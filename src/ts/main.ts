import version from "../../VERSION.txt";
import { drawPerformanceMeter, initPerformanceMeter, performanceMark, tickPerformanceMeter, togglePerformanceDisplay } from "./__debug/debug";
import { playMusic, sfxFootstep, sfxLaserCharge, zzfxInit, zzfxPlay } from "./audio";
import { initCanvas } from "./canvas";
import { entityClear, entityCollect, entityDraw, entityPlayerCollide, entitySpawnDust, entityUpdate, fireRainbowBeam, spawnEnemiesInRoom } from "./entity";
import { gl, glClear, glFlush, glInit, glPushColorQuad, glPushText, glPushTexture, uShake } from "./gl";
import { A_PRESSED, B_IS_DOWN, B_PRESSED, DOWN_IS_DOWN, drawControls, initializeInput, isTouch, isTouchEvent, LEFT_IS_DOWN, lookDeltaX, RIGHT_IS_DOWN, UP_IS_DOWN, updateHardwareInput, updateInputState } from "./input";
import { doorAnimActive, doorAnimT, generateDungeon, mapData, mapOffsetData, rooms, updatePlayerTorch } from "./map";
import { cos, max, min, sin, sqrt } from "./math";
import { interactionId, rayMove, rayRender, rayRenderFloorCeiling } from "./raycast";
import { getShakeSum, shakeUpdate, shakeX, shakeY, updateHeadbob, zeroShake } from "./shake";
import { loadTextureAtlas } from "./texture";

window.addEventListener("load", async (): Promise<void> => {
    let VERSION = version;
    let canvas = initCanvas();
    glInit(canvas);
    await loadTextureAtlas();

    entityClear();

    let px = 2.5, py = 2.5, angle = 0;
    let mapW = 50, mapH = 50;

    let charge = 0;
    let chargeSpeed = 1.5;
    let isCharging = false;
    let wasBPressed = false;

    [px, py] = generateDungeon(mapW, mapH);
    for (let i = 1; i < rooms.length; i++) {
        let r = rooms[i];
        spawnEnemiesInRoom(r.x_, r.y_, r.w_, r.h_, TEXTURE_DEMON);
    }

    entitySpawnDust(px, py, 220);
    initPerformanceMeter();

    let playing = false;

    let initializeGame = (e: PointerEvent | TouchEvent): void => {
        if (!playing) {
            initializeInput(canvas);
            isTouchEvent(e);

            zzfxInit();

            canvas.removeEventListener("touchstart", initializeGame);
            canvas.removeEventListener("pointerdown", initializeGame);
            playing = true;

            if (DEBUG) {
                document.addEventListener("keyup", (e: KeyboardEvent): void => {
                    if (e.code === "F2") {
                        togglePerformanceDisplay();
                    };
                });
            }
        }
    };

    canvas.addEventListener("touchstart", initializeGame);
    canvas.addEventListener("pointerdown", initializeGame);
    let footstepTimer = 0.28;
    let shootCooldown = 0;

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
                shootCooldown = max(0, shootCooldown - dt);
                playMusic(delta);
                let speed = 3 * dt;
                let moving = false;

                let dirX = cos(angle);
                let dirY = sin(angle);

                updateHardwareInput();
                updateInputState(delta, dt);

                if (A_PRESSED) {
                    if (interactionId > -1) {
                        doorAnimActive[interactionId] = 1;
                    }
                }

                if (isTouch && B_PRESSED) {
                    // Mobile 2-tap to charge and shoot
                    if (!isCharging && shootCooldown <= 0) {
                        zzfxPlay(sfxLaserCharge);
                        isCharging = true;
                    } else {
                        fireRainbowBeam(px, py, angle, charge);
                        shootCooldown = 1;
                        charge = 0;
                        isCharging = false;
                    }
                } else if (!isTouch && B_IS_DOWN && !isCharging && shootCooldown <= 0) {
                    // Desktop hold to charge
                    zzfxPlay(sfxLaserCharge);
                    isCharging = true;
                    wasBPressed = true;
                } else if (wasBPressed && !B_IS_DOWN) {
                    // Desktop release to shoot
                    if (isCharging) {
                        fireRainbowBeam(px, py, angle, charge);
                        shootCooldown = 1;
                        charge = 0;
                        isCharging = false;
                    }
                    wasBPressed = false;
                }

                if (isCharging) {
                    charge = min(charge + chargeSpeed * dt, MAX_CHARGE);
                }

                let moveX = 0;
                let moveY = 0;

                if (UP_IS_DOWN) {
                    moveX += dirX;
                    moveY += dirY;
                }
                if (DOWN_IS_DOWN) {
                    moveX -= dirX;
                    moveY -= dirY;
                }
                if (LEFT_IS_DOWN) {
                    moveX += dirY;
                    moveY += -dirX;
                }
                if (RIGHT_IS_DOWN) {
                    moveX += -dirY;
                    moveY += dirX;
                }

                let len2 = moveX * moveX + moveY * moveY;
                if (len2 > 1) {
                    let inv = 1 / sqrt(len2);
                    moveX *= inv;
                    moveY *= inv;
                }

                if (moveX !== 0 || moveY !== 0) {
                    [px, py] = rayMove(px, py, moveX * speed, moveY * speed);
                    moving = true;
                }

                [px, py] = entityPlayerCollide(px, py, 0.25, (idx) => {
                    // damage logic
                });

                angle += lookDeltaX;
                footstepTimer -= dt;
                updatePlayerTorch(isCharging);
                if (moving && footstepTimer <= 0) {
                    zzfxPlay(sfxFootstep);
                    footstepTimer = 0.28;
                }

                for (let i = 0; i < mapW * mapH; i++) {
                    if (!doorAnimActive[i]) continue;

                    doorAnimT[i] += dt * (1 / 0.6);
                    mapOffsetData[i] = doorAnimT[i];

                    if (doorAnimT[i] >= 1) {
                        doorAnimT[i] = 1;
                        doorAnimActive[i] = 0;
                        mapData[i] = CELL_FLOOR;
                    }
                }

                updateHeadbob(delta, moving, speed);
                shakeUpdate(delta);
                getShakeSum();
                gl.uniform2f(uShake, shakeX, shakeY);
                entityUpdate(dt, px, py);
            }
            performanceMark("update_end");

            performanceMark("render_start");
            {
                glClear(0, 0, 0);
                rayRenderFloorCeiling(px, py, angle);
                rayRender(px, py, angle, now * 0.0001, dt);
                entityCollect(px, py, angle);
                entityDraw(px, py, angle, now * 0.001);
                glPushTexture(TEXTURE_HORN, SCREEN_HALF_W - 36, SCREEN_HEIGHT - 128, 3);
                glFlush();

                zeroShake();
                if (interactionId > -1) {
                    glPushText("A to open", SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
                }

                glPushColorQuad(0, SCREEN_HEIGHT - 32, SCREEN_WIDTH, 16, 0xff333333);
                if (shootCooldown > 0) {
                    glPushColorQuad(0, SCREEN_HEIGHT - 32, SCREEN_WIDTH * shootCooldown, 16, 0xff0000ff);
                } else {
                    glPushColorQuad(0, SCREEN_HEIGHT - 32, SCREEN_WIDTH * charge, 16, 0xff00ff00);
                }
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
            glPushText("Children of the Horn", SCREEN_HALF_W, SCREEN_HALF_H - 28, 0xffffffff, 3, TEXT_H_ALIGN_CENTER);
            glPushText("js13k 2026 entry by david brad", SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
            glPushText("tap to start", SCREEN_HALF_W, SCREEN_HALF_H + 35, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
            glPushText(VERSION, SCREEN_WIDTH, SCREEN_HEIGHT, 0xffffffff, 1, TEXT_H_ALIGN_RIGHT, TEXT_V_ALIGN_BOTTOM);
            glFlush();
        }
    };
    requestAnimationFrame(tick);
});
