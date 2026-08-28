import { playMusic } from "../audio";
import { RAINBOW } from "../colours";
import { entityClear, entityCollect, entityDraw, entityUpdate } from "../entity";
import { gameState } from "../gameState";
import { glPushColorQuad, glPushText } from "../gl";
import { A_PRESSED, B_PRESSED, DOWN_PRESSED, UP_PRESSED } from "../input";
import { generateDungeon } from "../map";
import { max, min, randInt } from "../math";
import { rayRender, rayRenderFloorCeiling } from "../raycast";

let options: string[] = [
    "new game",
    "music",
    "headbob",
    "screen shake",
    "aim assist",
];

let selected: number = 0;

export let updateMainMenu = (delta: number, dt: number, now: number) => {
    if (A_PRESSED || B_PRESSED) {
        if (selected === 0) {
            gameState[GS_SCENE] = 1;
            entityClear();
            generateDungeon(randInt(1, 1000000));
        } else {
            // TODO: OPTION TOGGLING
        }
    } else if (UP_PRESSED) {
        selected = max(0, --selected);
    } else if (DOWN_PRESSED) {
        selected = min(4, ++selected);
    }
    let px = gameState[GS_PLAYER_X];
    let py = gameState[GS_PLAYER_Y];
    entityUpdate(dt, px, py);
    playMusic(delta);
};

export let renderMainMenu = (delta: number, dt: number, now: number) => {
    let angle = gameState[GS_PLAYER_ANGLE];
    let px = gameState[GS_PLAYER_X];
    let py = gameState[GS_PLAYER_Y];

    rayRenderFloorCeiling(px, py, angle);
    rayRender(px, py, angle, now * 0.0001, dt);
    entityCollect(px, py, angle);
    entityDraw(px, py, angle, now);

    for (let r = 0; r < 7; r++) {
        glPushColorQuad(23 - r, 49 + (r * 1), 346, 1, 0xffffffff);
        glPushColorQuad(24 - r, 49 + (r * 1), 344, 1, 200 << 24 | (RAINBOW[r] & 0xffffff));
    }

    glPushText("prism break", 20, 20, 0x99ffffff, 4);

    for (let i = 0; i < options.length; i++) {
        let s = (selected == i ? "> " : "") + options[i];
        glPushText(s, 20, 40 + SCREEN_HALF_H + (28 * i), 0x88ffffff, 2);
    }
};
