import version from "../../VERSION.txt";
import { drawPerformanceMeter, initPerformanceMeter, performanceMark, tickPerformanceMeter, togglePerformanceDisplay } from "./__debug/debug";
import { zzfxInit } from "./audio";
import { initCanvas } from "./canvas";
import { entitySpawnDust, spawnEnemiesInRoom } from "./entity";
import { gameState } from "./gameState";
import { glClear, glFlush, glInit, glPushText } from "./gl";
import { drawControls, initializeInput, isTouchEvent } from "./input";
import { generateDungeon, rooms } from "./map";
import { renderGame, updateGame } from "./scenes/gameScene";
import { loadTextureAtlas } from "./texture";

window.addEventListener("load", async (): Promise<void> => {
    let VERSION = version;
    let canvas = initCanvas();
    glInit(canvas);
    await loadTextureAtlas();
    initPerformanceMeter();

    let currentScene = 0;
    let playing = false;

    let initializeGame = (e: PointerEvent | TouchEvent): void => {
        if (!playing) {
            initializeInput(canvas);
            isTouchEvent(e);

            zzfxInit();

            canvas.removeEventListener("touchstart", initializeGame);
            canvas.removeEventListener("pointerdown", initializeGame);
            playing = true;

            [gameState[GS_PLAYER_X], gameState[GS_PLAYER_Y]] = generateDungeon(50, 50);
            for (let i = 1; i < rooms.length; i++) {
                let r = rooms[i];
                spawnEnemiesInRoom(r.x_, r.y_, r.w_, r.h_, TEXTURE_DEMON);
            }
            entitySpawnDust(gameState[GS_PLAYER_X], gameState[GS_PLAYER_Y], 220);

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
                updateGame(delta, dt, now);
            }
            performanceMark("update_end");

            performanceMark("render_start");
            {
                glClear(0, 0, 0);
                renderGame(delta, dt, now);
                drawControls();
                if (DEBUG) {
                    drawPerformanceMeter(gameState[GS_PLAYER_X], gameState[GS_PLAYER_Y]);
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
