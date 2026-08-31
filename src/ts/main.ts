import version from "../../VERSION.txt";
import { drawPerformanceMeter, initPerformanceMeter, performanceMark, tickPerformanceMeter, togglePerformanceDisplay } from "./__debug/debug";
import { playMusic, sfxFootstep, sfxLaserCharge, sfxPlayerHurt, zzfxInit, zzfxPlay } from "./audio";
import { initCanvas } from "./canvas";
import { RAINBOW } from "./colours";
import { entityAimAssist, entityClear, entityCollect, entityDraw, entityPlayerCollide, entityUpdate, fireRainbowBeam, renderBossBar } from "./entity";
import { gameState, loadGame, saveGame, saveState } from "./gameState";
import { gl, glClear, glFlush, glInit, glPushColorQuad, glPushText, glPushTexture, uShake, uTransition } from "./gl";
import { initializeInput, keyState, lookDeltaX, setKeyMap, updateHardwareInput, updateInputState } from "./input";
import { createMenuMap, doorAnimActive, doorAnimT, generateDungeon, initMap, mapData, mapOffsetData, mapSize, mapW, updatePlayerTorch } from "./map";
import { abs, clamp, cos, floor, max, min, randInt, sin, sqrt } from "./math";
import { interactionId, rayMove, rayRender, rayRenderFloorCeiling } from "./raycast";
import { getShakeSum, shakeTrigger, shakeUpdate, shakeX, shakeY, updateHeadbob, zeroShake } from "./shake";
import { generateProcTextures, loadTextureAtlas } from "./texture";

export let transition = false;

window.addEventListener("load", async (): Promise<void> => {
    let VERSION = version;
    let canvas = initCanvas();
    glInit(canvas);
    gameState[GS_SEED] = 1;
    await loadTextureAtlas();
    initPerformanceMeter();

    let playing = false;

    let initializeGame = (e: PointerEvent | TouchEvent): void => {
        if (!playing) {
            initializeInput(canvas);

            zzfxInit();

            canvas.removeEventListener("touchstart", initializeGame);
            canvas.removeEventListener("pointerdown", initializeGame);
            playing = true;

            loadGame();
            setKeyMap();
            initMap();
            createMenuMap();
            gameState[GS_PAUSE_GAME] = 1;

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

    let t = 0;
    let options: string[] = [
        "new game",
        "music",
        "headbob",
        "screen shake",
        "aim assist",
        "input mode"
    ];
    let selected: number = 0;

    let targetScene = -1;

    let charge = 0;
    let chargeSpeed = 1.5;
    let isCharging = false;
    let wasBPressed = false;

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
            let scene = gameState[GS_SCENE];
            if (delta > 250) {
                delta = 16.6;
                dt = delta * 0.001;
            }

            performanceMark("update_start");
            {
                updateHardwareInput();
                updateInputState(delta);

                if (targetScene > -1 && !transition) {
                    transition = true;
                    t = 0.00001;
                }

                if (scene === 0) {
                    // Main Menu Scene
                    playMusic(delta);
                    if (targetScene === -1) {
                        if (keyState[A_BUTTON] === KEY_WAS_DOWN) {
                            if (selected === 0) {
                                targetScene = 1;
                            } else {
                                saveGame();
                                // TODO: OPTION TOGGLING
                            }
                        } else if (keyState[D_UP] === KEY_WAS_DOWN) {
                            selected = max(0, --selected);
                        } else if (keyState[D_DOWN] === KEY_WAS_DOWN) {
                            selected = min(5, ++selected);
                        }
                    }
                    let px = gameState[GS_PLAYER_X];
                    let py = gameState[GS_PLAYER_Y];
                    entityUpdate(dt, px, py);
                } else {
                    // Game Scene
                    playMusic(delta);
                    shootCooldown = max(0, shootCooldown - dt);
                    let speed = 3 * dt;
                    let moving = false;

                    let angle = gameState[GS_PLAYER_ANGLE];
                    let px = gameState[GS_PLAYER_X];
                    let py = gameState[GS_PLAYER_Y];

                    let dirX = cos(angle);
                    let dirY = sin(angle);

                    if (keyState[A_BUTTON] === KEY_WAS_DOWN) {
                        if (interactionId > -1) {
                            doorAnimActive[interactionId] = 1;
                        }
                    }

                    if (keyState[B_BUTTON] === KEY_IS_DOWN && !isCharging && shootCooldown <= 0) {
                        zzfxPlay(sfxLaserCharge);
                        isCharging = true;
                        wasBPressed = true;
                    } else if (wasBPressed && keyState[B_BUTTON] === KEY_IS_UP) {
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

                    if (keyState[D_UP] === KEY_IS_DOWN) {
                        moveX += dirX;
                        moveY += dirY;
                    }
                    if (keyState[D_DOWN] === KEY_IS_DOWN) {
                        moveX -= dirX;
                        moveY -= dirY;
                    }
                    if (keyState[D_LEFT] === KEY_IS_DOWN) {
                        moveX += dirY;
                        moveY += -dirX;
                    }
                    if (keyState[D_RIGHT] === KEY_IS_DOWN) {
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

                    [px, py] = entityPlayerCollide(px, py, 0.25, () => {
                        gameState[GS_PLAYER_HP] -= 1;
                        shakeTrigger(16, 100);
                        zzfxPlay(sfxPlayerHurt);
                        gameState[GS_PLAYER_INVULNERABLE] = PLAYER_INVULNERABLE_DURATION;
                        if (gameState[GS_PLAYER_HP] <= 0) {
                            gameState[GS_PAUSE_GAME] = 1;
                            targetScene = 0;
                        }
                    });

                    let assist = entityAimAssist(px, py, angle);
                    if (abs(lookDeltaX) > 0.008) assist *= 0.35;

                    if (gameState[GS_PLAYER_INVULNERABLE] > 0) gameState[GS_PLAYER_INVULNERABLE] = max(0, gameState[GS_PLAYER_INVULNERABLE] - dt);

                    if (mapData[floor(py) * mapW + floor(px)] === CELL_EXIT) {
                        gameState[GS_PAUSE_GAME] = 1;
                        targetScene = 0;
                    }

                    gameState[GS_PLAYER_X] = px;
                    gameState[GS_PLAYER_Y] = py;
                    gameState[GS_PLAYER_ANGLE] += lookDeltaX + assist * dt;

                    footstepTimer -= dt;
                    updatePlayerTorch(isCharging);
                    if (moving && footstepTimer <= 0) {
                        zzfxPlay(sfxFootstep);
                        footstepTimer = 0.28;
                    }

                    for (let i = 0; i < mapSize; i++) {
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

                if (transition && t > 0 && t < 1) {
                    t += dt;
                } else if (!transition && t > 0) {
                    t -= dt;
                } else if (transition) {
                    gameState[GS_SCENE] = targetScene;
                    entityClear();
                    if (targetScene === 1) {
                        gameState[GS_PLAYER_HP] = gameState[GS_PLAYER_MAX_HP];
                        gameState[GS_PAUSE_GAME] = 0;
                        gameState[GS_SEED] = randInt(1, 1000000);
                        generateProcTextures();
                        generateDungeon();
                    } else {
                        createMenuMap();
                    }
                    targetScene = -1;

                    t = clamp(t, 0, 1);
                    transition = false;
                }
                gl.uniform1f(uTransition, t);
            }
            performanceMark("update_end");

            performanceMark("render_start");
            {
                glClear(0, 0, 0);
                let angle = gameState[GS_PLAYER_ANGLE];
                let px = gameState[GS_PLAYER_X];
                let py = gameState[GS_PLAYER_Y];

                rayRenderFloorCeiling(px, py, angle);
                rayRender(px, py, angle, now * 0.0001, dt);
                entityCollect(px, py, angle);
                entityDraw(px, py, angle, now);

                if (scene === 0) {
                    // Main Menu Scene
                    glPushText("prism break", 20, 20, 0x99ffffff, 4);
                    for (let r = 0; r < 7; r++) {
                        glPushColorQuad(23 - r, 49 + (r * 1), 346, 1, 0xffffffff);
                        glPushColorQuad(24 - r, 49 + (r * 1), 344, 1, 200 << 24 | (RAINBOW[r] & 0xffffff));
                    }

                    for (let i = 0; i < 6; i++) {
                        let s = (selected == i ? "> " : "") + options[i];
                        glPushText(s, 20, SCREEN_HALF_H + (28 * i), 0x88ffffff, 2);

                        if (i === 5)
                            glPushText(saveState[i - 1] ? "zqsd" : "wasd", 260, SCREEN_HALF_H + (28 * i), 0x88ffffff, 2);
                        else if (i > 0)
                            glPushText(saveState[i - 1] ? "on" : "off", 260, SCREEN_HALF_H + (28 * i), 0x88ffffff, 2);
                    }
                } else {
                    // Game Scene
                    glPushTexture(TEXTURE_HORN, SCREEN_HALF_W - 36, SCREEN_HEIGHT - 128, 3, gameState[GS_PLAYER_INVULNERABLE] > 0 ? 0x00ffffff : 0xffffffff);
                    glFlush();

                    zeroShake();
                    if (interactionId > -1) {
                        let str = "f to open";
                        if (mapData[interactionId] === CELL_BOSS_DOOR)
                            str = "f to open boss door";
                        glPushText(str, SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
                    }


                    // Player health bar
                    let hp = gameState[GS_PLAYER_HP] / gameState[GS_PLAYER_MAX_HP];
                    glPushColorQuad(5, SCREEN_HEIGHT - 5, 200, 1, 0xffffffff);
                    glPushColorQuad(5, SCREEN_HEIGHT - 5 - 8, 1, 8, 0xffffffff);
                    glPushColorQuad(7, SCREEN_HEIGHT - 7 - 8, 200 * hp, 2, RAINBOW[GREEN]);
                    glPushColorQuad(7, SCREEN_HEIGHT - 7 - 8, 200 * hp, 8, 0xdd008800);

                    let barWidth = SCREEN_WIDTH - 52;
                    if (shootCooldown > 0) {
                        glPushColorQuad(25, SCREEN_HEIGHT - 37, barWidth + 2, 16, 0xee2d2d2d);
                        glPushColorQuad(26, SCREEN_HEIGHT - 37, barWidth * shootCooldown, 16, RAINBOW[RED]);
                    } else if (charge > 0) {
                        glPushColorQuad(25, SCREEN_HEIGHT - 37, barWidth + 2, 16, 0xee2d2d2d);
                        for (let r = 0; r < 7; r++) {
                            glPushColorQuad(26, SCREEN_HEIGHT - 36 + (r * 2), barWidth * charge, 2, (255 * charge) << 24 | (RAINBOW[r] & 0xffffff));
                        }
                    }
                    renderBossBar();
                }

                if (DEBUG) {
                    drawPerformanceMeter(gameState[GS_PLAYER_X], gameState[GS_PLAYER_Y]);
                }
                glFlush();
            }
            performanceMark("render_end");

            tickPerformanceMeter(delta);
        } else {
            glClear(0, 0, 0);
            glPushText("prism break", SCREEN_HALF_W, SCREEN_HALF_H - 28, 0xffffffff, 3, TEXT_H_ALIGN_CENTER);
            glPushText("js13k 2026 entry by david brad", SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
            glPushText("tap to start", SCREEN_HALF_W, SCREEN_HALF_H + 35, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
            glPushText(VERSION, SCREEN_WIDTH, SCREEN_HEIGHT, 0xffffffff, 1, TEXT_H_ALIGN_RIGHT, TEXT_V_ALIGN_BOTTOM);
            glFlush();
        }
    };
    requestAnimationFrame(tick);
});
