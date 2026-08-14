import { assert } from "@debug";
import textureAltas from "@res/sheet.webp";
import { characterCodeMap, glUploadAtlas } from "./gl";

let textureDefinitions: TextureDefinition[] = [
  [TEXTURE_TYPE_SPRITE_STRIP, [TEXTURE_WALL, TEXTURE_FLOOR, TEXTURE_CEILING, TEXTURE_D_PAD, TEXTURE_D_PAD_UP, TEXTURE_D_PAD_RIGHT, TEXTURE_A_BUTTON_UP, TEXTURE_B_BUTTON_UP, TEXTURE_A_BUTTON_DOWN, TEXTURE_B_BUTTON_DOWN, TEXTURE_BAT], 0, 16, 16, 16],
];

export let TEXTURE_CACHE: TextureCache = [];

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
    ctx.drawImage(imageBitmap, 0, 0);
    glUploadAtlas(canvas);

    for (let i: number = 33; i <= 96; i++) {
      characterCodeMap[String.fromCharCode(i)] = i;
      let y = i < 65 ? 0 : 8;
      let x = y === 8 ? (i - 65) * 8 : (i - 33) * 8;
      TEXTURE_CACHE[100 + i] = newTexture(8, 8, x / ATLAS_WIDTH, y / ATLAS_HEIGHT, (x + 8) / ATLAS_WIDTH, (y + 8) / ATLAS_HEIGHT);
    }

    for (let texture of textureDefinitions) {
      let [defType, id, x, y, w, h] = texture;
      if (defType === TEXTURE_TYPE_SPRITE) {
        TEXTURE_CACHE[id[0]] = newTexture(w, h, x / ATLAS_WIDTH, y / ATLAS_HEIGHT, (x + w) / ATLAS_WIDTH, (y + h) / ATLAS_HEIGHT);
      } else { // TEXTURE_TYPE_SPRITE_STRIP
        for (let offsetX: number = x, i: number = 0; offsetX < ATLAS_WIDTH; offsetX += w) {
          TEXTURE_CACHE[id[i++]] = newTexture(w, h, offsetX / ATLAS_WIDTH, y / ATLAS_HEIGHT, (offsetX + w) / ATLAS_WIDTH, (y + h) / ATLAS_HEIGHT);
        }
      }
    }
    resolve(canvas);
  });
};