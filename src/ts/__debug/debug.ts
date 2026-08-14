import { glPushColorQuad, glPushText } from "../gl";

let frameCount = 0;
let fps = 60;
let ms = 1000 / fps;

let averageFrameTime = 0; // us
let averageUpdateTime = 0;
let averageDrawTime = 0;
let averageRenderTime = 0;

let spikeMs = 0;
let spikeFrameTime = 0;
let spikeUpdateTime = 0;
let spikeDrawTime = 0;
let spikeRenderTime = 0;

let displayMs = "";
let displayFrameTime = "";
let displayUpdateTime = "";
let displayDrawTime = "";
let displayRenderTime = "";

let displaySpikeMs = "";
let displaySpikeFrameTime = "";
let displaySpikeUpdateTime = "";
let displaySpikeDrawTime = "";
let displaySpikeRenderTime = "";

let nextFpsTime = 0;
let FPS_INTERVAL = 1000;

let nextDisplayTime = 0;
let DISPLAY_INTERVAL = 100;

let showPerformance = false;

let tFrameStart = 0;
let tUpdateStart = 0;
let tDrawStart = 0;
let tRenderStart = 0;

let lastUpdateUs = 0;
let lastDrawUs = 0;
let lastRenderUs = 0;

export let initPerformanceMeter = (): void => {
    if (DEBUG) {
        showPerformance = false;
    }
};

export let togglePerformanceDisplay = (): void => {
    if (DEBUG) {
        showPerformance = !showPerformance;
    }
};

let col1 = SCREEN_WIDTH - 8;
let col2 = SCREEN_WIDTH - 160;

export let drawPerformanceMeter = (): void => {
    if (DEBUG && showPerformance) {
        glPushColorQuad(0, 0, SCREEN_WIDTH, 85, 0xff000000);

        glPushText(`fps ${fps.toFixed(0).padStart(7, " ")} hz`, col1, 5, 0xffffffff, 1, "right");
        glPushText(`frame ${displayMs} ms`, col1, 18, 0xffffffff, 1, "right");
        glPushText(`actual ${displayFrameTime} us`, col1, 31, 0xffffffff, 1, "right");
        glPushText(`update ${displayUpdateTime} us`, col1, 44, 0xffffffff, 1, "right");
        // glPushText(`draw ${displayDrawTime} us`, col1, 57, 0xffffffff, 1, "right");
        glPushText(`render ${displayRenderTime} us`, col1, 70, 0xffffffff, 1, "right");

        glPushText(`frame ${displaySpikeMs} ms`, col2, 18, 0xffffffff, 1, "right");
        glPushText(`actual ${displaySpikeFrameTime} us`, col2, 31, 0xffffffff, 1, "right");
        glPushText(`update ${displaySpikeUpdateTime} us`, col2, 44, 0xffffffff, 1, "right");
        // glPushText(`draw ${displaySpikeDrawTime} us`, col2, 57, 0xffffffff, 1, "right");
        glPushText(`render ${displaySpikeRenderTime} us`, col2, 70, 0xffffffff, 1, "right");
    }
};

export let performanceMark = (markName: string): void => {
    if (!DEBUG) return;

    let now = performance.now();

    switch (markName) {
        case "start_of_frame":
            tFrameStart = now;
            break;
        case "update_start":
            tUpdateStart = now;
            break;
        case "update_end":
            lastUpdateUs = (now - tUpdateStart) * 1000;
            break;
        case "draw_start":
            tDrawStart = now;
            break;
        case "draw_end":
            lastDrawUs = (now - tDrawStart) * 1000;
            break;
        case "render_start":
            tRenderStart = now;
            break;
        case "render_end":
            lastRenderUs = (now - tRenderStart) * 1000;
            break;
    }
};

export let tickPerformanceMeter = (delta: number): void => {
    if (!DEBUG) return;

    let now = performance.now();

    ms = 0.9 * delta + 0.1 * ms;
    if (ms > 250) {
        fps = 0;
        ms = 0;
        averageFrameTime = 0;
        averageUpdateTime = 0;
        averageDrawTime = 0;
        averageRenderTime = 0;
    }

    if (now >= nextFpsTime) {
        let lastUpdateTime = nextFpsTime - FPS_INTERVAL;
        let currentFps = frameCount * 1000;
        let actualDuration = now - lastUpdateTime;
        if (actualDuration > 0) {
            fps = 0.9 * (currentFps / actualDuration) + 0.1 * fps;
        }
        frameCount = 0;
        nextFpsTime = now + FPS_INTERVAL;
    }
    frameCount++;

    if (lastUpdateUs > 0) averageUpdateTime = 0.9 * lastUpdateUs + 0.1 * averageUpdateTime;
    if (lastDrawUs > 0) averageDrawTime = 0.9 * lastDrawUs + 0.1 * averageDrawTime;
    if (lastRenderUs > 0) averageRenderTime = 0.9 * lastRenderUs + 0.1 * averageRenderTime;

    let total = averageUpdateTime + averageDrawTime + averageRenderTime;
    averageFrameTime = 0.9 * total + 0.1 * averageFrameTime;

    if (ms > spikeMs) spikeMs = ms;
    if (lastUpdateUs + lastDrawUs + lastRenderUs > spikeFrameTime) {
        spikeFrameTime = lastUpdateUs + lastDrawUs + lastRenderUs;
    }
    if (lastUpdateUs > spikeUpdateTime) spikeUpdateTime = lastUpdateUs;
    if (lastDrawUs > spikeDrawTime) spikeDrawTime = lastDrawUs;
    if (lastRenderUs > spikeRenderTime) spikeRenderTime = lastRenderUs;

    if (now > nextDisplayTime) {
        displayMs = ms.toFixed(3).padStart(7, " ");
        displayFrameTime = averageFrameTime.toFixed(0).padStart(7, " ");
        displayUpdateTime = averageUpdateTime.toFixed(0).padStart(7, " ");
        displayDrawTime = averageDrawTime.toFixed(0).padStart(7, " ");
        displayRenderTime = averageRenderTime.toFixed(0).padStart(7, " ");

        displaySpikeMs = spikeMs.toFixed(3).padStart(7, " ");
        displaySpikeFrameTime = spikeFrameTime.toFixed(0).padStart(7, " ");
        displaySpikeUpdateTime = spikeUpdateTime.toFixed(0).padStart(7, " ");
        displaySpikeDrawTime = spikeDrawTime.toFixed(0).padStart(7, " ");
        displaySpikeRenderTime = spikeRenderTime.toFixed(0).padStart(7, " ");

        nextDisplayTime = now + DISPLAY_INTERVAL;
    }
};

export function assert(predicate: (() => boolean) | boolean, message: string): asserts predicate {
    if (DEBUG) {
        if (typeof predicate === "function" ? !predicate() : !predicate) {
            throw new Error(message);
        }
    }
}