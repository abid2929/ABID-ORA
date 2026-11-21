"""Step 2 of the Abidora scan pipeline (system python 3 with numpy + Pillow):
   python3 zones.py preview <uvpos.npz> <out.png> K tex1.jpg [tex2.jpg ...]   -> colour clusters, to read and name
   python3 zones.py build <spec.json>                                          -> zone map PNG + stats JSON
A scanned product has one photographic texture. This splits that texture into named parts (zones) using two kinds
of evidence per texel: its colour (clusters, across every colourway texture the scan ships with) and its place on
the product (height, length, side, facing direction, from step 1). The result is a small index image (the zone of
every texel) and, per zone, the mean brightness of the original, so the studio can recolour a part while keeping
the scan's own shading, grain, wrinkles and stitching."""
import sys, json, numpy as np
from PIL import Image


def load_tex(paths, R):
    return [np.asarray(Image.open(p).convert('RGB').resize((R, R), Image.BILINEAR), np.float32) / 255 for p in paths]


def srgb2lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)


def kmeans(X, K, it=30, seed=1):
    rng = np.random.default_rng(seed); C = X[rng.choice(len(X), K, replace=False)]
    for _ in range(it):
        d = ((X[:, None, :] - C[None]) ** 2).sum(-1); L = d.argmin(1)
        for k in range(K):
            if (L == k).any(): C[k] = X[L == k].mean(0)
    return C, L


def features(texs, valid):
    return np.concatenate([t[valid] for t in texs], 1)


def dilate(zm, empty=255, n=8):
    z = zm.copy()
    for _ in range(n):
        m = z == empty
        if not m.any(): break
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sh = np.roll(np.roll(z, dy, 0), dx, 1); fill = m & (sh != empty); z[fill] = sh[fill]; m = z == empty
    z[z == empty] = 0
    return z


def norm_pos(npz):
    pos, lo, hi = npz['pos'], npz['lo'], npz['hi']
    return (pos - lo) / np.maximum(hi - lo, 1e-9)


if sys.argv[1] == 'preview':
    npz = np.load(sys.argv[2]); out = sys.argv[3]; K = int(sys.argv[4]); paths = sys.argv[5:]
    R = npz['pos'].shape[0]; valid = np.isfinite(npz['pos'][..., 0]); texs = load_tex(paths, R)
    X = features(texs, valid); sub = X[np.random.default_rng(0).choice(len(X), min(60000, len(X)), replace=False)]
    C, _ = kmeans(sub, K); L = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
    pal = np.array([[230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200], [245, 130, 48], [145, 30, 180], [70, 240, 240], [240, 50, 230], [210, 245, 60], [250, 190, 212], [0, 128, 128], [170, 110, 40]], np.uint8)
    img = np.zeros((R, R, 3), np.uint8); img[valid] = pal[L % len(pal)]
    Image.fromarray(img).resize((512, 512), Image.NEAREST).save(out)
    np.save(out + '.centres.npy', C)
    for k in range(K): print('cluster', k, 'colour', pal[k % len(pal)].tolist(), 'texels', int((L == k).sum()), 'centre', np.round(C[k], 3).tolist())
    sys.exit()

# ---------- build ----------
spec = json.load(open(sys.argv[2])); base = spec.get('dir', '.')
npz = np.load(base + '/' + spec['uvpos']); R = npz['pos'].shape[0]; valid = np.isfinite(npz['pos'][..., 0])
P = norm_pos(npz); Nn = npz['nrm']
texs = load_tex([base + '/' + p for p in spec['textures']], R)
X = features(texs, valid)
cl = None
if 'clusters' in spec:
    C = np.load(base + '/' + spec['clusters']); cl = np.full((R, R), -1); cl[valid] = ((X[:, None, :] - C[None]) ** 2).sum(-1).argmin(1)
ax = spec.get('axes', {'len': 0, 'side': 1, 'up': 2})
def coord(name): return P[..., ax[name]]
zm = np.full((R, R), 255, np.uint8)
for zi, zn in enumerate(spec['zones']):
    for rule in zn.get('rules', [{}]):
        m = valid & (zm == 255)
        for key, v in rule.items():
            if key in ('len', 'side', 'up'): c = coord(key); m &= (c >= v[0]) & (c <= v[1])
            elif key == 'cluster': m &= np.isin(cl, v)
            elif key == 'facing':   # normal direction, e.g. {"facing": [2, -1, -0.5]} : axis, sign, min dot
                a_, s_, t_ = v; m &= (Nn[..., a_] * s_) >= t_
            elif key in ('sat', 'val'):   # HSV saturation / value range of texture 0: {"sat": [0.3, 1]}
                t0 = texs[0]; mx = t0.max(-1); mn = t0.min(-1)
                q = mx if key == 'val' else np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0); m &= (q >= v[0]) & (q <= v[1])
            elif key == 'inward':   # normal points into the product (lining, insole): dot(normal, pos - centre line) <= -v
                d = P - .5; d[..., ax['len']] = 0; dn = np.linalg.norm(d, axis=-1) + 1e-6
                m &= (Nn * d).sum(-1) / dn <= -v
            elif key == 'tex':      # a channel of texture i in a range, e.g. the scan's occlusion map: [1, 0, 0, 0.45]
                i, ch, lo_, hi_ = v; m &= (texs[i][..., ch] >= lo_) & (texs[i][..., ch] <= hi_)
            elif key == 'edge':     # within v texels of a UV island border (piping, hems)
                from scipy import ndimage as nd
                m &= nd.distance_transform_edt(valid) <= v
            elif key == 'near':     # colour near a hex in texture i: [i, "#rrggbb", tolerance]
                i, hx, tol = v; c = np.array([int(hx[k:k + 2], 16) for k in (1, 3, 5)]) / 255; m &= np.linalg.norm(texs[i] - c, axis=-1) <= tol
        zm[m] = zi
zm[valid & (zm == 255)] = len(spec['zones']) - 1   # anything unmatched joins the last zone

# ---------- island pass: a UV island is one cut piece of the product, so it usually belongs to one part ----------
# "islands": {"vote": true, "min": 200, "rules": [{"zone": "laces", "max": 6000, "span": {"side": [0.3, 1]}, "majority": ["laces", "lining"]}]}
# rules are tried in order and claim the whole island; otherwise, with vote, the island takes its majority zone.
# This removes the speckle that colour clustering leaves where two parts share the same colour.
isl = spec.get('islands')
if isl:
    from scipy import ndimage as nd
    ids = {z['id']: i for i, z in enumerate(spec['zones'])}
    lab, nlab = nd.label(valid, structure=np.ones((3, 3)))
    for li in range(1, nlab + 1):
        m = lab == li; size = int(m.sum())
        if size < isl.get('min', 200): continue
        cnt = np.bincount(zm[m], minlength=len(spec['zones']))[:len(spec['zones'])]; maj = int(cnt.argmax())
        pts = P[m]; pick = None
        for r in isl.get('rules', []):
            ok = r.get('min', 0) <= size <= r.get('max', 1 << 30)
            for a, (lo_, hi_) in r.get('span', {}).items():
                q = np.percentile(pts[:, ax[a]], [5, 95]); ok &= lo_ <= q[1] - q[0] <= hi_
            for a, (lo_, hi_) in r.get('at', {}).items():
                ok &= lo_ <= float(np.median(pts[:, ax[a]])) <= hi_
            if 'majority' in r: ok &= spec['zones'][maj]['id'] in r['majority']
            if ok: pick = ids[r['zone']]; break
        if pick is None and isl.get('vote'): pick = maj
        if pick is not None: zm[m] = pick
sm = spec.get('smooth', 0)   # majority filter (radius in texels) to remove salt-and-pepper from colour rules
if sm:
    from scipy import ndimage as nd
    nz = len(spec['zones']); best = np.zeros(zm.shape, np.float32) - 1; lab = zm.copy()
    for zi in range(nz):
        f = nd.uniform_filter(((zm == zi) & valid).astype(np.float32), 2 * sm + 1); w = f > best; best[w] = f[w]; lab[w] = zi
    zm = np.where(valid, lab, zm).astype(np.uint8)
zm = dilate(zm)
out = base + '/' + spec['out']
Image.fromarray(zm).save(out + '.png', optimize=True)
lw = np.array([.2126, .7152, .0722])
stats = {'zones': []}
for zi, zn in enumerate(spec['zones']):
    m = valid & (zm == zi); e = {'id': zn['id'], 'label': zn['label'], 'texels': int(m.sum()), 'lum': [], 'hex': []}
    for t in texs:
        if m.any():
            lin = srgb2lin(t[m]); e['lum'].append(round(float((lin @ lw).mean()), 4))
            mc = t[m].mean(0); e['hex'].append('#' + ''.join(f'{int(round(v * 255)):02x}' for v in mc))
        else: e['lum'].append(.2); e['hex'].append('#808080')
    stats['zones'].append(e)
json.dump(stats, open(out + '.json', 'w'), indent=1)
pal = np.array([[230, 25, 75], [60, 180, 75], [255, 225, 25], [0, 130, 200], [245, 130, 48], [145, 30, 180], [70, 240, 240], [240, 50, 230], [210, 245, 60], [250, 190, 212]], np.uint8)
img = np.zeros((R, R, 3), np.uint8); img[valid] = pal[zm[valid] % len(pal)]
Image.fromarray(img).resize((512, 512), Image.NEAREST).save(out + '.preview.png')
print('ZONES', [(z['id'], z['texels']) for z in stats['zones']])
