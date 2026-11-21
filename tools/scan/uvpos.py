"""Step 1 of the Abidora scan pipeline (run in Blender):
   blender -b --factory-startup -P uvpos.py -- <model.glb|.gltf> <out.npz> [res=1024]
Rasterises every triangle of a scanned model into its texture (UV) space and stores, for each texel, the 3D
position and normal of the surface it belongs to. With that, a texel can be classified by where it sits on the
product (sole, toe, collar ...) as well as by its colour, which is how a single-texture scan is split into parts."""
import bpy, sys, numpy as np

a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]; R = int(a[2]) if len(a) > 2 else 1024
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.endswith(('.glb', '.gltf')): bpy.ops.import_scene.gltf(filepath=src)
elif src.endswith('.fbx'): bpy.ops.import_scene.fbx(filepath=src)
elif src.endswith('.obj'): bpy.ops.wm.obj_import(filepath=src)
dg = bpy.context.evaluated_depsgraph_get()
P = []; N = []; U = []; MAT = []
for o in bpy.context.scene.objects:
    if o.type != 'MESH': continue
    oe = o.evaluated_get(dg); me = oe.to_mesh(); me.calc_loop_triangles()
    if not me.uv_layers: continue
    uv = me.uv_layers.active.data; mw = o.matrix_world; nw = mw.to_3x3().inverted().transposed()
    co = np.array([mw @ v.co for v in me.vertices]); vn = np.array([(nw @ v.normal).normalized() for v in me.vertices])
    for t in me.loop_triangles:
        P.append(co[list(t.vertices)]); N.append(vn[list(t.vertices)]); U.append([uv[l].uv[:] for l in t.loops]); MAT.append(t.material_index)
    oe.to_mesh_clear()
P = np.array(P); N = np.array(N); U = np.array(U)
print('triangles', len(P))
pos = np.full((R, R, 3), np.nan, np.float32); nrm = np.zeros((R, R, 3), np.float32)
uvp = U.copy(); uvp[..., 0] = uvp[..., 0] * R - .5; uvp[..., 1] = (1 - uvp[..., 1]) * R - .5   # image rows go down
for k in range(len(P)):
    t = uvp[k]; x0, y0 = np.floor(t.min(0)).astype(int); x1, y1 = np.ceil(t.max(0)).astype(int)
    x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, R - 1), min(y1, R - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    (ax, ay), (bx, by), (cx, cy) = t
    d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(d) < 1e-12: continue
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d; w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d; w2 = 1 - w0 - w1
    m = (w0 >= -.02) & (w1 >= -.02) & (w2 >= -.02)
    if not m.any(): continue
    W = np.stack([w0[m], w1[m], w2[m]], 1)
    pos[ys[m], xs[m]] = W @ P[k]; nrm[ys[m], xs[m]] = W @ N[k]
lo = np.nanmin(P.reshape(-1, 3), 0); hi = np.nanmax(P.reshape(-1, 3), 0)
np.savez_compressed(out, pos=pos, nrm=nrm, lo=lo, hi=hi)
print('UVPOS', out, 'filled', int(np.isfinite(pos[..., 0]).sum()), 'of', R * R, 'bbox', lo, hi)
