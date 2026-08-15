import { assert } from "@debug";
import textureAltas from "@res/sheet.webp";
import { characterCodeMap, glUploadAtlas } from "./gl";
import { floor, randInt } from "./math";
import { genBrick, genStone, genUnicornHorn, genWood } from "./procedural-textures";

let textureDefinitions: TextureDefinition[] = [
  [TEXTURE_TYPE_SPRITE_STRIP, [TEXTURE_D_PAD, TEXTURE_D_PAD_UP, TEXTURE_D_PAD_RIGHT, TEXTURE_A_BUTTON_UP, TEXTURE_B_BUTTON_UP, TEXTURE_A_BUTTON_DOWN, TEXTURE_B_BUTTON_DOWN, TEXTURE_BAT], 0, 16, 16, 16, 0, 2],
];

export let TEXTURE_CACHE: TextureCache = [];

let procBuf: ImageDataArray | null = null;
let procBufCapacity = 0;

let stampProcedural = (ctx: CanvasRenderingContext2D, gen: (w: number, h: number, seed: number, out: Uint8Array, offset?: number, mod?: boolean, frame?: number) => void, x: number, y: number, w: number, h: number, seed: number, mod = false, frame = 0): void => {
  let needed = w * h * 4;
  if (!procBuf || procBufCapacity < needed) {
    procBuf = new Uint8ClampedArray(needed);
    procBufCapacity = needed;
  }
  gen(w, h, seed, procBuf as unknown as Uint8Array, 0, mod, frame);
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

    for (let texture of textureDefinitions) {
      let [defType, id, x, y, w, h, col, row] = texture;
      if (defType === TEXTURE_TYPE_SPRITE) {
        let dx = col * (16 + 2) + 2;
        let dy = row * (16 + 2) + 2;
        ctx.drawImage(imageBitmap, x, y, w, h, dx, dy, w, h);
        TEXTURE_CACHE[id[0]] = newTexture(w, h, dx / ATLAS_WIDTH, dy / ATLAS_HEIGHT, (dx + w) / ATLAS_WIDTH, (dy + h) / ATLAS_HEIGHT);
      } else { // === TEXTURE_TYPE_SPRITE_STRIP
        let dy = row * (16 + 2) + 2;
        for (let offsetX: number = x; offsetX < ATLAS_WIDTH; offsetX += w) {
          let dx = col * (w + 2) + 2;
          ctx.drawImage(imageBitmap, offsetX, y, w, h, dx, dy, w, h);
          TEXTURE_CACHE[id[col++]] = newTexture(w, h, dx / ATLAS_WIDTH, dy / ATLAS_HEIGHT, (dx + w) / ATLAS_WIDTH, (dy + h) / ATLAS_HEIGHT);
        }
      }
    }

    let S = 32;
    let offset = 8;
    stampProcedural(ctx, genBrick, offset, PROC_Y, S, S, 0xBEEF);
    TEXTURE_CACHE[TEXTURE_BRICK] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    stampProcedural(ctx, genBrick, offset, PROC_Y, S, S, 0xBEEF, true);
    TEXTURE_CACHE[TEXTURE_BRICK_CRACK] = newTexture(S, S, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + S) / ATLAS_WIDTH, (PROC_Y + S) / ATLAS_HEIGHT);

    offset += S + 8;
    stampProcedural(ctx, genStone, offset, PROC_Y, S, S, randInt(0, 100000));

    offset += S + 8;
    stampProcedural(ctx, genWood, offset, PROC_Y, S, S, randInt(0, 100000));

    offset += S + 8;
    stampProcedural(ctx, genUnicornHorn, offset, PROC_Y, 24, 48, 0x1337);
    TEXTURE_CACHE[TEXTURE_HORN] = newTexture(24, 48, offset / ATLAS_WIDTH, PROC_Y / ATLAS_HEIGHT, (offset + 24) / ATLAS_WIDTH, (PROC_Y + 48) / ATLAS_HEIGHT);

    glUploadAtlas(canvas);
    resolve(canvas);
  });
};