// entity.ts
import { glPushColorQuad, glPushQuad } from "./gl";
import { abs, circleOverlap, cos, max, min, PI, random, sin, sqrt } from "./math";
import {
    AMBIENT,
    FOG_END,
    FOG_START,
    FOV,
    lightCalculated,
    lightMap,
    mapData,
    mapH,
    mapW,
    rayIsSolid,
    rayMove,
    zBuffer
} from "./raycast";
import { TEXTURE_CACHE } from "./texture";

let MAX_ENTITIES = 5000;
let MAX_VISIBLE = 500;

let FLAG_ACTIVE = 1 << 0;
let FLAG_PARTICLE = 1 << 1;
let FLAG_DUST_MOTE = 1 << 2;
let FLAG_BILLBOARD = 1 << 3;
let FLAG_SOLID = 1 << 4;   // blocks the player
let FLAG_DAMAGE = 1 << 5;   // damages player on contact
let FLAG_PROJECTILE = 1 << 6;  // moving damage source (bullets, etc.)
let FLAG_ENEMY = 1 << 7;   // optional, for AI / scoring

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
        let t = i / 6;
        let rayAngle = angle - BEAM_SPREAD * 0.5 + BEAM_SPREAD * t;
        let dx = cos(rayAngle);
        let dy = sin(rayAngle);

        let hitDist = BEAM_RANGE;

        for (let d = BEAM_STEP; d < BEAM_RANGE; d += BEAM_STEP) {
            let x = px + dx * d;
            let y = py + dy * d;
            let mx = x | 0;
            let my = y | 0;

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
                    let e = entities[id];
                    e.vx_ = (random() - 0.5) * 2.2;
                    e.vy_ = (random() - 0.5) * 2.2;
                    e.vz_ = 0.8 + random() * 1.4;
                    e.data_ = 0.35 + random() * 0.25;
                }
                break;
            }
        }

        let sparkCount = 14;
        for (let p = 0; p < sparkCount; p++) {
            let u = p / (sparkCount - 1);
            let x = px + dx * hitDist * u;
            let y = py + dy * hitDist * u;

            let id = entityAddParticle(x, y, 0.32 + (random() - 0.5) * 0.12, 1.1 + random() * 0.9, RAINBOW[i]);
            if (id < 0) continue;
            let e = entities[id];
            e.vx_ = dx * (0.9 + random() * 0.7) + (random() - 0.5) * 0.4;
            e.vy_ = dy * (0.9 + random() * 0.7) + (random() - 0.5) * 0.4;
            e.vz_ = (random() - 0.5) * 0.6;
            e.data_ = 0.12 + random() * 0.10;
            e.size_ = 0.8 + random() * 0.9;
        }

        for (let p = 0; p < 4; p++) {
            let u = random() * 0.95;
            let x = px + dx * hitDist * u;
            let y = py + dy * hitDist * u;

            let id = entityAddParticle(x, y, 0.3, 2.0 + random(), RAINBOW[i]);
            if (id < 0) continue;
            let e = entities[id];
            e.vx_ = dx * 0.18;
            e.vy_ = dy * 0.18;
            e.vz_ = 0;
            e.data_ = 0.38 + random() * 0.15;
            e.size_ = 1.6 + random() * 0.8;
        }

        if (i === 3) {
            for (let d = 0.3; d < hitDist; d += 0.6) {
                let mx = (px + dx * d) | 0;
                let my = (py + dy * d) | 0;
                if (mx >= 0 && my >= 0 && mx < mapW && my < mapH) {
                    for (let x = mx - 5; x < mx + 5; x++) {
                        for (let y = my - 5; y < my + 5; y++) {
                            if (x < 0 || x >= mapW || y < 0 || y >= mapH) continue;
                            let idx = y * mapW + x;
                            let dx = mx - x;
                            let dy = my - y;
                            let dist = sqrt(dx * dx + dy * dy);
                            lightMap[idx] = min(1.5, AMBIENT + max(0, (1.5 - (0.3 * dist))));
                        }
                    }
                }
            }
        }
    }
};

export let entityAt = (index: number): Entity => {
    return entities[index];
};

export let entityCountActive = (): number => {
    return entityCount;
};

let respawnDustMote = (e: Entity): void => {
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

    e.colour_ = 0x00ffffff;
    e.phase_ = random() * PI * 2;
    e.size_ = 0.1 + random() * 0.75;
    e.flags_ = FLAG_ACTIVE | FLAG_DUST_MOTE | FLAG_PARTICLE;
    e.data_ = 20;
};

export let entitySpawnDust = (px: number, py: number, count = 220): void => {
    let n = min(count, MAX_ENTITIES - entityCount);
    for (let i = 0; i < n; i++) {
        let id = entityAddParticle(px, py);
        let e = entities[id];
        respawnDustMote(e);
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
        if ((e.flags_ & (FLAG_ACTIVE | FLAG_DAMAGE)) !== (FLAG_ACTIVE | FLAG_DAMAGE)) continue;

        let hit = false;
        let er = (e.flags_ & FLAG_PROJECTILE) ? 0.15 : 0.4 * e.scale_;
        hit = circleOverlap(outX, outY, playerRadius, e.x_, e.y_, er);

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
            respawnDustMote(e);
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
                respawnDustMote(e);
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

        if (screenX < -height || screenX > SCREEN_WIDTH + height) continue;
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
        slot.light_ = min(1.5, cellLight);
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
    for (let i = 0; i < visibleCount; i++) {
        let s = visible[i];
        let e = entities[s.idx_];
        if ((e.flags_ & FLAG_ACTIVE) === 0) continue;

        let fog = fogFactor(s.dist_);

        if ((e.flags_ & FLAG_PARTICLE) !== 0) {
            let moteH = s.height_;
            let sx = s.screenX_ | 0;
            if (sx < 0 || sx >= SCREEN_WIDTH) continue;
            if (s.dist_ > zBuffer[sx]) continue;

            let vOffset = ((e.z_ - 0.5) / s.dist_) * (SCREEN_HEIGHT * 0.5);
            let drawY = SCREEN_HEIGHT * 0.5 - moteH * 0.5 - vOffset;

            let alpha = min(0.38, 0.38 / s.dist_);

            let col = ((alpha * 255) | 0) << 24 | e.colour_;
            let litColour = modulateABGR(col, s.light_);

            glPushColorQuad(s.screenX_ - moteH * 0.5, drawY, moteH, moteH, litColour);
            continue;
        }

        let tex = TEXTURE_CACHE[e.texId_];
        if (!tex) continue;

        let litColour = modulateABGR(e.colour_, s.light_);

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
