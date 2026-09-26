"""Export example response fields and traces for the homepage's encoding view."""

import json
from pathlib import Path
import subprocess
from types import SimpleNamespace

import numpy as np
import rtgym
import torch
from rtgym import RatatouGym
from rtgym.agent.sensory.spatial_modulated import WeakSMCell
from rtgym.agent.sensory.movement_modulated import HeadDirectionCell
from export_home_demo import sample_fields
from export_vision_demo import heading_gain, boundary_response_maps


def export(recording):
    # Match the models, seeds and arena used by export_vision_demo.py.
    torch.set_num_threads(2)
    gym = RatatouGym(temporal_resolution=50, spatial_resolution=1, device='cpu')
    gym.init_arena_map(shape='rectangle', dimensions=[64, 64])
    common = dict(n_cells=24, seed=42, normalize=True)
    gym.agent.init_neurons(dict(
        place=dict(type='place_cell', sigma=14, **common),
        grid=dict(type='grid_cell', scale=40, **common)))

    # Directional vision uses the same spatial field as panoramic vision.
    vision = WeakSMCell(gym.arena, sensory_key='vision', sigma=8, **common)
    boundary_maps = boundary_response_maps(gym.arena)
    heading = HeadDirectionCell(gym.arena, sensory_key='heading', t_res=50,
                                sigma=np.pi / 3, **common)
    groups = list(gym.agent.neuron_groups.values())

    # Retain the last movement heading during stationary samples.
    coords = np.asarray(recording['coords'])
    differences = np.diff(coords, axis=0, append=coords[-1:])
    differences[-1] = differences[-2]
    headings = np.zeros(len(coords))
    for index, delta in enumerate(differences):
        moving = np.linalg.norm(delta) > 1e-8
        headings[index] = np.arctan2(delta[1], delta[0]) if moving else headings[index - 1]

    # Sample the entire room, with row/column order matching the physical view.
    side = 48
    low, high = np.asarray(recording['bounds'])
    rows = np.linspace(low[0], high[0], side)
    cols = np.linspace(low[1], high[1], side)
    rr, cc = np.meshgrid(rows, cols, indexing='ij')
    samples = np.column_stack([rr.ravel(), cc.ravel()])

    # Eight examples cover all four preferred walls in the boundary family.
    examples = [0, 3, 6, 9, 12, 15, 18, 21]
    maps = {8: vision.response_map, 64: vision.response_map,
            1: groups[0].response_map, 2: groups[1].response_map,
            32: boundary_maps}
    labels = {8: 'Vision', 64: 'Dir. vision', 1: 'Place', 2: 'Grid',
              16: 'Heading', 32: 'Boundary'}
    gains = heading_gain(headings)

    # Head-direction cells are spatially uniform at any fixed heading.
    state = SimpleNamespace(hds=headings[None, :, None])
    heading_trace = np.asarray(heading.get_response(state)[0])
    families = []
    for bit, label in labels.items():
        if bit == 16:
            fields = np.ones((side * side, 24))
            trace = heading_trace
            gain = heading_trace
        else:
            spatial = torch.as_tensor(maps[bit]).numpy()
            fields = sample_fields(spatial, samples)
            trace = sample_fields(spatial, coords)
            gain = gains if bit == 64 else None
            if gain is not None:
                trace = trace * gain

        # One fixed [0, 1] scale is shared by the field and its encoding row.
        channels = []
        for cell in examples:
            field, values = fields[:, cell], trace[:, cell]
            assert np.isfinite(field).all() and np.isfinite(values).all()
            assert field.min() >= 0 and field.max() <= 1.00001
            assert values.min() >= 0 and values.max() <= 1.00001
            channel = dict(cell=cell, field=np.round(field, 5).tolist(),
                           trace=np.round(values, 5).tolist())
            if gain is not None:
                channel['gain'] = np.round(gain[:, cell], 5).tolist()
            channels.append(channel)
        families.append(dict(bit=bit, label=label, channels=channels))

    # Record provenance alongside the samples used by all synchronized views.
    source = Path(rtgym.__file__).resolve().parent.parent
    revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'])
    return dict(side=side, steps=recording['steps'], dt_ms=recording['dt_ms'],
                bounds=recording['bounds'], source_revision=revision.decode().strip(),
                boundary_model='wall-selective Gaussian demo fields', families=families)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    assets = root / '_static' / 'demos'
    recording = json.loads((assets / 'neural-replay.json').read_text())
    result = export(recording)
    target = assets / 'response-fields.json'
    target.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'Exported {len(result["families"])} sensor families to {target}')
