import { createScene } from "../scene";

let setup = (): void => { };

let update = (delta: number, dt: number): void => { };

let draw = (delta: number, dt: number): void => { };

export let mainMenuScene = createScene(setup, update, draw, () => { });
