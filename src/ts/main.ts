import version from "../../VERSION.txt";
import { drawPerformanceMeter, initPerformanceMeter, performanceMark, tickPerformanceMeter, togglePerformanceDisplay } from "./__debug/debug";
import { initCanvas } from "./canvas";
import { doorClear, doorTryToggle, doorUpdate } from "./doors";
import { entityAdd, entityClear, entityCollect, entityDraw, entityPlayerCollide, entitySpawnDust, entityUpdate, fireRainbowBeam } from "./entity";
import { gl, glClear, glFlush, glInit, glPushColorQuad, glPushText, glPushTexture, uShake } from "./gl";
import { A_PRESSED, B_PRESSED, DOWN_IS_DOWN, drawControls, initializeInput, isTouchEvent, LEFT_IS_DOWN, RIGHT_IS_DOWN, UP_IS_DOWN, updateHardwareInput, updateInputState } from "./input";
import { generateDungeon } from "./map";
import { cos, PI, sin } from "./math";
import { FOG_B, FOG_G, FOG_R, lightCalculated, rayMove, rayRender, rayRenderFloorCeiling, raySetMap } from "./raycast";
import { getShakeSum, shakeUpdate, shakeX, shakeY, updateHeadbob, zeroShake } from "./shake";
import { loadTextureAtlas } from "./texture";

window.addEventListener("load", async (): Promise<void> => {
    let VERSION = version;
    let canvas = initCanvas();
    glInit(canvas);
    await loadTextureAtlas();

    doorClear();
    entityClear();

    let px = 2.5, py = 2.5, angle = 0;

    let mapW = 50, mapH = 50;
    let map: Int8Array;
    let lightMap: Float32Array;
    [map, lightMap, px, py] = generateDungeon(mapW, mapH, 4, 7, 50);

    raySetMap(mapW, mapH, map, lightMap);

    entityAdd(5.5, 3.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(7.5, 4.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(3.5, 12.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(10.5, 10.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(12.5, 12.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(15.5, 15.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(20.5, 20.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(25.5, 25.5, TEXTURE_A_BUTTON_UP, 1);
    entityAdd(28.5, 28.5, TEXTURE_A_BUTTON_UP, 1);

    entitySpawnDust(px, py, 220);
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
                let speed = 3 * dt;
                let moving = false;

                let dirX = cos(angle);
                let dirY = sin(angle);

                updateHardwareInput();
                updateInputState(delta, dt);
                lightCalculated.fill(0);

                if (A_PRESSED) {
                    doorTryToggle(px, py, angle);
                }

                if (B_PRESSED) {
                    fireRainbowBeam(px, py, angle);
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

                [px, py] = entityPlayerCollide(px, py, 0.25, (idx, e) => {
                    // your damage logic
                    // playerHealth -= (e.flags_ & FLAG_PROJECTILE) ? 10 : 5;
                    // play sound, flash, etc.
                });
                updateHeadbob(delta, moving, speed);
                shakeUpdate(delta);
                getShakeSum();
                gl.uniform2f(uShake, shakeX, shakeY);
                doorUpdate(dt);
                entityUpdate(dt, px, py);
            }
            performanceMark("update_end");

            performanceMark("render_start");
            {
                glClear(FOG_R, FOG_G, FOG_B);
                glClear(0, 0, 0);
                rayRenderFloorCeiling(px, py, angle);
                rayRender(px, py, angle, now * 0.0001, dt);
                entityCollect(px, py, angle);
                entityDraw(px, py, angle, now * 0.001);
                glPushTexture(TEXTURE_HORN, SCREEN_HALF_W - 36, SCREEN_HEIGHT - 128, 3);
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
            glPushText("new game 2026", SCREEN_HALF_W, SCREEN_HALF_H - 28, 0xffffffff, 3, TEXT_H_ALIGN_CENTER);
            glPushText("js13k 2026 entry by david brad", SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
            glPushText("tap to start", SCREEN_HALF_W, SCREEN_HALF_H + 35, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
            glPushText(VERSION, SCREEN_WIDTH, SCREEN_HEIGHT, 0xffffffff, 1, TEXT_H_ALIGN_RIGHT, TEXT_V_ALIGN_BOTTOM);
            glFlush();
        }
    };
    requestAnimationFrame(tick);
});
