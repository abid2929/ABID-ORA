// @ts-nocheck
/* the ten painting methods of World 45/28, unchanged from the site (same seed gives the same picture) */
export function rng(seed = Date.now()) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = (R, a) => a[Math.floor(R() * a.length)];
const pointillism = (g, w, hh, R) => {
  const horizon = hh * (0.42 + R() * 0.12), sunX = w * (0.2 + R() * 0.6), sunY = horizon - hh * (0.08 + R() * 0.12), hillA = R() * 6, warm = R() < 0.5;
  const base = (x, y) => {
    const ds = Math.hypot(x - sunX, y - sunY);
    if (ds < hh * 0.05) return [255, 214, 120];
    const hill = horizon + Math.sin(x / w * 5 + hillA) * hh * 0.04 + Math.sin(x / w * 13) * hh * 0.015;
    if (y < horizon) {
      const k = y / horizon;
      return warm ? [255 - k * 40, 180 + k * 30, 140 + k * 80] : [120 + k * 80, 170 + k * 50, 230];
    }
    if (y < hill + hh * 0.12) return [70, 130 + (y - horizon) / hh * 100, 70];
    return [60, 120 + Math.sin(y / 9) * 20, 170];
  };
  g.fillStyle = "#f4efe2";
  g.fillRect(0, 0, w, hh);
  const PAL = [[230, 60, 50], [250, 200, 60], [60, 160, 80], [50, 90, 200], [250, 250, 245], [170, 70, 170], [250, 140, 50], [90, 190, 220]];
  const r = Math.max(2, w / 150);
  for (let i = 0; i < w * hh / (r * r) * 1.3; i++) {
    const x = R() * w, y = R() * hh, [br, bg, bb] = base(x, y);
    let best = 0, bd = 1e9, second = 0;
    PAL.forEach((p, k) => {
      const d = (p[0] - br) ** 2 + (p[1] - bg) ** 2 + (p[2] - bb) ** 2;
      if (d < bd) {
        second = best;
        bd = d;
        best = k;
      }
    });
    const c = PAL[R() < 0.72 ? best : second];
    g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.8, R() * 3, 0, 7);
    g.fill();
  }
};
const deStijl = (g, w, hh, R) => {
  g.fillStyle = "#f3f0e6";
  g.fillRect(0, 0, w, hh);
  const cells = [[0, 0, w, hh]], out = [];
  while (cells.length) {
    const [x, y, cw, ch] = cells.pop();
    if (cw < w * 0.18 && ch < hh * 0.18 || out.length > 4 && R() < 0.28) {
      out.push([x, y, cw, ch]);
      continue;
    }
    if (cw > ch ? R() < 0.8 : R() < 0.2) {
      const s = cw * (0.25 + R() * 0.5);
      cells.push([x, y, s, ch], [x + s, y, cw - s, ch]);
    } else {
      const s = ch * (0.25 + R() * 0.5);
      cells.push([x, y, cw, s], [x, y + s, cw, ch - s]);
    }
  }
  const prim = ["#d42a1e", "#1e3fa0", "#f2c81e", "#111"];
  out.sort((a, b) => b[2] * b[3] - a[2] * a[3]);
  out.forEach((c, i) => {
    if (i > 0 && R() < 0.32) {
      g.fillStyle = prim[i % 4 === 3 && R() < 0.5 ? 3 : Math.floor(R() * 3)];
      g.fillRect(c[0], c[1], c[2], c[3]);
    }
  });
  g.strokeStyle = "#111";
  g.lineWidth = Math.max(4, w / 55);
  for (const c of out) g.strokeRect(c[0], c[1], c[2], c[3]);
};
const suprematism = (g, w, hh, R) => {
  g.fillStyle = "#efe9da";
  g.fillRect(0, 0, w, hh);
  const cols = ["#111", "#c8281d", "#1d3c8f", "#e2b829", "#2f6b3a", "#6b3b8f"], ang = (R() - 0.5) * 1.2;
  const n = 6 + Math.floor(R() * 8);
  for (let i = 0; i < n; i++) {
    g.save();
    g.translate(w * (0.2 + R() * 0.6), hh * (0.15 + R() * 0.7));
    g.rotate(ang + (R() - 0.5) * 0.5);
    g.fillStyle = i === 0 ? "#111" : pick(R, cols);
    const big = i < 2 ? 1 : 0.45;
    const k = R();
    if (k < 0.55) {
      const a = w * (0.08 + R() * 0.4) * big, b = a * (0.06 + R() * 0.4);
      g.fillRect(-a / 2, -b / 2, a, b);
    } else if (k < 0.75) {
      g.beginPath();
      g.arc(0, 0, w * (0.02 + R() * 0.08) * big, 0, 7);
      g.fill();
    } else {
      g.fillRect(-w * 0.25, -1, w * 0.5, Math.max(2, w / 220));
    }
    g.restore();
  }
};
const opArt = (g, w, hh, R) => {
  g.fillStyle = "#f7f5f0";
  g.fillRect(0, 0, w, hh);
  const n = 46 + Math.floor(R() * 30), cx = w * (0.3 + R() * 0.4), cy = hh * (0.3 + R() * 0.4), amp = w * (0.03 + R() * 0.05), freq = 2 + R() * 4, dark = R() < 0.5 ? "#111" : "#1a2a6c";
  g.fillStyle = dark;
  for (let i = 0; i < n; i += 2) {
    const y0 = i / n * hh, y1 = (i + 1) / n * hh;
    const line = (yb, x) => {
      const d = Math.hypot(x - cx, yb - cy) / w, bulge = Math.exp(-d * d * 6);
      return yb + Math.sin(x / w * Math.PI * freq + i * 0.15) * amp * (0.3 + bulge) + (yb - cy) * bulge * 0.35;
    };
    g.beginPath();
    for (let x = 0; x <= w; x += 4) g.lineTo(x, line(y0, x));
    for (let x = w; x >= 0; x -= 4) g.lineTo(x, line(y1, x));
    g.closePath();
    g.fill();
  }
};
const colorField = (g, w, hh, R) => {
  const hue = R() * 360, ground = `hsl(${hue},${45 + R() * 30}%,${18 + R() * 25}%)`;
  g.fillStyle = ground;
  g.fillRect(0, 0, w, hh);
  const n = 2 + Math.floor(R() * 2), m = w * 0.08;
  let y = hh * 0.06;
  const hs = Array.from({ length: n }, () => 0.5 + R()), tot = hs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const bh = (hh * 0.88 - (n - 1) * hh * 0.03) * hs[i] / tot, c = `hsl(${(hue + (R() - 0.5) * 90 + 360) % 360},${50 + R() * 40}%,${30 + R() * 40}%)`;
    g.save();
    g.filter = `blur(${Math.max(2, w / 120)}px)`;
    g.globalAlpha = 0.92;
    g.fillStyle = c;
    g.fillRect(m, y, w - 2 * m, bh);
    g.globalAlpha = 0.25;
    for (let k = 0; k < 6; k++) {
      g.fillRect(m + (R() - 0.5) * 8, y + (R() - 0.5) * 8, w - 2 * m, bh);
    }
    g.restore();
    y += bh + hh * 0.03;
  }
};
const drips = (g, w, hh, R) => {
  g.fillStyle = R() < 0.5 ? "#e9e2d0" : "#2b2a28";
  g.fillRect(0, 0, w, hh);
  const cols = ["#111", "#f4f1ea", "#c9a227", "#8a2b1f", "#5c6b7a", "#d9d2c3"];
  for (let s = 0; s < 64; s++) {
    g.strokeStyle = pick(R, cols);
    let x = R() * w, y = R() * hh, a = R() * 7, v = 2 + R() * 4, wd = 1 + R() * (w / 70);
    g.lineCap = "round";
    for (let i = 0; i < 160; i++) {
      a += (R() - 0.5) * 0.5;
      const nx = x + Math.cos(a) * v * w / 400, ny = y + Math.sin(a) * v * w / 400;
      v = clamp(v + (R() - 0.5) * 0.8, 0.5, 7);
      g.lineWidth = Math.max(0.8, wd / v * 3);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(nx, ny);
      g.stroke();
      x = nx;
      y = ny;
      if (R() < 0.03) {
        g.fillStyle = g.strokeStyle;
        g.beginPath();
        g.arc(x + (R() - 0.5) * 12, y + (R() - 0.5) * 12, R() * wd, 0, 7);
        g.fill();
      }
    }
  }
};
const girih = (g, w, hh, R) => {
  const bg = pick(R, ["#0f3b57", "#13312a", "#3a1f14", "#f1e6cf"]), ln = bg === "#f1e6cf" ? "#1c3f6e" : "#e8c77a", fill = pick(R, ["#2a7f8f", "#b5552e", "#e2d3a8", "#3c6e47"]);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, hh);
  const s = w / (3 + Math.floor(R() * 3)), contact = 0.3 + R() * 0.3;
  const star = (cx, cy, r) => {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8 + Math.PI / 8, rr = i % 2 ? r : r * contact * 1.5;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  };
  g.lineWidth = Math.max(2, w / 160);
  g.strokeStyle = ln;
  g.lineJoin = "round";
  for (let y = -s; y < hh + s; y += s) for (let x = -s; x < w + s; x += s) {
    const p = star(x + s / 2, y + s / 2, s * 0.5);
    g.fillStyle = fill;
    g.beginPath();
    p.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b));
    g.closePath();
    g.fill();
    g.stroke();
    const q = star(x, y, s * 0.24);
    g.fillStyle = bg;
    g.beginPath();
    q.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b));
    g.closePath();
    g.fill();
    g.stroke();
  }
};
const alpona = (g, w, hh, R) => {
  g.fillStyle = pick(R, ["#8c3a24", "#7a2e1f", "#9b4a2a"]);
  g.fillRect(0, 0, w, hh);
  const cx = w / 2, cy = hh / 2, M = Math.min(w, hh) / 2;
  g.strokeStyle = "#f7f1e3";
  g.fillStyle = "#f7f1e3";
  g.lineCap = "round";
  const petals = (n, r0, r1, wd, off = 0) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + off;
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.beginPath();
      g.moveTo(r0, 0);
      g.quadraticCurveTo((r0 + r1) / 2, -wd, r1, 0);
      g.quadraticCurveTo((r0 + r1) / 2, wd, r0, 0);
      g.lineWidth = Math.max(1.5, M / 90);
      g.stroke();
      g.restore();
    }
  };
  g.beginPath();
  g.arc(cx, cy, M * 0.07, 0, 7);
  g.fill();
  const rings = 3 + Math.floor(R() * 2);
  let r = M * 0.1;
  for (let k = 0; k < rings; k++) {
    const n = 8 + k * 4 + Math.floor(R() * 3) * 4, len = M * (0.12 + R() * 0.08);
    petals(n, r, r + len, len * (0.25 + R() * 0.2), k % 2 ? Math.PI / n : 0);
    r += len;
    g.lineWidth = Math.max(1, M / 160);
    g.beginPath();
    g.arc(cx, cy, r + M * 0.02, 0, 7);
    g.stroke();
    for (let i = 0; i < n * 2; i++) {
      const a = i / (n * 2) * Math.PI * 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * (r + M * 0.045), cy + Math.sin(a) * (r + M * 0.045), M / 130, 0, 7);
      g.fill();
    }
    r += M * 0.07;
  }
  for (const [sx, sy] of [[0, 0], [w, 0], [0, hh], [w, hh]]) {
    g.save();
    g.translate(sx, sy);
    g.rotate(Math.atan2(cy - sy, cx - sx));
    g.lineWidth = Math.max(1.5, M / 100);
    g.beginPath();
    for (let t = 0; t < 1; t += 0.01) {
      const x = t * M * 0.55, y = Math.sin(t * 12) * M * 0.04;
      t ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
    g.restore();
  }
};
const bauhaus = (g, w, hh, R) => {
  g.fillStyle = "#ece6d6";
  g.fillRect(0, 0, w, hh);
  const n = 3 + Math.floor(R() * 2), s = w / n, cols = ["#d33b2c", "#1f4a9c", "#f0b928", "#121212", "#ece6d6"];
  for (let y = 0; y < hh; y += s) for (let x = 0; x < w; x += s) {
    g.save();
    g.translate(x + s / 2, y + s / 2);
    g.rotate(Math.floor(R() * 4) * Math.PI / 2);
    g.fillStyle = pick(R, cols.slice(0, 4));
    g.fillRect(-s / 2, -s / 2, s, s);
    g.fillStyle = pick(R, cols);
    const k = R();
    if (k < 0.35) {
      g.beginPath();
      g.arc(-s / 2, s / 2, s, -Math.PI / 2, 0);
      g.lineTo(-s / 2, s / 2);
      g.fill();
    } else if (k < 0.6) {
      g.beginPath();
      g.arc(0, 0, s * 0.38, 0, 7);
      g.fill();
    } else if (k < 0.8) {
      g.beginPath();
      g.moveTo(-s / 2, -s / 2);
      g.lineTo(s / 2, s / 2);
      g.lineTo(-s / 2, s / 2);
      g.fill();
    } else {
      g.beginPath();
      g.arc(0, s / 2, s / 2, Math.PI, 0);
      g.fill();
    }
    g.restore();
  }
};
const computerArt = (g, w, hh, R) => {
  g.fillStyle = "#f5f3ee";
  g.fillRect(0, 0, w, hh);
  const cols = 10 + Math.floor(R() * 4), s = w * 0.8 / cols, rows = Math.floor(hh * 0.86 / s), x0 = (w - cols * s) / 2, y0 = (hh - rows * s) / 2;
  g.strokeStyle = "#151515";
  g.lineWidth = Math.max(1, w / 400);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j / rows, rot = (R() - 0.5) * k * k * 1.6, dx = (R() - 0.5) * k * k * s * 0.9, dy = (R() - 0.5) * k * k * s * 0.9;
    g.save();
    g.translate(x0 + i * s + s / 2 + dx, y0 + j * s + s / 2 + dy);
    g.rotate(rot);
    g.strokeRect(-s / 2, -s / 2, s, s);
    g.restore();
  }
};
export const GENS = { pointillism, deStijl, suprematism, opArt, colorField, drips, girih, alpona, bauhaus, computerArt };
