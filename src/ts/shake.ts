import { gl, uShake } from "./gl";
import { cos, random, sin } from "./math";

let shakeTime = 0;
let shakeDuration = 0;
let shakeMag = 0;

export let shakeX = 0;
export let shakeY = 0;
export let bobX = 0;
export let bobY = 0;
export let headbobTime = 0;

export let updateHeadbob = (dtMs: number, isMoving: boolean, speed: number): void => {
    if (!isMoving) {
        bobX = 0;
        bobY = 0;
        headbobTime = 0;
        return;
    }
    headbobTime += dtMs * (speed * 0.5);
    bobX = sin(headbobTime * 0.5) * 0.95;
    bobY = cos(headbobTime * 0.8) * 1.2;
};

export let shakeTrigger = (magnitude: number, durationMs: number): void => {
    if (magnitude >= shakeMag || shakeTime <= 0) {
        shakeMag = magnitude;
        shakeDuration = durationMs;
        shakeTime = durationMs;
    }
};

export let shakeUpdate = (dtMs: number): void => {
    if (shakeTime <= 0) {
        shakeX = 0;
        shakeY = 0;
        return;
    }
    shakeTime -= dtMs;
    if (shakeTime < 0) shakeTime = 0;
    let t = shakeDuration > 0 ? shakeTime / shakeDuration : 0;
    let m = shakeMag * t * t;
    shakeX = (random() * 2 - 1) * m;
    shakeY = (random() * 2 - 1) * m;
};

export let zeroShake = (): void => {
    gl.uniform2f(uShake, 0, 0);
};

export let getShakeSum = (): void => {
    shakeX += bobX;
    shakeY += bobY;
};

export let resetShakeSum = (): void => {
    shakeX = 0;
    shakeY = 0;
};