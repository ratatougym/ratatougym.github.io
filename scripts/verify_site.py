"""Check the public build and record which Python source generated its API."""

import argparse
import json
from pathlib import Path
import subprocess


def verify(output, source):
    assert not (output / '.doctrees').exists(), 'Build cache in public output'
    home = (output / 'index.html').read_text()
    assert 'id="gallery"' in home, 'Root is not the interactive homepage'
    assert 'href="overview.html"' in home, 'Missing documentation navigation'
    required = {
        'rtgym.agent.html': (
            'rtgym.agent.control.TrajectoryGenerator',
            'rtgym.agent.neurons.Neurons',
        ),
        'rtgym.html': ('rtgym.dataclasses.AgentState', 'rtgym.dataclasses.Trajectory'),
        'rtgym.arena.arena_shapes.html': (
            'rtgym.arena.arena_shapes.box.generate_box_arena',
            'rtgym.arena.arena_shapes.hairpin.generate_hairpin_arena',
            'rtgym.arena.arena_shapes.carpenter_rooms.generate_carpenter_rooms_arena',
        ),
    }
    for page, anchors in required.items():
        html = (output / page).read_text()
        assert 'class="docs-page"' in html, f'Missing documentation theme: {page}'
        for anchor in anchors:
            assert f'id="{anchor}"' in html, f'Missing API: {anchor}'
    static = output / '_static'
    for name in ('room-gallery', 'scene-demo', 'scene-clips/build-cache.json'):
        assert not (static / name).exists(), f'Internal asset in public build: {name}'
    assert not list(output.rglob('*.usd')), 'USD source in public build'
    assert not list(output.rglob('*.glb')), '3D source in public build'
    clips = static / 'scene-clips'
    rooms = json.loads((clips / 'index.json').read_text())['rooms']
    assert len(rooms) == 36
    for room in rooms:
        for key in ('video', 'poster', 'hd_video'):
            path = (clips / room[key]).resolve()
            assert path.is_relative_to(clips.resolve()) and path.is_file(), room[key]
        assert (clips / room['video']).stat().st_size == room['bytes']
        assert (clips / room['hd_video']).stat().st_size == room['hd_bytes']
    commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    (output / 'build-info.json').write_text(json.dumps({
        'source_repository': 'ratatougym/ratatougym', 'source_commit': commit,
        'rooms': len(rooms),
    }, indent=2) + '\n')
    print(f'Public site verified: 36 complete rooms; API built from {commit}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    verify(args.output, args.source)
