import { glPushColorQuad, glPushQuad } from "./gl";
import { AMBIENT, lightMap, mapData, mapH, mapW } from "./map";
import { abs, circleOverlap, cos, floor, max, min, PI, random, sin, sqrt } from "./math";
import { FOG_END, FOG_START, FOV, rayIsSolid, rayMove, zBuffer } from "./raycast";
import { TEXTURE_CACHE } from "./texture";

export let MAX_ENTITIES = 5000;
export let MAX_VISIBLE = 500;

export let FLAG_ACTIVE = 1 << 0;
export let FLAG_PARTICLE = 1 << 1;
export let FLAG_DUST_MOTE = 1 << 2;
export let FLAG_BILLBOARD = 1 << 3;
export let FLAG_SOLID = 1 << 4;
export let FLAG_DAMAGE = 1 << 5;
export let FLAG_PROJECTILE = 1 << 6;
export let FLAG_ENEMY = 1 << 7;

let DRIFT_SPEED = 0.15;
let STEER_STRENGTH = 1.25;
let MAX_PARTICLE_DIST = 19;
let MAX_PARTICLE_DIST_SQ = MAX_PARTICLE_DIST * MAX_PARTICLE_DIST;
let Z_MIN = -0.10;
let Z_MAX = 1.35;

let RAINBOW = [
    0xff0000ff,
    0xff0080ff,
    0xff00ffff,
    0xff00ff00,
    0xffffff00,
    0xffff0000,
    0xffff00ff,
];

let BEAM_SPREAD = 0.12;
let BEAM_RANGE = 20;
let BEAM_STEP = 0.1;

let x_ = new Float32Array(MAX_ENTITIES);
let y_ = new Float32Array(MAX_ENTITIES);
let z_ = new Float32Array(MAX_ENTITIES);
let vx_ = new Float32Array(MAX_ENTITIES);
let vy_ = new Float32Array(MAX_ENTITIES);
let vz_ = new Float32Array(MAX_ENTITIES);
let preferX_ = new Float32Array(MAX_ENTITIES);
let preferY_ = new Float32Array(MAX_ENTITIES);
let scale_ = new Float32Array(MAX_ENTITIES);
let size_ = new Float32Array(MAX_ENTITIES);
let phase_ = new Float32Array(MAX_ENTITIES);
let data_ = new Float32Array(MAX_ENTITIES);
let colour_ = new Uint32Array(MAX_ENTITIES);
let texId_ = new Int16Array(MAX_ENTITIES);
let flags_ = new Uint16Array(MAX_ENTITIES);
let facing_ = new Float32Array(MAX_ENTITIES);

let active = new Int16Array(MAX_ENTITIES);
let activeCount = 0;

let visIdx_ = new Int16Array(MAX_VISIBLE);
let visDist_ = new Float32Array(MAX_VISIBLE);
let visScreenX_ = new Float32Array(MAX_VISIBLE);
let visHeight_ = new Float32Array(MAX_VISIBLE);
let visLight_ = new Float32Array(MAX_VISIBLE);
let visibleCount = 0;

let particleTime = 0;

let fogFactor = (dist: number): number => {
    let t = (dist - FOG_START) / (FOG_END - FOG_START);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t;
};

let modulateABGR = (abgr: number, light: number): number => {
    let r = ((abgr >>> 0) & 0xff) * light;
    let g = ((abgr >>> 8) & 0xff) * light;
    let b = ((abgr >>> 16) & 0xff) * light;
    let a = (abgr >>> 24) & 0xff;
    if (r > 255) r = 255;
    if (g > 255) g = 255;
    if (b > 255) b = 255;
    return (a << 24) | (b << 16) | (g << 8) | (r | 0);
};

export let entityClear = (): void => {
    for (let i = 0; i < activeCount; i++) {
        flags_[active[i]] = 0;
    }
    activeCount = 0;
};

export let entityAdd = (x: number, y: number, texId: number, scale = 1, flags = FLAG_BILLBOARD | FLAG_ACTIVE, colour = 0xffffffff, z = 0.5): number => {
    if (activeCount >= MAX_ENTITIES) return -1;

    let slot = -1;
    for (let i = 0; i < MAX_ENTITIES; i++) {
        if ((flags_[i] & FLAG_ACTIVE) === 0) {
            slot = i;
            break;
        }
    }
    if (slot < 0) return -1;

    x_[slot] = x;
    y_[slot] = y;
    z_[slot] = z;
    vx_[slot] = 0;
    vy_[slot] = 0;
    vz_[slot] = 0;
    preferX_[slot] = 1;
    preferY_[slot] = 0;
    texId_[slot] = texId;
    scale_[slot] = scale;
    colour_[slot] = colour;
    facing_[slot] = 0;
    phase_[slot] = random() * PI * 2;
    size_[slot] = 1;
    flags_[slot] = flags | FLAG_ACTIVE;
    data_[slot] = 0;

    active[activeCount] = slot;
    return activeCount++;
};

export let entityAddParticle = (x: number, y: number, z = 0.5, size = 1, col = 0xffffffff): number => {
    let id = entityAdd(x, y, 0, 1, FLAG_PARTICLE | FLAG_ACTIVE, col, z);
    if (id < 0) return -1;
    let slot = active[id];
    size_[slot] = size;
    colour_[slot] = col;
    return id;
};

export let entityRemove = (activeIdx: number): void => {
    if (activeIdx < 0 || activeIdx >= activeCount) return;
    let slot = active[activeIdx];
    flags_[slot] = 0;

    let last = activeCount - 1;
    if (activeIdx !== last) {
        active[activeIdx] = active[last];
    }
    activeCount = last;
};

export let fireRainbowBeam = (px: number, py: number, angle: number, charge: number = 1.0): void => {
    for (let i = 0; i < 7; i++) {
        let t = i / 6;
        let rayAngle = angle - BEAM_SPREAD * 0.5 + BEAM_SPREAD * t;
        let dx = cos(rayAngle);
        let dy = sin(rayAngle);

        let hitDist = BEAM_RANGE * charge;

        for (let d = BEAM_STEP; d < hitDist; d += BEAM_STEP) {
            let x = px + dx * d;
            let y = py + dy * d;
            let mx = floor(x);
            let my = floor(y);

            if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) {
                hitDist = d;
                break;
            }

            let cell = mapData[my * mapW + mx];
            if (cell === CELL_WALL || cell === CELL_HORIZONTAL_DOOR || cell === CELL_VERTICAL_DOOR) {
                hitDist = d;
                break;
            }

            if (cell === CELL_CRACKED) {
                // TODO: Better wall destruction
                mapData[my * mapW + mx] = CELL_FLOOR;
                hitDist = d;

                for (let k = 0; k < 8; k++) {
                    let id = entityAddParticle(
                        x + (random() - 0.5) * 0.4,
                        y + (random() - 0.5) * 0.4,
                        0.4 + random() * 0.3,
                        0.9 + random() * 0.8,
                        0xff6688aa
                    );
                    if (id < 0) continue;
                    let s = active[id];
                    vx_[s] = (random() - 0.5) * 2.2;
                    vy_[s] = (random() - 0.5) * 2.2;
                    vz_[s] = 0.8 + random() * 1.4;
                    data_[s] = 0.35 + random() * 0.25;
                }
                break;
            }
        }

        for (let p = 0; p < 14 + floor(charge * 10); p++) {
            let u = p / ((14 + floor(charge * 10)) - 1);
            let x = px + dx * hitDist * u;
            let y = py + dy * hitDist * u;

            let id = entityAddParticle(x, y, 0.42 + (random() - 0.5) * 0.12, 1.1 + random() * 0.9, RAINBOW[i]);
            if (id < 0) continue;
            let s = active[id];
            vx_[s] = dx * (0.9 + random() * 0.7) + (random() - 0.5) * 0.4;
            vy_[s] = dy * (0.9 + random() * 0.7) + (random() - 0.5) * 0.4;
            vz_[s] = (random() - 0.5) * 0.6;
            data_[s] = 0.12 + random() * 0.10;
            size_[s] = 0.8 + random() * 0.9;
        }

        for (let p = 0; p < 4; p++) {
            let u = random() * 0.95;
            let x = px + dx * hitDist * u;
            let y = py + dy * hitDist * u;

            let id = entityAddParticle(x, y, 0.3, 2.0 + random(), RAINBOW[i]);
            if (id < 0) continue;
            let s = active[id];
            vx_[s] = dx * 0.18;
            vy_[s] = dy * 0.18;
            vz_[s] = 0;
            data_[s] = 0.38 + random() * 0.15;
            size_[s] = 1.6 + random() * 0.8;
        }

        let range = floor(3 + (2 * charge));
        if (i === 3) {
            for (let d = -1; d < hitDist; d += 1) {
                let mx = floor(px + dx * d);
                let my = floor(py + dy * d);
                if (mx >= 0 && my >= 0 && mx < mapW && my < mapH) {
                    for (let lx = mx - range; lx < mx + range; lx++) {
                        for (let ly = my - range; ly < my + range; ly++) {
                            if (lx < 0 || lx >= mapW || ly < 0 || ly >= mapH) continue;
                            let idx = ly * mapW + lx;
                            let ddx = mx - lx;
                            let ddy = my - ly;
                            let dist = sqrt(ddx * ddx + ddy * ddy);
                            lightMap[idx] = max(lightMap[idx], min(0.5 + (charge), AMBIENT + max(0, 1.5 - 0.3 * dist)));
                        }
                    }
                }
            }
        }
    }
};

let respawnDustMote = (slot: number): void => {
    let nx = 0, ny = 0;
    for (let tries = 0; tries < 30; tries++) {
        nx = 1 + random() * (mapW - 2);
        ny = 1 + random() * (mapH - 2);
        if (!rayIsSolid(nx, ny)) break;
    }

    x_[slot] = nx;
    y_[slot] = ny;
    z_[slot] = Z_MIN + random() * (Z_MAX - Z_MIN);

    let ang = random() * PI * 2;
    preferX_[slot] = cos(ang);
    preferY_[slot] = sin(ang);

    vx_[slot] = preferX_[slot] * DRIFT_SPEED * (0.7 + random() * 0.6);
    vy_[slot] = preferY_[slot] * DRIFT_SPEED * (0.7 + random() * 0.6);
    vz_[slot] = (random() - 0.5) * 0.2;

    colour_[slot] = 0x00ffffff;
    phase_[slot] = random() * PI * 2;
    size_[slot] = 0.1 + random() * 0.75;
    flags_[slot] = FLAG_ACTIVE | FLAG_DUST_MOTE | FLAG_PARTICLE;
    data_[slot] = 20;
};

export let entitySpawnDust = (px: number, py: number, count = 220): void => {
    let n = min(count, MAX_ENTITIES - activeCount);
    for (let i = 0; i < n; i++) {
        let id = entityAddParticle(px, py);
        if (id < 0) break;
        respawnDustMote(active[id]);
    }
};

export let entityPlayerCollide = (px: number, py: number, playerRadius = 0.25, onDamage?: (activeIdx: number) => void): [number, number] => {
    let outX = px;
    let outY = py;

    for (let i = 0; i < activeCount; i++) {
        let s = active[i];
        if ((flags_[s] & (FLAG_ACTIVE | FLAG_DAMAGE)) !== (FLAG_ACTIVE | FLAG_DAMAGE)) continue;

        let er = (flags_[s] & FLAG_PROJECTILE) ? 0.15 : 0.4 * scale_[s];
        if (circleOverlap(outX, outY, playerRadius, x_[s], y_[s], er)) {
            if (onDamage) {
                onDamage(i);
                if (flags_[s] & FLAG_PROJECTILE) flags_[s] = 0;
            }
        }
    }

    return [outX, outY];
};

export let entityUpdate = (dt: number, px: number, py: number): void => {
    particleTime += dt;
    for (let i = activeCount - 1; i >= 0; i--) {
        let s = active[i];
        if ((flags_[s] & FLAG_ACTIVE) === 0) {
            entityRemove(i);
            continue;
        }

        if (flags_[s] & (FLAG_ENEMY | FLAG_PROJECTILE)) {
            let dx = vx_[s] * dt;
            let dy = vy_[s] * dt;
            let [nx, ny] = rayMove(x_[s], y_[s], dx, dy, 0.2);
            x_[s] = nx;
            y_[s] = ny;

            if (nx === x_[s] - dx && ny === y_[s] - dy) {
                if (flags_[s] & FLAG_PROJECTILE) {
                    flags_[s] = 0;
                    entityRemove(i);
                    continue;
                }
            }
        }

        if ((flags_[s] & FLAG_PARTICLE) === 0) continue;

        data_[s] -= dt;

        let dx = x_[s] - px;
        let dy = y_[s] - py;
        let distSq = dx * dx + dy * dy;

        if (distSq > MAX_PARTICLE_DIST_SQ * 2.5) {
            respawnDustMote(s);
            continue;
        }

        if (flags_[s] & FLAG_DUST_MOTE) {
            vx_[s] += (preferX_[s] * DRIFT_SPEED - vx_[s]) * STEER_STRENGTH * dt;
            vy_[s] += (preferY_[s] * DRIFT_SPEED - vy_[s]) * STEER_STRENGTH * dt;

            if (random() < 0.003) {
                let ang = random() * PI * 2;
                preferX_[s] = cos(ang);
                preferY_[s] = sin(ang);
            }

            let drive1 = sin(particleTime * 0.85 + phase_[s]) * 0.22;
            let drive2 = cos(particleTime * 1.35 + phase_[s] * 0.7) * 0.18;
            vz_[s] += (drive1 + drive2) * dt;

            if (z_[s] < Z_MIN) vz_[s] += (Z_MIN - z_[s]) * 2.5 * dt;
            if (z_[s] > Z_MAX) vz_[s] += (Z_MAX - z_[s]) * 2.5 * dt;

            vx_[s] *= 1.0 - 0.9 * dt;
            vy_[s] *= 1.0 - 0.9 * dt;
            vz_[s] *= 1.0 - 1.3 * dt;
        }

        x_[s] += vx_[s] * dt;
        y_[s] += vy_[s] * dt;
        z_[s] += vz_[s] * dt;

        if (rayIsSolid(x_[s], y_[s]) || data_[s] <= 0) {
            if (flags_[s] & FLAG_DUST_MOTE) {
                respawnDustMote(s);
            } else {
                flags_[s] = 0;
                entityRemove(i);
            }
            continue;
        }

        phase_[s] += dt * (1.2 + size_[s] * 0.4);
    }
};

export let entityCollect = (px: number, py: number, angle: number): void => {
    visibleCount = 0;

    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (let i = 0; i < activeCount; i++) {
        let s = active[i];
        if ((flags_[s] & FLAG_ACTIVE) === 0) continue;

        let dx = x_[s] - px;
        let dy = y_[s] - py;

        let transformX = invDet * (dirY * dx - dirX * dy);
        let transformY = invDet * (-planeY * dx + planeX * dy);

        if (transformY <= 0.12) continue;

        let screenX = (SCREEN_WIDTH * 0.5) * (1 + transformX / transformY);
        let height =
            abs(SCREEN_HEIGHT / transformY) *
            scale_[s] *
            ((flags_[s] & FLAG_PARTICLE) !== 0 ? size_[s] * 0.026 : 1);

        if (screenX < -height || screenX > SCREEN_WIDTH + height) continue;
        if (visibleCount >= MAX_VISIBLE) continue;

        let cellX = x_[s] | 0;
        let cellY = y_[s] | 0;
        let cellLight = AMBIENT;
        if (cellX >= 0 && cellY >= 0 && cellX < mapW && cellY < mapH) {
            cellLight = lightMap[cellY * mapW + cellX];
        }

        visIdx_[visibleCount] = s;
        visDist_[visibleCount] = transformY;
        visScreenX_[visibleCount] = screenX;
        visHeight_[visibleCount] = height;
        visLight_[visibleCount] = min(1.5, cellLight);
        visibleCount++;
    }

    for (let i = 1; i < visibleCount; i++) {
        let tIdx = visIdx_[i];
        let tDist = visDist_[i];
        let tSX = visScreenX_[i];
        let tH = visHeight_[i];
        let tL = visLight_[i];

        let j = i - 1;
        while (j >= 0 && visDist_[j] < tDist) {
            visIdx_[j + 1] = visIdx_[j];
            visDist_[j + 1] = visDist_[j];
            visScreenX_[j + 1] = visScreenX_[j];
            visHeight_[j + 1] = visHeight_[j];
            visLight_[j + 1] = visLight_[j];
            j--;
        }
        visIdx_[j + 1] = tIdx;
        visDist_[j + 1] = tDist;
        visScreenX_[j + 1] = tSX;
        visHeight_[j + 1] = tH;
        visLight_[j + 1] = tL;
    }
};

export let entityDraw = (px: number, py: number, angle: number, now: number): void => {
    for (let i = 0; i < visibleCount; i++) {
        let s = visIdx_[i];
        if ((flags_[s] & FLAG_ACTIVE) === 0) continue;

        let dist = visDist_[i];
        let screenX = visScreenX_[i];
        let height = visHeight_[i];
        let light = visLight_[i];
        let fog = fogFactor(dist);

        if ((flags_[s] & FLAG_PARTICLE) !== 0) {
            let moteH = height;
            let sx = screenX | 0;
            if (sx < 0 || sx >= SCREEN_WIDTH) continue;
            if (dist > zBuffer[sx]) continue;

            let vOffset = ((z_[s] - 0.5) / dist) * (SCREEN_HEIGHT * 0.5);
            let drawY = SCREEN_HEIGHT * 0.5 - moteH * 0.5 - vOffset;

            let alpha = min(0.38, 0.38 / dist);
            let col = ((alpha * 255) | 0) << 24 | colour_[s];
            let lit = modulateABGR(col, light);

            glPushColorQuad(screenX - moteH * 0.5, drawY, moteH, moteH, lit);
            continue;
        }

        let tex = TEXTURE_CACHE[texId_[s]];
        if (!tex) continue;

        let litColour = modulateABGR(colour_[s], light);

        let halfW = height * 0.5;
        let drawStartX = screenX - halfW;
        let drawEndX = screenX + halfW;
        let bob = sin(now * 3 + phase_[s]) * (height * 0.04);
        let drawStartY = (SCREEN_HEIGHT - height) * 0.5 + bob;

        let startCol = max(0, drawStartX | 0);
        let endCol = min(SCREEN_WIDTH - 1, drawEndX | 0);
        if (endCol < startCol) continue;

        let uSpan = tex.u1_ - tex.u0_;
        let invW = 1 / height;

        for (let col = startCol; col <= endCol; col++) {
            if (dist >= zBuffer[col]) continue;
            let texU = tex.u0_ + uSpan * ((col - drawStartX) * invW);
            glPushQuad(col, drawStartY, 1, height, texU, tex.v0_, texU, tex.v1_, litColour, fog);
        }
    }
};
