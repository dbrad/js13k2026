import { floorTo, min } from "./math";

let stage: HTMLDivElement;
let canvas: HTMLCanvasElement;

let scale = (): void => {
  let scaleX: number = window.innerWidth / SCREEN_WIDTH;
  let scaleY: number = window.innerHeight / SCREEN_HEIGHT;
  let scaleToFit: number = floorTo(min(scaleX, scaleY), 0.1);
  scaleToFit = scaleToFit < 1 ? 1 : scaleToFit;
  let rule: string = "scale(" + scaleToFit + ")";
  stage.style.transform = rule;
};

export let initCanvas = (): HTMLCanvasElement => {
  document.title = "Game";
  document.body.style.cssText = "margin:0;padding:0;background-color:#000;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;";
  stage = document.createElement("div");
  stage.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;max-height:100vh;max-width:100vw;";
  document.body.appendChild(stage);
  canvas = document.createElement("canvas");
  canvas.style.cssText = "image-rendering:pixelated;";
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  stage.appendChild(canvas);

  window.addEventListener("resize", scale);
  scale();

  return canvas;
};

export let requestFullscreen = (canvas: HTMLCanvasElement): void => {
  if (document.fullscreenEnabled) {
    if (!document.fullscreenElement) {
      document.body.requestFullscreen();
    } else {
      document.exitFullscreen().then(scale);
    }
  }
};