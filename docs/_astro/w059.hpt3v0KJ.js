import{O as e,T as t,_ as n,b as r,c as i,i as a,k as o,l as s,n as c,p as l,s as u,t as d}from"./kit.CDM0lsaA.js";function f(e){let t=[];return e.split(`
`).forEach((e,n)=>{let r=e.replace(/;.*/,``).trimEnd(),i=/\s*([\[\]()+\-*/<>=]|#[0-9a-fA-F]{3,6}|:?[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)/y,a=0;for(;a<r.length;){i.lastIndex=a;let e=i.exec(r);if(!e){let e=r.slice(a).trim()[0];throw new p(`unexpected “${e}”`,n+1)}t.push({v:e[1],line:n+1}),a=i.lastIndex}}),t}var p=class extends Error{line;constructor(e,t){super(e),this.line=t}},m={forward:`fd`,back:`bk`,right:`rt`,left:`lt`,penup:`pu`,pendown:`pd`,pencolor:`color`,pensize:`width`},h={fd:1,bk:1,rt:1,lt:1,pu:0,pd:0,color:1,width:1,hue:1,home:0,setxy:2,seth:1,stop:0,circle:1},g={red:`#e05a4f`,orange:`#f0a04b`,yellow:`#f4d35e`,green:`#3aa66b`,teal:`#2bb3a6`,blue:`#3d7fe0`,purple:`#8e6fd8`,pink:`#ec7fb0`,white:`#f6f2ea`,black:`#1d1b18`,gold:`#d4a84b`,grey:`#8a8f99`,gray:`#8a8f99`},_=Symbol(`stop`);function v(e,t={}){let n=f(e),r=0,i=t.maxSteps??2e5,o=0,s=(t.seed??1)>>>0,c=()=>(s=s*1664525+1013904223>>>0,s/4294967296),l=new Map,u=[];for(;r<n.length;){let e=n[r];if(e.v.toLowerCase()===`to`){let t=n[r+1];if(!t||!/^[A-Za-z_]/.test(t.v))throw new p(`“to” needs a procedure name`,e.line);r+=2;let i=[];for(;r<n.length&&n[r].v.startsWith(`:`)&&n[r].line===e.line;)i.push(n[r++].v.slice(1).toLowerCase());let a=[];for(;r<n.length&&n[r].v.toLowerCase()!==`end`;)a.push(n[r++]);if(r>=n.length)throw new p(`procedure “${t.v}” has no “end”`,e.line);r++,l.set(t.v.toLowerCase(),{params:i,body:a,line:e.line})}else u.push(e),r++}let d=[],v={x:0,y:0,h:0,down:!0,c:`#1d1b18`,w:2},y=e=>{if(++o>i)throw new p(`stopped after ${i.toLocaleString()} steps (is there a loop or recursion that never ends?)`,e)};function b(e){let t=v.h*Math.PI/180,n=v.x+Math.sin(t)*e,r=v.y+Math.cos(t)*e;v.down&&d.push({x1:v.x,y1:v.y,x2:n,y2:r,c:v.c,w:v.w}),v.x=n,v.y=r}function x(e,t,n,r){let i=0,o=()=>e[i]?.v,s=()=>e[Math.min(i,e.length-1)]?.line??1;function u(){let r=e[i];if(!r)throw new p(`a number is missing at the end`,s());if(r.v===`(`){i++;let t=S();if(e[i]?.v!==`)`)throw new p(`missing “)”`,r.line);return i++,t}if(r.v===`-`)return i++,-u();if(/^\d/.test(r.v))return i++,+r.v;if(r.v.startsWith(`:`)){let e=r.v.slice(1).toLowerCase();if(!t.has(e))throw new p(`unknown input “${r.v}”`,r.line);return i++,t.get(e)}let a=r.v.toLowerCase();if(a===`repcount`)return i++,n;if(a===`random`)return i++,Math.floor(c()*u());if(a===`heading`)return i++,v.h;throw new p(`expected a number, found “${r.v}”`,r.line)}function d(){let t=u();for(;o()===`*`||o()===`/`;){let n=e[i++].v,r=u();t=n===`*`?t*r:t/r}return t}function f(){let t=d();for(;o()===`+`||o()===`-`;){let n=e[i++].v,r=d();t=n===`+`?t+r:t-r}return t}function S(){let e=f(),t=o();if(t===`<`||t===`>`||t===`=`){i++;let n=f();return+(t===`<`?e<n:t===`>`?e>n:Math.abs(e-n)<1e-9)}return e}function C(){let t=e[i];if(t?.v!==`[`)throw new p(`expected “[”`,s());let n=0,r=++i;for(;i<e.length;i++)if(e[i].v===`[`)n++;else if(e[i].v===`]`){if(n===0)break;n--}if(i>=e.length)throw new p(`missing “]”`,t.line);let a=e.slice(r,i);return i++,a}for(;i<e.length;){let o=e[i];y(o.line);let s=o.v.toLowerCase();if(s=m[s]??s,i++,s===`repeat`){let e=Math.floor(S()),n=C();for(let i=1;i<=e;i++)if(x(n,t,i,r)===_)return _;continue}if(s===`if`){let e=S(),i=C();if(e&&x(i,t,n,r)===_)return _;continue}if(s===`stop`)return _;if(s===`color`){let t=e[i];if(t&&(t.v.startsWith(`#`)||g[t.v.toLowerCase()])){v.c=t.v.startsWith(`#`)?t.v:g[t.v.toLowerCase()],i++;continue}throw new p(`color needs a name like red or a code like #3d7fe0`,o.line)}if(s in h){let e=h[s]>=1?S():0,t=h[s]>=2?S():0;if(s===`fd`)b(e);else if(s===`bk`)b(-e);else if(s===`rt`)v.h+=e;else if(s===`lt`)v.h-=e;else if(s===`pu`)v.down=!1;else if(s===`pd`)v.down=!0;else if(s===`width`)v.w=a(e,.25,40);else if(s===`hue`)v.c=`hsl(${(e%360+360)%360},75%,55%)`;else if(s===`home`)v.x=0,v.y=0,v.h=0;else if(s===`setxy`)v.x=e,v.y=t;else if(s===`seth`)v.h=e;else if(s===`circle`){let t=2*Math.PI*e/36;for(let e=0;e<36;e++)b(t),v.h+=10}continue}let c=l.get(s);if(c){if(r>60)throw new p(`“${o.v}” calls itself too deeply (over 60 levels): add an if … [stop]`,o.line);let e=new Map;for(let t of c.params)e.set(t,S());x(c.body,e,n,r+1)}else throw new p(`I don’t know how to “${o.v}”`,o.line)}}return x(u,new Map,0,0),{segs:d,steps:o,turtle:{...v}}}var y={square:`repeat 4 [fd 100 rt 90]`,spiral:`; a square spiral that changes colour
repeat 120 [
  hue repcount * 3
  fd repcount * 2.5
  rt 91
]`,flower:`; petals made of arcs
to petal :size
  repeat 2 [repeat 30 [fd :size rt 3] rt 90]
end
width 1.5
repeat 18 [
  hue repcount * 20
  petal 4
  rt 20
]`,tree:`; a tree that draws itself with recursion
to tree :len
  if :len < 6 [stop]
  width :len / 8
  fd :len
  lt 24 tree :len * 0.7
  rt 48 tree :len * 0.7
  lt 24
  bk :len
end
color green
pu bk 120 pd
tree 90`,snow:`; Koch snowflake
to side :len :depth
  if :depth = 0 [fd :len stop]
  side :len / 3 :depth - 1 lt 60
  side :len / 3 :depth - 1 rt 120
  side :len / 3 :depth - 1 lt 60
  side :len / 3 :depth - 1
end
color blue
pu setxy -150 90 seth 90 pd
repeat 3 [side 300 4 rt 120]`,stars:`; random stars
to star :s
  repeat 5 [fd :s rt 144]
end
repeat 40 [
  pu setxy random 500 - 250 random 360 - 180 pd
  hue random 360
  star 10 + random 30
]`};function b(a){let f=a.t,p=l(a,{panelFirst:!1});p.view.style.minHeight=`clamp(420px, 58vw, 620px)`;let m=c(p.view,f(`cv`,`The drawing made by your turtle program.`),{alpha:!1}),h=o(a.id,`cfg`,{code:y.tree,speed:60,bg:`paper`},e=>typeof e==`object`&&!!e&&`code`in e),g=h.get(),_=()=>h.set(g),b=o(a.id,`kept`,[],e=>Array.isArray(e)),x=null,S=0,C=``,w=0;s(p.panel,f(`code`,`Program`));let T=i(`textarea`,{rows:13,spellcheck:!1,"aria-label":f(`code`,`Program`),style:{width:`100%`,fontFamily:`var(--mono, ui-monospace, monospace)`,fontSize:`13px`,lineHeight:`1.45`,tabSize:`2`,resize:`vertical`,background:`color-mix(in srgb, var(--ink) 80%, black)`,color:`var(--bone)`,border:`1px solid var(--line)`,borderRadius:`8px`,padding:`8px`}});T.value=g.code,p.panel.append(T);let E=i(`p`,{class:`wk-note`,role:`status`,style:{color:`#f08c7f`,minHeight:`1.2em`}});p.panel.append(E),d(p.panel,[[f(`run`,`Run ▶`),()=>A(),!0],[f(`instant`,`Draw instantly`),()=>{A(),S=x?.segs.length??0,P.play()}]]),T.addEventListener(`keydown`,e=>{if((e.ctrlKey||e.metaKey)&&e.key===`Enter`&&(e.preventDefault(),A()),e.key===`Tab`){e.preventDefault();let t=T.selectionStart;T.setRangeText(`  `,t,T.selectionEnd,`end`)}}),t(p.panel,f(`ex`,`Examples`),[[``,`—`],[`square`,f(`e.square`,`Square`)],[`spiral`,f(`e.spiral`,`Colour spiral`)],[`flower`,f(`e.flower`,`Flower`)],[`tree`,f(`e.tree`,`Recursive tree`)],[`snow`,f(`e.snow`,`Koch snowflake`)],[`stars`,f(`e.stars`,`Random stars`)]],``,e=>{y[e]&&(T.value=y[e],A())}),r(p.panel,f(`speed`,`Drawing speed`),{min:1,max:100,value:g.speed,fmt:e=>e>=100?f(`fastest`,`instant`):`${e}`},e=>{g.speed=e,_()}),t(p.panel,f(`bg`,`Paper`),[[`paper`,f(`b.paper`,`Cream paper`)],[`night`,f(`b.night`,`Night`)],[`grid`,f(`b.grid`,`Graph paper`)]],g.bg,e=>{g.bg=e,_(),P.play()});let D=e(p.panel,[[`a`,f(`st.lines`,`Lines drawn`)],[`b`,f(`st.steps`,`Steps run`)],[`c`,f(`st.size`,`Size`)]]);s(p.panel,f(`sk`,`My sketches`)),d(p.panel,[[f(`keep`,`Keep this sketch`),()=>F()],[f(`png`,`Download PNG`),()=>L()],[f(`svg`,`Download SVG`),()=>R()]]);let O=i(`div`,{class:`wk-row`,style:{flexWrap:`wrap`}});p.panel.append(O);let k=i(`details`,{},i(`summary`,{text:f(`ref`,`Language reference`)}),i(`pre`,{style:{whiteSpace:`pre-wrap`,fontSize:`12px`,fontFamily:`var(--mono, monospace)`},text:`fd 50 / bk 50      move forward / back
rt 90 / lt 90      turn right / left
pu / pd            pen up / pen down
color red | #3d7fe0   pen colour
hue 200            rainbow colour (0-360)
width 3            pen width
circle 40          circle of radius 40
setxy 10 20 / seth 90 / home
repeat 10 [ ... ]  loop; repcount = 1, 2, 3…
to name :a :b ... end   your own command
if :a < 5 [ stop ] condition (< > =)
random 100         0 to 99
; comment          Ctrl+Enter runs`}));p.panel.append(k);function A(){g.code=T.value.slice(0,2e4),_();try{x=v(g.code,{seed:7}),C=``,w=0}catch(e){let t=e;C=t.line?`${f(`line`,`Line`)} ${t.line}: ${t.message}`:String(t.message),w=t.line??0}if(E.textContent=C,T.setAttribute(`aria-invalid`,String(!!C)),w){let e=T.value.split(`
`).slice(0,w-1).join(`
`).length+ +(w>1);try{T.setSelectionRange(e,e+(T.value.split(`
`)[w-1]?.length??0))}catch{}}S=g.speed>=100||a.calm?x?.segs.length??0:0,P.play()}function j(e,t){let n=x?.segs??[],r=-50,i=50,a=-50,o=50;for(let e of n)r=Math.min(r,e.x1,e.x2),i=Math.max(i,e.x1,e.x2),a=Math.min(a,e.y1,e.y2),o=Math.max(o,e.y1,e.y2);return{k:Math.min((e-60)/(i-r),(t-90)/(o-a),3),cx:(r+i)/2,cy:(a+o)/2,w:i-r,h:o-a}}function M(e,t,n){if(e.fillStyle=g.bg===`night`?`#14161f`:`#f5f0e4`,e.fillRect(0,0,t,n),g.bg===`grid`){e.strokeStyle=`rgba(70,120,190,.18)`,e.lineWidth=1;for(let r=t/2%20;r<t;r+=20)e.beginPath(),e.moveTo(r,0),e.lineTo(r,n),e.stroke();for(let r=n/2%20;r<n;r+=20)e.beginPath(),e.moveTo(0,r),e.lineTo(t,r),e.stroke()}}function N(e,t,n,r){let i=j(t,n),a=e=>t/2+(e-i.cx)*i.k,o=e=>n/2+14-(e-i.cy)*i.k;e.lineCap=`round`,e.lineJoin=`round`;let s=x?.segs??[];for(let t=0;t<Math.min(r,s.length);t++){let n=s[t];e.strokeStyle=g.bg===`night`&&n.c===`#1d1b18`?`#f6f2ea`:n.c,e.lineWidth=Math.max(.6,n.w*Math.min(1.6,i.k)),e.beginPath(),e.moveTo(a(n.x1),o(n.y1)),e.lineTo(a(n.x2),o(n.y2)),e.stroke()}return{F:i,X:a,Y:o}}let P=n(a,m.cv,e=>{let t=m.g,n=m.w,r=m.h,i=x?.segs.length??0;S<i&&(S=Math.min(i,S+Math.max(1,Math.round((g.speed/100)**2*600*e*60/10)+(g.speed>80?i/40:0)))),M(t,n,r);let{X:a,Y:o,F:s}=N(t,n,r,S),c=x?.segs??[],l=0,u=0,d=0;if(S<i&&S>0){let e=c[S-1];l=e.x2,u=e.y2,d=Math.atan2(e.x2-e.x1,e.y2-e.y1)}else x&&(l=x.turtle.x,u=x.turtle.y,d=x.turtle.h*Math.PI/180);t.save(),t.translate(a(l),o(u)),t.rotate(d),t.fillStyle=`#2e8b57`,t.beginPath(),t.moveTo(0,-11),t.lineTo(7,7),t.lineTo(0,3),t.lineTo(-7,7),t.closePath(),t.fill(),t.restore(),D(`a`,`${S.toLocaleString()} / ${i.toLocaleString()}`),D(`b`,x?x.steps.toLocaleString():`—`),D(`c`,`${Math.round(s.w)} × ${Math.round(s.h)}`),S>=i&&P.pause()});function F(){let e=b.get(),t=(g.code.split(`
`).find(e=>e.trim().startsWith(`;`))??g.code.split(`
`)[0]).replace(/^;\s*/,``).slice(0,28)||`sketch`;for(e.unshift({name:t,code:g.code});e.length>10;)e.pop();b.set(e),I()}function I(){O.replaceChildren(),b.get().forEach((e,t)=>{let n=i(`button`,{type:`button`,class:`wk-b`,text:e.name,onclick:()=>{T.value=e.code,A()}}),r=i(`button`,{type:`button`,class:`wk-b`,"aria-label":f(`del`,`Remove`),text:`×`,onclick:()=>{let e=b.get();e.splice(t,1),b.set(e),I()}});O.append(i(`span`,{style:{display:`inline-flex`,gap:`2px`}},n,r))})}function L(){let e=1600,t=1200,n=document.createElement(`canvas`);n.width=e,n.height=t;let r=n.getContext(`2d`);M(r,e,t),N(r,e,t,x?.segs.length??0),u(n,`abidora-turtle.png`)}function R(){let e=1e3,t=j(e,760),n=n=>(e/2+(n-t.cx)*t.k).toFixed(1),r=e=>(394-(e-t.cy)*t.k).toFixed(1),i=e=>e.replace(/[^#a-z0-9(),.% ]/gi,``),a=(x?.segs??[]).map(e=>`<line x1="${n(e.x1)}" y1="${r(e.y1)}" x2="${n(e.x2)}" y2="${r(e.y2)}" stroke="${i(e.c)}" stroke-width="${Math.max(.6,e.w*Math.min(1.6,t.k)).toFixed(2)}" stroke-linecap="round"/>`),o=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${e}" height="760" viewBox="0 0 ${e} 760"><rect width="100%" height="100%" fill="${g.bg===`night`?`#14161f`:`#f5f0e4`}"/>\n${a.join(`
`)}\n</svg>`;u(new Blob([o],{type:`image/svg+xml`}),`abidora-turtle.svg`)}m.onResize(()=>P.play()),I(),A()}export{y as EXAMPLES,p as LogoError,b as default,f as lex,v as runLogo};