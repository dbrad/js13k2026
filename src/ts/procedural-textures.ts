import { clamp, randInt, smooth } from "./math";

let hash2 = (x: number, y: number, seed: number): number => {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return h ^ (h >>> 16);
};

let valueNoise = (x: number, y: number, seed: number): number => {
  let ix = x | 0, iy = y | 0;
  let fx = x - ix, fy = y - iy;
  let a = (hash2(ix, iy, seed) & 0xffff) / 0xffff;
  let b = (hash2(ix + 1, iy, seed) & 0xffff) / 0xffff;
  let c = (hash2(ix, iy + 1, seed) & 0xffff) / 0xffff;
  let d = (hash2(ix + 1, iy + 1, seed) & 0xffff) / 0xffff;
  let ux = fx * fx * (3 - 2 * fx);
  let uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};



let put = (out: Uint8Array, i: number, r: number, g: number, b: number, a = 255): void => {
  out[i] = r < 0 ? 0 : r > 255 ? 255 : r | 0;
  out[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g | 0;
  out[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b | 0;
  out[i + 3] = a;
};

export let genBrick = (w: number, h: number, seed: number, out: Uint8Array, offset: number = 0, cracked: boolean = false): void => {
  let brickW = Math.max(6, (w / 4) | 0);
  let brickH = Math.max(3, (h / 8) | 0);
  let mortar = 1;

  for (let y = 0; y < h; y++) {
    let row = (y / brickH) | 0;
    let shift = (row & 1) * (brickW >> 1);

    for (let x = 0; x < w; x++) {
      let bx = ((x + shift) % brickW + brickW) % brickW;
      let by = y % brickH;
      let isMortar = bx < mortar || by < mortar;

      let brickId = (((x + shift) / brickW) | 0) + row * 31;
      let v = 0.78 + 0.22 * ((hash2(brickId, row, seed) & 7) / 7);

      let r: number, g: number, b: number;
      if (isMortar) {
        let m = 20 + (hash2(x, y, seed) & 12);
        r = g = b = m;
      } else {
        r = (62 * v) | 0;
        g = (60 * v) | 0;
        b = (66 * v) | 0;

        let grit = (hash2(x, y, seed) & 5) - 2;
        r = clamp(r + grit, 0, 255);
        g = clamp(g + grit, 0, 255);
        b = clamp(b + grit, 0, 255);

        let gy = by / brickH;
        r = (r * (0.92 + 0.16 * gy)) | 0;
        g = (g * (0.92 + 0.16 * gy)) | 0;
        b = (b * (0.92 + 0.16 * gy)) | 0;
      }

      if (cracked) {
        let crack = 1.0;

        {
          let n = valueNoise(x * 0.11 + 2.3, y * 0.19, seed + 901);
          let d = Math.abs(n - 0.5) * 2;
          crack = Math.min(crack, d);
        }
        {
          let n = valueNoise(x * 0.17 - y * 0.08, y * 0.13, seed + 417);
          let d = Math.abs(n - 0.5) * 2;
          crack = Math.min(crack, d * 1.15);
        }
        {
          let n = valueNoise(x * 0.09, y * 0.22 + 5.1, seed + 233);
          let d = Math.abs(n - 0.5) * 2;
          crack = Math.min(crack, d * 1.3);
        }

        let width = 0.07;
        if (crack < width) {
          let t = crack / width;
          let dark = 0.18 + 0.55 * t;
          r = (r * dark) | 0;
          g = (g * dark) | 0;
          b = (b * dark) | 0;
        }
      }

      put(out, offset + (y * w + x) * 4, r, g, b);
    }
  }
};

export let genStone = (w: number, h: number, seed: number, out: Uint8Array, offset = 0): void => {
  // Choose tile counts that divide the dimensions evenly so the texture
  // repeats without cutting a tile in half.
  let tilesX = Math.max(2, Math.round(w / 9));
  let tilesY = Math.max(2, Math.round(h / 9));

  // Nudge until we have exact divisors (keeps visual size close to target)
  while (w % tilesX !== 0 && tilesX > 2) tilesX--;
  while (h % tilesY !== 0 && tilesY > 2) tilesY--;

  let tileW = (w / tilesX) | 0;
  let tileH = (h / tilesY) | 0;
  let mortar = Math.max(1, (Math.min(tileW, tileH) / 8) | 0);

  // weathered grey-stone palette (dark → light)
  let tones = [
    [62, 60, 66],
    [82, 80, 86],
    [104, 102, 108],
    [128, 126, 132],
  ];

  for (let y = 0; y < h; y++) {
    let ty = (y / tileH) | 0;
    let localY = y % tileH;

    for (let x = 0; x < w; x++) {
      let tx = (x / tileW) | 0;
      let localX = x % tileW;

      let isMortar = localX < mortar || localY < mortar;

      let r: number, g: number, b: number;

      if (isMortar) {
        // dark mortar with tiny variation
        let m = 36 + (hash2(x, y, seed) & 12);
        r = g = b = m;
      } else {
        // per-tile colour variation
        let tileHash = hash2(tx, ty, seed);
        let baseIdx = tileHash & 3;
        let [tr, tg, tb] = tones[baseIdx];

        // surface noise inside the tile
        let n = valueNoise(x * 0.22, y * 0.22, seed + 17) * 0.55
          + valueNoise(x * 0.55, y * 0.55, seed + 41) * 0.45;
        n = clamp(n, 0, 1);
        let shade = 0.82 + 0.36 * n;

        r = (tr * shade) | 0;
        g = (tg * shade) | 0;
        b = (tb * shade) | 0;

        // edge weathering / darkening near the mortar (left & top)
        // also darken near the right & bottom so the tile still looks inset
        let distL = localX - mortar;
        let distT = localY - mortar;
        let distR = tileW - 1 - localX;
        let distB = tileH - 1 - localY;
        let edgeDist = Math.min(distL, distT, distR, distB);

        if (edgeDist < 2) {
          let wear = 1 - (2 - edgeDist) * 0.16;
          r = (r * wear) | 0;
          g = (g * wear) | 0;
          b = (b * wear) | 0;
        }

        // occasional small chip / pit
        let chip = hash2(x * 3, y * 5, seed + 99);
        if ((chip & 63) === 0) {
          r = (r * 0.55) | 0;
          g = (g * 0.55) | 0;
          b = (b * 0.55) | 0;
        }

        // fine grit
        let grit = (hash2(x, y, seed) & 5) - 2;
        r = clamp(r + grit, 0, 255);
        g = clamp(g + grit, 0, 255);
        b = clamp(b + grit, 0, 255);
      }

      put(out, offset + (y * w + x) * 4, r, g, b);
    }
  }
};

export let genWood = (w: number, h: number, seed: number, out: Uint8Array, offset = 0): void => {
  // plank height (thickness of each board)
  let plankH = 7;//Math.max(6, Math.round(h / 8));
  // average plank length – longer than brick, scales with width
  let plankLen = Math.max(14, (w * 0.75) | 0);
  let joint = 1;//Math.max(1, (plankH / 5) | 0);   // thickness of end + side grooves
  let lastRow = 0;
  for (let y = 0; y < h; y++) {
    let row = (y / plankH) | 0;
    let localY = y % plankH;
    if (row > lastRow) {
      plankLen = randInt((w * 0.55) | 0, (w * 0.85) | 0);
      lastRow = row;
    }
    // stagger every other row (classic hardwood / running bond)
    let rowShift = (row & 1) * (plankLen >> 1);

    for (let x = 0; x < w; x++) {
      // which plank are we inside on this row?
      let shiftedX = x + rowShift;
      let plankIdx = (shiftedX / plankLen) | 0;
      let localX = ((shiftedX % plankLen) + plankLen) % plankLen;

      // unique seed per individual plank
      let pSeed = hash2(plankIdx, row, seed);

      // base colour variation per plank
      let baseV = 1.0;//0.72 + 0.28 * ((pSeed & 15) / 15);
      let baseR = (148 * baseV) | 0;
      let baseG = (98 * baseV) | 0;
      let baseB = (52 * baseV) | 0;

      // vertical grain
      let grain = valueNoise(x * 0.38 + plankIdx * 2.3, row * 4.1, seed + 11);
      let gMod = 0.80 + 0.40 * grain;

      let r = (baseR * gMod) | 0;
      let g = (baseG * gMod) | 0;
      let b = (baseB * gMod) | 0;

      // long-edge grooves (top / bottom of plank)
      let onLongEdge = localY < joint || localY >= plankH - joint;
      // short end joints (left / right of plank)
      let onEndJoint = (localX < joint || localX >= plankLen - joint) && x > 1 && x < w;

      if (onLongEdge || onEndJoint) {
        // darker groove / joint
        let dark = onEndJoint ? 0.42 : 0.55;   // ends a bit darker
        r = (r * dark) | 0;
        g = (g * dark) | 0;
        b = (b * dark) | 0;
      } else {
        // subtle bevel / highlight just inside the edges
        let edgeDist = Math.min(localX - joint, plankLen - joint - 1 - localX,
          localY - joint, plankH - joint - 1 - localY);
        if (edgeDist < 2) {
          let bevel = 1.0 + (2 - edgeDist) * 0.07;
          r = (r * bevel) | 0;
          g = (g * bevel) | 0;
          b = (b * bevel) | 0;
        }
      }

      // occasional knot
      let knotX = (pSeed >>> 8) % Math.max(1, plankLen - 6) + 3;
      let dist = Math.abs(localX - knotX);
      if (dist < 2.5 && localY > joint + 1 && localY < plankH - joint - 1) {
        let k = 1 - dist / 2.5;
        r = (r * (1 - 0.48 * k)) | 0;
        g = (g * (1 - 0.48 * k)) | 0;
        b = (b * (1 - 0.38 * k)) | 0;
      }

      put(out, offset + (y * w + x) * 4, r, g, b);
    }
  }
};

export let genUnicornHorn = (w: number, h: number, seed: number, out: Uint8Array, offset = 0): void => {
  let cx = (w - 1) * 0.5;
  let maxR = w * 0.42;               // base radius
  let tipY = h * 0.08;               // tip starts a little below top

  for (let y = 0; y < h; y++) {
    let t = (y - tipY) / (h - tipY - 1);   // 0 at tip → 1 at base
    if (t < 0) {
      // above tip – fully transparent
      for (let x = 0; x < w; x++) {
        put(out, offset + (y * w + x) * 4, 0, 0, 0, 0);
      }
      continue;
    }

    // radius shrinks toward tip
    let radius = maxR * (0.18 + 0.82 * t);
    // spiral phase
    let phase = t * 6.5 + (seed & 7) * 0.4;

    for (let x = 0; x < w; x++) {
      let dx = x - cx;
      let dist = Math.abs(dx);

      if (dist > radius + 0.6) {
        put(out, offset + (y * w + x) * 4, 0, 0, 0, 0);
        continue;
      }

      // ridge (spiral)
      let ang = Math.atan2(dx, 1) + phase;   // approximate
      let ridge = Math.cos(ang * 3.0);
      let ridgeDark = ridge > 0.35 ? 0.72 : 1.0;

      // base colour: cream → soft pink/gold gradient
      let tipness = 1 - t;
      let r = (245 - tipness * 30 + (seed & 15)) | 0;
      let g = (220 - tipness * 55) | 0;
      let b = (190 - tipness * 40) | 0;

      // apply ridge + subtle vertical highlight
      let highlight = 1.0 + 0.18 * (1 - Math.abs(dx) / radius);
      r = (r * ridgeDark * highlight) | 0;
      g = (g * ridgeDark * highlight) | 0;
      b = (b * ridgeDark * highlight) | 0;

      // soft edge AA (cheap)
      let edge = clamp(1 - (dist - radius + 0.8), 0, 1);
      let a = (edge * 255) | 0;

      put(out, offset + (y * w + x) * 4, r, g, b, a);
    }
  }
};

export let genShadowDemon = (w: number, h: number, seed: number, out: Uint8Array, offset = 0, frameIndex = 0): void => {
  let cx = (w - 1) * 0.5;
  let cy = h * 0.55;
  let time = frameIndex * 0.7;

  // clear to transparent first
  let total = w * h * 4;
  for (let i = 0; i < total; i += 4) {
    out[offset + i] = 0;
    out[offset + i + 1] = 0;
    out[offset + i + 2] = 0;
    out[offset + i + 3] = 0;
  }

  // body parameters (slight seed variation)
  let bodyW = w * (0.28 + 0.04 * ((seed & 3) / 3));
  let bodyH = h * 0.42;
  let headR = w * 0.18;
  let limbPhase = time + seed * 0.01;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx = x - cx;
      let dy = y - cy;

      // ----- body (ellipse) -----
      let bx = dx / bodyW;
      let by = (dy + h * 0.05) / bodyH;
      let body = bx * bx + by * by;

      // ----- head -----
      let hx = dx / headR;
      let hy = (y - (cy - bodyH * 0.85)) / (headR * 1.1);
      let head = hx * hx + hy * hy;

      // ----- limbs (simple oscillating sticks) -----
      let limb = 999;
      // left arm
      {
        let ax = -bodyW * 0.9 + Math.sin(limbPhase) * w * 0.06;
        let ay = -bodyH * 0.2;
        let lx = (dx - ax) / (w * 0.07);
        let ly = (dy - ay) / (h * 0.22);
        limb = Math.min(limb, lx * lx + ly * ly * 0.35);
      }
      // right arm
      {
        let ax = bodyW * 0.9 + Math.sin(limbPhase + 1.3) * w * 0.06;
        let ay = -bodyH * 0.15;
        let lx = (dx - ax) / (w * 0.07);
        let ly = (dy - ay) / (h * 0.22);
        limb = Math.min(limb, lx * lx + ly * ly * 0.35);
      }
      // left leg
      {
        let ax = -bodyW * 0.45 + Math.sin(limbPhase * 0.8) * w * 0.04;
        let ay = bodyH * 0.55;
        let lx = (dx - ax) / (w * 0.08);
        let ly = (dy - ay) / (h * 0.28);
        limb = Math.min(limb, lx * lx + ly * ly * 0.4);
      }
      // right leg
      {
        let ax = bodyW * 0.45 + Math.sin(limbPhase * 0.8 + 2.1) * w * 0.04;
        let ay = bodyH * 0.55;
        let lx = (dx - ax) / (w * 0.08);
        let ly = (dy - ay) / (h * 0.28);
        limb = Math.min(limb, lx * lx + ly * ly * 0.4);
      }

      // ----- rising smoke / shadow tendrils -----
      let smoke = 999;
      for (let s = 0; s < 3; s++) {
        let sx = Math.sin(time * 1.4 + s * 2.1 + seed) * w * 0.12;
        let sy = -bodyH * 0.9 - s * h * 0.08 + Math.cos(time + s) * 3;
        let ss = 0.7 + s * 0.15;
        let lx = (dx - sx) / (w * 0.11 * ss);
        let ly = (dy - sy) / (h * 0.12 * ss);
        smoke = Math.min(smoke, lx * lx + ly * ly);
      }

      // combine
      let d = Math.min(body, head, limb, smoke);
      if (d > 1.0) continue;

      // colour: deep purple-black core, slightly lighter edges
      let edge = smooth(1 - d);
      let r = (18 + edge * 22) | 0;
      let g = (8 + edge * 12) | 0;
      let b = (32 + edge * 40) | 0;

      // glowing eyes (only on head)
      if (head < 0.85) {
        let eyeY = cy - bodyH * 0.85 - headR * 0.15;
        let eyeDistL = Math.hypot(x - (cx - headR * 0.35), y - eyeY);
        let eyeDistR = Math.hypot(x - (cx + headR * 0.35), y - eyeY);
        if (eyeDistL < 1.8 || eyeDistR < 1.8) {
          r = 255;
          g = 60;
          b = 120;
        } else if (eyeDistL < 2.6 || eyeDistR < 2.6) {
          r = 180;
          g = 30;
          b = 80;
        }
      }

      // mouth glow (optional, lower on head)
      if (head < 0.7) {
        let mouthY = cy - bodyH * 0.85 + headR * 0.35;
        let mouthDist = Math.hypot(x - cx, y - mouthY);
        if (mouthDist < 2.2) {
          r = Math.max(r, 140);
          g = Math.max(g, 20);
          b = Math.max(b, 60);
        }
      }

      let a = (edge * 255) | 0;
      put(out, offset + (y * w + x) * 4, r, g, b, a);
    }
  }
};
