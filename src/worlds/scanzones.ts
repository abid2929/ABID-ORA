/* Part recolouring for real scanned products. A scan has one photographic texture, so its parts cannot simply be
   given new materials. The scan pipeline (tools/scan) writes a zone map: for every texel, which part it belongs to
   (sole, upper, laces ...), plus each part's mean brightness. In the shader each texel's own brightness relative to
   its part's mean is kept and multiplied by the new colour, so the scan's grain, wrinkles, stitching, dirt and
   shading all stay; only the colour (and, if asked, the finish) changes. */
import { THREE } from './show3d';

export interface ZoneInfo { id: string; label: string; texels: number; lum: number[]; hex: string[] }
export interface ZonePack { tex: THREE.Texture; zones: ZoneInfo[] }
export const MAXZ = 12;

export async function loadZones(base: string): Promise<ZonePack> {
  const [tex, js] = await Promise.all([new THREE.TextureLoader().loadAsync(base + 'zones.png'), fetch(base + 'zones.json').then((r) => { if (!r.ok) throw new Error('zones'); return r.json(); })]);
  tex.flipY = false; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return { tex, zones: (js.zones as ZoneInfo[]).slice(0, MAXZ) };
}

export interface ZoneLook { color: string | null; finish: 'factory' | 'matte' | 'satin' | 'gloss' }
const lin = (hex: string) => { const c = new THREE.Color(hex); return new THREE.Vector3(c.r, c.g, c.b); };   // THREE.Color is linear

/* patches a material so each part can be recoloured; lumIndex picks the colourway texture the material uses */
export function attachZones(m: THREE.MeshStandardMaterial, pack: ZonePack, looks: ZoneLook[], lumIndex = 0) {
  const n = pack.zones.length;
  const tint = Array.from({ length: MAXZ }, (_, i) => lin(looks[i]?.color ?? '#ffffff'));
  const amt = Array.from({ length: MAXZ }, (_, i) => (looks[i]?.color ? 1 : 0));
  const lum = Array.from({ length: MAXZ }, (_, i) => Math.max(.004, pack.zones[i]?.lum[lumIndex] ?? pack.zones[i]?.lum[0] ?? .2));
  const rough = Array.from({ length: MAXZ }, (_, i) => ({ factory: 0, matte: .3, satin: -.08, gloss: -.35 })[looks[i]?.finish ?? 'factory']);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { zoneMap: { value: pack.tex }, uTint: { value: tint }, uAmt: { value: amt }, uLum: { value: lum }, uRough: { value: rough } });
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', `uniform sampler2D zoneMap; uniform vec3 uTint[${MAXZ}]; uniform float uAmt[${MAXZ}]; uniform float uLum[${MAXZ}]; uniform float uRough[${MAXZ}];\nvoid main() {`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  #ifdef USE_MAP
  int zid = clamp(int(texture2D(zoneMap, vMapUv).r * 255.0 + 0.5), 0, ${n - 1});
  float zl = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
  vec3 rc = uTint[zid] * clamp(zl / uLum[zid], 0.0, 3.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, rc, uAmt[zid]);
  #else
  int zid = 0;
  #endif`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor + uRough[zid], .04, 1.0);');
  };
  m.customProgramCacheKey = () => 'scanzones' + n;
  m.needsUpdate = true;
  return m;
}
