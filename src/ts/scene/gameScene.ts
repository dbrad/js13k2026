import { createScene } from "../scene";

let setup = (): void => { };

let update = (delta: number, dt: number): void => { };

let draw = (delta: number, dt: number): void => { };

let drawGUI = (): void => { };

export let gameScene = createScene(setup, update, draw, drawGUI);