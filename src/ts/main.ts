import version from "../../VERSION.txt";
import { drawPerformanceMeter, initPerformanceMeter, performanceMark, tickPerformanceMeter, togglePerformanceDisplay } from "./__debug/debug";
import { initCanvas } from "./canvas";
import { moteAdd, moteDraw, moteUpdate } from "./dust";
import { entityAdd, entityCollect, entityDraw } from "./entity";
import { gl, glClear, glFlush, glInit, glPushColorQuad, glPushText, uShake } from "./gl";
import { A_IS_DOWN, DOWN_IS_DOWN, drawControls, initializeInput, isTouchEvent, LEFT_IS_DOWN, RIGHT_IS_DOWN, UP_IS_DOWN, updateHardwareInput, updateInputState } from "./input";
import { generateDungeon } from "./map";
import { cos, PI, sin } from "./math";
import { FOG_B, FOG_G, FOG_R, rayMove, rayRender, rayRenderFloorCeiling, raySetMap } from "./raycast";
import { getShakeSum, shakeUpdate, shakeX, shakeY, updateHeadbob, zeroShake } from "./shake";
import { loadTextureAtlas } from "./texture";

window.addEventListener("load", async (): Promise<void> => {
    let VERSION = version;
    let canvas = initCanvas();
    glInit(canvas);
    await loadTextureAtlas();

    let px = 2.5, py = 2.5, angle = 0;

    let mapW = 50, mapH = 50;
    let map: Int8Array;
    let lightMap: Float32Array;
    [map, lightMap, px, py] = generateDungeon(mapW, mapH, 4, 7, 50);

    raySetMap(mapW, mapH, map, lightMap);

    entityAdd(5.5, 3.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(7.5, 4.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(3.5, 12.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(10.5, 10.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(12.5, 12.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(15.5, 15.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(20.5, 20.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(25.5, 25.5, TEXTURE_BAT, 1, 1, 1, 1, 1);
    entityAdd(28.5, 28.5, TEXTURE_BAT, 1, 1, 1, 1, 1);

    moteAdd(px, py);

    initPerformanceMeter();

    let playing = false;

    let initializeGame = (e: PointerEvent | TouchEvent): void => {
        if (!playing) {
            initializeInput(canvas);
            isTouchEvent(e);

            // zzfxInit();

            canvas.removeEventListener("touchstart", initializeGame);
            canvas.removeEventListener("pointerdown", initializeGame);
            playing = true;

            if (DEBUG) {
                document.addEventListener("keyup", (e: KeyboardEvent): void => {
                    if (e.code === "KeyD") {
                        togglePerformanceDisplay();
                    };
                });
            }
        }
    };

    canvas.addEventListener("touchstart", initializeGame);
    canvas.addEventListener("pointerdown", initializeGame);

    let then = performance.now();
    let tick = (now: number): void => {
        requestAnimationFrame(tick);

        let delta = now - then;
        let dt = delta * 0.001;

        then = now;

        if (playing) {
            performanceMark("start_of_frame");
            if (delta > 250) {
                delta = 16.6;
                dt = delta * 0.001;
            }

            performanceMark("update_start");
            {
                let speed = 2 * dt;
                let moving = false;

                let dirX = cos(angle);
                let dirY = sin(angle);

                updateHardwareInput();
                updateInputState(delta, dt);

                if (A_IS_DOWN) {
                    speed = 4 * dt;
                }

                if (UP_IS_DOWN) {
                    [px, py] = rayMove(px, py, dirX * speed, dirY * speed);
                    moving = true;
                } else if (DOWN_IS_DOWN) {
                    [px, py] = rayMove(px, py, -dirX * speed, -dirY * speed);
                    moving = true;
                }
                if (LEFT_IS_DOWN) {
                    angle = (angle - 2 * dt) % (PI * 2);
                } else if (RIGHT_IS_DOWN) {
                    angle = (angle + 2 * dt) % (PI * 2);
                }
                updateHeadbob(delta, moving, speed);
                shakeUpdate(delta);
                getShakeSum();
                gl.uniform2f(uShake, shakeX, shakeY);

                moteUpdate(dt, px, py, angle);
            }
            performanceMark("update_end");

            performanceMark("render_start");
            {
                glClear(FOG_R, FOG_G, FOG_B);
                rayRenderFloorCeiling(px, py, angle);
                rayRender(px, py, angle, now * 0.0001);
                entityCollect(px, py, angle);
                entityDraw(now * 0.001);
                moteDraw(px, py, angle);
                glFlush();

                zeroShake();
                glPushColorQuad(0, SCREEN_HEIGHT - 16, SCREEN_WIDTH + 1, 16, 0xff000000);
                drawControls();
                if (DEBUG) {
                    drawPerformanceMeter(px, py);
                }
                glFlush();
            }
            performanceMark("render_end");

            tickPerformanceMeter(delta);
        } else {
            glClear(0, 0, 0);
            glPushText("new game 2026", SCREEN_HALF_W, SCREEN_HALF_H - 28, 0xffffffff, 3, "center");
            glPushText("js13k 2026 entry by david brad", SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, "center", "top");
            glPushText("tap to start", SCREEN_HALF_W, SCREEN_HALF_H + 35, 0xffffffff, 1, "center");
            glPushText(VERSION, SCREEN_WIDTH, SCREEN_HEIGHT, 0xffffffff, 1, "right", "bottom");
            glFlush();
        }
    };
    requestAnimationFrame(tick);
});
