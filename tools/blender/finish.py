"""Shared finish for the Abidora model builders: turns every part into a plain mesh, bakes ambient occlusion
(the soft shadow in seams, under overlays, round eyelets and between lugs) into a vertex colour with Cycles,
and exports a GLB. The occlusion lives in COLOR_0, so the studio can recolour every part freely and the
contact shadows stay physically placed."""
import bpy


def bake_and_export(out, hi=True, distance=.012, strength=.8, samples=None, skip=('print_',)):
    """skip: name prefixes of see-through decal surfaces, which must not cast occlusion on the cloth below"""
    sc = bpy.context.scene
    for o in sc.objects: o.select_set(o.type in ('MESH', 'CURVE'))
    meshes = [o for o in sc.objects if o.type in ('MESH', 'CURVE')]
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.convert(target='MESH')   # applies solidify / bevel modifiers and turns curves into meshes
    meshes = [o for o in sc.objects if o.type == 'MESH' and len(o.data.vertices)]
    if sc.world is None: sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = distance
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = samples or (48 if hi else 16); sc.cycles.use_denoising = False
    for o in meshes:
        me = o.data
        while me.color_attributes: me.color_attributes.remove(me.color_attributes[0])
        a = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = a
    decals = [o for o in meshes if o.name.startswith(skip)]
    for o in decals: o.hide_render = True
    bakeable = [o for o in meshes if o not in decals]
    for o in sc.objects: o.select_set(o in bakeable)
    bpy.context.view_layer.objects.active = bakeable[0]
    try:
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
        ok = True
    except Exception as e:   # never ship a broken model: export without occlusion and say so
        print('AO BAKE FAILED', e); ok = False
    for o in meshes:
        a = o.data.color_attributes.get('Col')
        if not a: continue
        for d in a.data:
            v = d.color[0] if ok and o not in decals else 1.0
            v = 1 - (1 - min(1.0, max(0.0, v))) * strength
            d.color = (v, v, v, 1)
    for o in decals: o.hide_render = False
    for o in sc.objects: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True, use_selection=False,
                              export_texcoords=True, export_normals=True, export_materials='EXPORT', export_colors=True)
    print('AO', 'ok' if ok else 'skipped', len(meshes), 'meshes')
