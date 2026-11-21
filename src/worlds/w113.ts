/* 113 Rain World. A city street in the rain, rendered in real time.
   What is real here: GPU rain streaks that fall at drop terminal speed and lean with the wind, splashes,
   puddles that fill while it rains and drain when it stops, ripples where drops land, planar mirror
   reflections on the wet road (streaked like real wet asphalt), wet darkened materials, lit windows,
   neon, street lamps, lightning with thunder delayed by the speed of sound, drops on the lens, bloom,
   and synthesised rain/wind/thunder/city sound. What is not: the water is drawn by shaders, not simulated
   as a fluid. The car and bicycles are the owner's downloaded models (Sketchfab Standard licence). */
import type { Ctx } from './kit';
import { THREE, stage, sec, para, slider, segs, stats, chips, btns, el, canvasTex, glowTex, GLSL_NOISE, loadGLB, rng, clamp, lerp, noise2 } from './nskit';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- presets ---------- */
type Tod = 'morning' | 'afternoon' | 'sunset' | 'night' | 'late';
interface Wx { mm: number; wind: number; fog: number; tod?: Tod; storm: boolean }
const WX: Record<string, Wx> = {
  light: { mm: 2.5, wind: 2, fog: .010, storm: false },
  moderate: { mm: 7, wind: 4, fog: .013, storm: false },
  heavy: { mm: 25, wind: 7, fog: .018, storm: false },
  extreme: { mm: 70, wind: 18, fog: .03, storm: true },
  thunder: { mm: 40, wind: 11, fog: .02, storm: true },
  foggy: { mm: 3, wind: 1, fog: .045, storm: false },
  evening: { mm: 8, wind: 4, fog: .014, tod: 'sunset', storm: false },
  night: { mm: 10, wind: 5, fog: .014, tod: 'night', storm: false },
  sunset: { mm: 4, wind: 3, fog: .011, tod: 'sunset', storm: false },
};
/* time of day: sun elevation, sky top/horizon, ambient, lamps, lit windows share */
const TOD: Record<Tod, { sun: number; top: number[]; hor: number[]; glow: number[]; amb: number; lamps: number; win: number; neon: number; exp: number }> = {
  morning: { sun: 14, top: [.30, .34, .40], hor: [.52, .55, .58], glow: [.25, .2, .14], amb: .9, lamps: .25, win: .12, neon: .35, exp: .95 },
  afternoon: { sun: 40, top: [.36, .39, .44], hor: [.58, .6, .62], glow: [.08, .08, .07], amb: 1.15, lamps: 0, win: .06, neon: .25, exp: .85 },
  sunset: { sun: 3, top: [.13, .13, .2], hor: [.55, .33, .24], glow: [.9, .38, .12], amb: .55, lamps: .8, win: .4, neon: .8, exp: 1.05 },
  night: { sun: -20, top: [.012, .015, .03], hor: [.09, .065, .06], glow: [0, 0, 0], amb: .12, lamps: 1, win: .55, neon: 1, exp: .95 },
  late: { sun: -35, top: [.005, .006, .012], hor: [.04, .03, .03], glow: [0, 0, 0], amb: .06, lamps: 1, win: .18, neon: .85, exp: 1.05 },
};
type Q = 'low' | 'medium' | 'high' | 'ultra';
const QS: Record<Q, { rain: number; splash: number; mirror: number; bloom: boolean; dpr: number; lights: number }> = {
  low: { rain: 7000, splash: 250, mirror: 0, bloom: false, dpr: 1, lights: 2 },
  medium: { rain: 18000, splash: 700, mirror: .35, bloom: true, dpr: 1.25, lights: 4 },
  high: { rain: 34000, splash: 1400, mirror: .5, bloom: true, dpr: 1.5, lights: 6 },
  ultra: { rain: 60000, splash: 2600, mirror: .75, bloom: true, dpr: 2, lights: 8 },
};

/* street layout (metres): road along x, |z| < 4.5 road, 4.5..8.5 pavement (15 cm kerb), buildings beyond */
const ROAD = 4.5, WALK = 8.5, KERB = .15, LEN = 260;

const GLSL_HASH = `float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p*=2.07;a*=.5;}return s;}
vec2 ripples(vec2 p,float t,float rate){vec2 i=floor(p),f=fract(p),n=vec2(0.);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),c=i+o;float h=hs(c);
    float tt=fract(t*1.1+h*7.31); if(hs(c+floor(t*1.1+h*7.31)*.37)>rate) continue;
    vec2 d=o+vec2(hs(c+3.7),hs(c+9.1))-f; float l=length(d), w=l-tt*.95;
    float a=(1.-tt)*(1.-tt)*smoothstep(.16,0.,abs(w));
    n+=d/(l+1e-4)*sin(w*42.)*a;}
  return n;}`;

/* ---------- wet ground material: asphalt or paving, puddles, ripples, mirror reflections ---------- */
function wetGround(kind: 'road' | 'walk', U: Record<string, { value: unknown }>) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec4 vMir; uniform mat4 uTexMat;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz; vMir=uTexMat*vec4(vW,1.);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; varying vec4 vMir; uniform sampler2D uMirror; uniform float uMirOn, uWet, uPud, uRate, uT, uFlash;
      ${GLSL_HASH}
      float pud; vec2 rip;`)
      .replace('#include <map_fragment>', `
        vec2 P=vW.xz;
        ${kind === 'road' ? `
        float ag=vn(P*9.)*.5+vn(P*31.)*.5, patchy=fb(P*.12);
        vec3 base=vec3(.055,.056,.058)*(.75+.5*ag)*(.8+.4*patchy);
        float ax=abs(vW.z);
        /* lane markings: dashed centre, solid edges, zebra crossing at x 18..22 */
        float dash=step(abs(vW.z),.07)*step(fract(vW.x/9.),.55);
        float edge=step(abs(ax-${(ROAD - .35).toFixed(2)}),.07);
        float zebra=step(abs(vW.x-20.),2.)*step(fract(vW.z/1.1),.55)*step(ax,${(ROAD - .6).toFixed(2)});
        float paint=max(max(dash,edge),zebra)*(.75+.25*vn(P*14.));
        base=mix(base,vec3(.62,.6,.55),paint);
        float gutter=smoothstep(${(ROAD - 1.2).toFixed(2)},${ROAD.toFixed(2)},ax);
        pud=smoothstep(.56-uPud*.32,.6-uPud*.32,fb(P*.22+vec2(3.1,7.7))+gutter*.28*uPud);
        ` : `
        vec2 tile=P/vec2(.6,.6); vec2 tf=fract(tile); float th=hs(floor(tile));
        float joint=1.-step(.035,tf.x)*step(.035,tf.y)*step(tf.x,.965)*step(tf.y,.965);
        vec3 base=mix(vec3(.24,.23,.22),vec3(.3,.29,.27),th)*(.8+.3*vn(P*7.));
        base=mix(base,vec3(.06),joint*.8);
        pud=smoothstep(.62-uPud*.25,.66-uPud*.25,fb(P*.35+vec2(9.,1.)))*.9;
        `}
        float wet=uWet;
        diffuseColor.rgb*=base*mix(1.,.42,wet)*mix(1.,.55,pud);
        rip=(ripples(P*3.2,uT,uRate)+ripples(P*5.7+11.,uT*1.13,uRate)*.6)*pud;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(.9,.38,wet),.03,pud);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal=normalize(normal+(viewMatrix*vec4(rip.x*.35,0.,rip.y*.35,0.)).xyz);')
      .replace('#include <opaque_fragment>', `
        if(uMirOn>.5){
          vec3 vd=normalize(cameraPosition-vW); float fr=.03+.97*pow(1.-max(vd.y,0.),5.);
          vec4 mp=vMir; vec2 dis=(rip*.06+vec2(vn(P*6.)-.5,vn(P*6.+5.)-.5)*.03*(1.-pud))*mp.w;
          mp.xy+=dis;
          float s=(1.-pud)*.022*mp.w; vec3 r=texture2DProj(uMirror,mp).rgb*.4;
          r+=texture2DProj(uMirror,mp+vec4(0.,s,0.,0.)).rgb*.2+texture2DProj(uMirror,mp-vec4(0.,s,0.,0.)).rgb*.2;
          r+=texture2DProj(uMirror,mp+vec4(0.,s*2.2,0.,0.)).rgb*.1+texture2DProj(uMirror,mp-vec4(0.,s*2.2,0.,0.)).rgb*.1;
          float k=mix(wet*.55,.95,pud)*mix(.35,1.,fr)${kind === 'walk' ? '*.7' : ''};
          outgoingLight=mix(outgoingLight,r,k);
        }
        #include <opaque_fragment>`);
  };
  return m;
}

/* ---------- facades: windows from world coordinates, wet walls ---------- */
function facadeMat(U: Record<string, { value: unknown }>) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vNw;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
        vW=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz; vNw=normalize(mat3(modelMatrix*instanceMatrix)*objectNormal);
        #else
        vW=(modelMatrix*vec4(transformed,1.)).xyz; vNw=normalize(mat3(modelMatrix)*objectNormal);
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vW; varying vec3 vNw; uniform float uWet, uWin, uT, uFlash; ${GLSL_HASH}
      float glass; vec3 winE;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        glass=0.; winE=vec3(0.);
        if(abs(vNw.y)<.5){
          float u=abs(vNw.z)>.5?vW.x:vW.z, v=vW.y;
          float fx=fract(u/3.1), fy=fract(v/3.4); vec2 id=vec2(floor(u/3.1),floor(v/3.4));
          float sd=hs(id+floor(vW.x*.01+vW.z*.013)*13.);
          float inWin=step(.2,fx)*step(fx,.8)*step(.24,fy)*step(fy,.86)*step(4.8,v);
          float frame=inWin*(1.-step(.23,fx)*step(fx,.77)*step(.27,fy)*step(fy,.83));
          glass=inWin*(1.-frame);
          float lit=step(sd,uWin)*glass;
          vec3 wc=mix(vec3(1.,.72,.42),vec3(.75,.85,1.),step(.7,hs(id*1.7)));
          float blind=step(.5,hs(id+5.))*smoothstep(.5,.48,fy-.3*hs(id+2.));
          winE=wc*lit*(.6+.8*hs(id+9.))*mix(1.,.45,blind)*(.85+.15*sin(uT*.3+sd*40.));
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.03,.035,.04),glass);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.5,frame);
          /* rain streaks down the walls */
          float st=smoothstep(.55,.9,vn(vec2(u*3.,v*.15-uT*.05)))*uWet;
          diffuseColor.rgb*=1.-st*.25*(1.-glass);
          if(v<4.6) diffuseColor.rgb*=.55;
        }
        diffuseColor.rgb*=mix(1.,.62,uWet*(1.-glass));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(mix(.88,.5,uWet),.04,glass);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=winE*1.6;');
  };
  return m;
}

const SKY_VS = `varying vec3 vD; void main(){ vD=(modelMatrix*vec4(position,1.)).xyz-cameraPosition; vec4 p=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); gl_Position=p.xyww; }`;
const SKY_FS = `uniform vec3 uTop,uHor,uGlow,uSun; uniform float uT,uFlash,uWindA; varying vec3 vD; ${GLSL_NOISE}
void main(){ vec3 d=normalize(vD); float h=d.y;
  vec2 p=d.xz/(max(h,0.)+.12); vec2 w=vec2(cos(uWindA),sin(uWindA));
  float c=fbm(vec3(p*.55+w*uT*.025,uT*.01))*.5+.5, c2=fbm(vec3(p*1.7-w*uT*.04,uT*.02))*.5+.5;
  vec3 col=mix(uHor,uTop,pow(clamp(h,0.,1.),.5));
  col*=.7+.5*c*mix(1.,c2,.5)*smoothstep(-.02,.25,h);
  float mu=max(dot(d,normalize(uSun)),0.);
  col+=uGlow*(pow(mu,5.)*.8+pow(mu,30.)*.6)*(1.-c*.5)*smoothstep(-.1,.25,1.-h);
  col+=vec3(.55,.6,.8)*uFlash*(.5+1.2*c*c);
  col=mix(col,uHor*.7,smoothstep(0.,-.1,h));
  gl_FragColor=vec4(col,1.);
  #include <colorspace_fragment>
}`;

/* rain streaks: instanced quads that loop through a box around the camera */
const RAIN_VS = `attribute vec4 aS; uniform float uT,uH,uB,uSpeed; uniform vec3 uWind; uniform vec3 uLamp[8]; uniform float uLampOn[8]; uniform vec3 uAmb; uniform float uFlash;
varying float vA; varying vec2 vUv; varying vec3 vC;
void main(){
  vec3 cam=cameraPosition; float y0=max(0.,cam.y-uH*.45);
  float sp=uSpeed*(.75+.5*aS.w), fall=uT*sp+aS.z*uH*7.;
  float y=y0+uH-mod(fall,uH);
  vec3 v=normalize(vec3(uWind.x,-sp,uWind.z));
  vec2 xz=vec2(aS.x,aS.y)*uB-uB*.5 - uWind.xz/sp*(y-y0);
  xz=mod(xz-cam.xz+uB*.5+uWind.xz*uT*.0,uB)-uB*.5+cam.xz;
  vec3 c=vec3(xz.x,y,xz.y);
  vec3 vd=normalize(c-cam); vec3 side=normalize(cross(v,vd));
  float len=sp*.022*(.8+.4*aS.w), wid=.006+.006*aS.w;
  float d=distance(c,cam); wid*=max(1.,d*.12);
  vec3 p=c+side*position.x*wid+v*position.y*len;
  vUv=position.xy+.5;
  vec3 L=uAmb*.6; for(int i=0;i<8;i++){ float dl=distance(c,uLamp[i]); L+=vec3(1.,.82,.55)*uLampOn[i]*6./(1.+dl*dl*.35); }
  L+=vec3(.7,.75,1.)*uFlash*1.5;
  vC=L; vA=smoothstep(0.,1.5,d)*smoothstep(uB*.5,uB*.3,length(c.xz-cam.xz))*(.18+.2*aS.w);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const RAIN_FS = `varying float vA; varying vec2 vUv; varying vec3 vC;
void main(){ float a=vA*(1.-abs(vUv.x*2.-1.))*smoothstep(0.,.3,vUv.y)*smoothstep(1.,.6,vUv.y); if(a<.003) discard; gl_FragColor=vec4(vC*.9+.05,a); }`;

/* splashes: tiny crowns where drops land */
const SPL_VS = `attribute vec3 aS; uniform float uT,uRate,uB; uniform vec3 uAmb; uniform vec3 uLamp[8]; uniform float uLampOn[8];
varying vec2 vUv; varying float vL; varying vec3 vC;
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  float per=.32+.2*aS.z, k=uT/per+aS.z*9.; float cyc=floor(k); vL=fract(k);
  vec2 r=vec2(hs(vec2(aS.x,cyc)),hs(vec2(aS.y,cyc+7.)));
  vec2 xz=cameraPosition.xz+(r-.5)*uB;
  float az=abs(xz.y); float y=az>${ROAD.toFixed(1)}&&az<${WALK.toFixed(1)}?${KERB}:0.;
  if(az>${WALK.toFixed(1)}) y=-5.;
  if(hs(vec2(cyc,aS.x))>uRate) y=-5.;
  vec3 c=vec3(xz.x,y+.002,xz.y);
  vec3 vd=normalize(c-cameraPosition); vec3 side=normalize(cross(vec3(0.,1.,0.),vd));
  float s=.05+.07*vL;
  vec3 p=c+side*position.x*s*1.6+vec3(0.,1.,0.)*(position.y+.5)*s*1.1;
  vUv=position.xy+.5;
  vec3 L=uAmb*.7; for(int i=0;i<8;i++){ float dl=distance(c,uLamp[i]); L+=vec3(1.,.82,.55)*uLampOn[i]*5./(1.+dl*dl*.3); }
  vC=L; gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const SPL_FS = `varying vec2 vUv; varying float vL; varying vec3 vC;
void main(){ vec2 q=vUv*2.-1.; q.y=q.y*1.4+.2;
  float crown=smoothstep(.12,0.,abs(length(q*vec2(1.,1.6))-.55-vL*.4))*step(-.1,q.y);
  float drops=0.; for(int i=0;i<5;i++){ float a=float(i)*1.256+.3; vec2 c=vec2(cos(a)*(.4+vL*.6),.15+sin(vL*3.)*.7*(.6+.4*sin(a*3.))); drops+=smoothstep(.09,0.,length(q-c)); }
  float a=(crown*.7+drops)*(1.-vL)*.55; if(a<.01) discard; gl_FragColor=vec4(vC+.06,a); }`;

/* lens: drops on the glass refract the picture; also a soft vignette */
const LENS = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uDrops: { value: 0 }, uAsp: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT,uDrops,uAsp; varying vec2 vUv;
    float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    vec3 layer(vec2 uv,float sc,float t){ vec2 g=uv*vec2(uAsp,1.)*sc; vec2 id=floor(g), f=fract(g)-.5; float h=hs(id);
      float life=fract(t*.07+h*13.), r=(.12+.22*h)*smoothstep(0.,.05,life)*smoothstep(1.,.85,life);
      vec2 c=(vec2(hs(id+1.3),hs(id+2.9))-.5)*.5; vec2 d=f-c; float m=smoothstep(r,r*.6,length(d));
      return vec3(d/max(r,.001),m*step(.35,h)); }
    vec3 slide(vec2 uv,float t){ float cols=uAsp*7.; float x=uv.x*cols; float id=floor(x); float h=hs(vec2(id,3.));
      float y=fract(-t*(.06+.12*h)+h); vec2 d=vec2((fract(x)-.5-.15*sin(uv.y*20.+h*6.))*1.2,(uv.y-y)*cols*.8);
      float m=smoothstep(.28,.18,length(d))*step(.55,h); float trail=smoothstep(.07,.0,abs(d.x))*step(0.,d.y)*smoothstep(4.,0.,d.y)*step(.55,h)*.5;
      return vec3(d,max(m,trail)); }
    void main(){ vec2 uv=vUv; vec2 off=vec2(0.); float m=0.;
      if(uDrops>0.){ vec3 a=layer(uv,22.,uT), b=layer(uv+.37,12.,uT*1.3), s=slide(uv,uT);
        off=(a.xy*a.z+b.xy*b.z*1.4+s.xy*s.z*.6)*.012*uDrops; m=max(max(a.z,b.z),s.z)*uDrops; }
      vec3 col=texture2D(tDiffuse,uv-off).rgb;
      if(m>0.){ vec3 bl=(texture2D(tDiffuse,uv+vec2(.004,0.)).rgb+texture2D(tDiffuse,uv-vec2(.004,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,.004)).rgb+texture2D(tDiffuse,uv-vec2(0.,.004)).rgb)*.25;
        col=mix(bl,col,.4+.6*m); col+=m*.02; }
      vec2 q=uv-.5; col*=1.-dot(q,q)*.55;
      gl_FragColor=vec4(col,1.); }`,
};

/* neon / shop sign texture */
function signTex(text: string, col: string, w = 512, h = 128, vertical = false) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h);
    g.save(); if (vertical) { g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2); g.translate(-h / 2, -w / 2); }
    const W2 = vertical ? h : w, H2 = vertical ? w : h;
    g.font = `600 ${Math.round(H2 * .52)}px 'Space Grotesk', 'Inter Tight', system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [b, a] of [[28, .5], [14, .7], [5, .9]] as const) { g.shadowColor = col; g.shadowBlur = b; g.globalAlpha = a; g.fillStyle = col; g.fillText(text, W2 / 2, H2 / 2 + 2); }
    g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = '#ffffff'; g.globalAlpha = .85; g.fillText(text, W2 / 2, H2 / 2 + 2);
    g.restore();
  });
}
function interiorTex(seed: number, warm: string) {
  return canvasTex(256, 128, (g, w, h) => {
    const R = rng(seed); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, warm); gr.addColorStop(.6, '#2a2018'); gr.addColorStop(1, '#0c0907'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${20 + R() * 40},${15 + R() * 30},${10 + R() * 20},${.5 + R() * .4})`; const x = R() * w, y = h * .45 + R() * h * .4; g.fillRect(x, y, 10 + R() * 40, h - y); }
    for (let i = 0; i < 5; i++) { const x = R() * w; const rg = g.createRadialGradient(x, 14, 1, x, 14, 40); rg.addColorStop(0, 'rgba(255,240,210,.9)'); rg.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = rg; g.fillRect(x - 40, 0, 80, 60); }
    g.fillStyle = '#0b0a09'; for (let x = 0; x <= w; x += w / 4) g.fillRect(x - 3, 0, 6, h); g.fillRect(0, h * .78, w, 5); g.fillRect(0, 0, w, 5);
  });
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World · Rain'), title: t('title', 'Rain World'), sub: t('sub', 'A city street in the rain. Change the weather and the hour, then stand under an awning and listen.'),
    acc: '#8fd0ff', ink: '#05070b', hf: "'Fraunces'", fov: 52, near: .05, far: 1500,
  });
  const { scene, camera, controls, renderer } = S;
  const isPhone = S.phone;
  const W0 = { wx: 'night', tod: 'night' as Tod, mm: WX.night.mm, wind: WX.night.wind, fog: WX.night.fog, pud: .55, storm: false, lightning: true, drops: false, paused: false, q: 'auto' as Q | 'auto' };
  const P = { ...W0, wet: 1, level: .55 };

  /* shared uniforms */
  const U = {
    uT: { value: 0 }, uWet: { value: 1 }, uPud: { value: .55 }, uRate: { value: .5 }, uFlash: { value: 0 }, uWin: { value: .5 },
    uMirror: { value: null as THREE.Texture | null }, uMirOn: { value: 1 }, uTexMat: { value: new THREE.Matrix4() },
  };

  /* ---------- sky, fog, light ---------- */
  const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, .2, -1) }, uT: U.uT, uFlash: U.uFlash, uWindA: { value: .4 } };
  const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
  scene.fog = new THREE.FogExp2(0x101418, .014);
  const hemi = new THREE.HemisphereLight(0x8090a0, 0x202020, .6); scene.add(hemi);
  const sunL = new THREE.DirectionalLight(0xffffff, .4); sunL.position.set(-60, 80, -40); scene.add(sunL);
  const flashL = new THREE.DirectionalLight(0xc8d4ff, 0); flashL.position.set(40, 120, -80); scene.add(flashL);
  /* image-based light from a matching sky with city glow, rebuilt when the hour changes */
  const pm = new THREE.PMREMGenerator(renderer); let envRT: THREE.WebGLRenderTarget | null = null;
  const envScene = new THREE.Scene(); const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); envScene.add(envSky);
  const envGlow = new THREE.Group(); envScene.add(envGlow);
  { const R = rng(4); for (let i = 0; i < 26; i++) { const a = R() * 6.283, m = new THREE.Mesh(new THREE.PlaneGeometry(6 + R() * 12, 2 + R() * 8), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(R() < .7 ? .08 : .55 + R() * .35, .7, .5).multiplyScalar(.35), side: THREE.DoubleSide })); m.position.set(Math.cos(a) * 60, 2 + R() * 18, Math.sin(a) * 60); m.lookAt(0, m.position.y, 0); envGlow.add(m); } }

  /* ---------- the street ---------- */
  const road = new THREE.Mesh(new THREE.PlaneGeometry(LEN, ROAD * 2, 1, 1).rotateX(-Math.PI / 2), wetGround('road', U)); scene.add(road);
  const walkM = wetGround('walk', U); const walks: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(LEN, WALK - ROAD, 1, 1).rotateX(-Math.PI / 2), walkM); w.position.set(0, KERB, s * (ROAD + WALK) / 2); scene.add(w); walks.push(w);
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(LEN, KERB, .22), new THREE.MeshStandardMaterial({ color: 0x55534f, roughness: .45 })); kerb.position.set(0, KERB / 2, s * (ROAD + .11)); scene.add(kerb);
  }
  /* buildings: instanced boxes with the facade shader */
  const R0 = rng(72), nn = noise2(72);
  const fac = facadeMat(U);
  const bList: { x: number; z: number; w: number; d: number; h: number; side: number }[] = [];
  for (const side of [-1, 1]) {
    let x = -LEN / 2;
    while (x < LEN / 2) { const w = 9 + R0() * 14, h = 12 + R0() * R0() * 46 + (Math.abs(x) > 60 ? R0() * 30 : 0), d = 12 + R0() * 10; bList.push({ x: x + w / 2, z: side * (WALK + d / 2), w: w - .3, d, h, side }); x += w + (R0() < .12 ? 3 : 0); }
    /* towers behind */
    for (let i = 0; i < 22; i++) { const w = 18 + R0() * 20, h = 50 + R0() * 110; bList.push({ x: (R0() - .5) * LEN * 1.1, z: side * (WALK + 30 + R0() * 70), w, d: w, h, side }); }
  }
  const bG = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const bM = new THREE.InstancedMesh(bG, fac, bList.length);
  const palette = [0x8a8178, 0x6e655c, 0x9a8f80, 0x5d5a57, 0x7b6a5c, 0x8c8c88, 0x4e4a47, 0xa39684];
  bList.forEach((b, i) => { bM.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(b.x, 0, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d))); bM.setColorAt(i, new THREE.Color(palette[Math.floor(R0() * palette.length)])); });
  scene.add(bM);
  /* rooftop details: parapets, water tanks, antennas (silhouettes against the sky) */
  { const g: THREE.BufferGeometry[] = []; for (const b of bList) { if (R0() < .45) { const s = 1.5 + R0() * 2; g.push(new THREE.CylinderGeometry(s, s, s * 1.4, 12).translate(b.x + (R0() - .5) * b.w * .5, b.h + s * .7, b.z + (R0() - .5) * b.d * .5)); } if (R0() < .3) g.push(new THREE.CylinderGeometry(.08, .08, 6 + R0() * 10, 5).translate(b.x, b.h + 5, b.z)); g.push(new THREE.BoxGeometry(b.w, .8, .3).translate(b.x, b.h + .4, b.z - b.side * b.d / 2)); }
    const m = new THREE.Mesh(mergeGeometries(g.map((x) => x.index ? x.toNonIndexed() : x))!, new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: .7 })); scene.add(m); }

  /* shopfronts, neon, awnings along the near blocks */
  const neonMats: THREE.MeshBasicMaterial[] = [], shopMats: THREE.MeshStandardMaterial[] = [];
  const SIGNS: [string, string][] = [['ABIDORA', '#8fd0ff'], ['NOODLES 24', '#ff5a7a'], ['CAFÉ', '#ffcf6a'], ['BOOKS', '#9dff9a'], ['PHARMACY', '#5affc8'], ['RAIN BAR', '#d78bff'], ['LAUNDRY', '#7ab8ff'], ['FLOWERS', '#ff9ad5'], ['HOTEL', '#ff7a3a'], ['OPEN', '#ff4d4d']];
  const awnings: { x: number; z: number; w: number; side: number }[] = [];
  let si = 0;
  for (const b of bList) {
    if (Math.abs(b.z) > WALK + 14 || Math.abs(b.x) > 75) continue;
    const zf = b.side * WALK; /* facade plane */
    const [txt, col] = SIGNS[si++ % SIGNS.length];
    const shop = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .05, metalness: 0, emissive: 0xffffff, emissiveMap: interiorTex(si * 7, ['#7a5a3a', '#3a5a6a', '#6a4a5a', '#5a6a3a'][si % 4]), emissiveIntensity: .7 });
    shopMats.push(shop);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(b.w * .78, 2.9), shop); win.position.set(b.x, 1.6 + KERB, zf + b.side * -.02); win.rotation.y = b.side > 0 ? Math.PI : 0; scene.add(win);
    const nm = new THREE.MeshBasicMaterial({ map: signTex(txt, col), toneMapped: false, color: 0xffffff }); neonMats.push(nm);
    const vertical = si % 4 === 1;
    const sign = vertical ? new THREE.Mesh(new THREE.PlaneGeometry(.9, 3.6), new THREE.MeshBasicMaterial({ map: signTex(txt.split(' ')[0], col, 128, 512, true), toneMapped: false })) : new THREE.Mesh(new THREE.PlaneGeometry(Math.min(b.w * .6, 5.5), Math.min(b.w * .6, 5.5) / 4), nm);
    if (vertical) { neonMats.push(sign.material as THREE.MeshBasicMaterial); sign.position.set(b.x - b.w * .4, 6.5, zf - b.side * .7); sign.rotation.y = Math.PI / 2; const s2 = sign.clone(); s2.rotation.y = -Math.PI / 2; s2.position.x += .01; scene.add(s2); }
    else { sign.position.set(b.x, 3.75 + KERB, zf - b.side * .06); sign.rotation.y = b.side > 0 ? Math.PI : 0; }
    scene.add(sign);
    if (R0() < .75) awnings.push({ x: b.x, z: zf, w: b.w * .82, side: b.side });
  }
  { const am = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, side: THREE.DoubleSide }); const cols = [0x3c1f1a, 0x1d3340, 0x2b3a22, 0x3a2a12, 0x222226];
    const g = new THREE.PlaneGeometry(1, 1.6, 1, 1); g.translate(0, -.8, 0);
    awnings.forEach((a, i) => { const m = new THREE.Mesh(g, am.clone()); (m.material as THREE.MeshStandardMaterial).color.set(cols[i % cols.length]); m.scale.set(a.w, 1, 1); m.position.set(a.x, 3.35 + KERB, a.z); m.rotation.set(a.side > 0 ? Math.PI / 2 - .35 : -(Math.PI / 2 - .35), 0, 0); scene.add(m); }); }

  /* street lamps: emissive heads everywhere, real lights on the nearest few */
  const lampPos: THREE.Vector3[] = [];
  { const pole = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: .35, metalness: .7 }); const head = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffd9a0, emissiveIntensity: 4 });
    const pg: THREE.BufferGeometry[] = [], hg: THREE.BufferGeometry[] = [];
    for (let x = -LEN / 2 + 8; x < LEN / 2; x += 18) for (const s of [-1, 1]) {
      const xx = x + (s > 0 ? 9 : 0), z = s * (ROAD + .55);
      pg.push(new THREE.CylinderGeometry(.07, .1, 7, 8).translate(xx, KERB + 3.5, z).toNonIndexed(), new THREE.BoxGeometry(.08, .08, 1.6).translate(xx, KERB + 6.95, z - s * .8).toNonIndexed());
      hg.push(new THREE.BoxGeometry(.5, .12, .28).translate(xx, KERB + 6.86, z - s * 1.5).toNonIndexed());
      lampPos.push(new THREE.Vector3(xx, KERB + 6.7, z - s * 1.5));
    }
    scene.add(new THREE.Mesh(mergeGeometries(pg)!, pole)); const hm = new THREE.Mesh(mergeGeometries(hg)!, head); scene.add(hm); shopMats.push(head);
    const gl = new THREE.SpriteMaterial({ map: glowTex(64), color: 0xffcc88, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 });
    for (const p of lampPos) { const s = new THREE.Sprite(gl); s.position.copy(p); s.scale.setScalar(2.2); scene.add(s); }
    (globalThis as unknown as { __lampGlow?: THREE.SpriteMaterial }).__lampGlow = gl;
  }
  const lampLights: THREE.PointLight[] = [];
  const nearLamps = [...lampPos].sort((a, b) => Math.hypot(a.x - 2, a.z) - Math.hypot(b.x - 2, b.z)).slice(0, 8);
  for (const p of nearLamps) { const l = new THREE.PointLight(0xffd29a, 30, 26, 1.6); l.position.copy(p).add(new THREE.Vector3(0, -.3, 0)); scene.add(l); lampLights.push(l); }

  /* traffic light at the zebra crossing: it really cycles */
  const tl = { t: 0, lamps: [] as THREE.MeshStandardMaterial[] };
  { const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 4.2, 8), new THREE.MeshStandardMaterial({ color: 0x222, metalness: .6, roughness: .4 })); pole.position.y = 2.1 + KERB; g.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(.32, .95, .26), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: .5 })); box.position.y = 4.3 + KERB; g.add(box);
    [0xff2a1a, 0xffa31a, 0x2aff7a].forEach((c, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x111, emissive: c, emissiveIntensity: 0 }); tl.lamps.push(m); const l = new THREE.Mesh(new THREE.CircleGeometry(.09, 20), m); l.position.set(0, 4.6 - i * .3 + KERB, .14); g.add(l); });
    g.position.set(17.4, 0, ROAD + .5); g.rotation.y = 0; scene.add(g); const g2 = g.clone(true); g2.position.set(22.6, 0, -ROAD - .5); g2.rotation.y = Math.PI; scene.add(g2);
    g2.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && tl.lamps.includes(m.material as THREE.MeshStandardMaterial)) { /* shares materials */ } }); }

  /* trees in planters along the pavement */
  { const parts: THREE.BufferGeometry[] = []; for (let k = 0; k < 6; k++) { const g = new THREE.IcosahedronGeometry(1, 3); const a = k / 6 * 6.283; g.scale(.8, .7, .8); g.translate(Math.cos(a) * .55 * (k ? 1 : 0), k ? 0 : .4, Math.sin(a) * .55 * (k ? 1 : 0)); parts.push(g); }
    const crown = mergeVertices(mergeGeometries(parts)!, 1e-4); { const p = crown.attributes.position, n2 = noise2(9), c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + n2(x * 3 + z, y * 3) * .25; p.setXYZ(i, x * d, y * d, z * d); const k = .5 + .5 * clamp(y + .4, 0, 1); c[i * 3] = .05 * k; c[i * 3 + 1] = .1 * k; c[i * 3 + 2] = .04 * k; } crown.setAttribute('color', new THREE.BufferAttribute(c, 3)); crown.computeVertexNormals(); }
    const trunk = new THREE.CylinderGeometry(.07, .12, 3.2, 8).translate(0, 1.6, 0), planter = new THREE.BoxGeometry(1.3, .45, 1.3).translate(0, .22, 0);
    const xs: number[] = []; for (let x = -LEN / 2 + 4; x < LEN / 2; x += 12) xs.push(x);
    const N = xs.length * 2, cm = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55 }), N), tm = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: .8 }), N), plm = new THREE.InstancedMesh(planter, new THREE.MeshStandardMaterial({ color: 0x4a4946, roughness: .6 }), N);
    let i = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (const x of xs) for (const s of [-1, 1]) { const z = s * (ROAD + 2.1), sc = 1.25 + R0() * .4; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R0() * 6); m4.compose(new THREE.Vector3(x, KERB, z), q, new THREE.Vector3(1, 1, 1)); tm.setMatrixAt(i, m4); plm.setMatrixAt(i, m4); m4.compose(new THREE.Vector3(x, KERB + 3.9, z), q, new THREE.Vector3(sc, sc * 1.2, sc)); cm.setMatrixAt(i, m4); i++; }
    scene.add(cm, tm, plm); }

  /* bollards and a bus shelter */
  { const g: THREE.BufferGeometry[] = []; for (let x = -40; x < 40; x += 2.2) g.push(new THREE.CylinderGeometry(.08, .1, .9, 10).translate(x, KERB + .45, -(ROAD + .45))); scene.add(new THREE.Mesh(mergeGeometries(g)!, new THREE.MeshStandardMaterial({ color: 0x1c1d20, metalness: .5, roughness: .3 })));
    const sh = new THREE.Group(); const glass = new THREE.MeshPhysicalMaterial({ color: 0xaab8c4, roughness: .05, transmission: .9, thickness: .02, transparent: true, opacity: .35 }); const frame = new THREE.MeshStandardMaterial({ color: 0x2c2f33, metalness: .7, roughness: .3 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.4, .08, 1.7), frame); roof.position.y = 2.6; sh.add(roof); const back = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.3), glass); back.position.set(0, 1.3, .8); sh.add(back);
    for (const x of [-2.15, 2.15]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.6, .06), frame); p.position.set(x, 1.3, .8); sh.add(p); }
    const ad = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2), new THREE.MeshBasicMaterial({ map: signTex('ABIDORA', '#8fd0ff', 256, 400), toneMapped: false })); ad.position.set(1.4, 1.3, .79); ad.rotation.y = Math.PI; sh.add(ad);
    sh.position.set(-24, KERB, -(ROAD + 2.2)); scene.add(sh); }

  /* the owner's models: a parked car and old bicycles */
  const carAt = new THREE.Vector3(6, 0, -(ROAD - 1.15));
  loadGLB('car.glb').then((gl) => {
    const o = gl.scene; const box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
    const long = Math.max(sz.x, sz.z), s = 4.15 / long; o.scale.setScalar(s); if (sz.z > sz.x) o.rotation.y = Math.PI / 2;
    const b2 = new THREE.Box3().setFromObject(o); o.position.set(carAt.x - (b2.min.x + b2.max.x) / 2, -b2.min.y, carAt.z - (b2.min.z + b2.max.z) / 2);
    o.traverse((c) => { const m = c as THREE.Mesh; if (!m.isMesh) return; const mt = m.material as THREE.MeshPhysicalMaterial; if (/carpaint/i.test(mt.name)) { mt.clearcoat = 1; mt.clearcoatRoughness = .02; mt.color.set(0x0d2238); mt.roughness = .3; mt.metalness = .6; } });
    scene.add(o);
  }).catch(() => { /* the street still works */ });
  loadGLB('bikes.glb').then((gl) => {
    const o = gl.scene; const box = new THREE.Box3().setFromObject(o), sz = box.getSize(new THREE.Vector3());
    const s = 1.05 / sz.y; o.scale.setScalar(s); const b2 = new THREE.Box3().setFromObject(o);
    o.position.set(-6 - (b2.min.x + b2.max.x) / 2, KERB - b2.min.y, WALK - 1.1 - (b2.min.z + b2.max.z) / 2); scene.add(o);
  }).catch(() => {});

  /* ---------- rain, splashes ---------- */
  const MAXR = 60000, quad = new THREE.PlaneGeometry(1, 1);
  const rg = new THREE.InstancedBufferGeometry(); rg.index = quad.index; rg.setAttribute('position', quad.attributes.position);
  { const a = new Float32Array(MAXR * 4), R = rng(3); for (let i = 0; i < MAXR * 4; i++) a[i] = R(); rg.setAttribute('aS', new THREE.InstancedBufferAttribute(a, 4)); }
  const lampU = { value: nearLamps.map((p) => p.clone()) }, lampOnU = { value: new Array(8).fill(1) }, ambU = { value: new THREE.Color(.1, .1, .12) };
  const rainU = { uT: U.uT, uH: { value: 22 }, uB: { value: 34 }, uSpeed: { value: 8 }, uWind: { value: new THREE.Vector3() }, uLamp: lampU, uLampOn: lampOnU, uAmb: ambU, uFlash: U.uFlash };
  const rain = new THREE.Mesh(rg, new THREE.ShaderMaterial({ vertexShader: RAIN_VS, fragmentShader: RAIN_FS, uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.NormalBlending, side: THREE.DoubleSide }));
  rain.frustumCulled = false; rain.renderOrder = 5; scene.add(rain);
  const MAXS = 2600, sg = new THREE.InstancedBufferGeometry(); sg.index = quad.index; sg.setAttribute('position', quad.attributes.position);
  { const a = new Float32Array(MAXS * 3), R = rng(8); for (let i = 0; i < MAXS * 3; i++) a[i] = R() * 100; sg.setAttribute('aS', new THREE.InstancedBufferAttribute(a, 3)); }
  const splU = { uT: U.uT, uRate: { value: .5 }, uB: { value: 26 }, uAmb: ambU, uLamp: lampU, uLampOn: lampOnU };
  const splash = new THREE.Mesh(sg, new THREE.ShaderMaterial({ vertexShader: SPL_VS, fragmentShader: SPL_FS, uniforms: splU, transparent: true, depthWrite: false }));
  splash.frustumCulled = false; splash.renderOrder = 4; scene.add(splash);

  /* lightning bolt: a branched strip, shown for a fraction of a second */
  const boltM = new THREE.MeshBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
  const bolt = new THREE.Mesh(new THREE.BufferGeometry(), boltM); bolt.frustumCulled = false; scene.add(bolt);
  function makeBolt(az: number, dist: number) {
    const R = rng(Math.floor(Math.random() * 1e6)), pts: number[] = []; const seg = (x0: number, y0: number, x1: number, y1: number, w: number, depth: number) => {
      const n = 14; let px = x0, py = y0; for (let i = 1; i <= n; i++) { const k = i / n, x = lerp(x0, x1, k) + (R() - .5) * 18 * (1 - k * .5), y = lerp(y0, y1, k); pts.push(px - w, py, 0, px + w, py, 0, x + w, y, 0, px - w, py, 0, x + w, y, 0, x - w, y, 0); if (depth < 2 && R() < .18) seg(x, y, x + (R() - .5) * 120, y - 60 - R() * 80, w * .5, depth + 1); px = x; py = y; } };
    seg(0, 320, (R() - .5) * 60, 0, 1.6, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); bolt.geometry.dispose(); bolt.geometry = g;
    bolt.position.set(Math.cos(az) * dist, 0, Math.sin(az) * dist); bolt.lookAt(camera.position.x, 0, camera.position.z);
  }

  /* ---------- mirror pass for the wet road ---------- */
  const mirCam = new THREE.PerspectiveCamera(); let mirRT: THREE.WebGLRenderTarget | null = null;
  const vW = new THREE.Vector3(), vT = new THREE.Vector3(), rot = new THREE.Matrix4(), look = new THREE.Vector3(), N = new THREE.Vector3(0, 1, 0), plane = new THREE.Plane(), clip = new THREE.Vector4(), qv = new THREE.Vector4();
  function renderMirror() {
    if (!mirRT) return;
    const cp = vW.setFromMatrixPosition(camera.matrixWorld); if (cp.y <= .01) return;
    const view = new THREE.Vector3(0, 0, 0).sub(cp); /* plane through origin, normal up */
    view.reflect(N).negate();
    rot.extractRotation(camera.matrixWorld); look.set(0, 0, -1).applyMatrix4(rot).add(cp);
    vT.set(0, 0, 0).sub(look).reflect(N).negate();
    mirCam.position.copy(view); mirCam.up.set(0, 1, 0).applyMatrix4(rot).reflect(N); mirCam.lookAt(vT);
    mirCam.far = camera.far; mirCam.updateMatrixWorld(); mirCam.projectionMatrix.copy(camera.projectionMatrix);
    U.uTexMat.value.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1).multiply(mirCam.projectionMatrix).multiply(mirCam.matrixWorldInverse);
    plane.setFromNormalAndCoplanarPoint(N, new THREE.Vector3()).applyMatrix4(mirCam.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant); const pmx = mirCam.projectionMatrix.elements;
    qv.x = (Math.sign(clip.x) + pmx[8]) / pmx[0]; qv.y = (Math.sign(clip.y) + pmx[9]) / pmx[5]; qv.z = -1; qv.w = (1 + pmx[10]) / pmx[14];
    clip.multiplyScalar(2 / clip.dot(qv)); pmx[2] = clip.x; pmx[6] = clip.y; pmx[10] = clip.z + 1 - .003; pmx[14] = clip.w;
    const vis = [road.visible, rain.visible, splash.visible]; road.visible = rain.visible = splash.visible = false; walks.forEach((w) => (w.visible = false));
    const fogD = (scene.fog as THREE.FogExp2).density;
    renderer.setRenderTarget(mirRT); renderer.clear(); renderer.render(scene, mirCam); renderer.setRenderTarget(null);
    (scene.fog as THREE.FogExp2).density = fogD; [road.visible, rain.visible, splash.visible] = vis; walks.forEach((w) => (w.visible = true));
  }

  /* ---------- post: bloom, lens drops, tone mapping ---------- */
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .5, .82); composer.addPass(bloom);
  const lens = new ShaderPass(LENS); composer.addPass(lens);
  composer.addPass(new OutputPass());
  let usePost = true;
  S.onResize((w, h) => { composer.setPixelRatio(S.pixelRatio); composer.setSize(w, h); lens.uniforms.uAsp.value = w / h; sizeMirror(); });
  let mirQ = .5;
  function sizeMirror() {
    const { w, h } = S.size; if (mirQ <= 0) { mirRT?.dispose(); mirRT = null; U.uMirOn.value = 0; return; }
    const rw = Math.max(64, Math.round(w * S.pixelRatio * mirQ)), rh = Math.max(64, Math.round(h * S.pixelRatio * mirQ));
    if (!mirRT) mirRT = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType }); else mirRT.setSize(rw, rh);
    U.uMirror.value = mirRT.texture; U.uMirOn.value = 1;
  }
  S.setRender(() => { renderMirror(); if (usePost) composer.render(); else renderer.render(scene, camera); });
  ctx.onDispose(() => { composer.dispose(); mirRT?.dispose(); envRT?.dispose(); pm.dispose(); audio?.ctx.close(); });

  /* ---------- quality ---------- */
  let qNow: Q = 'high';
  function setQuality(q: Q) {
    qNow = q; const c = QS[q];
    S.setPixelRatio(c.dpr); mirQ = c.mirror; sizeMirror();
    bloom.enabled = c.bloom; usePost = true;
    lampLights.forEach((l, i) => { l.visible = i < c.lights; }); lampOnU.value = lampLights.map((l, i) => (i < c.lights ? TOD[P.tod].lamps : 0));
    applyRain(); info('q', `${t('q.' + q, q[0].toUpperCase() + q.slice(1))}${P.q === 'auto' ? ' (' + t('q.auto', 'auto') + ')' : ''}`);
  }

  /* ---------- weather and time ---------- */
  function applyRain() {
    const c = QS[qNow], f = clamp(.12 + P.mm / 45, 0, 1);
    rg.instanceCount = Math.round(c.rain * f * (P.mm > 0 ? 1 : 0)); sg.instanceCount = Math.round(c.splash * f);
    const v = 4 + 5.2 * clamp(P.mm / 40, 0, 1); rainU.uSpeed.value = ctx.calm ? v * .6 : v;
    const a = skyU.uWindA.value; rainU.uWind.value.set(Math.cos(a) * P.wind * .55, 0, Math.sin(a) * P.wind * .55);
    U.uRate.value = clamp(P.mm / 35, .04, 1); splU.uRate.value = clamp(.2 + P.mm / 40, .2, 1);
    (scene.fog as THREE.FogExp2).density = P.fog;
    info('mm', `${P.mm.toFixed(P.mm < 10 ? 1 : 0)} mm/h`); info('wind', `${P.wind.toFixed(0)} m/s`); info('vis', `${(3.912 / P.fog / 1000).toFixed(2)} km`);
  }
  function applyTod() {
    const d = TOD[P.tod];
    skyU.uTop.value.setRGB(d.top[0], d.top[1], d.top[2]); skyU.uHor.value.setRGB(d.hor[0], d.hor[1], d.hor[2]); skyU.uGlow.value.setRGB(d.glow[0], d.glow[1], d.glow[2]);
    const el2 = THREE.MathUtils.degToRad(d.sun); skyU.uSun.value.set(Math.cos(el2) * -.6, Math.sin(el2), Math.cos(el2) * -.8);
    (scene.fog as THREE.FogExp2).color.setRGB(d.hor[0] * .75, d.hor[1] * .75, d.hor[2] * .8);
    hemi.intensity = d.amb * .8; hemi.color.setRGB(d.top[0] * 2 + .2, d.top[1] * 2 + .2, d.top[2] * 2 + .25); hemi.groundColor.setRGB(.12 * d.amb + d.lamps * .05, .1 * d.amb + d.lamps * .04, .09 * d.amb + d.lamps * .03);
    sunL.intensity = Math.max(0, Math.sin(el2)) * .9 + (P.tod === 'sunset' ? .35 : 0); sunL.color.setRGB(1, P.tod === 'sunset' ? .6 : .95, P.tod === 'sunset' ? .4 : .9); sunL.position.copy(skyU.uSun.value).multiplyScalar(100);
    ambU.value.setRGB(d.top[0] * 1.5 + d.lamps * .02, d.top[1] * 1.5 + d.lamps * .02, d.top[2] * 1.5 + d.lamps * .03);
    lampLights.forEach((l) => { l.intensity = 30 * d.lamps; }); lampOnU.value = lampLights.map((l, i) => (i < QS[qNow].lights ? d.lamps : 0));
    const lg = (globalThis as unknown as { __lampGlow?: THREE.SpriteMaterial }).__lampGlow; if (lg) lg.opacity = .55 * d.lamps;
    U.uWin.value = d.win; neonMats.forEach((m) => m.color.setScalar(.15 + d.neon * 1.6)); shopMats.forEach((m, i) => { m.emissiveIntensity = (i === shopMats.length - 1 ? 4 * d.lamps + .2 : .45 * (.35 + d.lamps * .8)); });
    renderer.toneMappingExposure = d.exp;
    envGlow.visible = d.lamps > .5; envRT?.dispose(); envRT = pm.fromScene(envScene, 0, .1, 500); scene.environment = envRT.texture; scene.environmentIntensity = .22 + d.amb * .45;
    info('time', t('tod.' + P.tod, { morning: 'Morning', afternoon: 'Afternoon', sunset: 'Sunset', night: 'Night', late: 'Late night' }[P.tod]));
  }
  function setWx(k: string) {
    const w = WX[k]; P.wx = k; P.mm = w.mm; P.wind = w.wind; P.fog = w.fog; P.storm = w.storm; if (w.tod) { P.tod = w.tod; todSeg.set(w.tod); applyTod(); }
    mmS.set(P.mm); windS.set(P.wind); fogS.set(P.fog * 1000); applyRain(); wxBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === k)));
    if (w.storm && P.lightning) nextBolt = 1.5;
  }

  /* ---------- sound (synthesised, starts only when asked) ---------- */
  let audio: { ctx: AudioContext; master: GainNode; rainHi: GainNode; rainLo: GainNode; wind: GainNode; city: GainNode; noise: AudioBuffer } | null = null; let vol = .7, muted = false;
  function startAudio() {
    const ac = new AudioContext(), master = ac.createGain(); master.gain.value = vol; master.connect(ac.destination);
    const len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0); let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = .97 * b + .03 * w; d[i] = w * .6 + b * 2; }
    const src = (f: BiquadFilterType, fr: number, q: number) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = .9 + Math.random() * .2; const fl = ac.createBiquadFilter(); fl.type = f; fl.frequency.value = fr; fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(master); s.start(); return g; };
    const rainHi = src('bandpass', 5200, .4), rainLo = src('lowpass', 1100, .6), wind = src('bandpass', 380, 1.2), city = src('lowpass', 140, .7);
    audio = { ctx: ac, master, rainHi, rainLo, wind, city, noise: buf };
  }
  function thunder(delay: number, near: number) {
    if (!audio || muted) return; const ac = audio.ctx, t0 = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = audio.noise; s.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(near > .6 ? 900 : 300, t0); lp.frequency.exponentialRampToValueAtTime(70, t0 + 5);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.9 * (.4 + near), t0 + .08); g.gain.setTargetAtTime(.5 * near, t0 + .4, .5); g.gain.setTargetAtTime(0, t0 + 1.8, 1.2);
    s.connect(lp).connect(g).connect(audio.master); s.start(t0); s.stop(t0 + 8);
  }
  function drip() {
    if (!audio || muted) return; const ac = audio.ctx, o = ac.createOscillator(), g = ac.createGain(), t0 = ac.currentTime;
    o.frequency.setValueAtTime(1400 + Math.random() * 1800, t0); o.frequency.exponentialRampToValueAtTime(500 + Math.random() * 300, t0 + .08);
    g.gain.setValueAtTime(.05 * Math.random(), t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + .12); o.connect(g).connect(audio.master); o.start(t0); o.stop(t0 + .15);
  }
  function mixAudio() {
    if (!audio) return; const r = clamp(P.mm / 40, 0, 1.3), now = audio.ctx.currentTime, set = (g: GainNode, v: number) => g.gain.setTargetAtTime(P.paused ? 0 : v, now, .4);
    set(audio.rainHi, .25 * Math.sqrt(r) + (P.mm > 0 ? .02 : 0)); set(audio.rainLo, .55 * r); set(audio.wind, .04 + P.wind / 25 * .5); set(audio.city, TOD[P.tod].lamps > .5 ? .18 : .3);
    audio.master.gain.setTargetAtTime(muted ? 0 : vol, now, .1);
  }

  /* ---------- panel ---------- */
  const B = S.body;
  const mainInfo = stats(B, [['mm', t('s.rain', 'Rain')], ['wind', t('s.wind', 'Wind')], ['vis', t('s.vis', 'Visibility')], ['time', t('s.time', 'Time')]], true);
  sec(B, t('h.wx', 'Weather'));
  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '6px' } });
  const WXN: [string, string][] = [['light', t('wx.light', 'Light rain')], ['moderate', t('wx.moderate', 'Moderate')], ['heavy', t('wx.heavy', 'Heavy rain')], ['extreme', t('wx.extreme', 'Extreme storm')], ['thunder', t('wx.thunder', 'Thunderstorm')], ['foggy', t('wx.foggy', 'Foggy rain')], ['evening', t('wx.evening', 'Evening rain')], ['night', t('wx.night', 'Night rain')], ['sunset', t('wx.sunset', 'Sunset rain')]];
  const wxBtns = WXN.map(([k, n]) => el('button', { class: 'ns-btn', type: 'button', 'data-v': k, 'aria-pressed': String(k === P.wx), text: n, style: { padding: '9px 6px', fontSize: '12.5px', minWidth: '0' }, onclick: () => setWx(k) }));
  grid.append(...wxBtns); B.append(grid);
  const css = el('style', { html: `.ns-btn[aria-pressed="true"]{background:var(--acc);color:var(--ink);border-color:transparent}` }); B.append(css);
  const mmS = (slider(B, t('rain', 'Rainfall'), { min: 0, max: 100, step: .5, value: P.mm, fmt: (v) => v.toFixed(v < 10 ? 1 : 0) + ' mm/h' }, (v) => { P.mm = v; applyRain(); }));
  const windS = (slider(B, t('wind', 'Wind'), { min: 0, max: 25, step: .5, value: P.wind, fmt: (v) => v.toFixed(1) + ' m/s' }, (v) => { P.wind = v; applyRain(); }));
  const fogS = (slider(B, t('fog', 'Mist'), { min: 3, max: 60, step: 1, value: P.fog * 1000, fmt: (v) => (3.912 / v).toFixed(2) + ' km' }, (v) => { P.fog = v / 1000; applyRain(); }));
  segs(B, t('lightning', 'Lightning'), [['on', t('on', 'On')], ['off', t('off', 'Off')]], 'on', (v) => { P.lightning = v === 'on'; });
  sec(B, t('h.time', 'Time of day'));
  const todSeg = (segs(B, t('hour', 'Hour'), [['morning', t('tod.morning', 'Morning')], ['afternoon', t('tod.afternoon', 'Afternoon')], ['sunset', t('tod.sunset', 'Sunset')], ['night', t('tod.night', 'Night')], ['late', t('tod.late', 'Late night')]], P.tod, (v) => { P.tod = v as Tod; applyTod(); }));
  sec(B, t('h.view', 'View and sound'));
  segs(B, t('drops', 'Drops on the lens'), [['off', t('off', 'Off')], ['on', t('on', 'On')]], 'off', (v) => { P.drops = v === 'on'; });
  const sndBtn = el('button', { class: 'ns-btn', type: 'button', text: t('snd.on', 'Turn sound on'), onclick: () => { if (!audio) { startAudio(); muted = false; } else muted = !muted; audio?.ctx.resume(); sndBtn.textContent = muted ? t('snd.on', 'Turn sound on') : t('snd.mute', 'Mute'); sndBtn.setAttribute('aria-pressed', String(!muted)); mixAudio(); } });
  const pauseBtn = el('button', { class: 'ns-btn', type: 'button', text: t('pause', 'Pause rain'), onclick: () => { P.paused = !P.paused; pauseBtn.textContent = P.paused ? t('resume', 'Resume') : t('pause', 'Pause rain'); mixAudio(); } });
  B.append(el('div', { style: { display: 'flex', gap: '8px' } }, sndBtn, pauseBtn));
  slider(B, t('vol', 'Volume'), { min: 0, max: 100, step: 1, value: vol * 100, fmt: (v) => v + '%' }, (v) => { vol = v / 100; mixAudio(); });
  sec(B, t('h.q', 'Picture quality'));
  segs(B, t('quality', 'Quality'), [['auto', t('q.auto2', 'Auto')], ['low', t('q.low', 'Low')], ['medium', t('q.medium', 'Medium')], ['high', t('q.high', 'High')], ['ultra', t('q.ultra', 'Ultra')]], 'auto', (v) => { P.q = v as Q | 'auto'; setQuality(v === 'auto' ? autoQ() : (v as Q)); });
  const qInfo = stats(B, [['q', t('s.q', 'Running at')], ['fps', t('s.fps', 'Frames per second')]]);
  para(B, t('honest', 'Everything here is drawn live by your graphics chip: falling rain at real drop speeds, splashes, ripples, reflections in the wet road and thunder that arrives late, as it does, because sound travels about 343 m each second. The water is a visual effect, not a fluid simulation. Phones get fewer drops and simpler reflections to stay cool.'));
  para(B, t('credits', 'Car: Mercedes-Benz SLK 55 AMG by geyges. Bicycles: Collection of old bikes by Exploring Europe and Beyond. Both Sketchfab Standard licence.'));

  function info(k: string, v: string) { if (k === 'q' || k === 'fps') qInfo(k, v); else mainInfo(k, v); }

  /* ---------- views ---------- */
  const views: Record<string, [THREE.Vector3, THREE.Vector3, boolean]> = {
    street: [new THREE.Vector3(-10, 1.6, 2.4), new THREE.Vector3(14, 2.6, -.6), false],
    awning: [new THREE.Vector3(3.5, 1.65, WALK - .9), new THREE.Vector3(6, 1.2, -2), false],
    window: [new THREE.Vector3(-3, 1.55, WALK - .35), new THREE.Vector3(4, 1.6, -3), true],
    puddle: [new THREE.Vector3(-4, .32, 2.5), new THREE.Vector3(14, 1.4, -1.5), false],
    roof: [new THREE.Vector3(-46, 24, 1.5), new THREE.Vector3(8, 3, 0), false],
  };
  function view(v: string) { const [p, tt, d] = views[v]; S.flyTo(p, tt, 2.6); P.drops = d || P.drops && v !== 'roof'; if (v === 'window') S.showHint(t('win.h', 'Looking out through the café window'), 2600); }
  chips(S, [['street', t('c.street', 'Street')], ['awning', t('c.awning', 'Under the awning')], ['window', t('c.window', 'Café window')], ['puddle', t('c.puddle', 'Puddle level')], ['roof', t('c.roof', 'Rooftops')]], 'street', view);
  camera.position.set(-30, 12, 18); controls.target.copy(views.street[1]); S.setHome(views.street[0], views.street[1]);
  controls.maxPolarAngle = Math.PI * .497; controls.minDistance = .3; controls.maxDistance = 90;
  controls.addEventListener('change', () => { if (camera.position.y < .25) camera.position.y = .25; });

  /* ---------- run ---------- */
  function autoQ(): Q { return isPhone || S.coarse ? 'medium' : 'high'; }
  applyTod(); setQuality(autoQ()); applyRain();
  let simT = 0, nextBolt = 6, flash = 0, flashSeq: number[] = [], frames = 0, fpsAcc = 0, autoChecked = 0, dripAcc = 0, tlT = 0;
  S.onFrame((dt) => {
    if (!P.paused) simT += dt;
    U.uT.value = simT;
    /* puddles fill while it rains and drain when it stops (visual model, not hydrology) */
    const target = P.mm > .5 ? clamp(.25 + P.mm / 50, 0, 1) : 0; P.level += (target - P.level) * Math.min(1, dt * (target > P.level ? .05 : .02) * (P.paused ? 0 : 1));
    P.wet += ((P.mm > .2 ? 1 : .35) - P.wet) * Math.min(1, dt * .03);
    U.uPud.value = P.level; U.uWet.value = P.wet;
    /* lightning */
    if (!P.paused && P.storm && P.lightning && !ctx.calm) {
      nextBolt -= dt;
      if (nextBolt <= 0) { nextBolt = 4 + Math.random() * 10; const az = Math.random() * 6.283, dist = 300 + Math.random() * 1500; makeBolt(az, dist); flashSeq = [0, .07, .16, .3].slice(0, 2 + Math.floor(Math.random() * 3)); flash = 0; thunder(dist / 343, clamp(1 - dist / 1800, 0, 1)); }
    }
    if (flashSeq.length) { flash += dt; const on = flashSeq.some((s) => flash > s && flash < s + .06); U.uFlash.value = on ? 1 : U.uFlash.value * .8; boltM.opacity = on ? 1 : boltM.opacity * .7; if (flash > .6) flashSeq = []; } else { U.uFlash.value *= .85; boltM.opacity *= .7; }
    flashL.intensity = U.uFlash.value * 4; hemi.intensity = TOD[P.tod].amb * .8 + U.uFlash.value * 1.2;
    lens.uniforms.uT.value = simT; lens.uniforms.uDrops.value += ((P.drops && P.mm > .3 ? 1 : 0) - lens.uniforms.uDrops.value) * Math.min(1, dt * 1.5);
    /* traffic light cycle: green 9 s, amber 3 s, red 10 s */
    tlT = (tlT + dt) % 22; const phase = tlT < 9 ? 2 : tlT < 12 ? 1 : 0; tl.lamps.forEach((m, i) => { m.emissiveIntensity = i === phase ? 6 : .05; });
    if (audio && !muted && !P.paused) { dripAcc += dt; if (dripAcc > .25) { dripAcc = 0; if (Math.random() < .3 * clamp(P.mm / 10, .2, 1)) drip(); } }
    /* fps and automatic quality */
    frames++; fpsAcc += dt; if (fpsAcc > 1) { const fps = frames / fpsAcc; qInfo('fps', fps.toFixed(0)); frames = 0; fpsAcc = 0;
      if (P.q === 'auto' && autoChecked < 3) { autoChecked++; if (autoChecked >= 2) { const order: Q[] = ['low', 'medium', 'high', 'ultra']; const i = order.indexOf(qNow); if (fps < 28 && i > 0) { setQuality(order[i - 1]); autoChecked = 0; } else if (fps > 57 && i < 3 && !isPhone) { setQuality(order[i + 1]); autoChecked = 0; } } } }
  });
  let mixT = 0; S.onFrame((dt) => { if ((mixT += dt) > .3) { mixT = 0; mixAudio(); } });
  S.flyTo(views.street[0], views.street[1], 3.2);
  S.start();
}
