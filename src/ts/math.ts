export let math = Math,
  floor = math.floor,
  ceil = math.ceil,
  abs = math.abs,
  max = math.max,
  min = math.min,
  round = math.round,
  sqrt = math.sqrt,
  hypot = math.hypot,
  cos = math.cos,
  sin = math.sin,
  tan = math.tan,
  atan2 = math.atan2,
  random = math.random;

export let EULER = 2.71828 as const;
export let PI = 3.14159 as const;

export let vecCalc = new Float32Array(5);
export let calcVec = (x1: number, y1: number, x2: number, y2: number): boolean => {
  vecCalc[DX] = x2 - x1;
  vecCalc[DY] = y2 - y1;
  vecCalc[DIST] = hypot(vecCalc[0], vecCalc[1]);
  if (vecCalc[DIST] === 0) {
    vecCalc[NX] = 0;
    vecCalc[NY] = 0;
    return false;
  }
  vecCalc[NX] = vecCalc[DX] / vecCalc[DIST];
  vecCalc[NY] = vecCalc[DY] / vecCalc[DIST];
  return true;
};

export let roundTo = (value: number, nearest: number): number => {
  return round(value / nearest) * nearest;
};

export let floorTo = (value: number, nearest: number): number => {
  return floor(value / nearest) * nearest;
};

export let lerp = (origin: number, target: number, amount: number): number => {
  return origin + (target - origin) * amount;
};

export let smooth = (t: number): number => {
  return t * t * (3 - 2 * t);
};

export let clamp = (value: number, min: number, max: number): number => {
  return value < min ? min : value > max ? max : value;
};

export let isPointInRect = (x0: number, y0: number, x1: number, y1: number, w: number, h: number): boolean => {
  return x0 >= x1 && x0 < x1 + w && y0 >= y1 && y0 < y1 + h;
};

export let isPointInCircle = (x0: number, y0: number, x1: number, y1: number, radius: number): boolean => {
  return (((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1)) < radius * radius);
};

export let circleOverlap = (
  ax: number, ay: number, ar: number,
  bx: number, by: number, br: number
): boolean => {
  let dx = ax - bx;
  let dy = ay - by;
  let r = ar + br;
  return dx * dx + dy * dy < r * r;
};

export let raySegmentIntersection = (
  ox: number, oy: number,
  dx: number, dy: number,
  ax: number, ay: number,
  bx: number, by: number
): number => {
  // v2 = end - start
  let v2x = bx - ax;
  let v2y = by - ay;

  // v3 = perpendicular to ray direction
  let v3x = -dy;
  let v3y = dx;

  // d = dot(v2, v3)
  let d = v2x * v3x + v2y * v3y;

  // parallel (or almost)
  if (d > -1e-6 && d < 1e-6) return -1;

  // v1 = origin - start
  let v1x = ox - ax;
  let v1y = oy - ay;

  // t1 = cross(v2, v1) / d
  // cross(a,b) = a.x*b.y - a.y*b.x
  let t1 = (v2x * v1y - v2y * v1x) / d;

  // t2 = dot(v1, v3) / d
  let t2 = (v1x * v3x + v1y * v3y) / d;

  if (t1 >= 0 && t2 >= 0 && t2 <= 1) return t1;
  return -1;
};

export let pointSegDistSq = (
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number => {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) {
    dx = px - x1;
    dy = py - y1;
    return dx * dx + dy * dy;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  let cx = x1 + t * dx;
  let cy = y1 + t * dy;
  dx = px - cx;
  dy = py - cy;
  return dx * dx + dy * dy;
};

// Vector
// V2
export let copyV2 = (source: V2): V2 => {
  return [source[X], source[Y]];
};

export let setV2 = (target: V2, x: number, y: number): void => {
  target[X] = x;
  target[Y] = y;
};

export let setV2FromV2 = (target: V2, source: V2): void => {
  target[X] = source[X];
  target[Y] = source[Y];
};

export let addV2 = (target: V2, x: number, y: number): void => {
  target[X] += x;
  target[Y] += y;
};

export let subtractV2 = (target: V2, x: number, y: number): void => {
  target[X] -= x;
  target[Y] -= y;
};

// V3
export let setV3 = (target: V3, source: V3): void => {
  target[X] = source[X];
  target[Y] = source[Y];
  target[Z] = source[Z];
};

// V4
export let v4f = (r: number, g: number, b: number, a: number): V4f => {
  return new Float32Array([r, g, b, a]);
};

export let setV4 = (target: V4, x: number, y: number, z: number, w: number): void => {
  target[X] = x;
  target[Y] = y;
  target[Z] = z;
  target[W] = w;
};

export let setV4FromV4 = (target: V4, source: V4): void => {
  target[X] = source[X];
  target[Y] = source[Y];
  target[Z] = source[Z];
  target[W] = source[W];
};

export let setV4fFromV4f = (target: V4f, source: V4f): void => {
  target[X] = source[X];
  target[Y] = source[Y];
  target[Z] = source[Z];
  target[W] = source[W];
};

// RNG
let _srandSeed = 0;
export let srandSeed = (seed: number): void => {
  _srandSeed = seed;
};

let srand = (): number => {
  _srandSeed = (3967 * _srandSeed + 11) % 16127;
  return _srandSeed / 16127;
};

export let srandInt = (min: number, max: number): number => {
  return floor(srand() * (max - min + 1)) + min;
};

export let srandShuffle = <T>(array: T[]): T[] => {
  let currentIndex: number = array.length, temporaryValue: T, randomIndex: number;
  let arr: T[] = array.slice();
  while (0 !== currentIndex) {
    randomIndex = floor(srand() * currentIndex);
    currentIndex -= 1;
    temporaryValue = arr[currentIndex];
    arr[currentIndex] = arr[randomIndex];
    arr[randomIndex] = temporaryValue;
  }
  return arr;
};

export let randInt = (min: number, max: number): number => {
  return floor(random() * (max - min + 1)) + min;
};

export let randShuffle = <T>(array: T[]): T[] => {
  let currentIndex: number = array.length, temporaryValue: T, randomIndex: number;
  let arr: T[] = array.slice();
  while (0 !== currentIndex) {
    randomIndex = floor(random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = arr[currentIndex];
    arr[currentIndex] = arr[randomIndex];
    arr[randomIndex] = temporaryValue;
  }
  return arr;
};
