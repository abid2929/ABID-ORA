"""Abidora garment builder for Blender 4.x (run headless):
   blender -b --factory-startup -P garment.py -- <model> <variant> <lod hi|lo> <out.glb>
   model/variant: hoodie regular|oversized ; tee crew|vneck ; shirt long|short ; jeans straight|wide
Builds an original garment as a ghost-mannequin product model: the body is a lofted surface with real cloth thickness
(the inside is its own lining zone), set-in sleeves with drape folds, rib bands, a down hood that rolls over the back,
pockets, plackets, collars, buttons, drawstrings and real top-stitching. Each part is a named material zone
(zone_body, zone_sleeves, zone_hood, zone_pocket, zone_cuffs, zone_hem, zone_collar, zone_placket, zone_buttons,
zone_strings, zone_aglets, zone_inside, zone_thread, zone_waistband, zone_hardware, zone_patch ...) so the Abidora
studio can colour and re-material each part on its own. print_front / print_back are decal surfaces with 0..1 UVs for
the user's own graphics and text. Units are metres. Blender axes: X = wearer's left, -Y = front, Z = up. All original."""
import bpy, bmesh, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['hoodie', 'regular', 'hi', '/tmp/g.glb']
MODEL, VAR, LOD, OUT = argv[:4]
HI = LOD == 'hi'
for o in list(bpy.data.objects): bpy.data.objects.remove(o)


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def curve(pts):
    T = [p[0] for p in pts]; V = [p[1] for p in pts]; n = len(pts)
    M = []
    for i in range(n):
        a, b = max(0, i - 1), min(n - 1, i + 1)
        M.append((V[b] - V[a]) / (T[b] - T[a]) if T[b] != T[a] else 0)
    def f(t):
        if t <= T[0]: return V[0]
        if t >= T[-1]: return V[-1]
        i = 0
        while T[i + 1] < t: i += 1
        h = T[i + 1] - T[i]; s = (t - T[i]) / h
        return (2 * s ** 3 - 3 * s ** 2 + 1) * V[i] + (s ** 3 - 2 * s ** 2 + s) * h * M[i] + (-2 * s ** 3 + 3 * s ** 2) * V[i + 1] + (s ** 3 - s ** 2) * h * M[i + 1]
    return f


def spow(v, e): return math.copysign(abs(v) ** e, v)


# ---------- folds: individual ridges and valleys placed like real cloth folds, not a repeating wave ----------
import random
RNG = random.Random(hash((MODEL, VAR)) & 0xffff)


def ridge(d, w):
    return math.exp(-(d / w) ** 2)


def wrapd(a):
    return (a + math.pi) % (2 * math.pi) - math.pi


def make_torso_folds(n_hem, hem_h, side=True, belt=None):
    F = []
    for k in range(n_hem):   # drape folds rising from the hem, alternating ridge / valley
        F.append(('hem', RNG.uniform(-math.pi, math.pi), RNG.uniform(.02, .045), RNG.uniform(.0035, .008) * (1 if k % 2 else -.8), RNG.uniform(hem_h * .45, hem_h)))
    if side:
        for sd in (0.0, math.pi):   # tension folds running from the armpit down and in
            for k in range(3):
                F.append(('diag', sd + RNG.uniform(-.25, .25), RNG.uniform(.012, .02), RNG.uniform(.003, .0055), RNG.uniform(-1.2, 1.2), RNG.uniform(.1, .22), k))
    if belt is not None:
        for k in range(6):
            F.append(('belt', RNG.uniform(-math.pi, math.pi), RNG.uniform(.015, .03), RNG.uniform(.004, .009) * (1 if k % 2 else -.7), belt))
    return F


def torso_fold(F, z, th, zh, ZS, Rm):
    r = 0.0
    for f in F:
        if f[0] == 'hem':
            _, t0, w, a, hh = f
            r += a * ridge(wrapd(th - t0) * Rm, w) * (1 - smooth(0, hh, z - zh)) ** 1.4
        elif f[0] == 'diag':
            _, t0, w, a, slope, ln, k = f
            z0 = ZS - .04 - .03 * k; zz = z0 - z
            if 0 < zz < ln:
                tc = t0 + slope * zz / Rm * .5
                r += a * ridge(wrapd(th - tc) * Rm, w) * math.sin(math.pi * zz / ln)
        elif f[0] == 'belt':
            _, t0, w, a, zb = f
            dz = z - zb
            if abs(dz) < .14: r += a * ridge(wrapd(th - t0) * Rm, w) * (1 - abs(dz) / .14) ** 1.5 * smooth(.012, .03, abs(dz))
    return r


def make_ring_folds(n, s0, s1, amp, lobes=2.5):
    return [(RNG.uniform(s0, s1), RNG.uniform(.006, .012), RNG.uniform(.6, 1) * amp * (1 if k % 2 else -.7), RNG.uniform(0, 6.28), lobes * RNG.uniform(.8, 1.2), RNG.uniform(.008, .02)) for k in range(n)]


def ring_fold(F, s, ph, bias=None):
    r = 0.0
    for s0, w, a, phase, lobes, zig in F:
        sc = s0 + zig * math.sin(ph * lobes + phase)
        wt = 1.0 if bias is None else (.35 + .65 * max(0, math.cos(ph - bias)))
        r += a * wt * ridge(s - sc, w)
    return r


# ---------- materials ----------
DEF = {'body': ((.20, .22, .26), .9), 'sleeves': ((.20, .22, .26), .9), 'hood': ((.20, .22, .26), .9), 'pocket': ((.20, .22, .26), .9),
       'cuffs': ((.18, .2, .24), .95), 'hem': ((.18, .2, .24), .95), 'collar': ((.18, .2, .24), .95), 'inside': ((.55, .55, .55), .95),
       'strings': ((.92, .92, .9), .8), 'aglets': ((.75, .75, .75), .3), 'thread': ((.25, .27, .3), .8), 'placket': ((.9, .9, .92), .85),
       'buttons': ((.95, .95, .93), .3), 'waistband': ((.2, .3, .5), .85), 'hardware': ((.72, .55, .3), .3), 'patch': ((.55, .38, .22), .6),
       'yoke': ((.9, .9, .92), .85), 'belt': ((.1, .08, .07), .5), 'zip': ((.7, .7, .72), .3), 'print': ((1, 1, 1), .8), 'legs': ((.2, .3, .5), .85), 'loops': ((.2, .3, .5), .85)}
MATS = {}


def mat(z):
    if z not in MATS:
        m = bpy.data.materials.new('zone_' + z); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']; c, r = DEF[z]
        b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = r
        if z in ('aglets', 'hardware'): b.inputs['Metallic'].default_value = 1.0
        MATS[z] = m
    return MATS[z]


def mesh_obj(name, verts, faces, uvs, zone, smooth_shade=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    uvl = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices): uvl.data[li].uv = uvs[vi]
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    me.materials.append(mat(zone))
    for p in me.polygons: p.use_smooth = smooth_shade
    return ob


def clean(ob, dist=1e-6):
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-7)
    bm.to_mesh(ob.data); bm.free()
    for p in ob.data.polygons: p.use_smooth = True


def solidify(ob, th, off=-1.0, inside='inside'):
    m = ob.modifiers.new('solid', 'SOLIDIFY'); m.thickness = th; m.offset = off; m.use_even_offset = False; m.use_quality_normals = True; m.use_rim = True
    if inside:
        ob.data.materials.append(mat(inside)); m.material_offset = 1; m.material_offset_rim = 1
    return m


def grid(name, P, na, nb, zone, metric=True, uv01=False, flip=False):
    """P(a, b) -> Vector, a, b in [0, 1]. metric UVs: 1 UV unit = 10 cm of cloth (patterns tile at true scale)."""
    pts = [[P(i / na, j / nb) for j in range(nb + 1)] for i in range(na + 1)]
    verts, uvs, faces = [], [], []
    for i in range(na + 1):
        for j in range(nb + 1):
            verts.append(pts[i][j])
            if uv01: uvs.append((i / na, j / nb))
            else:
                u = sum((pts[k + 1][j] - pts[k][j]).length for k in range(i)) * 10
                v = sum((pts[i][k + 1] - pts[i][k]).length for k in range(j)) * 10
                uvs.append((u, v))
    for i in range(na):
        for j in range(nb):
            a = i * (nb + 1) + j
            faces.append((a, a + 1, a + nb + 2, a + nb + 1) if flip else (a, a + nb + 1, a + nb + 2, a + 1))
    ob = mesh_obj(name, verts, faces, uvs, zone)
    if not uv01: clean(ob)
    return ob


# ---------- stitches: real thread dashes on the cloth ----------
STB = bmesh.new()


def stitch(path, nrm, pitch=.0045, lift=.0012):
    """path(u) -> Vector, nrm(u) -> Vector (outward). Lays thread dashes along the path."""
    P3 = [path(k / 300) + nrm(k / 300) * lift for k in range(301)]
    acc = [0.0]
    for k in range(300): acc.append(acc[-1] + (P3[k + 1] - P3[k]).length)
    n = int(acc[-1] / pitch)
    def at(d):
        k = 0
        while k < 299 and acc[k + 1] < d: k += 1
        f = (d - acc[k]) / max(1e-9, acc[k + 1] - acc[k]); return P3[k].lerp(P3[k + 1], f), k
    for i in range(n):
        a, k = at(i * pitch + .0004); b, _ = at(i * pitch + .0032)
        nr = nrm(k / 300); d = b - a
        if d.length < 1e-6: continue
        side = d.cross(nr).normalized() * .0005; up = nr * .0004
        vs = [STB.verts.new(p) for p in (a - side, a + side, b + side, b - side, a - side + up, a + side + up, b + side + up, b - side + up)]
        for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
            STB.faces.new([vs[j] for j in f])


def tube_curve(name, pts, r, zone, res=None):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = 3 if HI else 1
    cu.resolution_u = res or (8 if HI else 4); cu.use_fill_caps = True
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1)
    for p, q in zip(sp.points, pts): p.co = (*q, 1)
    sp.use_endpoint_u = True; sp.order_u = min(4, len(pts))
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob); cu.materials.append(mat(zone))
    return ob


def disc(name, c, nrm, r, h, zone, seg=None):
    seg = seg or (20 if HI else 10)
    bm = bmesh.new(); n = nrm.normalized(); t = n.orthogonal().normalized(); b = n.cross(t)
    ring0 = [bm.verts.new(c + (t * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * r) for k in range(seg)]
    ring1 = [bm.verts.new(c + n * h + (t * math.cos(2 * math.pi * k / seg) + b * math.sin(2 * math.pi * k / seg)) * r * .9) for k in range(seg)]
    bm.faces.new(ring1); bm.faces.new(list(reversed(ring0)))
    for k in range(seg): bm.faces.new((ring0[k], ring0[(k + 1) % seg], ring1[(k + 1) % seg], ring1[k]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    uvl = me.uv_layers.new(name='UVMap')
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); me.materials.append(mat(zone))
    for p in me.polygons: p.use_smooth = True
    return ob


NT = 120 if HI else 56   # around
NZ = 70 if HI else 30    # up


# =====================================================================================================================
#  TOPS: hoodie, tee, shirt
# =====================================================================================================================
TOPS = {
    'hoodie': dict(ZS=.66, n=2.4, A=[(0, .212), (.07, .236), (.3, .242), (.5, .246), (.6, .24), (.66, .228)],
                   B=[(0, .112), (.07, .128), (.35, .13), (.5, .132), (.66, .118)], NR=(.088, .078), NH=.058, dip=.045,
                   alpha=64, sleeve=.60, sr=[(0, .092), (.12, .08), (.3, .07), (.48, .064), (.53, .068), (.56, .062), (.6, .058)],
                   cuff=.07, hemband=.065, hood=True, pocket='kangaroo', strings=True),
    'tee': dict(ZS=.64, n=2.3, A=[(0, .232), (.3, .228), (.5, .234), (.64, .226)], B=[(0, .118), (.4, .12), (.64, .11)],
                NR=(.082, .07), NH=.056, dip=.05, alpha=52, sleeve=.20, sr=[(0, .095), (.1, .088), (.2, .084)], cuff=0, hemband=0),
    'shirt': dict(ZS=.70, n=2.4, A=[(0, .226), (.25, .216), (.5, .226), (.62, .226), (.7, .214)], B=[(0, .112), (.4, .114), (.55, .12), (.7, .11)],
                  NR=(.074, .066), NH=.062, dip=.028, alpha=66, sleeve=.60, sr=[(0, .088), (.12, .075), (.3, .064), (.5, .056), (.6, .052)],
                  cuff=.065, hemband=0, curvedhem=.055, placket=True, collar=True, chestpocket=True),
    # original Abidora outerwear: a belted double-breasted trench and a cafe-racer jacket, both cut for leather or cloth
    'coat': dict(ZS=1.02, n=2.4, A=[(0, .275), (.25, .245), (.52, .208), (.6, .21), (.8, .224), (.95, .222), (1.02, .212)],
                 B=[(0, .15), (.3, .132), (.52, .116), (.6, .118), (.8, .126), (1.02, .114)], NR=(.088, .078), NH=.05, dip=.10,
                 alpha=66, sleeve=.62, sr=[(0, .096), (.15, .084), (.35, .074), (.62, .067)], cuff=0, hemband=0, nhem=9, hemh=.55,
                 belt=.56, lapels=True, coatcollar=True, dbuttons=True, cuffstrap=True),
}

if MODEL in TOPS:
    P = dict(TOPS[MODEL])
    if MODEL == 'hoodie' and VAR == 'oversized':
        P['A'] = [(z, a * 1.09) for z, a in P['A']]; P['B'] = [(z, b * 1.05) for z, b in P['B']]
        P['ZS'] = .70; P['A'] = [(z * .70 / .66, a) for z, a in P['A']]; P['B'] = [(z * .70 / .66, b) for z, b in P['B']]
        P['alpha'] = 70; P['sleeve'] = .58; P['drop'] = .06; P['sr'] = [(0, .1), (.12, .088), (.3, .076), (.46, .07), (.5, .074), (.54, .066), (.58, .06)]
    if MODEL == 'coat' and VAR == 'jacket':
        P.update(ZS=.62, A=[(0, .212), (.05, .222), (.3, .228), (.5, .236), (.62, .222)], B=[(0, .118), (.3, .124), (.5, .13), (.62, .114)],
                 dip=.03, NR=(.08, .07), NH=.056, sleeve=.60, sr=[(0, .09), (.12, .078), (.3, .07), (.5, .064), (.6, .06)], cuff=.06, hemband=.05,
                 nhem=8, hemh=.25, belt=None, lapels=False, coatcollar=False, dbuttons=False, cuffstrap=False, standcollar=True, zip=True)
    if MODEL == 'shirt' and VAR == 'short':
        P['sleeve'] = .24; P['sr'] = [(0, .092), (.12, .086), (.24, .084)]; P['cuff'] = 0
    ZS, N = P['ZS'], P['n']; Af, Bf = curve(P['A']), curve(P['B'])
    NRX, NRY = P['NR']; NH = P['NH']

    def zhem(th):
        return -P.get('curvedhem', 0) * math.sin(th) ** 2

    def neck(th):
        s = math.sin(th)
        dip = -P['dip'] * max(0, -s) ** 2.5
        if MODEL == 'tee' and VAR == 'vneck':
            w = .75; d = abs(th + math.pi / 2) if th < math.pi else abs(th - 1.5 * math.pi)
            dip -= .13 * max(0, 1 - d / w) ** 1.6
            rx = NRX * (1 - .25 * max(0, 1 - d / w))
            return Vector((rx * math.cos(th), NRY * s + .012, ZS + NH + dip))
        return Vector((NRX * math.cos(th), NRY * s + .012, ZS + NH + dip))

    TF = make_torso_folds(P.get('nhem', 11), P.get('hemh', .32), belt=P.get('belt'))

    def torso(z, th, fold=True):
        c, s = math.cos(th), math.sin(th)
        a, b = Af(z), Bf(z)
        if s < 0: b *= 1 + .06 * smooth(.25, .5, z / ZS) * (1 - smooth(.8, 1, z / ZS))   # chest
        x = a * spow(c, 2 / N); y = b * spow(s, 2 / N)
        r = 0.0
        if fold:
            r += torso_fold(TF, z, th, zhem(th), ZS, (a + b) / 2)
            if P.get('hemband'): r += .007 * (1 - smooth(P['hemband'], P['hemband'] + .09, z))   # blousing over the rib
        rad = Vector((x, y, 0)); L = rad.length or 1
        return Vector((x, y, z)) + rad / L * r

    def cap(k, th):
        p0 = torso(ZS, th, False); nk = neck(th)
        c = Vector(((p0.x * .5 + nk.x * .5) * 1.04, (p0.y * .5 + nk.y * .5) * 1.04, ZS + (nk.z - ZS) * .85 + .012))
        if math.cos(th) ** 2 > .5: c.z = ZS + (nk.z - ZS) * .55   # shoulders slope straight to the neck
        return p0 * (1 - k) ** 2 + c * 2 * k * (1 - k) + nk * k * k

    RS = .86
    Z0 = P['hemband'] * .92 if P['hemband'] else 0.0

    def body(r, th):
        if r <= RS:
            z0 = zhem(th) + Z0
            return torso(z0 + (ZS - z0) * (r / RS) ** .95, th)
        return cap((r - RS) / (1 - RS), th)

    def bnorm(r, th):
        e = 1e-3
        dr = body(min(1, r + e), th) - body(max(0, r - e), th)
        dt = body(r, th + e) - body(r, th - e)
        n = dt.cross(dr).normalized()
        p = body(r, th)
        if n.dot(Vector((p.x, p.y - .01, .3 * (r > RS)))) < 0: n = -n
        return n

    def theta_for_x(x, r, front=True):
        """invert the body section at row r: the angle whose point has this x (front or back)"""
        lo, hi = (-math.pi, 0) if front else (0, math.pi)
        for _ in range(40):
            m = (lo + hi) / 2
            if (body(r, m).x > x) == front: hi = m
            else: lo = m
        return (lo + hi) / 2

    def r_for_z(z, th):
        lo, hi = 0.0, RS
        for _ in range(40):
            m = (lo + hi) / 2
            if body(m, th).z < z: lo = m
            else: hi = m
        return (lo + hi) / 2

    # ---- the body: torso and shoulders in one surface, seam at the left side
    th0 = -math.pi / 2 + .0001
    bod = grid('body', lambda a, b: body(b, th0 + 2 * math.pi * a), NT, NZ, 'body')
    solidify(bod, .0028)
    # side seams
    for sx in (0, math.pi):
        stitch(lambda u, sx=sx: body(.02 + u * .8, sx + .0001), lambda u, sx=sx: bnorm(.02 + u * .8, sx + .0001), pitch=.006)

    # ---- rib hem band (hoodie)
    if P['hemband']:
        hb = P['hemband']
        def band(a, b):
            th = th0 + 2 * math.pi * a; z = b * hb
            p = torso(z, th, False); rad = Vector((p.x, p.y, 0)).normalized()
            return p - rad * (.012 * (1 - b) + .006 * b)
        hob = grid('hemband', band, NT, 8 if HI else 4, 'hem'); solidify(hob, .003)
        stitch(lambda u: band(u, .96) , lambda u: Vector((band(u, .96).x, band(u, .96).y, 0)).normalized())

    # ---- hem stitching (tee, shirt)
    else:
        for zz in ((.018, .024) if MODEL == 'tee' else (.008,)):
            stitch(lambda u, zz=zz: body(r_for_z(zhem(th0 + 2 * math.pi * u) + zz, th0 + 2 * math.pi * u), th0 + 2 * math.pi * u),
                   lambda u, zz=zz: bnorm(r_for_z(zhem(th0 + 2 * math.pi * u) + zz, th0 + 2 * math.pi * u), th0 + 2 * math.pi * u))

    # ---- sleeves: set-in tubes hanging in a relaxed A-pose, with drape folds
    al = math.radians(P['alpha']); SL = P['sleeve']; srf = curve(P['sr']); cuffL = P['cuff']
    SF, PF = {}, {}
    for sd in (1, -1):
        if P['sleeve'] > .3:   # elbow compression rings (stronger on the inside of the arm) and stacking above the cuff
            SF[sd] = make_ring_folds(4, .26, .38, .0055) + make_ring_folds(5, P['sleeve'] - .19, P['sleeve'] - .03, .006, 2)
        else:
            SF[sd] = make_ring_folds(2, .05, P['sleeve'] - .04, .003, 1.5)
        PF[sd] = [(RNG.uniform(-3, 3), RNG.uniform(.01, .018), RNG.uniform(.002, .004) * (1 if k % 2 else -1)) for k in range(4)]   # long pipe folds from the shoulder
    drop = P.get('drop', 0)
    for side in (1, -1):
        sp = Vector((side * (Af(ZS) * .80 + drop), .012, ZS - .045 - drop * .6))
        d = Vector((side * math.cos(al), 0, -math.sin(al)))
        e1 = Vector((side * math.sin(al), 0, math.cos(al)))   # up / out
        e2 = Vector((0, 1, 0))
        def sl(a, b, sp=sp, d=d, e1=e1, side=side):
            s = -.04 + b * (SL + .04); ph = 2 * math.pi * a
            r = srf(max(0, s)) * (.55 + .45 * smooth(-.04, 0, s))
            r += ring_fold(SF[side], s, ph, bias=-math.pi / 2) * smooth(.0, .05, s)
            for p0, w0, a0 in PF[side]: r += a0 * ridge(wrapd(ph - p0) * .07, w0) * smooth(.02, .15, s) * (1 - smooth(SL * .55, SL * .8, s))
            bend = Vector((0, -.07, 0)) * (max(0, s) / SL) ** 2 if SL > .3 else Vector((0, 0, 0))
            c = sp + d * s + bend
            return c + (e1 * math.cos(ph) * 1.0 + e2 * math.sin(ph) * .9) * r
        so = grid('sleeve_' + ('l' if side > 0 else 'r'), sl, NT // 2, 40 if HI else 18, 'sleeves', flip=side > 0)
        solidify(so, .0026)
        cen = lambda s, sp=sp, d=d: sp + d * s + (Vector((0, -.07, 0)) * (s / SL) ** 2 if SL > .3 else Vector((0, 0, 0)))
        if cuffL:
            def cf(a, b, sp=sp, d=d, e1=e1, cen=cen):
                s = SL - .012 + b * cuffL; ph = 2 * math.pi * a
                r = srf(SL) * (.86 if MODEL == 'hoodie' else .98) - .002 * b
                return cen(s) + (e1 * math.cos(ph) + e2 * math.sin(ph) * .9) * r
            co = grid('cuff_' + ('l' if side > 0 else 'r'), cf, NT // 2, 8 if HI else 4, 'cuffs', flip=side > 0); solidify(co, .003)
            stitch(lambda u, cf=cf: cf(u, .06), lambda u, cf=cf, cen=cen: (cf(u, .06) - cen(SL - .01)).normalized())
            if MODEL == 'shirt':
                stitch(lambda u, cf=cf: cf(u, .9), lambda u, cf=cf, cen=cen: (cf(u, .9) - cen(SL + cuffL * .9)).normalized())
                bp = cf(.75 if side > 0 else .25, .5); disc('cuffbutton', bp, (bp - cen(SL + cuffL * .5)), .005, .0025, 'buttons')
        else:   # short sleeve hem
            for ss in (SL - .02, SL - .026):
                stitch(lambda u, ss=ss, sl=sl: sl(u, (ss + .04) / (SL + .04)), lambda u, ss=ss, sl=sl, cen=cen: (sl(u, (ss + .04) / (SL + .04)) - cen(ss)).normalized())
        # armhole seam on the shoulder
        stitch(lambda u, sl=sl: sl(u * .5 + .75, .04 / (SL + .04)) , lambda u, sl=sl, sp=sp: (sl(u * .5 + .75, .04 / (SL + .04)) - sp).normalized(), pitch=.006)

    # ---- neck finish
    def neckpath(th, sg):
        """point sg metres down from the neck seam along the shoulders/chest"""
        lo, hi = RS, 1.0
        target = sg
        # walk down from r=1 until arc length reaches sg
        r = 1.0; acc = 0.0; prev = body(1.0, th); step = .004
        while acc < target and r > 0:
            r -= step; q = body(r, th); acc += (q - prev).length; prev = q
        return r

    if MODEL == 'tee':
        def nb(a, b):
            th = th0 + 2 * math.pi * a; r = neckpath(th, .024 * (1 - b))
            return body(r, th) + bnorm(r, th) * (.0015 + .001 * math.sin(math.pi * b))
        no = grid('neckband', nb, NT, 6 if HI else 3, 'collar'); solidify(no, .0025)
        stitch(lambda u: nb(u, .08), lambda u: bnorm(neckpath(th0 + 2 * math.pi * u, .022), th0 + 2 * math.pi * u))

    # ---- hood lying down over the back (hoodie)
    if P.get('hood'):
        g = .2
        def hood(a, b):
            th = -math.pi / 2 + g + a * (2 * math.pi - 2 * g); ph = th - math.pi / 2
            f = abs(ph) / (math.pi - g)
            rr = .055 * (1 - f) ** .6 + .014; h0 = .03 * (1 - f) + .012; Ld = .26 * max(0, 1 - f * 1.45) ** 1.2
            segs = [h0, math.pi * rr, h0 * .8, Ld]; tot = sum(segs); d = b * tot
            if d < segs[0]: sg, et = 0.0, d
            elif d < segs[0] + segs[1]:
                be = (d - segs[0]) / rr; sg, et = rr - rr * math.cos(be), h0 + rr * math.sin(be)
            elif d < segs[0] + segs[1] + segs[2]:
                q = (d - segs[0] - segs[1]) / segs[2]; sg, et = 2 * rr + .01 * q, h0 * (1 - q) + .008 * q
            else:
                q = (d - sum(segs[:3])) / max(1e-6, Ld); sg, et = 2 * rr + .01 + q * Ld, .008 + .006 * math.sin(q * math.pi)
            r = neckpath(th, sg); p = body(r, th) + bnorm(r, th) * et
            # soft folds in the drape
            p += bnorm(r, th) * .005 * math.sin(ph * 6 + sg * 20) * smooth(.05, .15, sg)
            return p
        ho = grid('hood', hood, NT, 40 if HI else 18, 'hood', flip=True); solidify(ho, .0035)
        stitch(lambda u: hood(u, .0) , lambda u: bnorm(neckpath(-math.pi / 2 + g + u * (2 * math.pi - 2 * g), .0), -math.pi / 2 + g + u * (2 * math.pi - 2 * g)))

    # ---- drawstrings
    if P.get('strings'):
        for side in (1, -1):
            th = -math.pi / 2 + side * .3; top = neck(th) + Vector((0, -.02, -.005))
            pts = [top, top + Vector((side * .006, -.012, -.04)), top + Vector((side * .01, -.016, -.11)), top + Vector((side * .006, -.02, -.19)), top + Vector((side * .004, -.024, -.24))]
            tube_curve('string', pts, .0035, 'strings')
            tube_curve('aglet', [pts[-1], pts[-1] + Vector((0, -.001, -.012)), pts[-1] + Vector((0, -.0015, -.03))], .0042, 'aglets', 2)
            disc('eyelet', top + Vector((0, -.004, .006)), Vector((0, -1, .25)), .006, .0015, 'aglets')

    # ---- kangaroo pocket
    if P.get('pocket') == 'kangaroo':
        def kp(a, b):
            z = .075 + b * .235; w = .17 - .05 * b
            # side openings curve in near the top
            w -= .045 * smooth(.35, 1, b) ** 1.5
            x = (-1 + 2 * a) * w; r = r_for_z(z, -math.pi / 2); th = theta_for_x(x, r)
            return body(r, th) + bnorm(r, th) * (.0035 + .006 * math.sin(math.pi * a) * math.sin(math.pi * min(1, b * 1.2)))
        ko = grid('pocket', kp, 40 if HI else 16, 24 if HI else 10, 'pocket'); solidify(ko, .0025)
        stitch(lambda u: kp(u, .03), lambda u: Vector((0, -1, 0)))
        stitch(lambda u: kp(u, .97), lambda u: Vector((0, -1, 0)))
        for a in (.02, .98):
            stitch(lambda u, a=a: kp(a, .03 + u * .94), lambda u: Vector((0, -1, 0)))

    # ---- shirt: placket, buttons, chest pocket, collar, yoke
    if P.get('placket'):
        def pl(a, b):
            r = b * .995; x = (-1 + 2 * a) * .018; th = theta_for_x(x, min(r, RS - .001)) if r < RS else -math.pi / 2 + (-1 + 2 * a) * .018 / NRX * .9
            return body(r, th) + bnorm(r, th) * .0018
        po = grid('placket', pl, 4, 50 if HI else 22, 'placket'); solidify(po, .0015, 1, inside=None)
        for a in (.04, .96):
            stitch(lambda u, a=a: pl(a, .01 + u * .97), lambda u, a=a: bnorm(.01 + u * .97, -math.pi / 2), pitch=.004)
        for k in range(7):
            z = ZS + .02 - .095 * k
            if z < .04: break
            r = r_for_z(z, -math.pi / 2); bp = body(r, -math.pi / 2) + bnorm(r, -math.pi / 2) * .0034
            disc('button', bp, bnorm(r, -math.pi / 2), .0058, .0024, 'buttons')
    if P.get('chestpocket'):
        def cp(a, b):
            z = ZS - .215 + b * .135; x = .048 + a * .115
            z += -.018 * (1 - abs(2 * a - 1)) * (1 - smooth(0, .25, b))   # pointed bottom
            r = r_for_z(z, -math.pi / 2 + .5); th = theta_for_x(x, r)
            return body(r, th) + bnorm(r, th) * .0026
        co = grid('chestpocket', cp, 14 if HI else 6, 14 if HI else 6, 'pocket'); solidify(co, .0015, 1, inside=None)
        for a in (.02, .98):
            stitch(lambda u, a=a: cp(a, .03 + u * .95), lambda u: Vector((0, -1, 0)), pitch=.004)
        stitch(lambda u: cp(.02 + .96 * u, .03), lambda u: Vector((0, -1, 0)), pitch=.004)
        stitch(lambda u: cp(.02 + .96 * u, .86), lambda u: Vector((0, -1, 0)), pitch=.004)
    if P.get('collar'):
        def stand(a, b):
            th = -math.pi / 2 + .05 + a * (2 * math.pi - .1); nk = neck(th); rad = Vector((nk.x, nk.y - .012, 0)).normalized()
            return nk + Vector((0, 0, .036 * b)) - rad * .004 * b
        so = grid('collarstand', stand, NT, 6 if HI else 3, 'collar'); solidify(so, .002)
        def fall(a, b):
            th = -math.pi / 2 + .26 + a * (2 * math.pi - .52); ph = th - math.pi / 2; f = abs(ph) / (math.pi - .26)
            nk = neck(th); rad = Vector((nk.x, nk.y - .012, 0)).normalized(); top = nk + Vector((0, 0, .04)) + rad * .002
            L = .042 + .05 * smooth(.62, 1, f) ** 2
            # roll over the top then fall outward and down onto the stand and shoulders
            if b < .15: q = b / .15; return top + rad * (.006 * math.sin(q * math.pi / 2)) + Vector((0, 0, .004 * math.sin(q * math.pi)))
            q = (b - .15) / .85
            return top + rad * (.006 + L * .62 * q + .004 * math.sin(q * math.pi)) - Vector((0, 0, L * .78 * q)) + Vector((0, -.012 * smooth(.7, 1, f) * q, 0))
        fo = grid('collar', fall, NT, 10 if HI else 5, 'collar', flip=True); solidify(fo, .0022)
        stitch(lambda u: fall(u, .93), lambda u: (fall(u, .93) - fall(u, .8)).cross(fall(min(1, u + .01), .93) - fall(max(0, u - .01), .93)).normalized(), pitch=.004)
        # yoke seam across the back
        stitch(lambda u: body(r_for_z(ZS - .08, .3 + u * (math.pi - .6)), .3 + u * (math.pi - .6)), lambda u: bnorm(r_for_z(ZS - .08, .3 + u * (math.pi - .6)), .3 + u * (math.pi - .6)), pitch=.005)

    # ---- coat: belt with buckle, lapels, notch collar, double-breasted buttons, cuff straps, back vent
    if P.get('belt'):
        zb = P['belt']
        def bl(a, b):
            th = th0 + 2 * math.pi * a; z = zb - .022 + .044 * b; r = r_for_z(z, th)
            return body(r, th) + bnorm(r, th) * (.0055 + .0015 * math.sin(math.pi * b))
        bo = grid('belt', bl, NT, 4, 'belt'); solidify(bo, .003)
        for b in (.12, .88): stitch(lambda u, b=b: bl(u, b), lambda u: bnorm(r_for_z(zb, th0 + 2 * math.pi * u), th0 + 2 * math.pi * u), pitch=.004)
        rc = r_for_z(zb, -math.pi / 2 - .35); c0 = body(rc, -math.pi / 2 - .35) + bnorm(rc, -math.pi / 2 - .35) * .011
        for dx, dz, ex, ez in ((-.022, -.03, .022, -.03), (.022, -.03, .022, .03), (.022, .03, -.022, .03), (-.022, .03, -.022, -.03)):
            tube_curve('buckle', [c0 + Vector((dx, 0, dz)), c0 + Vector(((dx + ex) / 2, -.001, (dz + ez) / 2)), c0 + Vector((ex, 0, ez))], .0028, 'hardware', 2)
        tail = [c0 + Vector((.02, -.003, -.005)), c0 + Vector((.05, -.008, -.06)), c0 + Vector((.06, -.012, -.14)), c0 + Vector((.058, -.014, -.2))]
        def tl(a, b):
            q = b * (len(tail) - 1); k = min(len(tail) - 2, int(q)); f = q - k; p = tail[k].lerp(tail[k + 1], f)
            return p + Vector((1, 0, 0)) * (a - .5) * .044
        to = grid('belttail', tl, 2, 16, 'belt', flip=True); solidify(to, .003)
    if P.get('lapels'):
        zbk = ZS - .36
        for sd in (1, -1):
            nk = neck(-math.pi / 2 + sd * .62)
            B0 = (sd * .015, zbk); T0 = (nk.x * .9, ZS - .01); T1 = (sd * .155, ZS - .07)
            def lp(a, b, sd=sd, B0=B0, T0=T0, T1=T1):
                bb = b ** .9
                ix, iz = B0[0] + (T0[0] - B0[0]) * bb, B0[1] + (T0[1] - B0[1]) * bb
                ox, oz = B0[0] + (T1[0] - B0[0]) * bb, B0[1] + (T1[1] - B0[1]) * bb
                x, z = ix + (ox - ix) * a, iz + (oz - iz) * a
                r = r_for_z(z, -math.pi / 2 + sd * .4); th = theta_for_x(x, r)
                return body(r, th) + bnorm(r, th) * (.004 + .006 * (1 - a) * b + .002 * math.sin(math.pi * a))
            lo_ = grid('lapel', lp, 10 if HI else 5, 24 if HI else 10, 'collar', flip=sd < 0); solidify(lo_, .0025)
            stitch(lambda u, lp=lp: lp(.94, .04 + .92 * u), lambda u, sd=sd: Vector((0, -1, .2)).normalized(), pitch=.004)
    if P.get('coatcollar'):
        def cc(a, b):
            th = -math.pi / 2 + .62 + a * (2 * math.pi - 1.24); ph = th - math.pi / 2; f = abs(ph) / (math.pi - .62)
            nk = neck(th); rad = Vector((nk.x, nk.y - .012, 0)).normalized(); top = nk + Vector((0, 0, .045)) + rad * .003
            L = .06 + .03 * smooth(.7, 1, f)
            if b < .15: q = b / .15; return top + rad * (.008 * math.sin(q * math.pi / 2)) + Vector((0, 0, .005 * math.sin(q * math.pi)))
            q = (b - .15) / .85
            return top + rad * (.008 + L * .55 * q + .006 * math.sin(q * math.pi)) - Vector((0, 0, L * .82 * q))
        def cst(a, b):
            th = -math.pi / 2 + .62 + a * (2 * math.pi - 1.24); nk = neck(th); rad = Vector((nk.x, nk.y - .012, 0)).normalized()
            return nk + Vector((0, 0, .045 * b)) - rad * .004 * b
        so = grid('collarstand', cst, NT, 5 if HI else 3, 'collar'); solidify(so, .0025)
        fo = grid('collar', cc, NT, 10 if HI else 5, 'collar', flip=True); solidify(fo, .003)
        stitch(lambda u: cc(u, .93), lambda u: (cc(u, .93) - cc(u, .8)).cross(cc(min(1, u + .01), .93) - cc(max(0, u - .01), .93)).normalized(), pitch=.004)
    if P.get('dbuttons'):
        for z in (P['belt'] + .13, P['belt'] + .24, P['belt'] - .12):
            for x in (-.085, .085):
                r = r_for_z(z, -math.pi / 2); th = theta_for_x(x, r)
                disc('button', body(r, th) + bnorm(r, th) * .003, bnorm(r, th), .0095, .004, 'buttons')
        # front edge of the overlapping panel and the back vent
        stitch(lambda u: body(r_for_z(.02 + u * (ZS - .4), -2.1), theta_for_x(-.105, r_for_z(.02 + u * (ZS - .4), -2.1))),
               lambda u: bnorm(r_for_z(.02 + u * (ZS - .4), -2.1), theta_for_x(-.105, r_for_z(.02 + u * (ZS - .4), -2.1))), pitch=.005)
        stitch(lambda u: body(r_for_z(.02 + u * .32, math.pi / 2), math.pi / 2), lambda u: bnorm(r_for_z(.02 + u * .32, math.pi / 2), math.pi / 2), pitch=.005)
    if P.get('cuffstrap'):
        for side in (1, -1):
            sp = Vector((side * (Af(ZS) * .80), .012, ZS - .045)); d = Vector((side * math.cos(al), 0, -math.sin(al))); e1 = Vector((side * math.sin(al), 0, math.cos(al)))
            def cs(a, b, sp=sp, d=d, e1=e1):
                s_ = SL - .08 + b * .03; ph = 2 * math.pi * a; c = sp + d * s_ + Vector((0, -.07, 0)) * (s_ / SL) ** 2
                return c + (e1 * math.cos(ph) + Vector((0, 1, 0)) * math.sin(ph) * .9) * (srf(s_) + .004)
            co = grid('cuffstrap', cs, NT // 2, 3, 'belt', flip=side > 0); solidify(co, .0025)
    if P.get('standcollar'):
        def sc_(a, b):
            th = -math.pi / 2 + .12 + a * (2 * math.pi - .24); nk = neck(th); rad = Vector((nk.x, nk.y - .012, 0)).normalized()
            return nk + Vector((0, 0, .048 * b)) - rad * .006 * b
        so = grid('collar', sc_, NT, 6 if HI else 3, 'collar'); solidify(so, .003)
        stitch(lambda u: sc_(u, .9), lambda u: (lambda th: Vector((math.cos(th), math.sin(th), 0)))(-math.pi / 2 + .12 + u * (2 * math.pi - .24)), pitch=.004)
        disc('snap', sc_(.03, .6) + Vector((0, -.004, 0)), Vector((0, -1, 0)), .006, .002, 'hardware')
    if P.get('zip'):
        tb = STB   # zipper teeth as real geometry, on its own hardware mesh
        zm = bmesh.new()
        def zl(u):
            z = .01 + u * (ZS + .03); x = .03 + .05 * u
            if z <= ZS - .005: r = r_for_z(z, -math.pi / 2); th = theta_for_x(x, r)
            else: r = RS + (1 - RS) * min(1, (z - ZS) / .08); th = -math.pi / 2 + .5
            return body(r, th), bnorm(r, th)
        n_t = int((ZS + .03) / .0032)
        for i in range(n_t):
            p, nr = zl(i / n_t); p = p + nr * .0025; t_ = Vector((0, 0, 1)); sd = nr.cross(t_).normalized()
            off = sd * (.0022 if i % 2 else -.0022)
            for v in bmesh.ops.create_cube(zm, size=1)['verts']:
                v.co = Vector((v.co.x * .005, v.co.y * .0016, v.co.z * .0022)); v.co = p + off + sd * v.co.x + nr * v.co.y + t_ * v.co.z
        me = bpy.data.meshes.new('zipteeth'); zm.to_mesh(me); zm.free(); me.uv_layers.new(name='UVMap')
        zo = bpy.data.objects.new('zipteeth', me); bpy.context.collection.objects.link(zo); me.materials.append(mat('zip'))
        def zt(a, b):
            p, nr = zl(b); sd = nr.cross(Vector((0, 0, 1))).normalized()
            return p + nr * .0018 + sd * (a - .5) * .022
        zo2 = grid('ziptape', zt, 2, 60 if HI else 24, 'placket', flip=True); solidify(zo2, .001, -1, inside=None)
        pp, nn_ = zl(.62); disc('zippull', pp + nn_ * .006 + Vector((0, 0, -.012)), nn_, .005, .002, 'zip')
        for k in (-1, 1): stitch(lambda u, k=k: zt(.5 + k * .55, u), lambda u: zl(u)[1], pitch=.004)

    # ---- print decals (front and back): 0..1 UVs for the studio's graphics
    def decal(name, zc, h, w, front):
        def dp(a, b):
            z = zc - h / 2 + b * h; thc = -math.pi / 2 if front else math.pi / 2
            r = r_for_z(z, thc); x = (-w / 2 + a * w) * (1 if front else -1)
            th = theta_for_x(x, r, front)
            off = .0042 if front and P.get('pocket') == 'kangaroo' and z < .32 else .0016
            return body(r, th) + bnorm(r, th) * off
        grid(name, dp, 24 if HI else 12, 24 if HI else 12, 'print', uv01=True)
    if MODEL == 'hoodie':
        decal('print_front', .45 if VAR == 'regular' else .48, .22, .24, True); decal('print_back', .21 if VAR == 'regular' else .23, .2, .216, False)
    elif MODEL == 'tee':
        decal('print_front', ZS - .2, .24, .26, True); decal('print_back', ZS - .22, .26, .28, False)
    elif MODEL == 'coat':
        decal('print_back', ZS - .26 if VAR == 'jacket' else ZS - .3, .22, .24, False)
    else:
        decal('print_back', ZS - .3, .24, .26, False)


# =====================================================================================================================
#  JEANS
# =====================================================================================================================
if MODEL == 'jeans':
    WAIST, CROTCH = 1.02, .76
    wide = VAR == 'wide'
    legR = curve([(0, .096 if wide else .066), (.25, .094 if wide else .066), (.45, .09 if wide else .069), (.6, .088 if wide else .078), (CROTCH, .092)])
    legX = curve([(0, .112 if wide else .106), (.4, .108), (CROTCH, .098)])
    hipA = curve([(CROTCH, .19), (.86, .192), (.94, .18), (WAIST, .17)])
    hipB = curve([(CROTCH, .118), (.86, .122), (.94, .114), (WAIST, .104)])

    JF = {}
    for sd in (1, -1):
        JF[sd] = {'stack': make_ring_folds(6, .04, .2, .0055 if not wide else .007, 2.2), 'knee': make_ring_folds(3, .42, .5, .003, 1.4),
                  'whisk': [(-1.6 - .35 * k + RNG.uniform(-.1, .1), .70 + .02 * k + RNG.uniform(-.01, .01), RNG.uniform(.006, .01), -.0022, RNG.uniform(-.3, .3)) for k in range(5)],
                  'pipe': [(RNG.uniform(-3, 3), RNG.uniform(.01, .02), RNG.uniform(.002, .004) * (1 if k % 2 else -1)) for k in range(4)]}

    def leg(z, th, side, fold=True):
        """side +1 = wearer's left leg. th measured around the leg, 0 = outer side"""
        c, s = math.cos(th), math.sin(th)
        wb = smooth(CROTCH - .03, CROTCH + .05, z)   # 0 leg tube .. 1 half pelvis
        r = legR(min(z, CROTCH)); cx = legX(min(z, CROTCH))
        lx, ly = cx + r * c, r * s * (1.05 + .1 * (s > 0))
        A, B = hipA(max(z, CROTCH)), hipB(max(z, CROTCH))
        hx = A / 2 + (A / 2) * spow(c, 2 / (2.3 if c > 0 else 7)); hy = B * spow(s, 2 / 2.5) + (.012 * (s > 0) * smooth(.8, .9, z))
        x = lx * (1 - wb) + hx * wb; y = ly * (1 - wb) + hy * wb
        if fold:
            rr = ring_fold(JF[side]['stack'], z, th)                         # stacking above the hem
            rr += ring_fold(JF[side]['knee'], z, th, bias=math.pi / 2) * .9   # honeycombs behind the knee
            for t0, z0, w, a, sl in JF[side]['whisk']:                       # whiskers fanning from the crotch on the front
                dz = z - z0
                if -.06 < dz < .06: rr += a * ridge(wrapd(th - t0 - sl * dz * 8) * .09, w) * math.cos(dz / .06 * math.pi / 2) ** 2
            for t0, w, a in JF[side]['pipe']:                                # long vertical drape folds
                rr += a * ridge(wrapd(th - t0) * .08, w) * smooth(.12, .3, z) * (1 - smooth(.55, .7, z))
            cxx = cx * (1 - wb) + (A / 2) * wb
            d = Vector((x - cxx, y, 0)); L = d.length or 1; x += d.x / L * rr; y += d.y / L * rr
        return Vector((side * x, y, z))

    def lnorm(z, th, side):
        e = 1e-3
        dz = leg(z + e, th, side) - leg(z - e, th, side); dt = leg(z, th + e, side) - leg(z, th - e, side)
        n = dt.cross(dz).normalized() * side
        return n

    TOPZ = WAIST - .045
    for side in (1, -1):
        def lp(a, b, side=side): return leg(.012 + b * (TOPZ - .012), 2 * math.pi * a, side)
        lo = grid('leg_' + ('l' if side > 0 else 'r'), lp, NT // 2 + 4, NZ + 10, 'legs', flip=side < 0); solidify(lo, .0032)
        # outseam, inseam, hem
        stitch(lambda u, side=side: leg(.02 + u * (TOPZ - .03), .0001, side), lambda u, side=side: lnorm(.02 + u * (TOPZ - .03), .0001, side))
        stitch(lambda u, side=side: leg(.02 + u * (CROTCH - .03), math.pi, side), lambda u, side=side: lnorm(.02 + u * (CROTCH - .03), math.pi, side))
        for zz in (.018, .025):
            stitch(lambda u, zz=zz, side=side: leg(zz, 2 * math.pi * u, side), lambda u, zz=zz, side=side: lnorm(zz, 2 * math.pi * u, side))
        # back pocket
        def bp(a, b, side=side):
            z = TOPZ - .17 + b * .135 - .02 * (1 - abs(2 * a - 1)) * (1 - smooth(0, .3, b)); th = .55 + a * .95
            return leg(z, th, side) + lnorm(z, th, side) * .0026
        pk = grid('backpocket', bp, 12 if HI else 6, 12 if HI else 6, 'pocket', flip=side > 0); solidify(pk, .0018, 1, inside=None)
        for a in (.03, .97): stitch(lambda u, a=a, bp=bp: bp(a, .05 + .9 * u), lambda u, a=a, side=side: lnorm(TOPZ - .1, .55 + a * .95, side), pitch=.004)
        stitch(lambda u, bp=bp: bp(.03 + .94 * u, .05), lambda u, side=side: lnorm(TOPZ - .16, 1.0, side), pitch=.004)
        stitch(lambda u, bp=bp: bp(.03 + .94 * u, .9), lambda u, side=side: lnorm(TOPZ - .05, 1.0, side), pitch=.004)
        # decorative arc stitch on the pocket (original Abidora mark)
        stitch(lambda u, bp=bp: bp(.15 + .7 * u, .45 + .2 * math.sin(u * math.pi)), lambda u, side=side: lnorm(TOPZ - .1, 1.0, side), pitch=.004)
        # front pocket opening: a curved facing patch
        def fp(a, b, side=side):
            z = TOPZ - b * .11; th = -.05 - a * (1.05 - .75 * b ** 1.5)
            return leg(z, th, side) + lnorm(z, th, side) * .0022
        fpk = grid('frontpocket', fp, 10 if HI else 5, 10 if HI else 5, 'pocket', flip=side < 0); solidify(fpk, .0018, 1, inside=None)
        stitch(lambda u, fp=fp: fp(1, u), lambda u, side=side: lnorm(TOPZ - .05, -.6, side), pitch=.004)
        # rivets at the pocket corners
        for (z, th) in ((TOPZ - .005, -1.06), (TOPZ - .108, -.08)):
            disc('rivet', leg(z, th, side) + lnorm(z, th, side) * .0026, lnorm(z, th, side), .0035, .0018, 'hardware')
    # waistband
    def wbp(a, b):
        th = 2 * math.pi * a; z = TOPZ - .004 + b * .049
        A, B = hipA(WAIST) + .004, hipB(WAIST) + .004
        return Vector((A * spow(math.cos(th), 2 / 2.3), B * spow(math.sin(th), 2 / 2.5) + .004, z))
    wo = grid('waistband', wbp, NT, 6 if HI else 3, 'waistband'); solidify(wo, .004)
    for b in (.1, .9): stitch(lambda u, b=b: wbp(u, b), lambda u: Vector((math.cos(2 * math.pi * u), math.sin(2 * math.pi * u), 0)))
    # belt loops
    for th in (-1.25, -1.9, 1.2, 1.9, math.pi / 2, -math.pi / 2 - 1.25 + math.pi):
        p0 = wbp(th / (2 * math.pi) % 1, -.15); p1 = wbp(th / (2 * math.pi) % 1, 1.0); n = Vector((math.cos(th), math.sin(th), 0)) * .004
        tube_curve('loop', [p0 + n * .6, p0 + n * 1.3, (p0 + p1) / 2 + n * 1.5, p1 + n * 1.3, p1 + n * .4], .0028, 'loops', 4)
    # front button + fly stitching
    bpos = wbp(.75, .5); disc('button', bpos + Vector((0, -.004, 0)), Vector((0, -1, 0)), .0085, .003, 'hardware')
    stitch(lambda u: Vector((.034 - .03 * smooth(.75, 1, u), -hipB(TOPZ - min(u, .8) / .8 * .15) - .002, TOPZ - .005 - min(u, .8) / .8 * .15 - .015 * smooth(.8, 1, u))),
           lambda u: Vector((0, -1, 0)), pitch=.004)
    # back patch (leather label, original mark)
    def pat(a, b):
        th = math.pi / 2 + .5 + a * .32; z = TOPZ + .008 + b * .03
        A, B = hipA(WAIST) + .009, hipB(WAIST) + .009
        return Vector((A * spow(math.cos(th), 2 / 2.3), B * spow(math.sin(th), 2 / 2.5) + .004, z))
    grid('patch', pat, 6, 4, 'patch', flip=True)

# ---------- export with baked ambient occlusion ----------
if len(STB.faces):
    me = bpy.data.meshes.new('stitches'); STB.to_mesh(me); STB.free(); me.uv_layers.new(name='UVMap')
    so = bpy.data.objects.new('stitches', me); bpy.context.collection.objects.link(so); me.materials.append(mat('thread'))
sys.path.insert(0, __import__('os').path.dirname(__file__))
from finish import bake_and_export
bake_and_export(OUT, HI, distance=.03, strength=.8)
print('BUILT', MODEL, VAR, LOD, OUT)
