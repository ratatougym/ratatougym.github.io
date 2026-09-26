"""Bake the demo room's diffuse lighting with Blender Cycles, then export it."""

import argparse
import json
from pathlib import Path
import sys

import bpy


def make_box(name, dimensions, position, color):
    # Inputs use the browser's x/right, y/up, z/forward convention.
    x, y, z = position
    width, height, depth = dimensions
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -z, y))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (width, depth, height)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Bevels expose narrow lit edges instead of perfectly sharp box silhouettes.
    bevel = obj.modifiers.new('Soft edges', 'BEVEL')
    bevel.width = 0.045
    bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    material = bpy.data.materials.new(name)
    material.use_nodes = True

    # A matte surface makes the baked result independent of viewing direction.
    nodes = material.node_tree.nodes
    nodes.clear()
    diffuse = nodes.new('ShaderNodeBsdfDiffuse')
    diffuse.inputs['Color'].default_value = (*color, 1)
    output = nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(diffuse.outputs[0], output.inputs['Surface'])
    obj.data.materials.append(material)
    return obj


def bake(output):
    # Keep the one-time bake bounded and independent of the simulator runtime.
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 96
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 8

    # The front walls are cut down to leave the physical trajectory visible.
    make_box('Floor slab', (10.56, 0.36, 10.56), (0, -0.18, 0), (0.62, 0.60, 0.55))
    make_box('Back wall', (10.56, 1.65, 0.28), (0, 0.825, -5.14), (0.73, 0.74, 0.71))
    make_box('Side wall', (0.28, 1.65, 10.56), (-5.14, 0.825, 0), (0.73, 0.74, 0.71))
    make_box('Front edge', (10.56, 0.20, 0.28), (0, 0.10, 5.14), (0.73, 0.74, 0.71))
    make_box('Right edge', (0.28, 0.20, 10.56), (5.14, 0.10, 0), (0.73, 0.74, 0.71))

    # Bake all architectural pieces into one atlas, including contact shadows.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    room = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=0.015)
    bpy.ops.object.mode_set(mode='OBJECT')

    # A broad key light supplies soft shadows; the world supplies a dim fill.
    scene.world = bpy.data.worlds.new('Studio fill')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
    background.inputs['Strength'].default_value = 0.25
    light_data = bpy.data.lights.new('Softbox', 'AREA')
    light_data.energy = 1200
    light_data.shape = 'DISK'
    light_data.size = 4

    # Match this direction in the browser for the moving marker's shadow.
    light = bpy.data.objects.new('Softbox', light_data)
    scene.collection.objects.link(light)
    light.location = (-3, -4, 10)
    light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
    image = bpy.data.images.new('Room lighting', 1024, 1024, alpha=False)
    image.colorspace_settings.name = 'sRGB'

    # The image node is the bake target, not an input to the source material.
    for material in room.data.materials:
        nodes = material.node_tree.nodes
        target = nodes.new('ShaderNodeTexImage')
        target.image = image
        nodes.active = target
    scene.render.bake.margin = 8
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR', 'DIRECT', 'INDIRECT'})

    # The texture contains actual illumination, not only the material color.
    image.filepath_raw = str(output / 'room-lighting.png')
    image.file_format = 'PNG'
    image.save()
    mesh = room.data
    mesh.calc_loop_triangles()
    uv_layer = mesh.uv_layers.active.data
    positions, uvs = [], []

    # Expand triangle corners to keep each UV seam intact in Three.js.
    for triangle in mesh.loop_triangles:
        for loop_index in triangle.loops:
            vertex = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            positions.extend(round(value, 6) for value in (vertex.x, vertex.z, -vertex.y))
            uvs.extend(round(value, 6) for value in uv_layer[loop_index].uv)
    payload = dict(positions=positions, uvs=uvs, texture='room-lighting.png',
                   blender=bpy.app.version_string, engine='Cycles', samples=96,
                   lighting_baked=True, passes=['COLOR', 'DIRECT', 'INDIRECT'])
    (output / 'room.json').write_text(json.dumps(payload, separators=(',', ':')) + '\n')
    print(f'Exported {len(positions) // 9} triangles and baked lighting to {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bake(args.output.resolve())
