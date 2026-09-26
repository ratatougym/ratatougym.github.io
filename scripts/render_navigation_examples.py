"""Render recorded navigation examples as shaded, open-roof room cutaways."""

import argparse
import json
import math
from pathlib import Path
import subprocess
import sys

import bpy
from mathutils import Vector


def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = 0.85
    return result


def translucent(surface):
    # Preserve the matte wall surface, while allowing the trajectory to show through.
    nodes, links = surface.node_tree.nodes, surface.node_tree.links
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = 0.32
    links.new(transparent.outputs[0], mix.inputs[1])
    links.new(nodes.get('Principled BSDF').outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], nodes.get('Material Output').inputs['Surface'])


def box(name, position, dimensions, surface):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Soft edges', 'BEVEL')
    bevel.width = 0.025
    bevel.segments = 3
    obj.data.materials.append(surface)
    return obj


def visible_walls(data):
    # Keep rear walls continuous, including where interior partitions meet them.
    if len(data['shape']) == 2:
        return data['walls']
    top, left = data['bounds'][0][-2:]
    bottom, right = [value + 1 for value in data['bounds'][1][-2:]]
    walls = [[0, top, 0, data['shape'][-1]], [top, bottom, 0, left]]

    # Clip the remaining wall footprints to the interior, omitting both front sides.
    for r0, r1, c0, c1 in data['walls']:
        r0, r1 = max(r0, top), min(r1, bottom)
        c0, c1 = max(c0, left), min(c1, right)
        if r0 < r1 and c0 < c1:
            walls.append([r0, r1, c0, c1])
    return walls


def animate(scene, source, data, points, curve, marker, args):
    # Replay the recorded movement at four times simulation speed, at 30 fps.
    frame_dir = args.frames / source.stem
    frame_dir.mkdir(parents=True, exist_ok=True)
    duration = (len(points) - 1) * data['dt_ms'] / 4000
    frame_count = math.ceil(duration * 30)
    if args.limit:
        frame_count = min(frame_count, args.limit)

    # Keep the room's original shading; composite its transparent margins in ffmpeg.
    scene.render.resolution_x, scene.render.resolution_y = 960, 720
    for frame in range(frame_count):
        step = min(frame / 30 * 4000 / data['dt_ms'], len(points) - 1.001)
        index = int(step)
        position = Vector(points[index]).lerp(Vector(points[index + 1]), step - index)
        marker.location = position
        recent = points[max(0, index - 300):index + 1] + [position]

        # A moving trail uses only actual segments, with no spline overshoot.
        curve.splines.clear()
        line = curve.splines.new('POLY')
        line.points.add(len(recent) - 1)
        for point, coord in zip(line.points, recent):
            point.co = (*coord, 1)
        scene.render.filepath = str(frame_dir / f'{frame:05d}.png')
        bpy.ops.render.render(write_still=True)

    # Match the page background and put playback metadata at the start of the MP4.
    composite = 'color=c=0xf0f2f3:s=960x720:r=30[bg];[bg][0:v]overlay=shortest=1:format=auto,format=yuv420p'
    encoded = frame_dir / 'encoded.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-framerate', '30',
                    '-i', str(frame_dir / '%05d.png'), '-frames:v', str(frame_count),
                    '-filter_complex', composite, '-c:v', 'libx264', '-crf', '20',
                    '-preset', 'slow', '-movflags', '+faststart',
                    str(encoded)], check=True)
    source.with_suffix('.mp4').write_bytes(encoded.read_bytes())


def render(source, args):
    data = json.loads(source.read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8

    # Offline GPU rendering preserves the existing Cycles lighting in the videos.
    preferences = bpy.context.preferences.addons['cycles'].preferences
    preferences.compute_device_type = 'OPTIX'
    preferences.get_devices()
    for device in preferences.devices:
        device.use = device.type == 'OPTIX'
    scene.cycles.device = 'GPU' if any(d.use for d in preferences.devices) else 'CPU'
    scene.cycles.denoising_use_gpu = True
    scene.render.use_persistent_data = True

    # Keep the same physical aspect ratio in all three examples.
    height, width = data['shape'][-2:]
    scale = 10 / max(height, width)
    flying = len(data['shape']) == 3
    # Matte light-gray surfaces retain shading instead of washing out the room.
    floor = material('Floor', (0.86, 0.87, 0.88))
    wall = material('Walls', (0.9, 0.91, 0.92))
    if flying:
        interior_wall = material('Interior walls', (0.9, 0.91, 0.92))
        translucent(interior_wall)
        rear_wall = material('Rear walls', (0.98, 0.98, 0.98))
        rear_shader = rear_wall.node_tree.nodes.get('Principled BSDF')
        rear_shader.inputs['Emission Color'].default_value = (1, 1, 1, 1)
        rear_shader.inputs['Emission Strength'].default_value = 1.0
        scene.cycles.transparent_max_bounces = 16
        scene.cycles.samples = 128
    box('Floor slab', (0, 0, -0.10), (width * scale, height * scale, 0.2), floor)

    # Remove the flight view's two foreground walls; retain full-height rear and interior walls.
    for index, (r0, r1, c0, c1) in enumerate(visible_walls(data)):
        outer_back = r1 <= 5 or c1 <= 5
        outer_front = r0 >= height - 5 or c0 >= width - 5
        if flying and outer_front:
            continue

        # Only the interior partitions are translucent; the white rear walls stay opaque.
        surface = wall
        wall_height = 0.9 if outer_back else 0.7
        if flying:
            surface = rear_wall if outer_back else interior_wall
            flight_height = data['bounds'][1][0] - data['bounds'][0][0] + 1
            wall_height = flight_height * scale + 0.12
        elif outer_front:
            wall_height = 0.18
        center = ((c0 + c1 - width) * scale / 2,
                  (height - r0 - r1) * scale / 2, wall_height / 2)
        box(f'Wall {index}', center, ((c1 - c0) * scale, (r1 - r0) * scale, wall_height), surface)

    # Every curve point comes from the recorded simulation, without spline overshoot.
    points = []
    for coord in data['coords']:
        row, col = coord[-2:]
        z = (coord[0] - data['bounds'][0][0]) * scale if flying else 0
        points.append(((col - width / 2) * scale, (height / 2 - row) * scale, z + 0.06))
    path_material = material('Trajectory', (0.04, 0.33, 0.8))
    curve = bpy.data.curves.new('Recorded path', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.032
    curve.bevel_resolution = 3
    line = curve.splines.new('POLY')
    line.points.add(len(points) - 1)
    for point, position in zip(line.points, points):
        point.co = (*position, 1)
    obj = bpy.data.objects.new('Trajectory', curve)
    scene.collection.objects.link(obj)
    obj.data.materials.append(path_material)

    # Mark the final recorded position without adding an artificial orientation.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.075, location=points[-1])
    marker = bpy.context.object
    marker.data.materials.append(path_material)
    bpy.ops.object.shade_smooth()

    # Directional key light separates wall orientations while soft fill keeps shadows light.
    scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.4
    lamp = bpy.data.lights.new('Softbox', 'AREA')
    lamp.energy = 2600
    lamp.size = 5
    light = bpy.data.objects.new('Softbox', lamp)
    scene.collection.objects.link(light)
    light.location = (-7, -3, 11)
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()

    # The cutaway view shows elevation changes in the 3D flight recording.
    camera = bpy.data.cameras.new('Camera')
    camera.type = 'ORTHO'
    camera.ortho_scale = 16.4
    eye = bpy.data.objects.new('Camera', camera)
    scene.collection.objects.link(eye)
    eye.location = (11, -14, 15)
    target = Vector((0, 0, 0.65 if flying else 0.1))
    eye.rotation_euler = (target - eye.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = eye

    # Transparent margins blend into the page without a separate image background.
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 820
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.filepath = str(source.with_suffix('.png'))
    bpy.ops.render.render(write_still=True)
    if args.animate:
        animate(scene, source, data, points, curve, marker, args)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--animate', action='store_true')
    parser.add_argument('--only', choices=['square', 'connected', 'house-3d'])
    parser.add_argument('--frames', type=Path, default=Path('/tmp/rtgym-blue-navigation-frames'))
    parser.add_argument('--limit', type=int, help='Render a short performance sample')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    for source in sorted(args.input.glob('*.json')):
        if not args.only or source.stem == args.only:
            render(source, args)
