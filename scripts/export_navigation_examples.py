"""Record 2D and 3D navigation examples using grid_and_place's rtgym."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
import torch


def floor_boxes(occupied):
    # Merge identical horizontal runs into rectangular wall footprints.
    active, boxes = {}, []
    for row in range(occupied.shape[0] + 1):
        values = occupied[row] if row < len(occupied) else np.zeros(occupied.shape[1])
        edges = np.diff(np.pad(values.astype(int), (1, 1)))
        runs = list(zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)))
        current = set(runs)
        for run in list(active):
            if run not in current:
                boxes.append([active.pop(run), row, *run])
        for run in runs:
            active.setdefault(run, row)
    return [[int(value) for value in box] for box in boxes]


def record(source, output):
    # Import the requested repository, not the website's simulator environment.
    sys.path.insert(0, str(source.resolve()))
    from rtgym import RatatouGym
    torch.set_num_threads(2)
    revision = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD']).decode().strip()
    profile = dict(spd_mean=24, spd_sd=5, alpha_spd=0.15, alpha_dir=0.15,
                   switch_dir_prob=0.06, switch_spd_prob=0.08, boundary_avoidance=1)

    for name in ('square', 'connected', 'house-3d'):
        gym = RatatouGym(temporal_resolution=50, spatial_resolution=1, device='cpu')
        if name == 'square':
            gym.init_arena_map(shape='rectangle', dimensions=[64, 64])
        elif name == 'connected':
            gym.init_arena_map(shape='carpenter_rooms', room_width=48, room_height=52,
                               corridor_width=24, wall_thickness=3, opening_width=20)
        else:
            # Four rooms with doorways; the flight volume includes floor and ceiling.
            footprint = torch.zeros((96, 120))
            footprint[46:49, :] = 1
            footprint[:, 58:61] = 1
            footprint[46:49, 18:38] = 0
            footprint[46:49, 82:102] = 0
            footprint[14:34, 58:61] = 0
            footprint[62:82, 58:61] = 0
            volume = footprint[None].repeat(36, 1, 1)
            gym.arena.map_ = torch.nn.functional.pad(volume, (5, 5, 5, 5, 5, 5), value=1)

        # These are unmodified random-walk equations, with a fixed seed per arena.
        seed = {'square': 73, 'connected': 42, 'house-3d': 91}[name]
        gym.agent.init_control(profile)
        torch.manual_seed(seed)
        trajectory = gym.agent.random_traverse(duration_ts=6000, batch_size=8)
        paths = trajectory.coord.cpu().numpy()
        arena = gym.arena.map_.cpu().numpy()
        free = np.argwhere(arena == 0)
        low, high = free.min(axis=0), free.max(axis=0)

        # Select a continuous excerpt that explores the layout, without editing points.
        candidates = []
        length = 1000 if name == 'square' else 1800
        for agent, path in enumerate(paths):
            for start in range(0, len(path) - length, 300):
                part = path[start:start + length]
                probes = part[:-1, None] + np.linspace(0, 1, 8)[None, :, None] * np.diff(part, axis=0)[:, None]
                indices = probes.astype(int).reshape(-1, arena.ndim)
                if arena[tuple(indices.T)].any():
                    continue
                coverage = len(np.unique((part / 12).astype(int), axis=0))
                quadrants = part[:, -2:] > (low[-2:] + high[-2:]) / 2
                regions = len(np.unique(quadrants, axis=0))
                candidates.append((regions * 10000 + coverage, agent, start, part))
        if not candidates:
            raise RuntimeError(f'No collision-free excerpt for {name}')
        _, agent, start, coords = max(candidates, key=lambda item: item[0])

        # Store collision geometry and native axis order for reproducible rendering.
        footprint = arena[5] if arena.ndim == 3 else arena
        payload = dict(name=name, source='grasp-lyrl/grid_and_place', revision=revision,
                       source_control_sha256=hashlib.sha256((source / 'rtgym/agent/control.py').read_bytes()).hexdigest(),
                       seed=seed, profile=profile, dt_ms=50, agent=agent, start=start,
                       axes='height,row,column' if arena.ndim == 3 else 'row,column',
                       bounds=[low.tolist(), high.tolist()], shape=list(arena.shape),
                       walls=floor_boxes(footprint), coords=np.round(coords, 5).tolist())
        output.mkdir(parents=True, exist_ok=True)
        (output / f'{name}.json').write_text(json.dumps(payload, separators=(',', ':')) + '\n')
        print(name, 'range=', np.ptp(coords, axis=0), 'samples=', len(coords), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    record(args.source, args.output)
