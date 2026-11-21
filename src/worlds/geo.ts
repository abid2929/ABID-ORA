/* Shared geography helpers (used by worlds 065 and 068): great circles, the Sun's position and a list of cities. */
import { clamp } from './kit';

export const RAD = Math.PI / 180, DEG = 180 / Math.PI;
export const R_EARTH = 6371.0088; /* mean Earth radius, km */

/* ---------- geodesy ---------- */
export function haversine(la1: number, lo1: number, la2: number, lo2: number) {
  const p1 = la1 * RAD, p2 = la2 * RAD, dp = p2 - p1, dl = (lo2 - lo1) * RAD;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}
/** initial compass bearing in degrees, 0 = north, clockwise */
export function bearing(la1: number, lo1: number, la2: number, lo2: number) {
  const p1 = la1 * RAD, p2 = la2 * RAD, dl = (lo2 - lo1) * RAD;
  return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * DEG + 360) % 360;
}
/** point reached after going `d` km from (la, lo) on bearing `brg` */
export function destination(la: number, lo: number, brg: number, d: number): [number, number] {
  const p = la * RAD, l = lo * RAD, b = brg * RAD, a = d / R_EARTH;
  const p2 = Math.asin(Math.sin(p) * Math.cos(a) + Math.cos(p) * Math.sin(a) * Math.cos(b));
  const l2 = l + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(p), Math.cos(a) - Math.sin(p) * Math.sin(p2));
  return [p2 * DEG, ((l2 * DEG + 540) % 360) - 180];
}
/** n+1 points along the great circle from A to B (spherical interpolation) */
export function greatCircle(la1: number, lo1: number, la2: number, lo2: number, n = 128): [number, number][] {
  const v = (la: number, lo: number) => [Math.cos(la * RAD) * Math.cos(lo * RAD), Math.cos(la * RAD) * Math.sin(lo * RAD), Math.sin(la * RAD)];
  const a = v(la1, lo1), b = v(la2, lo2), w = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1)), out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = Math.sin(w), k1 = s < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / s, k2 = s < 1e-9 ? t : Math.sin(t * w) / s;
    const x = k1 * a[0] + k2 * b[0], y = k1 * a[1] + k2 * b[1], z = k1 * a[2] + k2 * b[2];
    out.push([Math.atan2(z, Math.hypot(x, y)) * DEG, Math.atan2(y, x) * DEG]);
  }
  return out;
}

/* ---------- the Sun (standard low-precision formulas, good to about 0.01° in declination) ---------- */
export function sun(date: Date) {
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0; /* days since J2000.0 */
  const g = (357.529 + 0.98560028 * d) * RAD, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD, e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) * DEG, dec = Math.asin(Math.sin(e) * Math.sin(L)) * DEG;
  const gmst = 280.46061837 + 360.98564736629 * d;
  const lon = ((((ra - gmst) % 360) + 540) % 360) - 180;
  return { dec, lon };
}
/** the Sun's height above the horizon, degrees */
export const sunAlt = (la: number, lo: number, s: { dec: number; lon: number }) => Math.asin(clamp(Math.sin(la * RAD) * Math.sin(s.dec * RAD) + Math.cos(la * RAD) * Math.cos(s.dec * RAD) * Math.cos((lo - s.lon) * RAD), -1, 1)) * DEG;
/** hours from sunrise to sunset (with the usual −0.833° for refraction and the Sun's size); 0 or 24 in polar night or day */
export function dayLength(la: number, dec: number) {
  const c = (Math.sin(-0.833 * RAD) - Math.sin(la * RAD) * Math.sin(dec * RAD)) / (Math.cos(la * RAD) * Math.cos(dec * RAD));
  if (c >= 1) return 0; if (c <= -1) return 24; return 2 * Math.acos(c) * DEG / 15;
}

/* ---------- cities (approximate centre coordinates; time zones are IANA names used by your browser's clock) ---------- */
export const CITIES: [string, number, number, string][] = [
  ['Dhaka', 23.81, 90.41, 'Asia/Dhaka'], ['Chattogram', 22.36, 91.78, 'Asia/Dhaka'], ['London', 51.51, -0.13, 'Europe/London'], ['New York', 40.71, -74.01, 'America/New_York'],
  ['Tokyo', 35.68, 139.69, 'Asia/Tokyo'], ['Sydney', -33.87, 151.21, 'Australia/Sydney'], ['Dubai', 25.2, 55.27, 'Asia/Dubai'], ['Paris', 48.86, 2.35, 'Europe/Paris'],
  ['Cairo', 30.04, 31.24, 'Africa/Cairo'], ['Lagos', 6.52, 3.38, 'Africa/Lagos'], ['Nairobi', -1.29, 36.82, 'Africa/Nairobi'], ['Cape Town', -33.92, 18.42, 'Africa/Johannesburg'],
  ['Mumbai', 19.08, 72.88, 'Asia/Kolkata'], ['Delhi', 28.61, 77.21, 'Asia/Kolkata'], ['Kathmandu', 27.72, 85.32, 'Asia/Kathmandu'], ['Karachi', 24.86, 67.01, 'Asia/Karachi'],
  ['Beijing', 39.9, 116.41, 'Asia/Shanghai'], ['Seoul', 37.57, 126.98, 'Asia/Seoul'], ['Singapore', 1.35, 103.82, 'Asia/Singapore'], ['Jakarta', -6.21, 106.85, 'Asia/Jakarta'],
  ['Bangkok', 13.76, 100.5, 'Asia/Bangkok'], ['Riyadh', 24.71, 46.68, 'Asia/Riyadh'], ['Makkah', 21.42, 39.83, 'Asia/Riyadh'], ['Tehran', 35.69, 51.39, 'Asia/Tehran'],
  ['Istanbul', 41.01, 28.98, 'Europe/Istanbul'], ['Moscow', 55.76, 37.62, 'Europe/Moscow'], ['Berlin', 52.52, 13.4, 'Europe/Berlin'], ['Madrid', 40.42, -3.7, 'Europe/Madrid'],
  ['Reykjavík', 64.15, -21.94, 'Atlantic/Reykjavik'], ['Toronto', 43.65, -79.38, 'America/Toronto'], ['Los Angeles', 34.05, -118.24, 'America/Los_Angeles'], ['Mexico City', 19.43, -99.13, 'America/Mexico_City'],
  ['São Paulo', -23.55, -46.63, 'America/Sao_Paulo'], ['Buenos Aires', -34.6, -58.38, 'America/Argentina/Buenos_Aires'], ['Lima', -12.05, -77.04, 'America/Lima'], ['Anchorage', 61.22, -149.9, 'America/Anchorage'],
  ['Honolulu', 21.31, -157.86, 'Pacific/Honolulu'], ['Auckland', -36.85, 174.76, 'Pacific/Auckland'], ['Longyearbyen', 78.22, 15.65, 'Arctic/Longyearbyen'], ['McMurdo Station', -77.85, 166.67, 'Antarctica/McMurdo'],
];

