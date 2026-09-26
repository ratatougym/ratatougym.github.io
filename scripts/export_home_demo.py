"""Export one RatatouGym trajectory and PCA projections of spatial responses."""

import argparse
import json
from pathlib import Path
import subprocess

import numpy as np
import torch
from rtgym import RatatouGym


def sample_fields(fields, coords):
    # Interpolate the cached spatial maps at continuous room coordinates.
    row, col = coords.T
    r0, c0 = np.floor(coords).astype(int).T
    dr, dc = row - r0, col - c0
    a = fields[:, r0, c0] * (1 - dr) * (1 - dc)
    b = fields[:, r0 + 1, c0] * dr * (1 - dc)
    c = fields[:, r0, c0 + 1] * (1 - dr) * dc
    d = fields[:, r0 + 1, c0 + 1] * dr * dc
    return (a + b + c + d).T


def project_maps(features, path_features, reference):
    # Fit PCA across room positions, not just the visited trajectory.
    mean = features.mean(axis=0)
    centered = features - mean
    _, values, axes = np.linalg.svd(centered, full_matrices=False)
    basis = axes[:3].T
    surface = centered @ basis
    path = (path_features - mean) @ basis

    # A rigid alignment makes sensor combinations visually comparable.
    # It rotates the PCA subspace without injecting physical coordinates.
    left, _, right = np.linalg.svd(surface.T @ reference)
    rotation = left @ right
    surface = surface @ rotation
    path = path @ rotation
    scale = 9 / np.max(np.ptp(surface, axis=0))
    variance = np.sum(values[:3] ** 2) / np.sum(values ** 2)

    # Keep enough precision for continuous animation in the browser.
    assert np.isfinite(surface).all() and np.isfinite(path).all()
    return dict(surface=np.round(surface * scale, 4).tolist(),
                path=np.round(path * scale, 4).tolist(),
                explained_variance=round(float(variance), 4))


def export_demo(source):
    # Use actual simulator motion and spatial response generators.
    torch.set_num_threads(2)
    gym = RatatouGym(temporal_resolution=50, spatial_resolution=1, device='cpu')
    gym.init_arena_map(shape='rectangle', dimensions=[64, 64])
    control = dict(spd_mean=18, spd_sd=6, alpha_spd=0.2, alpha_dir=0.15,
                   switch_dir_prob=0.07, switch_spd_prob=0.05, boundary_avoidance=3)
    gym.agent.init_control(control)

    # Each sensor family contributes the same number of response channels.
    common = dict(n_cells=24, seed=42, normalize=True)
    profiles = dict(place=dict(type='place_cell', sigma=14, **common),
                    grid=dict(type='grid_cell', scale=40, **common),
                    diffusion=dict(type='diffusion_cell', sigma=9, **common))
    gym.agent.init_neurons(profiles)
    torch.manual_seed(73)
    coords = gym.agent.random_traverse(duration_ts=4096, batch_size=1).coord[0].numpy()
    assert gym.arena.validate_index(coords.astype(int)).all()

    # Use a regular free-space mesh so its physical connectivity is preserved.
    free = np.argwhere(gym.arena.arena_map == 0)
    low, high = free.min(axis=0), free.max(axis=0)
    rows = np.linspace(low[0], high[0], 40)
    cols = np.linspace(low[1], high[1], 40)
    rr, cc = np.meshgrid(rows, cols, indexing='ij')
    samples = np.column_stack([rr.ravel(), cc.ravel()])
    reference = np.column_stack([cc.ravel(), np.zeros(cc.size), rr.ravel()])
    reference -= reference.mean(axis=0)

    # Center and scale each family by its total spatial variance.
    # The same normalization is applied to trajectory samples.
    fields, traces, sensors = [], [], []
    for key, group in gym.agent.neuron_groups.items():
        maps = torch.as_tensor(group.response_map).numpy()
        spatial = sample_fields(maps, samples)
        trace = sample_fields(maps, coords)
        scale = max(np.sqrt(np.var(spatial, axis=0).sum()), 1e-12)
        fields.append(spatial / scale)
        traces.append(trace / scale)

        # Display one representative cell for each family on the room floor.
        example = spatial[:, 0]
        example = (example - example.min()) / max(np.ptp(example), 1e-12)
        sensors.append(dict(id=key, cells=24,
                            field=np.rint(example * 255).astype(int).tolist()))

    # Precompute every nonempty subset; toggles need no browser-side fitting.
    projections = {}
    for mask in range(1, 8):
        chosen = [index for index in range(3) if mask & (1 << index)]
        feature = np.concatenate([fields[index] for index in chosen], axis=1)
        path_feature = np.concatenate([traces[index] for index in chosen], axis=1)
        projections[str(mask)] = project_maps(feature, path_feature, reference)

    # Save provenance and the exact projection conventions beside the data.
    revision = subprocess.check_output(
        ['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    return dict(source='ratatougym/ratatougym', revision=revision, dt_ms=50,
                control_seed=73, cell_seed=42, steps=len(coords), grid_size=40,
                bounds=[low.tolist(), high.tolist()], coords=np.round(coords, 4).tolist(),
                sensors=sensors, projections=projections,
                method='Centered PCA; equal total variance per sensor family; '
                       'rigidly aligned to room axes; uniform display scale per subset. '
                       'Bilinear interpolation of simulator response maps.')


def main():
    # Keep exporting separate from the documentation build and browser runtime.
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    data = export_demo(args.source)

    # Store static data locally so the demo does not depend on a remote service.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, separators=(',', ':')) + '\n')
    print(f'Exported {data["steps"]} steps and 7 projections to {args.output}.')


if __name__ == '__main__':
    main()
