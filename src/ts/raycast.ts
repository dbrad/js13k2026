import { gl, glPushColorQuad, glPushQuad, uDir, updateLightmap, uPlane, uPlayer } from "./gl";
import { abs, clamp, cos, floor, max, min, sin, sqrt } from "./math";
import { TEXTURE_CACHE } from "./texture";

let TEXTURE_SIZE = 32;
export let FOV = 0.75;
let MAX_RAY_DEPTH = 50;

export let lightMap: Float32Array;
export let lightCalculated: Int8Array;
export let LIGHT_DECAY = 6.5;

export let AMBIENT = 0.15;
export let PLAYER_TORCH_INTENSITY = 0.5;

export let FOG_R = 0.05;
export let FOG_G = 0.05;
export let FOG_B = 0.08;
export let FOG_ABGR = 0xff140D0D;

export let FOG_START = 1;
export let FOG_END = 20;

export let mapW = 0;
export let mapH = 0;
export let mapData: Int8Array = new Int8Array(0);
export let mapOffsetData: Float32Array;

export let zBuffer = new Float32Array(SCREEN_WIDTH);

export let fogFactor = (dist: number): number => {
    let t = clamp((dist - FOG_START) / (FOG_END - FOG_START), 0, 1);
    return t * t;
};

let shadeFogABGR = (shade: number): number => {
    let s = (shade * 255) | 0;
    let out = (255 & 0xff) << 8 >>> 0;
    out = (out | s) << 8 >>> 0;
    out = (out | s) << 8 >>> 0;
    out = (out | s) >>> 0;
    return out;
};

export let raySetMap = (w: number, h: number, data: Int8Array, lights?: Float32Array): void => {
    mapW = w;
    mapH = h;
    mapData = data;
    lightMap = lights && lights.length === w * h
        ? lights
        : new Float32Array(w * h).fill(AMBIENT);
    lightCalculated = new Int8Array(w * h).fill(0);
};

export let rayRender = (px: number, py: number, angle: number, now: number, dt: number): void => {
    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let playerX = floor(px);
    let playerY = floor(py);

    let phase = sin(now * 30);
    let fading = 0.05 * phase;

    let playerIdx = playerY * mapW + playerX;
    let desired = PLAYER_TORCH_INTENSITY - fading;
    lightMap[playerIdx] += (desired - lightMap[playerIdx]) * min(1, LIGHT_DECAY * dt);
    lightCalculated[playerIdx] = 1;

    for (let x = 0; x < SCREEN_WIDTH; x++) {
        let cameraX = (2 * x) / SCREEN_WIDTH - 1;
        let rayDirX = dirX + planeX * cameraX;
        let rayDirY = dirY + planeY * cameraX;

        let rayMapX = playerX;
        let rayMapY = playerY;

        let deltaDistX = abs(1 / (rayDirX || 1e-10));
        let deltaDistY = abs(1 / (rayDirY || 1e-10));

        let stepX: number, stepY: number;
        let sideDistX: number, sideDistY: number;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (px - rayMapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (rayMapX + 1 - px) * deltaDistX;
        }
        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (py - rayMapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (rayMapY + 1 - py) * deltaDistY;
        }

        let hit = 0;
        let side = 0;
        let rayDepth = 0;
        let idx = rayMapY * mapW + rayMapX;
        let cell = mapData[idx];
        while (hit === 0 && rayDepth < MAX_RAY_DEPTH) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                rayMapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                rayMapY += stepY;
                side = 1;
            }
            rayDepth++;

            if (rayMapX < 0 || rayMapY < 0 || rayMapX >= mapW || rayMapY >= mapH) {
                hit = 1;
                break;
            }
            idx = rayMapY * mapW + rayMapX;
            cell = mapData[idx];

            if (cell > CELL_FLOOR) {
                hit = 1;
            }
            if (lightCalculated[idx] === 0) {
                let dx = rayMapX - playerX;
                let dy = rayMapY - playerY;
                let dist = sqrt(dx * dx + dy * dy);
                let targetLightLevel = clamp(PLAYER_TORCH_INTENSITY - (0.1 * dist) - fading, AMBIENT, 1);
                lightMap[idx] += (targetLightLevel - lightMap[idx]) * min(1, LIGHT_DECAY * dt);
                lightCalculated[idx] = 1;
            }
        }

        if (hit === 0) {
            zBuffer[x] = FOG_END;
            let lineHeight = (SCREEN_HEIGHT / FOG_END);
            let drawStart = max(0, floor(-lineHeight * 0.5 + SCREEN_HEIGHT * 0.5));
            let drawEnd = min(SCREEN_HEIGHT - 1, floor(lineHeight * 0.5 + SCREEN_HEIGHT * 0.5));
            if (drawEnd > drawStart) {
                glPushColorQuad(x, drawStart, 1, drawEnd - drawStart, FOG_ABGR);
            }
            continue;
        }

        let perpWallDist: number;
        let wallX: number;
        if (side === 0) {
            perpWallDist = (rayMapX - px + (1 - stepX) / 2) / rayDirX;
            wallX = py + perpWallDist * rayDirY;
        } else {
            perpWallDist = (rayMapY - py + (1 - stepY) / 2) / rayDirY;
            wallX = px + perpWallDist * rayDirX;
        }
        perpWallDist = max(perpWallDist, 1e-4);
        wallX -= floor(wallX);
        zBuffer[x] = perpWallDist;

        let distForFog = min(perpWallDist, FOG_END);

        let lineHeight = SCREEN_HEIGHT / perpWallDist;
        let fullStart = -lineHeight * 0.5 + SCREEN_HEIGHT * 0.5;
        let fullEnd = lineHeight * 0.5 + SCREEN_HEIGHT * 0.5;

        let drawStart = max(0, floor(fullStart));
        let drawEnd = min(SCREEN_HEIGHT - 1, floor(fullEnd));
        if (drawEnd <= drawStart) continue;

        let vStart = (drawStart - fullStart) / lineHeight;
        let vEnd = (drawEnd - fullStart) / lineHeight;

        let textureX = (wallX * TEXTURE_SIZE) | 0;
        if (side === 0 && rayDirX > 0) textureX = TEXTURE_SIZE - textureX - 1;
        if (side === 1 && rayDirY < 0) textureX = TEXTURE_SIZE - textureX - 1;

        let wallTexture = cell === 1 ? TEXTURE_CACHE[TEXTURE_BRICK] : TEXTURE_CACHE[TEXTURE_BRICK_CRACK];
        let u0 = wallTexture.u0_ + (textureX / TEXTURE_SIZE) * (wallTexture.u1_ - wallTexture.u0_);

        let cellLighting = lightMap[rayMapY * mapW + rayMapX];
        let shade = min(1.0, 1.0 / (1.0 + perpWallDist * 0.18));
        let finalShade = (side === 1 ? shade * 0.82 : shade) * cellLighting;

        let textureV0 = wallTexture.v0_ + vStart * (wallTexture.v1_ - wallTexture.v0_);
        let textureV1 = wallTexture.v0_ + vEnd * (wallTexture.v1_ - wallTexture.v0_);

        glPushQuad(x, drawStart, 1, drawEnd - drawStart, u0, textureV0, u0, textureV1, shadeFogABGR(finalShade), fogFactor(distForFog));
    }

    for (let i = 0; i < lightCalculated.length; i++) {
        if (lightCalculated[i] === 1) continue;
        lightMap[i] += (AMBIENT - lightMap[i]) * min(1, LIGHT_DECAY * dt);
    }
    updateLightmap(lightMap);
};

export let rayRenderFloorCeiling = (px: number, py: number, angle: number): void => {
    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;

    gl.uniform2f(uPlayer, px, py);
    gl.uniform2f(uDir, dirX, dirY);
    gl.uniform2f(uPlane, planeX, planeY);

    glPushQuad(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 10, 0, 11, 1, 0xffffffff);
};

export let rayIsSolid = (x: number, y: number): boolean => {
    let mx = x | 0;
    let my = y | 0;
    if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) return true;
    return mapData[my * mapW + mx] > 0;
};

export let rayMove = (px: number, py: number, dx: number, dy: number, radius = 0.25): [number, number] => {
    let nx = px + dx;
    let ny = py + dy;

    if (!rayIsSolid(nx - radius, py - radius) &&
        !rayIsSolid(nx + radius, py - radius) &&
        !rayIsSolid(nx - radius, py + radius) &&
        !rayIsSolid(nx + radius, py + radius)) {
        px = nx;
    }
    if (!rayIsSolid(px - radius, ny - radius) &&
        !rayIsSolid(px + radius, ny - radius) &&
        !rayIsSolid(px - radius, ny + radius) &&
        !rayIsSolid(px + radius, ny + radius)) {
        py = ny;
    }
    return [px, py];
};