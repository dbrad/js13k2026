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

export let clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export let isPointInRect = (x0: number, y0: number, x1: number, y1: number, w: number, h: number): boolean => {
  return x0 >= x1 && x0 < x1 + w && y0 >= y1 && y0 < y1 + h;
};

export let isPointInCircle = (x0: number, y0: number, x1: number, y1: number, radius: number): boolean => {
  return (((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1)) < radius * radius);
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
