import { assert } from "@debug";
import textureAltas from "@res/sheet.webp";
import { characterCodeMap, glUploadAtlas } from "./gl";
import { floor, randInt } from "./math";
import { genBrick, genShadowCreature, genStone, genUnicornHorn, genWood } from "./procedural-textures";

export let TEXTURE_CACHE: TextureCache = [];

let procBuf: ImageDataArray | null = null;
let procBufCapacity = 0;

let stampProcedural = (ctx: CanvasRenderingContext2D, gen: (w: number, h: number, seed: number, out: Uint8Array, mod?: boolean) => void, x: number, y: number, w: number, h: number, seed: number, mod = false, frame = 0): void => {
  let needed = w * h * 4;
  if (!procBuf || procBufCapacity < needed) {
    procBuf = new Uint8ClampedArray(needed);
    procBufCapacity = needed;
  }
  gen(w, h, seed, procBuf as unknown as Uint8Array, mod);
  let view = procBuf.subarray(0, needed);
  let img = new ImageData(view, w, h);
  ctx.putImageData(img, x, y);
};

let newTexture = (_w: number, _h: number, _u0: number, _v0: number, _u1: number, _v1: number): Texture => {
  return { w_: _w, h_: _h, u0_: _u0, v0_: _v0, u1_: _u1, v1_: _v1 };
};

export let loadTextureAtlas = async (): Promise<HTMLCanvasElement> => {
  return new Promise(async (resolve): Promise<void> => {
    let response = await fetch(textureAltas);
    let blob = await response.blob();
    let imageBitmap = await createImageBitmap(blob);

    assert(IMAGE_WIDTH === imageBitmap.width, `ATLAS IMAGE WIDTH CHANGED (expected: ${IMAGE_WIDTH} actual: ${imageBitmap.width})`);
    assert(IMAGE_HEIGHT === imageBitmap.height, `ATLAS IMAGE HEIGHT CHANGED (expected: ${IMAGE_HEIGHT} actual: ${imageBitmap.height})`);

    let PROC_Y = IMAGE_HEIGHT * 2;

    let canvas = document.createElement("canvas",);
    let ctx = canvas.getContext("2d")!!;
    canvas.width = ATLAS_WIDTH;
    canvas.height = ATLAS_HEIGHT;

    for (let i: number = 33; i <= 96; i++) {
      characterCodeMap[String.fromCharCode(i)] = i;
      let row = floor((i - 33) / 32);
      let col = (i - 33) - (row * 32);
      let sx = col * 8;
      let sy = row * 8;
      let dx = col * 10 + 2;
      let dy = row * 10 + 2;
      ctx.drawImage(imageBitmap, sx, sy, 8, 8, dx, dy, 8, 8);
      TEXTURE_CACHE[100 + i] = newTexture(8, 8, dx / ATLAS_WIDTH, dy / ATLAS_HEIGHT, (dx + 8) / ATLAS_WIDTH, (dy + 8) / ATLAS_HEIGHT);
    };

    let S = 32;
    let offset = 8;
    let seed = randInt(0, 100000);

    stampProcedural(ctx, genBrick, offset, PROC_Y, S, S, seed);
    TEXTURE_CACHE[TEXTURE_BRICK] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    stampProcedural(ctx, genBrick, offset, PROC_Y, S, S, seed, true);
    TEXTURE_CACHE[TEXTURE_BRICK_CRACK] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    stampProcedural(ctx, genStone, offset, PROC_Y, S, S, seed);
    TEXTURE_CACHE[TEXTURE_STONE] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    stampProcedural(ctx, genWood, offset, PROC_Y, S, S, seed);
    TEXTURE_CACHE[TEXTURE_WOOD] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    stampProcedural(ctx, genUnicornHorn, offset, PROC_Y, 24, 48, seed);
    TEXTURE_CACHE[TEXTURE_HORN] = newTexture(24, 48, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + 24) / ATLAS_WIDTH, (PROC_Y + 48) / ATLAS_HEIGHT);

    offset = 0;
    PROC_Y += 64;
    S = 16;
    stampProcedural(ctx, genShadowCreature, offset, PROC_Y, S, S, seed);
    TEXTURE_CACHE[TEXTURE_DEMON] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    S = 24;
    stampProcedural(ctx, genShadowCreature, offset, PROC_Y, S, S, seed);
    TEXTURE_CACHE[TEXTURE_DEMON_MEDIUM] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    S = 32;
    stampProcedural(ctx, genShadowCreature, offset, PROC_Y, S, S, seed);
    TEXTURE_CACHE[TEXTURE_DEMON_LARGE] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    glUploadAtlas(canvas);
    resolve(canvas);
  });
};