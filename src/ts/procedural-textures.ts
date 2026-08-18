import { clamp, floor, randInt } from "./math";

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
  let plankH = 8;//Math.max(6, Math.round(h / 8));
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

export let genShadowCreature = (outputW: number, outputH: number, seed: number, out: Uint8Array, offset = 0): void => {
  let rng = floor(seed);
  let rnd = (max: number = 1, min: number = 0): number => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return ((rng >>> 0) / 4294967296) * (max - min) + min;
  };

  let size = outputW;

  for (let i = 0; i < size * size * 4; i += 4) {
    out[offset + i] = 0;
    out[offset + i + 1] = 0;
    out[offset + i + 2] = 0;
    out[offset + i + 3] = 0;
  }

  const flipAxis = rnd() < .5;
  let w = flipAxis ? size - 3 : floor(size / 2 - 1);
  let h = !flipAxis ? size - 3 : floor(size / 2 - 1);

  const spriteSize = size * rnd(.9, .6);
  const density = rnd(1, .9);
  const doubleCenter = rnd() < .5;
  const yBias = rnd(.1, -.1);

  let x = floor(size / 2);
  let y = 2;
  let colors = [[18, 16, 22], [65, 16, 65]];
  let draw = (outline: number = 0) => {
    rng = floor(seed);
    let [r, g, b] = colors[outline];
    for (let k = 0; k < w * h; ++k) {
      const i = flipAxis ? floor(k / w) : k % w;
      const j = !flipAxis ? floor(k / w) : k % w;
      const isHole = rnd() > density;
      if (!isHole && rnd(spriteSize / 2) ** 2 > i * i + (j - (1 - 2 * yBias) * h / 2) ** 2) {
        for (let sx = 0; sx < 1 + 2 * outline; sx++) {
          for (let sy = 0; sy < 1 + 2 * outline; sy++) {
            let px = x + i - outline - (doubleCenter ? 1 : 0) + sx;
            let py = y + j - outline + sy;
            put(out, offset + (py * outputW + px) * 4, r, g, b, 255);
            px = x - i - outline + sx;
            py = y + j - outline + sy;
            put(out, offset + (py * outputW + px) * 4, r, g, b, 255);
          }
        }
      }
    }
  };
  draw(1);
  draw();
};

export let genCultist = (
  w: number, h: number, seed: number,
  out: Uint8Array, offset = 0
): void => {
  let rng = seed | 0;
  let rnd = (): number => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return (rng >>> 0) / 4294967296;
  };

  // clear
  for (let i = 0; i < w * h * 4; i += 4) {
    out[offset + i] = 0;
    out[offset + i + 1] = 0;
    out[offset + i + 2] = 0;
    out[offset + i + 3] = 0;
  }

  let cx = (w - 1) * 0.5;
  let robeW = w * (0.28 + rnd() * 0.08);     // half-width at base
  let hoodH = h * (0.42 + rnd() * 0.06);     // how tall the hood is
  let cowlDepth = 0.55 + rnd() * 0.15;       // how deep the face hole is

  for (let y = 0; y < h; y++) {
    let width: number;
    if (y < hoodH) {
      // pointed / rounded hood
      let ht = y / hoodH;
      width = robeW * (0.35 + 0.65 * Math.sqrt(ht));
    } else {
      // body / robe
      let bt = (y - hoodH) / (h - hoodH);
      width = robeW * (0.92 + 0.18 * bt);
    }

    for (let x = 0; x < w; x++) {
      let dx = Math.abs(x - cx);
      if (dx > width + 0.6) continue;

      // soft edge AA
      let edge = clamp(1 - (dx - width + 0.7), 0, 1);
      let a = (edge * 255) | 0;
      if (a < 8) continue;

      let r: number, g: number, b: number;

      // ---- face hole (cowl) ----
      let inHood = y < hoodH;
      let faceHole = false;
      if (inHood) {
        let faceCy = hoodH * 0.55;
        let faceRx = width * 0.55;
        let faceRy = hoodH * 0.38;
        let fx = (x - cx) / faceRx;
        let fy = (y - faceCy) / faceRy;
        if (fx * fx + fy * fy < cowlDepth) {
          faceHole = true;
        }
      }

      if (faceHole) {
        // pure black void inside the hood
        r = g = b = 8 + (rnd() * 6 | 0);
      } else {
        // robe / hood fabric – deep purple-black with slight variation
        let n = valueNoise(x * 0.31, y * 0.27, seed + 77);
        let shade = 0.55 + 0.45 * n;
        r = (28 * shade) | 0;
        g = (18 * shade) | 0;
        b = (42 * shade) | 0;

        // subtle vertical folds
        let fold = Math.sin((x - cx) * 0.55 + seed * 0.1) * 0.5 + 0.5;
        let foldDark = 0.82 + 0.18 * fold;
        r = (r * foldDark) | 0;
        g = (g * foldDark) | 0;
        b = (b * foldDark) | 0;

        // darker near silhouette edge (volume cue)
        let edgeDist = width - dx;
        if (edgeDist < 2.2) {
          let wear = 0.65 + 0.35 * (edgeDist / 2.2);
          r = (r * wear) | 0;
          g = (g * wear) | 0;
          b = (b * wear) | 0;
        }
      }

      put(out, offset + (y * w + x) * 4, r, g, b, a);
    }
  }
};
