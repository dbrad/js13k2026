import { playMusic, sfxFootstep, sfxLaserCharge, sfxPlayerHurt, zzfxPlay } from "@root/ts/audio";
import { entityAimAssist, entityCollect, entityDraw, entityPlayerCollide, entityUpdate, fireRainbowBeam } from "@root/ts/entity";
import { gl, glFlush, glPushColorQuad, glPushText, glPushTexture, uShake } from "@root/ts/gl";
import { A_PRESSED, B_IS_DOWN, B_PRESSED, DOWN_IS_DOWN, isTouch, LEFT_IS_DOWN, lookDeltaX, RIGHT_IS_DOWN, UP_IS_DOWN } from "@root/ts/input";
import { doorAnimActive, doorAnimT, mapData, mapOffsetData, mapSize, updatePlayerTorch } from "@root/ts/map";
import { abs, cos, max, min, sin, sqrt } from "@root/ts/math";
import { interactionId, rayMove, rayRender, rayRenderFloorCeiling } from "@root/ts/raycast";
import { getShakeSum, shakeTrigger, shakeUpdate, shakeX, shakeY, updateHeadbob, zeroShake } from "@root/ts/shake";
import { RAINBOW } from "../colours";
import { gameState } from "../gameState";

let charge = 0;
let chargeSpeed = 1.5;
let isCharging = false;
let wasBPressed = false;

let footstepTimer = 0.28;
let shootCooldown = 0;

export let updateGame = (delta: number, dt: number, now: number) => {
    shootCooldown = max(0, shootCooldown - dt);
    playMusic(delta);
    let speed = 3 * dt;
    let moving = false;

    let angle = gameState[GS_PLAYER_ANGLE];
    let px = gameState[GS_PLAYER_X];
    let py = gameState[GS_PLAYER_Y];

    let dirX = cos(angle);
    let dirY = sin(angle);

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
        if (gameState[GS_PLAYER_INVULNERABLE] > 0) return;
        gameState[GS_PLAYER_HP] -= 1;
        shakeTrigger(16, 100);
        zzfxPlay(sfxPlayerHurt);
        gameState[GS_PLAYER_INVULNERABLE] = PLAYER_INVULNERABLE_DURATION;
    });

    let assist = entityAimAssist(px, py, angle);
    if (abs(lookDeltaX) > 0.008) assist *= 0.35;

    if (gameState[GS_PLAYER_INVULNERABLE] > 0) gameState[GS_PLAYER_INVULNERABLE] = max(0, gameState[GS_PLAYER_INVULNERABLE] - dt);

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
};

export let renderGame = (delta: number, dt: number, now: number) => {
    let angle = gameState[GS_PLAYER_ANGLE];
    let px = gameState[GS_PLAYER_X];
    let py = gameState[GS_PLAYER_Y];

    rayRenderFloorCeiling(px, py, angle);
    rayRender(px, py, angle, now * 0.0001, dt);
    entityCollect(px, py, angle);
    entityDraw(px, py, angle, now * 0.001);
    glPushTexture(TEXTURE_HORN, SCREEN_HALF_W - 36, SCREEN_HEIGHT - 128, 3, gameState[GS_PLAYER_INVULNERABLE] > 0 ? 0x00ffffff : 0xffffffff);
    glFlush();

    zeroShake();
    if (interactionId > -1) {
        glPushText("A to open", SCREEN_HALF_W, SCREEN_HALF_H, 0xffffffff, 1, TEXT_H_ALIGN_CENTER); // TODO: Fix this text per input
    }

    let hp = gameState[GS_PLAYER_HP] / gameState[GS_PLAYER_MAX_HP];
    glPushColorQuad(5, 5, 200, 1, 0xffffffff);
    glPushColorQuad(5, 5, 1, 8, 0xffffffff);
    glPushColorQuad(7, 7, 200 * hp, 2, RAINBOW[RED]);
    glPushColorQuad(7, 7, 200 * hp, 8, 0xdd000088);

    let barWidth = SCREEN_WIDTH - 32;
    glPushColorQuad(16, SCREEN_HEIGHT - 32, barWidth, 16, 0xff333333);
    if (shootCooldown > 0) {
        glPushColorQuad(16, SCREEN_HEIGHT - 32, barWidth * shootCooldown, 16, RAINBOW[RED]);
    } else {
        glPushColorQuad(16, SCREEN_HEIGHT - 32, barWidth * charge, 16, RAINBOW[GREEN]);
    }
};