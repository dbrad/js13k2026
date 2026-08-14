import { A_PRESSED, B_PRESSED, buttonActions } from "../input";
import { createScene, switchToScene } from "../scene";
import { mainMenuScene } from "./mainMenu";

export let gameoverData = ["", ""];
let setup = (): void => {
    buttonActions[0] = buttonActions[1] = "continue";
};

let update = (delta: number, dt: number): void => {
    if (A_PRESSED || B_PRESSED) {
        switchToScene(mainMenuScene.id_);
    }
};

let draw = (delta: number, dt: number): void => {
};

export let gameOverScene = createScene(setup, update, draw, () => { });