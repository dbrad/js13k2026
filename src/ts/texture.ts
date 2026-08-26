import { assert } from "@debug";
import textureAltas from "@res/sheet.webp";
import { characterCodeMap, glUploadAtlas } from "./gl";
import { floor, randInt } from "./math";
import { genBrick, genShadowCreature, genStone, genUnicornHorn, genWood } from "./procedural-textures";

export let TEXTURE_CACHE: TextureCache = [];

let procBuf: ImageDataArray | null = null;
let procBufCapacity = 0;

let stampProcedural = (ctx: CanvasRenderingContext2D, texId: number, gen: (w: number, h: number, seed: number, out: Uint8Array, mod?: boolean) => void, x: number, y: number, w: number, h: number, seed: number, mod = false, frame = 0): void => {
  let needed = w * h * 4;
  if (!procBuf || procBufCapacity < needed) {
    procBuf = new Uint8ClampedArray(needed);
    procBufCapacity = needed;
  }
  gen(w, h, seed, procBuf as unknown as Uint8Array, mod);
  let view = procBuf.subarray(0, needed);
  let img = new ImageData(view, w, h);
  ctx.putImageData(img, x, y);
  TEXTURE_CACHE[texId] = newTexture(w, h, x / ATLAS_WIDTH, y / ATLAS_HEIGHT, (x + w) / ATLAS_WIDTH, (y + h) / ATLAS_HEIGHT);
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
    let xOffset = 8;
    let seed = randInt(0, 100000);

    stampProcedural(ctx, TEXTURE_BRICK, genBrick, xOffset, 32, S, S, seed);
    xOffset += S + 8;
    stampProcedural(ctx, TEXTURE_BRICK_CRACK, genBrick, xOffset, 32, S, S, seed, true);
    xOffset += S + 8;
    stampProcedural(ctx, TEXTURE_STONE, genStone, xOffset, 32, S, S, seed);
    xOffset += S + 8;
    stampProcedural(ctx, TEXTURE_WOOD, genWood, xOffset, 32, S, S, seed);
    xOffset += S + 8;
    stampProcedural(ctx, TEXTURE_HORN, genUnicornHorn, xOffset, 32, 24, 48, seed);

    xOffset = 0;
    stampProcedural(ctx, TEXTURE_DEMON, genShadowCreature, xOffset, 96, 16, 16, seed);
    xOffset += 16 + 8;
    stampProcedural(ctx, TEXTURE_DEMON_MEDIUM, genShadowCreature, xOffset, 96, 24, 24, seed);
    xOffset += 24 + 8;
    stampProcedural(ctx, TEXTURE_DEMON_LARGE, genShadowCreature, xOffset, 96, 32, 32, seed);

    glUploadAtlas(canvas);
    resolve(canvas);
  });
};