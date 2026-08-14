import { gl, glPushColorQuad, glPushQuad, uDir, updateLightmap, uPlane, uPlayer } from "./gl";
import { clamp, floor, sqrt } from "./math";
import { TEXTURE_CACHE } from "./texture";

let TEX_SIZE = 16;
export let FOV = 0.75;
let MAX_DEPTH = 18;

export let lightMap: Float32Array;
export let lightCalculated: Int8Array;

export let AMBIENT = 0.20;
export let PLAYER_TORCH_RADIUS = 5;
export let PLAYER_TORCH_INTENSITY = 1.4;
export let PLAYER_TORCH_RADIUS_SQ = PLAYER_TORCH_RADIUS * PLAYER_TORCH_RADIUS;

export let FOG_R = 0.05;
export let FOG_G = 0.05;
export let FOG_B = 0.08;
export let FOG_ABGR = 0xff140D0D;

export let FOG_START = 1;
export let FOG_END = 9;

export let mapW = 0;
export let mapH = 0;
let mapData: Int8Array = new Int8Array(0);
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

export let rayRender = (px: number, py: number, angle: number, now: number): void => {
    lightMap.fill(AMBIENT);
    lightCalculated.fill(0);
    let dirX = Math.cos(angle);
    let dirY = Math.sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let rpx = floor(px);
    let rpy = floor(py);

    let phase = Math.sin(now * 30);
    let fading = 0.03 * phase;

    lightMap[rpy * mapW + rpx] = 0.75 - fading;

    for (let x = 0; x < SCREEN_WIDTH; x++) {
        let cameraX = (2 * x) / SCREEN_WIDTH - 1;
        let rayDirX = dirX + planeX * cameraX;
        let rayDirY = dirY + planeY * cameraX;

        let mapX = rpx;
        let mapY = rpy;

        let deltaDistX = Math.abs(1 / (rayDirX || 1e-10));
        let deltaDistY = Math.abs(1 / (rayDirY || 1e-10));

        let stepX: number, stepY: number;
        let sideDistX: number, sideDistY: number;

        if (rayDirX < 0) {
            stepX = -1;
            sideDistX = (px - mapX) * deltaDistX;
        } else {
            stepX = 1;
            sideDistX = (mapX + 1 - px) * deltaDistX;
        }
        if (rayDirY < 0) {
            stepY = -1;
            sideDistY = (py - mapY) * deltaDistY;
        } else {
            stepY = 1;
            sideDistY = (mapY + 1 - py) * deltaDistY;
        }

        let hit = 0;
        let side = 0;
        let depth = 0;
        while (hit === 0 && depth < MAX_DEPTH) {
            if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
            } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
            }
            depth++;

            if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) {
                hit = 1;
                break;
            }
            if (mapData[mapY * mapW + mapX] > 0) {
                hit = 1;
            }
            if (lightCalculated[mapY * mapW + mapX] === 0) {
                let dx = (mapX - rpx);
                let dy = (mapY - rpy);
                let dist = sqrt(dx * dx + dy * dy);
                lightMap[mapY * mapW + mapX] = clamp(0.75 - (0.1 * dist) - fading, 0, 1);
                lightCalculated[mapY * mapW + mapX] = 1;
            }
        }

        if (hit === 0) {
            let dist = FOG_END;
            zBuffer[x] = dist;
            let lineHeight = (SCREEN_HEIGHT / dist);
            let drawStart = (-lineHeight * 0.5 + SCREEN_HEIGHT * 0.5) | 0;
            let drawEnd = (lineHeight * 0.5 + SCREEN_HEIGHT * 0.5) | 0;
            if (drawStart < 0) drawStart = 0;
            if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;
            if (drawEnd > drawStart) {
                glPushColorQuad(x, drawStart, 1, drawEnd - drawStart, FOG_ABGR);
            }
            continue;
        }

        let perpWallDist: number;
        if (side === 0) {
            perpWallDist = (mapX - px + (1 - stepX) / 2) / rayDirX;
        } else {
            perpWallDist = (mapY - py + (1 - stepY) / 2) / rayDirY;
        }
        perpWallDist = Math.max(perpWallDist, 1e-4);
        let distForFog = Math.min(perpWallDist, FOG_END);
        zBuffer[x] = perpWallDist;

        let lineHeight = SCREEN_HEIGHT / perpWallDist;
        let fullStart = -lineHeight * 0.5 + SCREEN_HEIGHT * 0.5;
        let fullEnd = lineHeight * 0.5 + SCREEN_HEIGHT * 0.5;

        let drawStart = fullStart | 0;
        let drawEnd = fullEnd | 0;
        if (drawStart < 0) drawStart = 0;
        if (drawEnd >= SCREEN_HEIGHT) drawEnd = SCREEN_HEIGHT - 1;
        if (drawEnd <= drawStart) continue;

        let vStart = (drawStart - fullStart) / lineHeight;
        let vEnd = (drawEnd - fullStart) / lineHeight;

        let wallX: number;
        if (side === 0) {
            wallX = py + perpWallDist * rayDirY;
        } else {
            wallX = px + perpWallDist * rayDirX;
        }
        wallX -= Math.floor(wallX);

        let texX = (wallX * TEX_SIZE) | 0;
        if (side === 0 && rayDirX > 0) texX = TEX_SIZE - texX - 1;
        if (side === 1 && rayDirY < 0) texX = TEX_SIZE - texX - 1;

        let wallTexture = TEXTURE_CACHE[TEXTURE_WALL];
        let uBase = wallTexture.u0_;
        let u0 = uBase + (texX / TEX_SIZE) * (wallTexture.u1_ - wallTexture.u0_);
        let u1 = u0;

        let cellLight = lightMap[mapY * mapW + mapX];

        let shade = Math.min(1.0, 1.0 / (1.0 + perpWallDist * 0.18));
        let finalShade = (side === 1 ? shade * 0.82 : shade) * cellLight;

        let vt0 = wallTexture.v0_ + vStart * (wallTexture.v1_ - wallTexture.v0_);
        let vt1 = wallTexture.v0_ + vEnd * (wallTexture.v1_ - wallTexture.v0_);

        glPushQuad(x, drawStart, 1, drawEnd - drawStart, u0, vt0, u1, vt1, shadeFogABGR(finalShade), fogFactor(distForFog));
    }
    updateLightmap(lightMap);
};

export let rayRenderFloorCeiling = (px: number, py: number, angle: number): void => {
    let dirX = Math.cos(angle);
    let dirY = Math.sin(angle);
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

export let rayMove = (px: number, py: number, dx: number, dy: number, radius = 0.2): [number, number] => {
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