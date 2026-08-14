import { boop, boopGood, zzfxPlay } from "../audio";
import { pushText, WHITE } from "../draw";
import { gameState, saveGame } from "../gameState";
import { A_PRESSED, B_PRESSED, DOWN_PRESSED, UP_PRESSED } from "../input";
import { createScene, switchToScene } from "../scene";
import { mainMenuScene } from "./mainMenu";

let selected = 0;
let options: string[] = [];

let getMute = () => gameState[GS_MUTEMUSIC] === 1 ? "music: off" : "music: on";
let getShake = () => gameState[GS_SCREENSHAKE] === 1 ? "screen shake: on" : "screen shake: off";
let setup = (): void => {
    selected = 0;
    options = [
        getMute(),
        getShake(),
        "back"
    ];
};

let update = (delta: number, dt: number): void => {
    if (UP_PRESSED) {
        if (selected > 0) {
            selected--;
            zzfxPlay(boop);
        }
    } else if (DOWN_PRESSED) {
        if (selected < 2) {
            selected++;
            zzfxPlay(boop);
        }
    } else if (A_PRESSED) {
        zzfxPlay(boopGood);
        switch (selected) {
            case 0:
                gameState[GS_MUTEMUSIC] = (gameState[GS_MUTEMUSIC] + 1) % 2;
                options[0] = getMute();
                saveGame();
                break;
            case 1:
                gameState[GS_SCREENSHAKE] = (gameState[GS_SCREENSHAKE] + 1) % 2;
                options[1] = getShake();
                saveGame();
                break;
            case 2:
                switchToScene(mainMenuScene.id_);
                break;
        }
    } else if (B_PRESSED) {
        zzfxPlay(boopGood);
        switchToScene(mainMenuScene.id_);
    }
};

let draw = (delta: number, dt: number): void => {
    for (let i = 0; i < 3; i++) {
        pushText((selected === i ? ">" : "") + options[i], SCREEN_LEFT + 8, SCREEN_DIM - 8 - 48 + (i * 24), WHITE, 2, TEXT_ALIGN_LEFT, TEXT_ALIGN_BOTTOM);
    }
};

export let optionsScene = createScene(setup, update, draw, () => { });