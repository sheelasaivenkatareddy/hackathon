// Binary morphology and connected components, matching scipy.ndimage defaults used in the reference.
import { Mask, newMask } from "./types";

export function and(a: Mask, b: Mask): Mask {
  const o = newMask(a.width, a.height);
  for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] & b.data[i];
  return o;
}
export function or(a: Mask, b: Mask): Mask {
  const o = newMask(a.width, a.height);
  for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] | b.data[i];
  return o;
}
export function andNot(a: Mask, b: Mask): Mask {
  const o = newMask(a.width, a.height);
  for (let i = 0; i < o.data.length; i++) o.data[i] = a.data[i] & (b.data[i] ^ 1);
  return o;
}

/** Square dilation (size k, odd) - separable. Outside the image counts as 0. */
export function dilateSquare(m: Mask, k: number): Mask {
  const r = k >> 1, { width: w, height: h } = m;
  const tmp = newMask(w, h), o = newMask(w, h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dx = -r; dx <= r && !v; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) v = m.data[row + xx]; }
      tmp.data[row + x] = v;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let dy = -r; dy <= r && !v; dy++) { const yy = y + dy; if (yy >= 0 && yy < h) v = tmp.data[yy * w + x]; }
    o.data[y * w + x] = v;
  }
  return o;
}

/** Square erosion (size k, odd) - separable. Outside the image counts as 0 (scipy border_value=0). */
export function erodeSquare(m: Mask, k: number): Mask {
  const r = k >> 1, { width: w, height: h } = m;
  const tmp = newMask(w, h), o = newMask(w, h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dx = -r; dx <= r && v; dx++) { const xx = x + dx; v = xx >= 0 && xx < w ? m.data[row + xx] : 0; }
      tmp.data[row + x] = v;
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 1;
    for (let dy = -r; dy <= r && v; dy++) { const yy = y + dy; v = yy >= 0 && yy < h ? tmp.data[yy * w + x] : 0; }
    o.data[y * w + x] = v;
  }
  return o;
}

export const closeSquare = (m: Mask, k: number): Mask => erodeSquare(dilateSquare(m, k), k);

function diskOffsets(r: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) out.push([dx, dy]);
  return out;
}

/** Dilation with a disk of radius r. */
export function dilateDisk(m: Mask, r: number): Mask {
  const { width: w, height: h } = m, o = newMask(w, h), off = diskOffsets(r);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m.data[y * w + x]) continue;
    for (const [dx, dy] of off) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) o.data[yy * w + xx] = 1;
    }
  }
  return o;
}

/** Erosion with a disk of radius r. Outside the image counts as 0. */
export function erodeDisk(m: Mask, r: number): Mask {
  const { width: w, height: h } = m, o = newMask(w, h), off = diskOffsets(r);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!m.data[y * w + x]) continue;
    let keep = 1;
    for (const [dx, dy] of off) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || xx >= w || yy < 0 || yy >= h || !m.data[yy * w + xx]) { keep = 0; break; }
    }
    o.data[y * w + x] = keep;
  }
  return o;
}

/** Diamond dilation, same as scipy binary_dilation(iterations=n) with the default cross. */
export function dilateDiamond(m: Mask, n: number): Mask {
  let cur = m;
  for (let it = 0; it < n; it++) {
    const { width: w, height: h } = cur, o = newMask(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      o.data[i] = cur.data[i] | (x > 0 ? cur.data[i - 1] : 0) | (x < w - 1 ? cur.data[i + 1] : 0) |
        (y > 0 ? cur.data[i - w] : 0) | (y < h - 1 ? cur.data[i + w] : 0);
    }
    cur = o;
  }
  return cur;
}

export interface Labels { labels: Int32Array; sizes: number[]; count: number } // label 0 = background, sizes[0] unused

/** Connected components. eight=true uses 8-connectivity. */
export function label(m: Mask, eight = true): Labels {
  const { width: w, height: h } = m, labels = new Int32Array(w * h), sizes = [0];
  const stack = new Int32Array(w * h);
  let count = 0;
  for (let start = 0; start < w * h; start++) {
    if (!m.data[start] || labels[start]) continue;
    count++; let size = 0, top = 0;
    stack[top++] = start; labels[start] = count;
    while (top) {
      const i = stack[--top]; size++;
      const x = i % w, y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!eight && dx && dy) continue;
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
        const j = yy * w + xx;
        if (m.data[j] && !labels[j]) { labels[j] = count; stack[top++] = j; }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes, count };
}

export function largestComponent(m: Mask): Mask {
  const { labels, sizes, count } = label(m, true), o = newMask(m.width, m.height);
  if (!count) return o;
  let best = 1;
  for (let k = 2; k <= count; k++) if (sizes[k] > sizes[best]) best = k;
  for (let i = 0; i < labels.length; i++) o.data[i] = labels[i] === best ? 1 : 0;
  return o;
}

/** scipy binary_fill_holes: background not connected (4-way) to the border becomes foreground. */
export function fillHoles(m: Mask): Mask {
  const { width: w, height: h } = m, reached = new Uint8Array(w * h), stack = new Int32Array(w * h);
  let top = 0;
  const push = (i: number) => { if (!m.data[i] && !reached[i]) { reached[i] = 1; stack[top++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (top) {
    const i = stack[--top], x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  const o = newMask(w, h);
  for (let i = 0; i < o.data.length; i++) o.data[i] = m.data[i] || !reached[i] ? 1 : 0;
  return o;
}
