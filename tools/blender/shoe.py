"""Abidora shoe builder for Blender 4.x (run headless):
   blender -b --factory-startup -P shoe.py -- <model> <variant> <lod> <out.glb>
   model: sneaker | runner | derby ; lod: hi | lo
Builds an original shoe from a parametric last: a shell upper with real overlay panels (each its own leather layer with
thickness), a padded collar, a tongue, eyelets, laces with a bow, and a two-part sole. Every part is a named material
zone (zone_vamp, zone_quarter, zone_toe, zone_heel, zone_eyestay, zone_logo, zone_tongue, zone_lining, zone_laces,
zone_eyelets, zone_midsole, zone_outsole) so the Abidora studio can colour and re-material each one separately.
Units are metres. Blender axes: X = heel to toe, -Y = outer (lateral) side, Z = up. All designs are original."""
import bpy, bmesh, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['sneaker', 'low', 'hi', '/tmp/shoe.glb']
MODEL, VAR, LOD, OUT = argv[:4]
HI = LOD == 'hi'


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def curve(pts):
    """cubic Hermite through (t, v) control points, tangents from neighbours"""
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
        h00 = 2 * s ** 3 - 3 * s ** 2 + 1; h10 = s ** 3 - 2 * s ** 2 + s; h01 = -2 * s ** 3 + 3 * s ** 2; h11 = s ** 3 - s ** 2
        return h00 * V[i] + h10 * h * M[i] + h01 * V[i + 1] + h11 * h * M[i + 1]
    return f


# ---------- the last: outline half-widths (share of W) for the outer and inner side ----------
FL_ROUND = [(0, 0), (.004, .30), (.012, .48), (.03, .63), (.06, .74), (.15, .80), (.30, .78), (.45, .80), (.62, .92), (.72, .96), (.82, .89), (.90, .72), (.95, .52), (.98, .30), (.995, .14), (1, 0)]
FM_ROUND = [(0, 0), (.004, .30), (.012, .48), (.03, .62), (.06, .72), (.15, .76), (.30, .67), (.45, .70), (.62, .88), (.70, .94), (.80, .93), (.88, .80), (.94, .58), (.975, .34), (.995, .14), (1, 0)]
FL_ALMOND = FL_ROUND[:9] + [(.70, .93), (.80, .80), (.88, .60), (.94, .40), (.98, .20), (.995, .09), (1, 0)]
FM_ALMOND = FM_ROUND[:9] + [(.70, .92), (.80, .84), (.88, .66), (.94, .44), (.98, .22), (.995, .09), (1, 0)]

SIL = {
    'sneaker': dict(L=.29, W=.050, n=2.8, last='round', stackH=.030, stackF=.024, spring=.011, sole='cup', pad=.0045, outsole=.008,
                    R=[(0, .088), (.06, .092), (.20, .091), (.35, .087), (.50, .080), (.62, .069), (.74, .056), (.86, .044), (.94, .034), (.98, .022), (1, .007)],
                    C=[(0, .070), (.06, .068), (.16, .056), (.26, .060), (.33, .072), (.45, .080), (.55, .075), (.63, .069)],
                    ts=.33, te=.63, eyelets=7, cap=True, counter=True, logo='wave', bulge=.0),
    'runner': dict(L=.29, W=.048, n=2.6, last='round', stackH=.036, stackF=.024, spring=.020, sole='foam', pad=.005, outsole=.006,
                   R=[(0, .086), (.06, .090), (.20, .088), (.35, .083), (.50, .076), (.62, .066), (.74, .052), (.86, .040), (.94, .030), (.98, .020), (1, .006)],
                   C=[(0, .080), (.05, .074), (.15, .057), (.26, .062), (.33, .070), (.45, .077), (.55, .071), (.61, .066)],
                   ts=.33, te=.61, eyelets=6, cap=False, counter=True, logo='wave', bulge=.0035),
    'derby': dict(L=.295, W=.046, n=3.0, last='almond', stackH=.012, stackF=.012, spring=.008, sole='leather', pad=.0035, outsole=.006, heelH=.026,
                  R=[(0, .082), (.06, .085), (.20, .082), (.35, .078), (.50, .070), (.60, .062), (.72, .048), (.84, .036), (.93, .028), (.98, .018), (1, .006)],
                  C=[(0, .066), (.06, .064), (.16, .050), (.26, .054), (.34, .064), (.44, .068), (.52, .065), (.57, .061)],
                  ts=.34, te=.57, eyelets=5, cap=False, counter=True, logo='none', bulge=0),
    # original Abidora hiking boot: tall padded collar, rubber toe bumper, mudguard, lugged outsole
    'boot': dict(L=.30, W=.053, n=2.6, last='round', stackH=.030, stackF=.022, spring=.016, sole='lug', pad=.0055, outsole=.007, lug=.0075,
                 R=[(0, .160), (.06, .162), (.20, .150), (.30, .124), (.40, .100), (.50, .086), (.62, .073), (.74, .060), (.86, .048), (.94, .038), (.98, .025), (1, .008)],
                 C=[(0, .150), (.08, .146), (.18, .136), (.27, .114), (.35, .096), (.45, .086), (.55, .080), (.64, .073)],
                 ts=.21, te=.64, eyelets=8, cap=True, bumper=True, mud=True, counter=True, logo='wave', bulge=.002),
}
P = dict(SIL[MODEL])
# shape variations (each is its own real geometry, not a recolour)
if MODEL == 'sneaker' and VAR == 'high':
    P['R'] = [(0, .150), (.06, .152), (.20, .140), (.30, .118), (.40, .095), (.50, .082), (.62, .069), (.74, .056), (.86, .044), (.94, .034), (.98, .022), (1, .007)]
    P['C'] = [(0, .140), (.08, .138), (.18, .128), (.27, .108), (.35, .090), (.45, .082), (.55, .076), (.63, .069)]
    P['ts'], P['eyelets'] = .22, 9
if MODEL == 'runner' and VAR == 'max':
    P['stackH'], P['stackF'], P['spring'], P['bulge'], P['pad'] = .046, .032, .026, .006, .0065
if MODEL == 'derby' and VAR == 'captoe':
    P['cap'] = True
if MODEL == 'derby' and VAR == 'plain':
    P['cap'] = False

L, W, N = P['L'], P['W'], P['n']
FL = curve(FL_ROUND if P['last'] == 'round' else FL_ALMOND)
FM = curve(FM_ROUND if P['last'] == 'round' else FM_ALMOND)
Rf, Cf = curve(P['R']), curve(P['C'])
TS, TE = P['ts'], P['te']
E = 2 / N


def gap(t):  # toe spring + heel lift, the sole's underside above the ground
    return P['spring'] * smooth(.68, 1, t) ** 2 + .004 * max(0, 1 - t / .07) ** 2


def heelh(t):
    return P.get('heelH', 0) * (1 - smooth(.22, .62, t))


def y0(t):  # top of the sole stack (where the upper sits)
    if P['sole'] == 'leather':
        return heelh(t) + P['outsole'] + .006 + gap(t) * .6
    return gap(t) + P['stackF'] + (P['stackH'] - P['stackF']) * (1 - smooth(.2, .75, t))


def zb(t):
    return y0(t) - .005


def phie(t):
    if t >= TE: return math.pi / 2
    R, C = Rf(t), Cf(t)
    if C >= R * .999: return math.pi / 2
    return math.asin(max(0, C / R) ** (N / 2))


CR_AMP = {'sneaker': .0011, 'runner': .0006, 'derby': .0010, 'boot': .0014}[MODEL]


def crease(t, ph, hf):
    """flex creases across the vamp, just in front of the laces, where a worn shoe bends when you walk"""
    if t < TE or t > TE + .16: return 0.0
    g = 0.0
    for k in range(4):
        c = TE + .018 + .028 * k + .010 * math.cos(ph) + .004 * math.sin(ph * 5 + k * 1.7)
        g += math.exp(-((t - c) / .0050) ** 2) * (1 - .22 * k)
    return CR_AMP * g * smooth(.30, .80, hf)


def shell(t, ph):
    c, s = math.cos(ph), math.sin(ph)
    hf = abs(s) ** E
    w = W * (FL(t) if c >= 0 else FM(t))
    zr = Rf(t) * hf
    zr -= crease(t, ph, hf)
    lean = (1 - .13 * hf) * (1 - .40 * smooth(.065, .15, zr) * (1 - smooth(.25, .5, t)))   # tall shafts narrow towards the ankle
    y = (abs(c) ** E) * w * lean * (-1 if c >= 0 else 1)
    return Vector((t * L, y, zb(t) + zr))


def normal(t, ph):
    d = 1e-4
    a = shell(min(1, t + d), ph) - shell(max(0, t - d), ph)
    b = shell(t, ph + d) - shell(t, ph - d)
    nrm = a.cross(b)
    if nrm.length < 1e-12: nrm = Vector((0, 0, 1))
    nrm.normalize()
    p = shell(t, ph); axis = Vector((p.x, 0, zb(t) + Rf(t) * .35))
    if nrm.dot(p - axis) < 0: nrm = -nrm
    return nrm


_arc = {}
def arc(t, ph):
    """distance along the cross-section from the outer bottom edge (for even texture density)"""
    key = round(t, 4)
    if key not in _arc:
        pts = [shell(t, math.pi * k / 96) for k in range(97)]
        acc = [0.0]
        for k in range(96): acc.append(acc[-1] + (pts[k + 1] - pts[k]).length)
        _arc[key] = acc
    acc = _arc[key]; f = ph / math.pi * 96; k = min(95, max(0, int(f)))
    return acc[k] + (acc[k + 1] - acc[k]) * (f - k)


# ---------- scene + materials ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
DEF = {'vamp': ((.93, .92, .90), .55), 'quarter': ((.93, .92, .90), .55), 'toe': ((.93, .92, .90), .5), 'heel': ((.85, .84, .82), .5),
       'eyestay': ((.90, .89, .87), .5), 'logo': ((.12, .12, .13), .45), 'tongue': ((.93, .92, .90), .6), 'lining': ((.80, .78, .74), .85),
       'laces': ((.95, .95, .94), .8), 'eyelets': ((.75, .75, .76), .3), 'midsole': ((.96, .95, .92), .6), 'outsole': ((.25, .24, .23), .9)}
if MODEL == 'derby':
    for k in ('vamp', 'quarter', 'toe', 'heel', 'eyestay', 'tongue'): DEF[k] = ((.22, .12, .07), .4)
    DEF['midsole'] = ((.30, .18, .10), .5); DEF['outsole'] = ((.36, .22, .12), .55); DEF['laces'] = ((.10, .07, .05), .6); DEF['lining'] = ((.72, .58, .42), .7)
if MODEL == 'boot':
    for k in ('vamp', 'quarter', 'tongue', 'eyestay'): DEF[k] = ((.13, .13, .14), .55)
    DEF['heel'] = ((.10, .10, .11), .5); DEF['toe'] = ((.07, .07, .075), .7); DEF['mudguard'] = ((.07, .07, .075), .65)
    DEF['logo'] = ((.62, .66, .45), .5); DEF['midsole'] = ((.42, .43, .45), .7); DEF['outsole'] = ((.06, .06, .065), .9)
    DEF['laces'] = ((.08, .08, .08), .7); DEF['eyelets'] = ((.25, .25, .27), .35)
DEF.setdefault('mudguard', ((.2, .2, .2), .6))
if MODEL == 'runner':
    for k in ('vamp', 'quarter', 'tongue'): DEF[k] = ((.20, .26, .36), .85)
    DEF['logo'] = ((.95, .45, .25), .5); DEF['midsole'] = ((.97, .96, .94), .7); DEF['outsole'] = ((.18, .18, .19), .9)


def mat(z):
    if z not in MATS:
        m = bpy.data.materials.new('zone_' + z); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']; c, r = DEF[z]
        b.inputs['Base Color'].default_value = (*c, 1); b.inputs['Roughness'].default_value = r
        if z == 'eyelets': b.inputs['Metallic'].default_value = 1.0
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


def solidify(ob, th, off=1.0, lining=False):
    m = ob.modifiers.new('solid', 'SOLIDIFY'); m.thickness = th; m.offset = off; m.use_even_offset = True; m.use_rim = True
    if lining:
        ob.data.materials.append(mat('lining')); m.material_offset = 1; m.material_offset_rim = 1
    bv = ob.modifiers.new('edge', 'BEVEL'); bv.width = min(.0004, th * .35); bv.segments = 2 if HI else 1; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(50)
    bv.harden_normals = False
    return m


def grid(name, fn, na, nb, zone, wrap_uv=True):
    """fn(a, b) -> (t, phi, offset) ; a, b in [0, 1]. Builds a patch on the last, offset along its normal."""
    verts, uvs, faces = [], [], []
    for i in range(na + 1):
        for j in range(nb + 1):
            t, ph, off = fn(i / na, j / nb)
            t = min(1, max(0, t))
            p = shell(t, ph) + normal(t, ph) * off
            verts.append(p); uvs.append((p.x * 10, arc(t, ph) * 10))
    for i in range(na):
        for j in range(nb):
            a = i * (nb + 1) + j
            faces.append((a, a + nb + 1, a + nb + 2, a + 1))
    ob = mesh_obj(name, verts, faces, uvs, zone)
    clean(ob)
    return ob


NU = 140 if HI else 64
M = 34 if HI else 16

# ---------- base upper shell (the vamp), with lining on its inside ----------
verts, uvs, faces = [], [], []
cols = 2 * (M + 1)
for i in range(NU + 1):
    t = (1 - math.cos(math.pi * i / NU)) / 2
    pe = phie(t)
    phs = [pe * j / M for j in range(M + 1)] + [math.pi - pe + pe * j / M for j in range(M + 1)]
    for ph in phs:
        p = shell(t, ph); verts.append(p); uvs.append((p.x * 10, arc(t, ph) * 10))
for i in range(NU):
    for j in list(range(M)) + list(range(M + 1, 2 * M + 1)):
        a = i * cols + j
        faces.append((a, a + cols, a + cols + 1, a + 1))
upper = mesh_obj('upper', verts, faces, uvs, 'vamp')
clean(upper)
solidify(upper, .0018, -1, lining=True)

# ---------- overlay panels: each a real layer of material with its own thickness ----------
LAY = .0009
# quarter: the rear side panel, up to the collar and eyestay
for side, nm in ((1, 'L'), (-1, 'M')):
    def q(a, b, side=side):
        tq = .54 - .12 * a
        t = b * tq
        pe = phie(t)
        ph = a * pe * .985
        return t, (ph if side > 0 else math.pi - ph), LAY
    o = grid('quarter' + nm, q, 26 if HI else 12, 60 if HI else 26, 'quarter'); solidify(o, .0011)
# heel counter
if P['counter']:
    for side, nm in ((1, 'L'), (-1, 'M')):
        def hc(a, b, side=side):
            ah = a * .78
            th = .21 - .09 * ah ** 1.4
            t = b * th
            ph = ah * phie(t)
            return t, (ph if side > 0 else math.pi - ph), LAY * 2.2
        o = grid('heel' + nm, hc, 22 if HI else 10, 34 if HI else 14, 'heel'); solidify(o, .0012)
# toe cap, across the top
if P['cap']:
    def tc(a, b):
        ph = a * math.pi
        hf = abs(math.sin(ph)) ** E
        t0 = .80 - .07 * (1 - hf) ** 2 if MODEL != 'derby' else .78 - .02 * (1 - hf)
        if P.get('bumper'): t0 = .86 - .13 * (1 - hf) ** 1.5
        return t0 + b * (1 - t0) * .999, ph, LAY * (3.4 if P.get('bumper') else 1)
    o = grid('toe', tc, 48 if HI else 20, 24 if HI else 10, 'toe'); solidify(o, .0022 if P.get('bumper') else .0011)
# mudguard: a protective band round the bottom of the upper
if P.get('mud'):
    for side, nm in ((1, 'L'), (-1, 'M')):
        def md(a, b, side=side):
            t = b
            hm = .17 + .05 * smooth(.5, 1, t) + .04 * math.sin(t * math.pi * 3) ** 2
            ph = a * math.asin(hm ** (N / 2))
            return t, (ph if side > 0 else math.pi - ph), LAY * 2.8
        o = grid('mud' + nm, md, 6 if HI else 3, 90 if HI else 36, 'mudguard'); solidify(o, .0014)
# eyestay: a band along the lace opening
for side, nm in ((1, 'L'), (-1, 'M')):
    def ey(a, b, side=side):
        t = TS - .03 + a * (TE - TS + .028)
        pe = phie(t)
        ph = pe - .24 * (1 - b) * (1 - smooth(TE - .05, TE, t) * .6)
        return t, (ph if side > 0 else math.pi - ph), LAY * 3.2
    o = grid('eyestay' + nm, ey, 8 if HI else 4, 40 if HI else 18, 'eyestay'); solidify(o, .0012)
# side logo: an original Abidora "wave" mark on both sides
if P['logo'] == 'wave':
    for side, nm in ((1, 'L'), (-1, 'M')):
        def lg(a, b, side=side):
            t = .29 + .32 * b
            mid = .30 + .34 * b + .06 * math.sin(b * math.pi * 1.6)
            wdt = .07 * math.sin(math.pi * min(1, b * 1.08)) ** .7 + .004
            fr = mid + (a - .5) * wdt * 2
            ph = fr * phie(t)
            return t, (ph if side > 0 else math.pi - ph), LAY * 4.4
        o = grid('logo' + nm, lg, 6 if HI else 3, 40 if HI else 16, 'logo'); solidify(o, .0008)
# heel tab with room for initials
def tab(a, b):
    t = .0 + .05 * b
    ph = (.70 + .30 * a) * phie(t)
    return t, ph, LAY * 3.3
for side in (1, -1):
    def tb(a, b, side=side):
        t, ph, off = tab(a, b)
        return t, (ph if side > 0 else math.pi - ph), off
    o = grid('tab' + ('L' if side > 0 else 'M'), tb, 6, 6, 'logo'); solidify(o, .0012)

# ---------- stitching: rows of real thread stitches along the panel edges ----------
STB = bmesh.new()
def stitch(fn, n_mm=None):
    pts = [fn(k / 200) for k in range(201)]
    P3 = [shell(min(1, max(0, t)), ph) + normal(min(1, max(0, t)), ph) * off for t, ph, off in pts]
    length = sum((P3[k + 1] - P3[k]).length for k in range(200))
    pitch = .0042; n = int(length / pitch)
    acc = [0.0]
    for k in range(200): acc.append(acc[-1] + (P3[k + 1] - P3[k]).length)
    def at(d):
        k = 0
        while k < 199 and acc[k + 1] < d: k += 1
        f = (d - acc[k]) / max(1e-9, acc[k + 1] - acc[k]); return P3[k].lerp(P3[k + 1], f), k
    for i in range(n):
        a, k = at(i * pitch + .0005); b, _ = at(i * pitch + .0030)
        t, ph, _ = pts[k]; nrm = normal(min(1, max(0, t)), ph)
        d = b - a; side = d.cross(nrm).normalized() * .00045; up = nrm * .00035
        vs = [STB.verts.new(p) for p in (a - side, a + side, b + side, b - side, a - side + up, a + side + up, b + side + up, b - side + up)]
        for f in ((0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
            STB.faces.new([vs[j] for j in f])
TH = LAY * 1.0 + .0012
for side in (1, -1):
    sgn = lambda ph, side=side: ph if side > 0 else math.pi - ph
    # quarter front edge
    stitch(lambda u, sgn=sgn: ((.54 - .12 * u) - .006, sgn(u * phie(.54 - .12 * u) * .985 * .97), TH))
    if P['counter']:
        stitch(lambda u, sgn=sgn: ((.21 - .09 * (u * .78) ** 1.4) - .005, sgn(u * .78 * phie(.21 - .09 * (u * .78) ** 1.4)), LAY * 2.2 + .0013))
    stitch(lambda u, sgn=sgn: (TS - .03 + u * (TE - TS + .028), sgn(phie(TS - .03 + u * (TE - TS + .028)) - .22 * (1 - smooth(TE - .05, TE, TS - .03 + u * (TE - TS + .028)) * .6)), LAY * 3.2 + .0013))
    if P.get('mud'):
        stitch(lambda u, sgn=sgn: (u, sgn(math.asin((.17 + .05 * smooth(.5, 1, u) + .04 * math.sin(u * math.pi * 3) ** 2) ** (N / 2)) - .03), LAY * 2.8 + .0015))
if P['cap']:
    def capedge(u):
        ph = .02 + u * (math.pi - .04); hf = abs(math.sin(ph)) ** E
        t0 = .80 - .07 * (1 - hf) ** 2 if MODEL != 'derby' else .78 - .02 * (1 - hf)
        if P.get('bumper'): t0 = .86 - .13 * (1 - hf) ** 1.5
        return t0 + .006, ph, LAY * (3.4 if P.get('bumper') else 1) + (.0023 if P.get('bumper') else .0012)
    stitch(capedge)
me = bpy.data.meshes.new('stitches'); STB.to_mesh(me); STB.free()
so = bpy.data.objects.new('stitches', me); bpy.context.collection.objects.link(so)
DEF.setdefault('thread', DEF['eyestay'] if MODEL != 'derby' else ((.75, .62, .45), .6))
me.materials.append(mat('thread')); me.uv_layers.new(name='UVMap')

# ---------- padded collar round the opening ----------
cu = bpy.data.curves.new('collar', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = .0075 if MODEL == 'boot' else .0048; cu.bevel_resolution = 4 if HI else 2; cu.resolution_u = 6
sp = cu.splines.new('NURBS')
cp = []
K = 40 if HI else 18
for k in range(K + 1):
    t = TS * (1 - k / K)
    pe = phie(t); cp.append(shell(t, pe) - normal(t, pe) * .003 + Vector((0, 0, .001)))
for k in range(1, K + 1):
    t = TS * k / K
    pe = phie(t); cp.append(shell(t, math.pi - pe) - normal(t, math.pi - pe) * .003 + Vector((0, 0, .001)))
sp.points.add(len(cp) - 1)
for p, c in zip(sp.points, cp): p.co = (c.x, c.y, c.z, 1)
sp.use_endpoint_u = True; sp.order_u = 4
col = bpy.data.objects.new('collar', cu); bpy.context.collection.objects.link(col); cu.materials.append(mat('lining'))

# ---------- tongue ----------
TEND = .05 if Rf(0) < .12 else .03
UP = .016 if Rf(0) < .12 else .014
def tongue_pt(a, b, lift=0.0):
    t = (TE - .025) + a * ((TS - TEND) - (TE - .025))
    tt = max(t, 0)
    roof = min(zb(tt) + Rf(tt), zb(tt) + Cf(tt) + .012) if tt < TS else zb(tt) + Rf(tt)
    up = UP * smooth(.6, 1, a)
    hw = .021 + .008 * a
    z = roof - .004 + up - .011 * b * b + lift
    return Vector((t * L, b * hw, z))

TA, TB = (40, 16) if HI else (16, 8)
tv, tuv, tf = [], [], []
for i in range(TA + 1):
    for j in range(TB + 1):
        p = tongue_pt(i / TA, -1 + 2 * j / TB); tv.append(p); tuv.append((p.x * 10, p.y * 10))
for i in range(TA):
    for j in range(TB):
        a = i * (TB + 1) + j; tf.append((a, a + 1, a + TB + 2, a + TB + 1))
tg = mesh_obj('tongue', tv, tf, tuv, 'tongue'); s = solidify(tg, .0045, -1); s.use_rim = True
# a woven label near the top of the tongue
lv, luv, lf = [], [], []
for i in range(5):
    for j in range(5):
        a = .70 + .18 * i / 4; b = -.45 + .9 * j / 4
        p = tongue_pt(a, b, .0012); lv.append(p); luv.append((j / 4, i / 4))
for i in range(4):
    for j in range(4):
        a = i * 5 + j; lf.append((a, a + 1, a + 6, a + 5))
lb = mesh_obj('label', lv, lf, luv, 'logo'); solidify(lb, .0006)

# ---------- eyelets + laces ----------
EL, EM = [], []
if MODEL != 'loafer':
    n = P['eyelets']
    for k in range(n):
        t = (TE - .045) - (TE - .045 - (TS + .015)) * k / (n - 1)
        for side, lst in ((1, EL), (-1, EM)):
            pe = phie(t) - .11
            ph = pe if side > 0 else math.pi - pe
            p = shell(t, ph) + normal(t, ph) * (LAY * 3.2 + .0012); nm = normal(t, ph)
            bpy.ops.mesh.primitive_torus_add(major_radius=.0033, minor_radius=.0011, major_segments=20 if HI else 10, minor_segments=8 if HI else 5, location=p,
                                             rotation=nm.to_track_quat('Z', 'Y').to_euler())
            eo = bpy.context.active_object; eo.data.materials.append(mat('eyelets'))
            for pp in eo.data.polygons: pp.use_smooth = True
            lst.append((p, nm, t))
    lcu = bpy.data.curves.new('laces', 'CURVE'); lcu.dimensions = '3D'; lcu.bevel_depth = .0021 if MODEL != 'derby' else .0014
    lcu.bevel_resolution = 3 if HI else 1; lcu.resolution_u = 10 if HI else 5

    def over(a, b, k=.5):
        m = a.lerp(b, k)
        tt = m.x / L
        top = tongue_pt(min(1, max(0, (tt - (TE - .025)) / ((TS - .085) - (TE - .025)))), 0).z + .0055
        return Vector((m.x, m.y, max(m.z, top)))

    def seg(a, b, na, nb):
        sp = lcu.splines.new('NURBS'); pts = [a - na * .0006, a + na * .002, over(a, b, .3), over(a, b, .5), over(a, b, .7), b + nb * .002, b - nb * .0006]
        sp.points.add(len(pts) - 1)
        for p, c in zip(sp.points, pts): p.co = (c.x, c.y, c.z, 1)
        sp.use_endpoint_u = True; sp.order_u = 4

    seg(EL[0][0], EM[0][0], EL[0][1], EM[0][1])
    for k in range(len(EL) - 1):
        seg(EL[k][0], EM[k + 1][0], EL[k][1], EM[k + 1][1])
        seg(EM[k][0], EL[k + 1][0], EM[k][1], EL[k + 1][1])
    # the bow: two loops and two ends, tied above the top eyelets
    top = over(EL[-1][0], EM[-1][0]) + Vector((-.004, 0, .004))
    for sgn in (1, -1):
        sp = lcu.splines.new('NURBS')
        pts = [top, top + Vector((.012, sgn * .018, .006)), top + Vector((.03, sgn * .034, -.002)), top + Vector((.016, sgn * .03, -.012)), top + Vector((.002, sgn * .006, -.002)), top]
        sp.points.add(len(pts) - 1)
        for p, c in zip(sp.points, pts): p.co = (c.x, c.y, c.z, 1)
        sp.use_endpoint_u = True; sp.order_u = 4
        sp = lcu.splines.new('NURBS')
        side_pt = shell(EL[-1][2] - .02, (math.pi / 2 - .9) if sgn < 0 else (math.pi / 2 + .9))
        pts = [top, top + Vector((-.006, -sgn * .01, -.004)), top + Vector((-.014, -sgn * .022, -.02)), Vector((side_pt.x - .01, side_pt.y * 1.25, side_pt.z - .028))]
        sp.points.add(len(pts) - 1)
        for p, c in zip(sp.points, pts): p.co = (c.x, c.y, c.z, 1)
        sp.use_endpoint_u = True; sp.order_u = 3
    lo = bpy.data.objects.new('laces', lcu); bpy.context.collection.objects.link(lo); lcu.materials.append(mat('laces'))

# ---------- sole: midsole (or leather welt) and outsole, built as clean quad slabs ----------
def slab(name, t0, t1, bot, topf, pad, zone, NUs, NS, bulge=0.0, lift_edge=0.0):
    """bot(t), topf(t) heights; pad: outline offset beyond the last; sides bulge outwards (foam)"""
    def edge(t, s):  # s = +1 outer side, -1 inner side
        w = W * (FL(t) if s > 0 else FM(t)) + pad(t)
        x = -.006 + t * (L + .012)
        return x, -s * w
    rows = [t0 + (t1 - t0) * (1 - math.cos(math.pi * i / NUs)) / 2 for i in range(NUs + 1)]
    verts, uvs, faces = [], [], []
    def add(p): verts.append(p); uvs.append((p.x * 10, (p.y + p.z * (1 if p.y >= 0 else -1)) * 10)); return len(verts) - 1
    top, btm = [], []
    for t in rows:
        rt, rb = [], []
        for j in range(NS + 1):
            s = -1 + 2 * j / NS
            xo, yo = edge(t, 1 if s >= 0 else -1)
            y = yo * abs(s)
            rt.append(add(Vector((xo, y, topf(t) + lift_edge * abs(s) ** 6))))
            rb.append(add(Vector((xo, y, bot(t)))))
        top.append(rt); btm.append(rb)
    for i in range(NUs):
        for j in range(NS):
            faces.append((top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]))
            faces.append((btm[i][j], btm[i + 1][j], btm[i + 1][j + 1], btm[i][j + 1]))
    # boundary ring of the grid, walked once around
    ring = [(0, j) for j in range(NS + 1)] + [(i, NS) for i in range(1, NUs + 1)] + [(NUs, j) for j in range(NS - 1, -1, -1)] + [(i, 0) for i in range(NUs - 1, 0, -1)]
    LEV = 5
    walls = []
    for (i, j) in ring:
        a, b = verts[top[i][j]], verts[btm[i][j]]
        col = [top[i][j]]
        cx = Vector((a.x, 0, 0))
        for k in range(1, LEV):
            f = k / LEV
            p = a.lerp(b, f)
            out = Vector((0, p.y, 0)); out = out.normalized() if out.length > 1e-6 else Vector((0, 0, 0))
            col.append(add(p + out * bulge * math.sin(math.pi * f)))
        col.append(btm[i][j]); walls.append(col)
    for r in range(len(walls)):
        A, B = walls[r], walls[(r + 1) % len(walls)]
        for k in range(LEV):
            faces.append((A[k], A[k + 1], B[k + 1], B[k]))
    ob = mesh_obj(name, verts, faces, uvs, zone)
    clean(ob, 1e-6)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    bv = ob.modifiers.new('bevel', 'BEVEL'); bv.width = .0016; bv.segments = 3 if HI else 1; bv.limit_method = 'ANGLE'; bv.angle_limit = math.radians(40)
    for p in ob.data.polygons: p.use_smooth = True
    return ob


NS = 28 if HI else 12
NUS = 90 if HI else 40
pad = lambda t: P['pad'] + (.004 * (1 - smooth(0, .3, t)) if P['sole'] == 'foam' else 0)
if P['sole'] == 'leather':
    slab('welt', 0, 1, lambda t: y0(t) - .006, lambda t: y0(t) + .0008, lambda t: P['pad'], 'midsole', NUS, NS)
    slab('outsole', .27, 1, lambda t: y0(t) - .006 - P['outsole'], lambda t: y0(t) - .0058, lambda t: P['pad'] - .0004, 'outsole', NUS, NS)
    slab('heelblock', 0, .25, lambda t: 0.0, lambda t: y0(t) - .0058, lambda t: P['pad'] - .0006, 'outsole', 30 if HI else 12, NS)
elif P['sole'] == 'lug':
    ot, lh = P['outsole'], P['lug']
    slab('midsole', 0, 1, lambda t: gap(t) + lh + ot - .0006, lambda t: y0(t) + lh, pad, 'midsole', NUS, NS, bulge=P['bulge'], lift_edge=.003)
    slab('outsole', 0, 1, lambda t: gap(t) + lh, lambda t: gap(t) + lh + ot, lambda t: pad(t) - .0004, 'outsole', NUS, NS, lift_edge=.006)
    # real lugs: chevron blocks under the forefoot and heel, edge lugs round the rim
    bm = bmesh.new()
    def lug(x, y, z, sx, sy, rot):
        r_ = bmesh.ops.create_cube(bm, size=1)['verts']
        for v in r_:
            tp = .78 if v.co.z < 0 else 1.0   # lugs taper towards the ground for grip and self-cleaning
            v.co.x *= sx * tp; v.co.y *= sy * tp; v.co.z *= lh
            c, s_ = math.cos(rot), math.sin(rot)
            v.co.x, v.co.y = v.co.x * c - v.co.y * s_, v.co.x * s_ + v.co.y * c
            v.co += Vector((x, y, z + lh / 2 + .0002))
    for i in range(34):
        t = .03 + .94 * i / 33
        if .38 < t < .52: continue
        w_l, w_m = W * FL(t) + pad(t) - .003, W * FM(t) + pad(t) - .003
        x = -.006 + t * (L + .012)
        for j, s_ in enumerate((-.85, -.45, 0, .45, .85)):
            w = w_l if s_ < 0 else w_m
            if abs(s_) > .8 and i % 2: continue
            ang = (.5 if s_ <= 0 else -.5) * (1 if (i % 2) else .7)
            lug(x, s_ * w, gap(t), .0082 if abs(s_) < .8 else .010, .0115 if abs(s_) < .8 else .0068, ang)
    me = bpy.data.meshes.new('lugs'); bm.to_mesh(me); bm.free()
    lo_ = bpy.data.objects.new('lugs', me); bpy.context.collection.objects.link(lo_); me.materials.append(mat('outsole'))
    bv = lo_.modifiers.new('bevel', 'BEVEL'); bv.width = .0012; bv.segments = 2 if HI else 1
    uvl = me.uv_layers.new(name='UVMap')
else:
    ot = P['outsole']
    slab('midsole', 0, 1, lambda t: gap(t) + ot - .0006, lambda t: y0(t), pad, 'midsole', NUS, NS, bulge=P['bulge'], lift_edge=.004 if P['sole'] == 'cup' else .002)
    slab('outsole', 0, 1, lambda t: gap(t), lambda t: gap(t) + ot, lambda t: pad(t) - .0005, 'outsole', NUS, NS)

# insole (visible through the opening)
iv, iuv, ifc = [], [], []
for i in range(31):
    t = .02 + .9 * i / 30
    for j in range(9):
        s = -1 + 2 * j / 8
        w = W * (FL(t) if s >= 0 else FM(t)) * .86
        p = Vector((t * L, -s * w * abs(s) ** 0 if s != 0 else 0, zb(t) + .0035)); p.y = -w * s
        iv.append(p); iuv.append((t, (s + 1) / 2))
for i in range(30):
    for j in range(8):
        a = i * 9 + j; ifc.append((a, a + 9, a + 10, a + 1))
mesh_obj('insole', iv, ifc, iuv, 'lining')

# ---------- ambient occlusion baked into vertex colours, then export ----------
sys.path.insert(0, __import__('os').path.dirname(__file__))
from finish import bake_and_export
bake_and_export(OUT, HI, distance=.010, strength=.85)
print('BUILT', MODEL, VAR, LOD, OUT)
