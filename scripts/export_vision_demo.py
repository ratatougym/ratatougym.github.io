"""Export synthetic Vision response projections alongside the existing demo."""

import argparse
import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import torch
from rtgym import RatatouGym
from rtgym.agent.sensory.spatial_modulated import WeakSMCell
from rtgym.agent.sensory.movement_modulated import HeadDirectionCell
from export_home_demo import sample_fields


def heading_gain(headings):
    # Match wrapped Gaussian head-direction tuning, with fixed preferred angles.
    preferred = np.linspace(-np.pi, np.pi, 24, endpoint=False)
    difference = headings[:, None] - preferred[None, :]
    difference = (difference + np.pi) % (2 * np.pi) - np.pi
    return np.exp(-0.5 * (difference / (np.pi / 3)) ** 2)


def project(features, trace, reference, display):
    # Fit a single basis to all sampled states, then apply it to the trajectory.
    centered = features - features.mean(axis=0)
    covariance = centered.T @ centered
    values, vectors = np.linalg.eigh(covariance)
    basis = vectors[:, -3:][:, ::-1]
    cloud = centered @ basis
    path = (trace - features.mean(axis=0)) @ basis

    # Keep the same rigid alignment and uniform scaling as the original demo.
    left, _, right = np.linalg.svd(cloud.T @ reference)
    rotation = left @ right
    cloud, path = cloud @ rotation, path @ rotation
    scale = 9 / max(np.max(np.ptp(cloud, axis=0)), 1e-12)
    variance = float(values[-3:].sum() / values.sum())
    assert np.isfinite(cloud).all() and np.isfinite(path).all()

    # Densify only the displayed cloud; retain the fitted basis and trajectory.
    dense_cloud = (display - features.mean(axis=0)) @ basis @ rotation
    assert np.isfinite(dense_cloud).all()
    return dict(surface=np.round(dense_cloud * scale, 4).tolist(),
                path=np.round(path * scale, 4).tolist(),
                explained_variance=round(variance, 4))


def boundary_response_maps(arena, n_cells=24, res_dist=10):
    """Demo fields selective for one of the rectangular arena's four walls."""
    free = np.argwhere(arena.arena_map == 0)
    low, high = free.min(axis=0), free.max(axis=0)
    row, col = np.indices(arena.dimensions)
    distances = (row - low[0], high[0] - row, col - low[1], high[1] - col)

    # Six cells per wall vary in spatial range, independently of animal heading.
    maps = []
    for cell in range(n_cells):
        wall = cell // 6
        width = res_dist * (0.6 + 0.8 * (cell % 6) / 5)
        distance = np.maximum(distances[wall], 0) * arena.spatial_resolution
        maps.append(np.exp(-0.5 * (distance / width) ** 2))
    return np.asarray(maps)


def export(recording, output, boundary_only=False):
    # Preserve the exact recorded positions and the existing three sensor families.
    torch.set_num_threads(2)
    coords = np.asarray(recording['coords'])
    differences = np.diff(coords, axis=0, append=coords[-1:])
    differences[-1] = differences[-2]

    # Keep the last movement heading during stops, as the browser marker does.
    headings = np.zeros(len(coords))
    previous = 0.0
    for index, difference in enumerate(differences):
        if np.linalg.norm(difference) > 1e-8:
            previous = np.arctan2(difference[1], difference[0])
        headings[index] = previous

    # Build the same arena used to generate the existing recording.
    gym = RatatouGym(temporal_resolution=50, spatial_resolution=1, device='cpu')
    gym.init_arena_map(shape='rectangle', dimensions=[64, 64])

    # Preserve the original place/grid profiles and fix vision smoothness at 8 cm.
    common = dict(n_cells=24, seed=42, normalize=True)
    gym.agent.init_neurons(dict(
        place=dict(type='place_cell', sigma=14, **common),
        grid=dict(type='grid_cell', scale=40, **common)))
    groups = list(gym.agent.neuron_groups.values())
    vision = WeakSMCell(gym.arena, sensory_key='vision', sigma=8, **common)
    boundary_maps = boundary_response_maps(gym.arena)
    heading = HeadDirectionCell(gym.arena, sensory_key='heading', t_res=50,
                                sigma=np.pi / 3, **common)

    # Keep existing bit assignments; diffusion (bit 4) is no longer offered.
    spatial_maps = {1: groups[0].response_map, 2: groups[1].response_map,
                    8: vision.response_map, 32: boundary_maps}
    low, high = np.asarray(recording['bounds'])
    masks = [mask for mask in range(1, 64) if not mask & 4]
    for mode in ('panoramic', 'directional', 'combined'):
        directional = mode != 'panoramic'
        for mask in masks:
            if boundary_only and not mask & 32:
                continue
            # Vision-off combinations share one file; combined includes both vision families.
            if directional and not mask & 8:
                continue
            heading_domain = bool(mask & 16) or (directional and bool(mask & 8))
            side = 20 if heading_domain else 40
            rows = np.linspace(low[0], high[0], side)
            cols = np.linspace(low[1], high[1], side)
            rr, cc = np.meshgrid(rows, cols, indexing='ij')
            samples = np.column_stack([rr.ravel(), cc.ravel()])

            # Include twelve headings whenever any selected response uses heading.
            if heading_domain:
                angles = np.linspace(-np.pi, np.pi, 12, endpoint=False)
                samples = np.tile(samples, (len(angles), 1))
                state_headings = np.repeat(angles, side * side)
            else:
                state_headings = np.zeros(len(samples))
            # Display 16 times as many points without changing the PCA fitting states.
            dense_side = 40 if heading_domain else 160
            dense_rows = np.linspace(low[0], high[0], dense_side)
            dense_cols = np.linspace(low[1], high[1], dense_side)
            dense_rr, dense_cc = np.meshgrid(dense_rows, dense_cols, indexing='ij')
            dense_samples = np.column_stack([dense_rr.ravel(), dense_cc.ravel()])

            # Directional clouds cover both spatial positions and heading angles.
            if heading_domain:
                dense_angles = np.linspace(-np.pi, np.pi, 16, endpoint=False)
                dense_samples = np.tile(dense_samples, (len(dense_angles), 1))
                dense_headings = np.repeat(dense_angles, dense_side * dense_side)
            else:
                dense_headings = np.zeros(len(dense_samples))
            fields, traces, displays = [], [], []
            for bit in (1, 2, 8, 16, 32):
                if not mask & bit:
                    continue

                # Evaluate the simulator's head-direction model on the same headings.
                if bit == 16:
                    state = SimpleNamespace(hds=state_headings[None, :, None])
                    trajectory = SimpleNamespace(hds=headings[None, :, None])
                    field = heading.get_response(state)[0]
                    trace = heading.get_response(trajectory)[0]
                    dense_state = SimpleNamespace(hds=dense_headings[None, :, None])
                    display = heading.get_response(dense_state)[0]
                else:
                    maps = np.asarray(spatial_maps[bit])
                    field = sample_fields(maps, samples)
                    trace = sample_fields(maps, coords)
                    display = sample_fields(maps, dense_samples)

                # Keep the panoramic family as well when both vision sensors are selected.
                if bit == 8 and mode == 'combined':
                    scale = max(np.sqrt(np.var(field, axis=0).sum()), 1e-12)
                    fields.append(field / scale)
                    traces.append(trace / scale)
                    displays.append(display / scale)

                # Directional vision combines spatial responses with heading tuning.
                if bit == 8 and directional:
                    field *= heading_gain(state_headings)
                    trace *= heading_gain(headings)
                    display *= heading_gain(dense_headings)
                scale = max(np.sqrt(np.var(field, axis=0).sum()), 1e-12)
                fields.append(field / scale)
                traces.append(trace / scale)
                displays.append(display / scale)

            # All selections have 25,600 displayed points for matching transition buffers.
            reference = np.column_stack([samples[:, 1], np.zeros(len(samples)), samples[:, 0]])
            reference -= reference.mean(axis=0)
            features = np.concatenate(fields, axis=1)
            trace = np.concatenate(traces, axis=1)
            display = np.concatenate(displays, axis=1)
            projection = project(features, trace, reference, display)

            # Record the source models and fixed parameters beside the exported PCA.
            result = dict(projection=projection, mask=mask, cells_per_family=24,
                          source_revision=recording['revision'], seed=42,
                          pca_domain='position + heading' if heading_domain else 'position',
                          vision_sigma_cm=8, vision_directional=directional,
                          vision_combined=mode == 'combined',
                          heading_sigma_rad=np.pi / 3, boundary_res_dist_cm=10,
                          boundary_model='wall-selective Gaussian demo fields',
                          models=['PlaceCell', 'GridCell', 'WeakSMCell',
                                  'HeadDirectionCell', 'WallSelectiveBoundary'])
            path = output / f'{mode}-{mask}.json'
            path.write_text(json.dumps(result, separators=(',', ':')) + '\n')
            print(f'Exported {path}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--recording', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--boundary-only', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    export(json.loads(args.recording.read_text()), args.output, args.boundary_only)
