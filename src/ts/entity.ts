// entity.ts
import { glPushColorQuad, glPushQuad } from "./gl";
import { abs, circleOverlap, cos, floor, max, min, PI, random, sin, sqrt } from "./math";
import {
    AMBIENT,
    FOG_END,
    FOG_START,
    FOV,
    lightMap,
    mapH,
    mapW,
    rayIsSolid,
    rayMove,
    zBuffer,
} from "./raycast";
import { TEXTURE_CACHE } from "./texture";

let MAX_ENTITIES = 5000;
let MAX_VISIBLE = 500;

let FLAG_ACTIVE = 1 << 0;
let FLAG_PARTICLE = 1 << 1;
let FLAG_DUST_MOTE = 1 << 2;
let FLAG_ORIENTED = 1 << 3;
let FLAG_BILLBOARD = 1 << 4;
let FLAG_SOLID = 1 << 5;   // blocks the player
let FLAG_DAMAGE = 1 << 6;   // damages player on contact
let FLAG_PROJECTILE = 1 << 7;  // moving damage source (bullets, etc.)
let FLAG_ENEMY = 1 << 8;   // optional, for AI / scoring

let entities: Entity[] = new Array(MAX_ENTITIES);
let visible: Visible[] = new Array(MAX_VISIBLE);
let entityCount = 0;
let visibleCount = 0;
let particleTime = 0;

let DRIFT_SPEED = 0.15;
let STEER_STRENGTH = 1.25;
let MAX_PARTICLE_DIST = 19;
let MAX_PARTICLE_DIST_SQ = MAX_PARTICLE_DIST * MAX_PARTICLE_DIST;
let Z_MIN = -0.10;
let Z_MAX = 1.35;

for (let i = 0; i < MAX_ENTITIES; i++) {
    entities[i] = {
        x_: 0, y_: 0, z_: 0.5,
        vx_: 0, vy_: 0, vz_: 0,
        preferX_: 1, preferY_: 0,
        texId_: 0, scale_: 1, colour_: 0xffffffff,
        facing_: 0, phase_: 0, size_: 1,
        flags_: 0, data_: 0,
    };
}

for (let i = 0; i < MAX_VISIBLE; i++) {
    visible[i] = {
        idx_: 0,
        dist_: 0,
        screenX_: 0,
        height_: 0,
        light_: 1,
    };
}

let fogFactor = (dist: number): number => {
    let t = (dist - FOG_START) / (FOG_END - FOG_START);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t;
};

let packABGR = (r: number, g: number, b: number, a = 1): number => {
    let R = (r * 255) | 0;
    let G = (g * 255) | 0;
    let B = (b * 255) | 0;
    let A = (a * 255) | 0;
    let out = (A & 0xff) << 8 >>> 0;
    out = (out | (B & 0xff)) << 8 >>> 0;
    out = (out | (G & 0xff)) << 8 >>> 0;
    out = (out | (R & 0xff)) >>> 0;
    return out;
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
    for (let i = 0; i < entityCount; i++) {
        entities[i].flags_ = 0;
    }
    entityCount = 0;
};

export let entityAdd = (
    x: number,
    y: number,
    texId: number,
    scale = 1,
    flags = FLAG_BILLBOARD | FLAG_ACTIVE,
    colour = 0xffffffff,
    z = 0.5
): number => {
    if (entityCount >= MAX_ENTITIES) return -1;
    let e = entities[entityCount];
    e.x_ = x;
    e.y_ = y;
    e.z_ = z;
    e.vx_ = 0;
    e.vy_ = 0;
    e.vz_ = 0;
    e.preferX_ = 1;
    e.preferY_ = 0;
    e.texId_ = texId;
    e.scale_ = scale;
    e.colour_ = colour;
    e.facing_ = 0;
    e.phase_ = random() * PI * 2;
    e.size_ = 1;
    e.flags_ = flags | FLAG_ACTIVE;
    e.data_ = 0;
    return entityCount++;
};

export let entityAddParticle = (
    x: number,
    y: number,
    z = 0.5,
    size = 1,
    col: number = 0xffffffff
): number => {
    let id = entityAdd(x, y, 0, 1, FLAG_PARTICLE | FLAG_ACTIVE, col, z);
    if (id < 0) return -1;
    let e = entities[id];
    e.size_ = size;
    e.colour_ = col;
    return id;
};

export let entityAddOriented = (x: number, y: number,
    texId: number, facing: number, scale = 1,
    col: number = 0xffffffff): number => {
    let id = entityAdd(x, y, texId, scale, FLAG_ORIENTED | FLAG_ACTIVE | FLAG_SOLID, col);
    if (id >= 0) entities[id].facing_ = facing;
    return id;
};

export let entityRemove = (index: number): void => {
    if (index < 0 || index >= entityCount) return;
    let last = entityCount - 1;
    if (index !== last) {
        let tmp = entities[index];
        entities[index] = entities[last];
        entities[last] = tmp;
    }
    entities[last].flags_ = 0;
    entityCount = last;
};

let RAINBOW = [
    0xff0000ff, // R
    0xff0080ff, // O
    0xff00ffff, // Y
    0xff00ff00, // G
    0xffffff00, // C
    0xffff0000, // B
    0xffff00ff, // V
];

let BEAM_SPREAD = 0.12;   // total angle in radians (~11°)
let BEAM_RANGE = 20;
let BEAM_STEP = 0.1;

export let fireRainbowBeam = (px: number, py: number, angle: number): void => {
    for (let i = 0; i < 7; i++) {
        let t = i / 6;                          // 0 → 1
        let rayAngle = angle - BEAM_SPREAD * 0.5 + BEAM_SPREAD * t;
        let dx = cos(rayAngle);
        let dy = sin(rayAngle);

        let hitDist = BEAM_RANGE;

        for (let d = BEAM_STEP; d < BEAM_RANGE; d += BEAM_STEP) {
            let x = px + dx * d;
            let y = py + dy * d;

            if (rayIsSolid(x, y)) {
                hitDist = d;
                // TODO: if this cell is a cracked wall → damage / break it
                break;
            }

            // optional: also test solid entities here if you want the beam blocked by them
            // (or do a separate entity pass after all rays)
        }

        // visual – a few particles along this ray, coloured by rainbow index
        let count = 30;
        for (let p = 0; p < count; p++) {
            let u = p / (count - 1);
            let x = px + dx * hitDist * u;
            let y = py + dy * hitDist * u;

            let id = entityAddParticle(x, y, 0.45, 0.7 + random() * 0.6, RAINBOW[i]);
            if (id < 0) continue;

            let e = entities[id];
            e.colour_ = RAINBOW[i];
            e.vx_ = dx * .5;
            e.vy_ = dy * .5;
            e.vz_ = 0;
            e.data_ = 0.5;
            e.size_ = 0.5;
            // short life handled by your existing particle update / age system
        }

        // gameplay: collect hits along this ray (enemies, cracked walls, etc.)
        // you can either do it inside the walk above or do a second lightweight pass
    }
};

export let entityAt = (index: number): Entity => {
    return entities[index];
};

export let entityCountActive = (): number => {
    return entityCount;
};

let respawnParticle = (e: Entity): void => {
    let nx = 0;
    let ny = 0;
    for (let tries = 0; tries < 30; tries++) {
        nx = 1 + random() * (mapW - 2);
        ny = 1 + random() * (mapH - 2);
        if (!rayIsSolid(nx, ny)) break;
    }

    e.x_ = nx;
    e.y_ = ny;
    e.z_ = Z_MIN + random() * (Z_MAX - Z_MIN);

    let ang = random() * PI * 2;
    e.preferX_ = cos(ang);
    e.preferY_ = sin(ang);

    e.vx_ = e.preferX_ * DRIFT_SPEED * (0.7 + random() * 0.6);
    e.vy_ = e.preferY_ * DRIFT_SPEED * (0.7 + random() * 0.6);
    e.vz_ = (random() - 0.5) * 0.2;

    e.phase_ = random() * PI * 2;
    e.size_ = 0.25 + random() * 1.0;
    e.flags_ = FLAG_PARTICLE | FLAG_ACTIVE;
    e.data_ = 10;
};

export let entitySpawnDust = (px: number, py: number, count = 220): void => {
    let n = min(count, MAX_ENTITIES - entityCount);
    for (let i = 0; i < n; i++) {
        let id = entityAddParticle(px, py);
        let e = entities[id];
        respawnParticle(e);
    }
};

export let entityPlayerCollide = (
    px: number, py: number,
    playerRadius = 0.25,
    onDamage?: (entityIndex: number, e: Entity) => void
): [number, number] => {
    let outX = px;
    let outY = py;

    for (let i = 0; i < entityCount; i++) {
        let e = entities[i];
        if ((e.flags_ & (FLAG_ACTIVE | FLAG_SOLID)) !== (FLAG_ACTIVE | FLAG_SOLID)) continue;

        if (e.flags_ & FLAG_ORIENTED) {
            let cx = floor(e.x_);
            let cy = floor(e.y_);

            let EXPAND = 0.04;
            let minX = cx - EXPAND;
            let maxX = cx + 1 + EXPAND;
            let minY = cy - EXPAND;
            let maxY = cy + 1 + EXPAND;

            let nearestX = outX < minX ? minX : outX > maxX ? maxX : outX;
            let nearestY = outY < minY ? minY : outY > maxY ? maxY : outY;

            let dx = outX - nearestX;
            let dy = outY - nearestY;
            let d2 = dx * dx + dy * dy;
            let r = playerRadius;

            if (d2 >= r * r || d2 < 1e-10) continue;

            let d = sqrt(d2);
            let pen = r - d;
            outX += (dx / d) * pen;
            outY += (dy / d) * pen;
        } else {
            let er = 0.35 * e.scale_;
            let dx = outX - e.x_;
            let dy = outY - e.y_;
            let d2 = dx * dx + dy * dy;
            let r = playerRadius + er;
            if (d2 >= r * r || d2 < 1e-10) continue;

            let d = sqrt(d2);
            let pen = r - d;
            outX += (dx / d) * pen;
            outY += (dy / d) * pen;
        }
    }

    [outX, outY] = rayMove(outX, outY, 0, 0, playerRadius);

    for (let i = 0; i < entityCount; i++) {
        let e = entities[i];
        if ((e.flags_ & (FLAG_ACTIVE | FLAG_DAMAGE)) !== (FLAG_ACTIVE | FLAG_DAMAGE)) continue;

        let hit = false;
        if (e.flags_ & FLAG_ORIENTED) {
            let cx = e.x_ | 0, cy = e.y_ | 0;
            hit = outX > cx - playerRadius && outX < cx + 1 + playerRadius &&
                outY > cy - playerRadius && outY < cy + 1 + playerRadius;
        } else {
            let er = (e.flags_ & FLAG_PROJECTILE) ? 0.15 : 0.4 * e.scale_;
            hit = circleOverlap(outX, outY, playerRadius, e.x_, e.y_, er);
        }

        if (hit && onDamage) {
            onDamage(i, e);
            if (e.flags_ & FLAG_PROJECTILE) e.flags_ = 0;
        }
    }

    return [outX, outY];
};

export let entityUpdate = (dt: number, px: number, py: number): void => {
    particleTime += dt;

    for (let i = 0; i < entityCount; i++) {
        let e = entities[i];
        if ((e.flags_ & FLAG_ACTIVE) === 0) continue;

        if (e.flags_ & (FLAG_ENEMY | FLAG_PROJECTILE)) {
            let dx = e.vx_ * dt;
            let dy = e.vy_ * dt;

            let [nx, ny] = rayMove(e.x_, e.y_, dx, dy, 0.2);
            e.x_ = nx;
            e.y_ = ny;

            if (nx === e.x_ - dx && ny === e.y_ - dy) {
                if (e.flags_ & FLAG_PROJECTILE) e.flags_ = 0;
            }
        }

        if ((e.flags_ & FLAG_PARTICLE) === 0) continue;

        e.data_ -= dt;

        let dx = e.x_ - px;
        let dy = e.y_ - py;
        let distSq = dx * dx + dy * dy;

        if (distSq > MAX_PARTICLE_DIST_SQ * 2.5) {
            respawnParticle(e);
            continue;
        }

        if (e.flags_ & FLAG_DUST_MOTE) {
            e.vx_ += (e.preferX_ * DRIFT_SPEED - e.vx_) * STEER_STRENGTH * dt;
            e.vy_ += (e.preferY_ * DRIFT_SPEED - e.vy_) * STEER_STRENGTH * dt;

            if (random() < 0.003) {
                let ang = random() * PI * 2;
                e.preferX_ = cos(ang);
                e.preferY_ = sin(ang);
            }

            let drive1 = sin(particleTime * 0.85 + e.phase_) * 0.22;
            let drive2 = cos(particleTime * 1.35 + e.phase_ * 0.7) * 0.18;
            e.vz_ += (drive1 + drive2) * dt;

            if (e.z_ < Z_MIN) e.vz_ += (Z_MIN - e.z_) * 2.5 * dt;
            if (e.z_ > Z_MAX) e.vz_ += (Z_MAX - e.z_) * 2.5 * dt;

            e.vx_ *= 1.0 - 0.9 * dt;
            e.vy_ *= 1.0 - 0.9 * dt;
            e.vz_ *= 1.0 - 1.3 * dt;
        }

        e.x_ += e.vx_ * dt;
        e.y_ += e.vy_ * dt;
        e.z_ += e.vz_ * dt;

        if (rayIsSolid(e.x_, e.y_) || e.data_ <= 0) {
            if (e.flags_ & FLAG_DUST_MOTE) {
                respawnParticle(e);
                continue;
            } else {
                entityRemove(i);
                continue;
            }
        }

        e.phase_ += dt * (1.2 + e.size_ * 0.4);
    }
};

export let entityCollect = (px: number, py: number, angle: number): void => {
    visibleCount = 0;

    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (let i = 0; i < entityCount; i++) {
        let e = entities[i];
        if ((e.flags_ & FLAG_ACTIVE) === 0) continue;

        let dx = e.x_ - px;
        let dy = e.y_ - py;

        let transformX = invDet * (dirY * dx - dirX * dy);
        let transformY = invDet * (-planeY * dx + planeX * dy);

        if (transformY <= 0.12) continue;

        let screenX = (SCREEN_WIDTH * 0.5) * (1 + transformX / transformY);
        let height =
            abs(SCREEN_HEIGHT / transformY) *
            e.scale_ *
            ((e.flags_ & FLAG_PARTICLE) !== 0 ? e.size_ * 0.026 : 1);

        if ((e.flags_ & FLAG_ORIENTED) !== 0) {
            if (transformY <= -0.5) continue;
            let halfLen = 0.5 * e.scale_;
            let nx = cos(e.facing_);
            let ny = sin(e.facing_);
            let sx = -ny;
            let sy = nx;

            let lx = e.x_ - sx * halfLen;
            let ly = e.y_ - sy * halfLen;
            let rx = e.x_ + sx * halfLen;
            let ry = e.y_ + sy * halfLen;

            let ldx = lx - px, ldy = ly - py;
            let rdx = rx - px, rdy = ry - py;

            let lTX = invDet * (dirY * ldx - dirX * ldy);
            let lTY = invDet * (-planeY * ldx + planeX * ldy);
            let rTX = invDet * (dirY * rdx - dirX * rdy);
            let rTY = invDet * (-planeY * rdx + planeX * rdy);
            if (lTY <= -0.5 && rTY <= -0.5) continue;

            let NEAR = -0.5;
            if (lTY < NEAR) {
                let t = (NEAR - lTY) / (rTY - lTY + 1e-8);
                lTX += (rTX - lTX) * t;
                lTY = NEAR;
            }
            if (rTY < NEAR) {
                let t = (NEAR - rTY) / (lTY - rTY + 1e-8);
                rTX += (lTX - rTX) * t;
                rTY = NEAR;
            }

            let lScreen = (SCREEN_WIDTH * 0.5) * (1 + lTX / lTY);
            let rScreen = (SCREEN_WIDTH * 0.5) * (1 + rTX / rTY);

            if (!isFinite(lScreen) || !isFinite(rScreen)) {
                if (screenX < -height * 2 || screenX > SCREEN_WIDTH + height * 2) continue;
            } else {
                let left = lScreen < rScreen ? lScreen : rScreen;
                let right = lScreen < rScreen ? rScreen : lScreen;
                if (right < -2 || left > SCREEN_WIDTH + 2) continue;
            }
        } else {
            if (transformY <= 0.12) continue;
            if (screenX < -height || screenX > SCREEN_WIDTH + height) continue;
        }

        if (visibleCount >= MAX_VISIBLE) continue;

        let cellX = e.x_ | 0;
        let cellY = e.y_ | 0;
        let cellLight = AMBIENT;
        if (cellX >= 0 && cellY >= 0 && cellX < mapW && cellY < mapH) {
            cellLight = lightMap[cellY * mapW + cellX];
        }

        let slot = visible[visibleCount++];
        slot.idx_ = i;
        slot.dist_ = transformY;
        slot.screenX_ = screenX;
        slot.height_ = height;
        slot.light_ = min(1.6, cellLight);
    }

    for (let i = 1; i < visibleCount; i++) {
        let tmp = visible[i];
        let j = i - 1;
        while (j >= 0 && visible[j].dist_ < tmp.dist_) {
            visible[j + 1] = visible[j];
            j--;
        }
        visible[j + 1] = tmp;
    }
};

export let entityDraw = (px: number, py: number, angle: number, now: number): void => {
    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;

    for (let i = 0; i < visibleCount; i++) {
        let s = visible[i];
        let e = entities[s.idx_];
        if ((e.flags_ & FLAG_ACTIVE) === 0) continue;

        let fog = fogFactor(s.dist_);

        if ((e.flags_ & FLAG_PARTICLE) !== 0) {
            let moteH = s.height_;
            if (moteH < 1) continue;

            let sx = s.screenX_ | 0;
            if (sx < 0 || sx >= SCREEN_WIDTH) continue;
            if (s.dist_ > zBuffer[sx]) continue;

            let vOffset = ((e.z_ - 0.5) / s.dist_) * (SCREEN_HEIGHT * 0.5);
            let drawY = SCREEN_HEIGHT * 0.5 - moteH * 0.5 - vOffset;

            let alpha = min(0.38, 0.38 / s.dist_);
            let col = ((alpha * 255) | 0) << 24 | e.colour_;
            glPushColorQuad(s.screenX_ - moteH * 0.5, drawY, moteH, moteH, col);
            continue;
        }

        let tex = TEXTURE_CACHE[e.texId_];
        if (!tex) continue;

        let litColour = modulateABGR(e.colour_, s.light_);

        if ((e.flags_ & FLAG_ORIENTED) !== 0) {
            let halfLen = 0.5 * e.scale_;
            let nx = cos(e.facing_);
            let ny = sin(e.facing_);
            let sx = -ny;
            let sy = nx;

            let startCol = 0;
            let endCol = SCREEN_WIDTH - 1;

            let uSpan = tex.u1_ - tex.u0_;

            for (let col = startCol; col <= endCol; col++) {
                let cameraX = (2 * col) / SCREEN_WIDTH - 1;
                let rayDirX = dirX + planeX * cameraX;
                let rayDirY = dirY + planeY * cameraX;

                let denom = rayDirX * nx + rayDirY * ny;
                if (abs(denom) < 1e-6) continue;

                let t = ((e.x_ - px) * nx + (e.y_ - py) * ny) / denom;
                let dist = abs(t);
                if (dist <= 0.05) continue;

                let hitX = px + t * rayDirX;
                let hitY = py + t * rayDirY;

                let sideDist = (hitX - e.x_) * sx + (hitY - e.y_) * sy;
                if (sideDist < -halfLen || sideDist > halfLen) continue;

                if (dist >= zBuffer[col]) continue;

                let lineHeight = SCREEN_HEIGHT / dist;
                let drawStart = (-lineHeight * 0.5 + SCREEN_HEIGHT * 0.5) | 0;
                let drawEnd = (lineHeight * 0.5 + SCREEN_HEIGHT * 0.5) | 0;

                let u = (sideDist + halfLen) / (halfLen * 2);
                // uncomment if the back face should not mirror
                // if (t < 0) u = 1 - u;

                let texU = tex.u0_ + uSpan * u;
                let fog = fogFactor(dist);

                glPushQuad(col, drawStart, 1, drawEnd - drawStart,
                    texU, tex.v0_, texU, tex.v1_,
                    litColour, fog);
            }
            continue;
        }

        let halfW = s.height_ * 0.5;
        let drawStartX = s.screenX_ - halfW;
        let drawEndX = s.screenX_ + halfW;
        let bob = sin(now * 3 + e.phase_) * (s.height_ * 0.04);
        let drawStartY = (SCREEN_HEIGHT - s.height_) * 0.5 + bob;

        let startCol = max(0, drawStartX | 0);
        let endCol = min(SCREEN_WIDTH - 1, drawEndX | 0);
        if (endCol < startCol) continue;

        let uSpan = tex.u1_ - tex.u0_;
        let invW = 1 / s.height_;

        for (let col = startCol; col <= endCol; col++) {
            if (s.dist_ >= zBuffer[col]) continue;
            let texU = tex.u0_ + uSpan * ((col - drawStartX) * invW);
            glPushQuad(col, drawStartY, 1, s.height_, texU, tex.v0_, texU, tex.v1_, litColour, fog);
        }
    }
};