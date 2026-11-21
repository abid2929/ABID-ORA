import{Bt as e,Ct as t,Rt as n,Vt as r,cn as i,f as a,l as o,ln as s,lt as c,r as l,st as u,t as d,un as f}from"./three.module.CMag8gOt.js";import{i as p,n as m,r as h,t as g}from"./OutputPass.COZ7N13M.js";import{D as _}from"./common.8PmWospT.js";var v=class e extends c{constructor(){let t=e.SkyShader,n=new r({name:t.name,uniforms:i.clone(t.uniforms),vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,side:1,depthWrite:!1});super(new o(1,1,1),n),this.isSky=!0}};v.SkyShader={name:`SkyShader`,uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new f},cloudScale:{value:2e-4},cloudSpeed:{value:2e-5},cloudCoverage:{value:.4},cloudDensity:{value:.4},cloudElevation:{value:.5},showSunDisc:{value:1},time:{value:0}},vertexShader:`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( vSunDirection.y );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,fragmentShader:`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform float cloudScale;
		uniform float cloudSpeed;
		uniform float cloudCoverage;
		uniform float cloudDensity;
		uniform float cloudElevation;
		uniform float showSunDisc;
		uniform float time;

		// gradient at a lattice corner; sinless hash so every GPU produces the same clouds
		vec2 gradient( vec2 i ) {
			vec3 p = fract( i.xyx * vec3( 0.1031, 0.1030, 0.0973 ) );
			p += dot( p, p.yzx + 33.33 );
			return fract( ( p.xx + p.yz ) * p.zy ) * 2.0 - 1.0;
		}

		// 2D gradient noise: isotropic lobes like Perlin at value-noise cost
		float noise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 ); // quintic fade
			float a = dot( gradient( i ), f );
			float b = dot( gradient( i + vec2( 1.0, 0.0 ) ), f - vec2( 1.0, 0.0 ) );
			float c = dot( gradient( i + vec2( 0.0, 1.0 ) ), f - vec2( 0.0, 1.0 ) );
			float d = dot( gradient( i + vec2( 1.0, 1.0 ) ), f - vec2( 1.0, 1.0 ) );
			return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y ) * 1.6; // ~[-1,1]
		}

		// fbm; per-octave drift makes clouds billow instead of scrolling as a rigid stamp
		float fbm( vec2 p, float drift ) {
			float result = 0.0;
			float amplitude = 1.0;
			for ( int i = 0; i < 4; i ++ ) {
				result += amplitude * noise( p );
				amplitude *= 0.5;
				p = p * 2.0 + drift;
			}
			return result;
		}

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, direction.y ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - vSunDirection.y, 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisc = clamp( ( cosTheta - sunAngularDiameterCos ) * 50000.0, 0.0, 1.0 ) * showSunDisc;
			vec3 sundiscColor = ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 );

			vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );

			// Clouds
			if ( direction.y > 0.0 && cloudCoverage > 0.0 ) {

				// Project to cloud plane (higher elevation = clouds appear lower/closer)
				float elevation = mix( 1.0, 0.1, cloudElevation );
				vec2 cloudUV = direction.xz / ( direction.y * elevation );
				cloudUV *= cloudScale;
				cloudUV += time * cloudSpeed;

				// Cloud density field
				float evolve = time * cloudSpeed * 300.0;
				float cloudNoise = clamp( fbm( cloudUV * 1000.0, evolve ) * 0.7 + 0.5, 0.0, 1.0 );

				// Large-scale coverage variation: clear gaps next to dense banks
				float region = noise( cloudUV * 300.0 ) * 0.37 + 0.5;
				float cov = clamp( cloudCoverage + ( region - 0.5 ) * 0.6, 0.0, 1.0 );

				// Carve clouds where noise rises above the coverage level
				float threshold = 1.0 - cov;
				float cloudMask = smoothstep( threshold, threshold + 0.3, cloudNoise );

				// Fade clouds near horizon (adjusted by elevation)
				float horizonFade = smoothstep( 0.0, 0.03 + 0.06 * cloudElevation, direction.y );
				cloudMask *= horizonFade;

				// Cloud lighting from the sky's own radiance
				float dayFactor = smoothstep( -0.08, 0.3, vSunDirection.y );
				vec3 sunColor = vSunE * Fex * 0.22 * 0.04; // 0.22 ~ albedo/pi, 0.04 = exposure; the aerial composite adds the eye-leg extinction
				vec3 skyAmbient = Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

				// Beer-powder self-shadow from the sampled density
				float depth = max( 0.0, cloudNoise - threshold );
				float beer = exp( depth * -4.0 );
				float powder = 1.0 - beer * beer; // beer*beer == exp(-8*depth)
				float shade = mix( 0.45, 1.0, clamp( beer * powder * 2.6, 0.0, 1.0 ) ); // 2.6 = 1/0.385, normalizes beer*powder peak to 1

				// Henyey-Greenstein forward lobe ( g = 0.7 ): silver lining on rims toward the sun
				float silver = clamp( 0.51 / pow( 1.49 - cosTheta * 1.4, 1.5 ), 0.0, 3.0 ); // 0.51=1-g^2, 1.49=1+g^2, 1.4=2g
				float edge = cloudMask * ( 1.0 - cloudMask ) * 4.0;

				vec3 cloudColor = skyAmbient + sunColor * shade;
				cloudColor += sunColor * silver * edge * 0.6;
				cloudColor *= max( dayFactor, 0.03 );

				// Cloud opacity via Beer's law: density sets how solid the clouds get
				float alpha = ( 1.0 - exp( depth * cloudDensity * -12.0 ) ) * horizonFade;

				// Occlude the sun disc/glow behind opaque cloud
				texColor -= L0 * 0.04 * alpha;

				// Composite through the atmosphere so distant clouds dissolve into haze
				vec3 cloudAerial = mix( texColor, cloudColor, Fex );
				texColor = mix( texColor, cloudAerial, alpha );

			}

			gl_FragColor = vec4( texColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};var y=matchMedia(`(pointer: coarse)`).matches||`ontouchstart`in window,b=(e,t)=>t,x=()=>!0,S=()=>!0,C=()=>!0,w=``;function T(e){e.t&&(b=e.t),e.gate&&(x=e.gate),e.shown&&(S=e.shown),e.engaged&&(C=e.engaged),e.assetBase!=null&&(w=e.assetBase)}var E=(e,t,n)=>Math.max(t,Math.min(n,e)),D=(e,t,n)=>e+(t-e)*n,O=(e,t,n,r)=>D(e,t,1-Math.exp(-n*r));function k(e=1){let t=e>>>0;return()=>{t=t+1831565813|0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function A(e=1){let t=k(e),n=new Uint8Array(512),r=Array.from({length:256},(e,t)=>t);for(let e=255;e>0;e--){let n=t()*(e+1)|0;[r[e],r[n]]=[r[n],r[e]]}for(let e=0;e<512;e++)n[e]=r[e&255];let i=(e,t,n)=>{let r=(e&15)*Math.PI/8;return Math.cos(r)*t+Math.sin(r)*n},a=e=>e*e*e*(e*(e*6-15)+10),o=(e,t)=>{let r=Math.floor(e),o=Math.floor(t),s=e-r,c=t-o,l=r&255,u=o&255,d=a(s),f=a(c);return D(D(i(n[n[l]+u],s,c),i(n[n[l+1]+u],s-1,c),d),D(i(n[n[l]+u+1],s,c-1),i(n[n[l+1]+u+1],s-1,c-1),d),f)*1.41};return o.fbm=(e,t,n=5)=>{let r=0,i=.5,a=1,s=0;for(let c=0;c<n;c++)r+=o(e*a,t*a)*i,s+=i,i*=.5,a*=2.03;return r/s},o}function j(e,t,r,i=!0){let o=document.createElement(`canvas`);o.width=e,o.height=t,r(o.getContext(`2d`),e,t);let s=new a(o);return s.colorSpace=i?n:``,s.anisotropy=8,s}function M(r,i={}){let a=new l({canvas:r,antialias:!0,powerPreference:`high-performance`,alpha:!1}),o=Math.min(devicePixelRatio||1,y?3:2),c=Math.min(o,(devicePixelRatio||1)>=2?1.5:1),u=Math.min(o,y?2.4:2);a.setPixelRatio(u),a.toneMapping=4,a.toneMappingExposure=i.exposure??1,a.outputColorSpace=n,a.shadowMap.enabled=i.shadows!==!1,a.shadowMap.type=1;let d=new e,f=new t(i.fov??55,1,i.near??.1,i.far??4e3),_=null,v=null;i.bloom&&(_=new p(a),_.addPass(new h(d,f)),v=new m(new s(256,256),i.bloom.strength??.6,i.bloom.radius??.5,i.bloom.threshold??.85),_.addPass(v),_.addPass(new g));let b={renderer:a,scene:d,camera:f,composer:_,bloom:v,w:1,h:1,quality:2,onResize:[]},x=()=>{let e=r.clientWidth||innerWidth,t=r.clientHeight||innerHeight;b.w=e,b.h=t,a.setPixelRatio(u),a.setSize(e,t,!1),f.aspect=e/t,f.updateProjectionMatrix(),_&&(_.setPixelRatio(u),_.setSize(e,t),v.resolution.set(e*(b.quality>1?.5:.35),t*(b.quality>1?.5:.35))),b.onResize.forEach(n=>n(e,t))};new ResizeObserver(x).observe(r),addEventListener(`resize`,x),x();let S=0,C=0,w=1.5;return b.watch=e=>{if(w>0)w-=e;else if(S+=e,C++,S>2){let e=C/S;S=0,C=0,e<42&&b.quality>0&&(b.quality--,b.quality===1&&(a.shadowMap.type=1,v&&(v.strength*=.85)),b.quality===0&&(u=Math.max(c,u*.8)),x(),i.onQuality?.(b.quality))}},b.render=()=>{_&&b.quality>=0?_.render():a.render(d,f)},b.dpr=()=>u,b}function N(t,n={}){let r=new v;r.scale.setScalar(n.scale??3e3),r.material.fragmentShader=r.material.fragmentShader.replace(`gl_FragColor = vec4( texColor, 1.0 );`,`gl_FragColor = vec4( min( texColor, vec3( `+(n.cap??1.6).toFixed(2)+` ) ), 1.0 );`);let i=r.material.uniforms;i.turbidity.value=n.turbidity??6,i.rayleigh.value=n.rayleigh??1.6,i.mieCoefficient.value=n.mie??.005,i.mieDirectionalG.value=n.mieG??.82;let a=new f,o=new d(t.renderer),s=null,c=new e,l=new v;l.scale.setScalar(100),c.add(l);let p=(e,n)=>{a.setFromSphericalCoords(1,u.degToRad(90-e),u.degToRad(n)),i.sunPosition.value.copy(a),Object.keys(i).forEach(e=>{l.material.uniforms[e]&&e!==`sunPosition`&&(l.material.uniforms[e].value=i[e].value)}),l.material.uniforms.sunPosition.value.copy(a),s&&s.dispose(),s=o.fromScene(c,.02),t.scene.environment=s.texture};return t.scene.add(r),p(n.elev??12,n.azim??200),{sky:r,sun:a,set:p}}function P(){let e=new Set;return addEventListener(`keydown`,t=>{t.target.tagName!==`INPUT`&&t.target.tagName!==`SELECT`&&x()&&(e.add(t.code),[`ArrowUp`,`ArrowDown`,`ArrowLeft`,`ArrowRight`,`Space`].includes(t.code)&&t.preventDefault())}),addEventListener(`keyup`,t=>e.delete(t.code)),addEventListener(`blur`,()=>e.clear()),{has:(...t)=>t.some(t=>e.has(t)),set:e}}function F(e,t={}){let n=R(`div`,`gk-zone `+(t.side??`left`));e.append(n);let r=R(`div`,`gk-stick`),i=R(`div`,`gk-knob`);r.append(i),n.append(r);let a={x:0,y:0,on:!1},o=null,s=0,c=0,l=()=>{r.style.left=``,r.style.top=``,r.classList.remove(`on`)};n.addEventListener(`pointerdown`,e=>{if(o!==null)return;o=e.pointerId,n.setPointerCapture(o);let t=n.getBoundingClientRect();s=e.clientX,c=e.clientY,r.style.left=e.clientX-t.left+`px`,r.style.top=e.clientY-t.top+`px`,r.classList.add(`on`),a.on=!0,u(e)});let u=e=>{if(e.pointerId!==o)return;let t=e.clientX-s,n=e.clientY-c,r=Math.hypot(t,n);r>52&&(t*=52/r,n*=52/r),i.style.transform=`translate(${t}px,${n}px)`,a.x=t/52,a.y=n/52},d=e=>{e.pointerId===o&&(o=null,a.x=a.y=0,a.on=!1,i.style.transform=``,l())};return n.addEventListener(`pointermove`,u),n.addEventListener(`pointerup`,d),n.addEventListener(`pointercancel`,d),a.el=n,a}function I(e,t,n=``,r){let i=R(`button`,`gk-btn `+n);i.type=`button`,i.innerHTML=t,e.append(i);let a={down:!1,el:i};i.addEventListener(`pointerdown`,e=>{e.preventDefault(),a.down=!0,i.classList.add(`on`),r?.();try{i.setPointerCapture(e.pointerId)}catch{}});let o=()=>{a.down=!1,i.classList.remove(`on`)};return i.addEventListener(`pointerup`,o),i.addEventListener(`pointercancel`,o),i.addEventListener(`lostpointercapture`,o),i.addEventListener(`click`,e=>{e.detail===0&&r?.()}),a}function L(e,t={}){let n={dx:0,dy:0,wheel:0},r=new Map,i=0;e.addEventListener(`pointerdown`,e=>{if(!t.ignore?.(e)&&(r.set(e.pointerId,[e.clientX,e.clientY]),r.size===2)){let[e,t]=[...r.values()];i=Math.hypot(e[0]-t[0],e[1]-t[1])}}),e.addEventListener(`pointermove`,e=>{let t=r.get(e.pointerId);if(t){if(r.size===2){r.set(e.pointerId,[e.clientX,e.clientY]);let[t,a]=[...r.values()],o=Math.hypot(t[0]-a[0],t[1]-a[1]);i&&(n.wheel+=(i-o)*2),i=o}else n.dx+=e.clientX-t[0],n.dy+=e.clientY-t[1],t[0]=e.clientX,t[1]=e.clientY}});let a=e=>{r.delete(e.pointerId),i=0};return e.addEventListener(`pointerup`,a),e.addEventListener(`pointercancel`,a),e.addEventListener(`wheel`,e=>{C()&&(e.preventDefault(),n.wheel+=e.deltaY)},{passive:!1}),n.take=()=>{let e=[n.dx,n.dy,n.wheel];return n.dx=n.dy=n.wheel=0,e},n}function R(e,t=``,n){let r=document.createElement(e);return t&&(r.className=t),n!==void 0&&(r.innerHTML=n),r}function z(e,t){let n=R(`div`,`gk-card-wrap`+(t.side?` side`:``)),r=R(`div`,`gk-card `+(t.cls??``));r.innerHTML=`${t.kicker?`<p class="gk-kick">${t.kicker}</p>`:``}<h1>${t.title}</h1>${t.body?`<div class="gk-body">${t.body}</div>`:``}`;let i=R(`div`,`gk-row`);return r.append(i),n.append(r),e.append(n),new Promise(e=>{(t.buttons??[b(`play`,`Play`)]).forEach((t,r)=>{let a=R(`button`,`gk-cbtn`+(r===0?` pri`:``),t);a.type=`button`,a.onclick=()=>{n.classList.add(`out`),setTimeout(()=>n.remove(),350),e(r)},i.append(a),r===0&&setTimeout(()=>a.focus({preventScroll:!0}),50)})})}function B(e,t=``){let n=R(`div`,`gk-hud `+t);return e.append(n),n}function V(e,t,n=1600){let r=R(`div`,`gk-toast`,t);e.append(r),requestAnimationFrame(()=>r.classList.add(`in`)),setTimeout(()=>{r.classList.remove(`in`),setTimeout(()=>r.remove(),400)},n)}function H(e,t){return`<div class="gk-legend">${(y?t:e).map(([e,t])=>`<div><b>${e}</b><span>${t}</span></div>`).join(``)}</div>`}var U={get(e){try{return JSON.parse(localStorage.getItem(`abidora.games.`+e)??`null`)}catch{return null}},set(e,t){try{localStorage.setItem(`abidora.games.`+e,JSON.stringify(t))}catch{}}};function W(e){if(e==null||!isFinite(e))return`—`;let t=Math.floor(e/60);return`${t}:${(e-t*60).toFixed(2).padStart(5,`0`)}`}var G=(()=>{let e=null,t=null,n=U.get(`mute`)===!0,r=()=>{if(e)return e;try{e=new AudioContext,t=e.createGain(),t.gain.value=n?0:.5,t.connect(e.destination)}catch{e=null}return e};return addEventListener(`pointerdown`,r,{once:!0}),addEventListener(`keydown`,r,{once:!0}),{blip:(i=600,a=.12,o=`sine`,s=.3,c=0)=>{if(!r()||n)return;let l=e.currentTime,u=e.createOscillator(),d=e.createGain();u.type=o,u.frequency.setValueAtTime(i,l),c&&u.frequency.exponentialRampToValueAtTime(Math.max(30,i*c),l+a),d.gain.setValueAtTime(s,l),d.gain.exponentialRampToValueAtTime(.001,l+a),u.connect(d),d.connect(t),u.start(l),u.stop(l+a+.02)},noise:(i=.3,a=.3,o=900)=>{if(!r()||n)return;let s=e.currentTime,c=e.createBuffer(1,e.sampleRate*i,e.sampleRate),l=c.getChannelData(0);for(let e=0;e<l.length;e++)l[e]=(Math.random()*2-1)*(1-e/l.length);let u=e.createBufferSource(),d=e.createBiquadFilter(),f=e.createGain();u.buffer=c,d.type=`lowpass`,d.frequency.value=o,f.gain.value=a,u.connect(d),d.connect(f),f.connect(t),u.start(s)},hum:(i=`sawtooth`,a=700)=>{let o,s,c,l;return{set(u,d){if(!r())return;o||(o=e.createOscillator(),s=e.createOscillator(),c=e.createGain(),l=e.createBiquadFilter(),o.type=i,s.type=`square`,l.type=`lowpass`,l.frequency.value=a,c.gain.value=0,o.connect(l),s.connect(l),l.connect(c),c.connect(t),o.start(),s.start());let f=e.currentTime;o.frequency.setTargetAtTime(u,f,.05),s.frequency.setTargetAtTime(u*.501,f,.05),c.gain.setTargetAtTime(n?0:d,f,.08)},stop(){c&&c.gain.setTargetAtTime(0,e.currentTime,.05)}}},get muted(){return n},toggle(){return n=!n,U.set(`mute`,n),t&&(t.gain.value=n?0:.5),n}}})();function K(e){let t=0,n=0,r=!1,i=a=>{if(n=requestAnimationFrame(i),!S()){t=0;return}let o=Math.min(.05,t?(a-t)/1e3:1/60);t=a,r||e(o,a/1e3)};return n=requestAnimationFrame(i),document.addEventListener(`visibilitychange`,()=>{t=0}),{pause(e=!0){r=e,t=0},get paused(){return r},stop(){cancelAnimationFrame(n)}}}function q(e,t){let n=R(`div`,`gk-top`);e.append(n);let r=R(`button`,`gk-ic`,`<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>`);r.type=`button`,r.setAttribute(`aria-label`,b(`pause`,`Pause`)),r.onclick=t;let i=R(`button`,`gk-ic`,``);i.type=`button`;let a=()=>{i.innerHTML=G.muted?`<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6"/></svg>`:`<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 8a5 5 0 0 1 0 8M19.5 5.5a8.5 8.5 0 0 1 0 13"/></svg>`,i.setAttribute(`aria-label`,G.muted?b(`soundon`,`Sound on`):b(`mute`,`Mute`))};return i.onclick=()=>{G.toggle(),a()},a(),n.append(i,r),n}function J(e){addEventListener(`keydown`,t=>{t.target.tagName!==`INPUT`&&t.target.tagName!==`SELECT`&&x()&&e(t)})}var Y=matchMedia(`(pointer: coarse)`).matches||`ontouchstart`in window,X=/\d+(?:[.,:]\d+)*(?![A-Za-z\d])|—/g;function Z(e){let t=e.replace(/\s+/g,` `).trim().replace(X,`{n}`),n=2166136261;for(let e=0;e<t.length;e++)n^=t.charCodeAt(e),n=Math.imul(n,16777619);return`g`+(n>>>0).toString(36)}function Q(e,t){let n=new Map,r=t=>{let r=t.nodeValue??``;if(!/[A-Za-z]{2}/.test(r))return;let i=Z(r),a=n.get(i);if(a===void 0&&(a=e.t(i,``),n.set(i,a)),!a)return;let o=r.match(X)??[],s=0,c=a.replace(/\{n\}/g,()=>o[s++]??``),l=/^\s*/.exec(r)[0],u=/\s*$/.exec(r)[0];t.nodeValue=l+c+u},i=e=>{if(e.nodeType===3){r(e);return}let t=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),n;for(;n=t.nextNode();)r(n)};i(t),new MutationObserver(e=>{for(let t of e)t.type===`characterData`?r(t.target):t.addedNodes.forEach(i)}).observe(t,{subtree:!0,childList:!0,characterData:!0})}function $(e,t){let n=e.t,r=document.createElement(`div`);r.className=`gm`,e.rtl&&(r.dataset.rtl=``);let i=document.createElement(`canvas`);i.tabIndex=0,i.setAttribute(`aria-label`,t.label),i.setAttribute(`role`,`application`);let a=document.createElement(`div`);a.className=`gm-ui`;let o=document.createElement(`div`);o.className=`gm-load`,o.textContent=n(`loading`,`Loading 3D world…`);let s=document.createElement(`button`);s.type=`button`,s.className=`gm-x`,s.hidden=!0,s.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,s.append(n(`exit`,`Exit`)),r.append(i,a,o,s);let c=[r];if(t.tabs?.length){let i=document.createElement(`div`);i.className=`gm-tabs`,i.setAttribute(`role`,`tablist`);let a=[t.label,...t.tabs.map(e=>e.label)].map((e,t)=>{let n=document.createElement(`button`);return n.type=`button`,n.setAttribute(`role`,`tab`),n.textContent=e,n.setAttribute(`aria-selected`,String(t===0)),i.append(n),n}),o=document.createElement(`div`);o.className=`gm-wrap`,o.append(i,r);let s=[];t.tabs.forEach((t,r)=>{let i=document.createElement(`div`);i.className=`gm-pane`,i.hidden=!0,i.setAttribute(`role`,`tabpanel`),o.append(i),c.push(i),a[r+1].addEventListener(`click`,()=>{s[r]||(s[r]=!0,t.load().then(t=>{let n=t.default({...e,root:i});typeof n==`function`&&e.onDispose(n)}).catch(e=>{console.error(e),i.innerHTML=`<p class="gm-fail">${n(`err`,`This part could not load. Please reload the page.`)}</p>`}))})}),a.forEach((t,n)=>t.addEventListener(`click`,()=>{a.forEach((e,t)=>e.setAttribute(`aria-selected`,String(n===t))),c.forEach((e,t)=>e.hidden=n!==t);try{localStorage.setItem(`abidora.w${e.id}.tab`,String(n))}catch{}})),e.root.append(o);let l=0;try{l=+(localStorage.getItem(`abidora.w${e.id}.tab`)??0)||0}catch{}l>0&&l<a.length&&queueMicrotask(()=>a[l].click()),r._tabs=a}else e.root.append(r);let l=document.createElement(`canvas`);if(!(l.getContext(`webgl2`)||l.getContext(`webgl`))){o.remove(),a.innerHTML=`<p class="gm-fail">${n(`nogl`,`This 3D game needs WebGL, which this browser has turned off. Try another browser or device.`)}</p>`;let e=r._tabs;e&&e[1].click();return}let u=!1,d=!1,f=!1;new IntersectionObserver(e=>{u=e[0].isIntersecting},{threshold:[0,.01]}).observe(r),document.addEventListener(`pointerdown`,e=>{d=r.contains(e.target)},!0),r.addEventListener(`focusin`,()=>{d=!0}),r.addEventListener(`focusout`,e=>{r.contains(e.relatedTarget)||(d=!1)}),T({t:(e,t)=>n(e,t),shown:()=>(u||f)&&!document.hidden&&!r.hidden,gate:()=>f||d&&u&&!r.hidden,engaged:()=>f||d,assetBase:`${_.root}assets/games/`}),e.lang!==`en`&&Q(e,a);let p=!1,m=e=>{if(e!==f){if(f=e,r.classList.toggle(`full`,e),document.documentElement.classList.toggle(`gm-lock`,e),s.hidden=!e,e){try{history.pushState({gm:1},``),p=!0}catch{p=!1}r.requestFullscreen&&document.fullscreenEnabled&&r.requestFullscreen({navigationUI:`hide`}).catch(()=>{})}else document.fullscreenElement===r&&document.exitFullscreen().catch(()=>{}),p&&(p=!1,history.back()),r.scrollIntoView({block:`center`});dispatchEvent(new Event(`resize`))}};addEventListener(`popstate`,()=>{f&&(p=!1,m(!1))}),document.addEventListener(`fullscreenchange`,()=>{f&&!document.fullscreenElement&&m(!1)}),s.addEventListener(`click`,()=>m(!1)),Y&&a.addEventListener(`click`,e=>{!f&&e.target.closest?.(`.gk-cbtn.pri`)&&m(!0)},!0);let h=!1,g=()=>{h||(h=!0,v.disconnect(),o.classList.add(`done`),setTimeout(()=>o.remove(),700))},v=new MutationObserver(()=>{a.querySelector(`.gk-card`)&&g()});v.observe(a,{childList:!0,subtree:!0}),t.game().then(async e=>{await e.start(i,a),g()}).catch(e=>{v.disconnect(),console.error(e),o.remove(),a.innerHTML=`<p class="gm-fail">${n(`err`,`This part could not load. Please reload the page.`)}</p>`})}export{G as C,q as D,V as E,K as S,F as T,D as _,I as a,J as b,E as c,L as d,R as f,P as g,B as h,U as i,H as l,W as m,y as n,j as o,C as p,w as r,z as s,$ as t,O as u,M as v,N as w,k as x,A as y};