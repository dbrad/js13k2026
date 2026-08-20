import { assert } from "./__debug/debug";
import { playerShoot, zzfxPlay } from "./audio";
import { glPushColorQuad, glPushQuad } from "./gl";
import { AMBIENT, lightMap, mapData, mapH, mapW } from "./map";
import { abs, atan2, circleOverlap, cos, floor, max, min, PI, random, sin, sqrt } from "./math";
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

export let ENEMY_NONE = 0;
export let ENEMY_MELEE = 1;
export let ENEMY_TANK = 2;
export let ENEMY_RANGED = 3;

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

let MELEE_SPEED = 1.55;
let TANK_SPEED = 0.95;
let RANGED_SPEED = 1.15;
let PROJECTILE_SPEED = 9.0;
let MELEE_ATTACK_RANGE = 1.15;
let RANGED_ATTACK_RANGE = 7.5;
let RANGED_MIN_DIST = 3.8;
let RANGED_MAX_DIST = 6.2;
let MELEE_COOLDOWN = 1.1;
let RANGED_COOLDOWN = 1.6;
let TANK_COOLDOWN = 1.4;
let PSEUDO_LIFETIME = 0.18;
let PROJECTILE_LIFETIME = 2.4;

let NOTICE_DIST = 9.5;
let NOTICE_DIST_SQ = NOTICE_DIST * NOTICE_DIST;
let NOTICE_DELAY_MIN = 0.35;
let NOTICE_DELAY_MAX = 0.85;
let IDLE_WANDER_SPEED = 0.35;

let SEPARATION_RADIUS = 0.85;
let SEPARATION_STRENGTH = 2.8;

let BEAM_BASE_DAMAGE = 4.5;
let BEAM_HIT_RADIUS = 0.55;

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
let colour_ = new Int32Array(MAX_ENTITIES);
let texId_ = new Int32Array(MAX_ENTITIES);
let flags_ = new Int32Array(MAX_ENTITIES);
let facing_ = new Float32Array(MAX_ENTITIES);
let type_id_ = new Int32Array(MAX_ENTITIES);
let hp_ = new Float32Array(MAX_ENTITIES);
let max_hp_ = new Float32Array(MAX_ENTITIES);
let damage_ = new Float32Array(MAX_ENTITIES);
let targetX_ = new Float32Array(MAX_ENTITIES);
let targetY_ = new Float32Array(MAX_ENTITIES);
let lastAttackTime__ = new Float32Array(MAX_ENTITIES);

let alert_ = new Float32Array(MAX_ENTITIES);

let active = new Int32Array(MAX_ENTITIES);
let activeCount = 0;

let visIdx_ = new Int32Array(MAX_VISIBLE);
let visDist_ = new Float32Array(MAX_VISIBLE);
let visScreenX_ = new Float32Array(MAX_VISIBLE);
let visHeight_ = new Float32Array(MAX_VISIBLE);
let visLight_ = new Float32Array(MAX_VISIBLE);
let visibleCount = 0;

let particleTime = 0;

let floorScratchX = new Float32Array(256);
let floorScratchY = new Float32Array(256);
let floorScratchCount = 0;

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
    return (a << 24) | (b << 16) | (g << 8) | floor(r);
};

export let entityClear = (): void => {
    for (let i = 0; i < activeCount; i++) {
        flags_[active[i]] = 0;
    }
    activeCount = 0;
};

type enemyStat = [
    number,
    number
];

let enemyStats: [enemyStat, enemyStat, enemyStat, enemyStat] = [
    [0, 0],
    [5, 3],
    [20, 1],
    [5, 2]
];

export let entityAdd = (x: number, y: number, texId: number, scale = 1, flags = FLAG_BILLBOARD | FLAG_ACTIVE, colour = 0xffffffff, z = 0.5, type_id = ENEMY_NONE): number => {
    assert(activeCount <= MAX_ENTITIES, `entity pool too small, increase entity pool size. active: ${activeCount} max: ${MAX_ENTITIES}`);

    let slot = -1;
    for (let i = 0; i < MAX_ENTITIES; i++) {
        if ((flags_[i] & FLAG_ACTIVE) === 0) {
            slot = i;
            break;
        }
    }
    assert(slot >= 0, `entity pool too small, increase entity pool size. active: ${activeCount} max: ${MAX_ENTITIES}`);

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
    type_id_[slot] = type_id;
    hp_[slot] = 0;
    max_hp_[slot] = 0;
    damage_[slot] = 0;
    targetX_[slot] = 0;
    targetY_[slot] = 0;
    lastAttackTime__[slot] = 0;
    alert_[slot] = 0;

    if (type_id > ENEMY_NONE) {
        let stats = enemyStats[type_id];
        hp_[slot] = stats[0];
        max_hp_[slot] = stats[0];
        damage_[slot] = stats[1];
        flags_[slot] |= FLAG_ENEMY | FLAG_SOLID;

        alert_[slot] = -1;
    }

    active[activeCount] = slot;
    return activeCount++;
};

export let entityAddParticle = (x: number, y: number, z = 0.5, size = 1, col = 0xffffffff): number => {
    let id = entityAdd(x, y, 0, 1, FLAG_PARTICLE | FLAG_ACTIVE, col, z);
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

let burstParticles = (ox: number, oy: number, oz: number, count: number, col: number, speed: number, life: number): void => {
    for (let k = 0; k < count; k++) {
        let id = entityAddParticle(
            ox + (random() - 0.5) * 0.25,
            oy + (random() - 0.5) * 0.25,
            oz + (random() - 0.5) * 0.15,
            0.7 + random() * 1.1,
            col
        );
        if (id < 0) return;
        let s = active[id];
        let ang = random() * PI * 2;
        let sp = speed * (0.5 + random());
        vx_[s] = cos(ang) * sp;
        vy_[s] = sin(ang) * sp;
        vz_[s] = (random() - 0.3) * speed * 0.8;
        data_[s] = life * (0.6 + random() * 0.5);
        size_[s] = 0.6 + random() * 1.2;
    }
};

let spawnProjectile = (sx: number, sy: number, dx: number, dy: number, dmg: number, col: number): void => {
    let len = sqrt(dx * dx + dy * dy);
    if (len < 0.001) return;
    let inv = 1 / len;
    let ndx = dx * inv;
    let ndy = dy * inv;

    let id = entityAdd(sx, sy, 0, 0.45, FLAG_PROJECTILE | FLAG_DAMAGE | FLAG_ACTIVE | FLAG_BILLBOARD, col, 0.45);
    if (id < 0) return;
    let s = active[id];
    vx_[s] = ndx * PROJECTILE_SPEED;
    vy_[s] = ndy * PROJECTILE_SPEED;
    damage_[s] = dmg;
    data_[s] = PROJECTILE_LIFETIME;
    size_[s] = 0.7;
    colour_[s] = col;


    burstParticles(sx + ndx * 0.3, sy + ndy * 0.3, 0.45, 5, col, 2.2, 0.22);
};

let spawnPseudoMelee = (tx: number, ty: number, dmg: number): void => {
    let id = entityAdd(tx, ty, 0, 0.85, FLAG_DAMAGE | FLAG_ACTIVE, 0xff4488ff, 0.4);
    if (id < 0) return;
    let s = active[id];
    damage_[s] = dmg;
    data_[s] = PSEUDO_LIFETIME;
    size_[s] = 1.2;
    vx_[s] = 0;
    vy_[s] = 0;


    burstParticles(tx, ty, 0.5, 8, 0xff66aaff, 3.5, 0.28);
    burstParticles(tx, ty, 0.35, 4, 0xffffffff, 1.8, 0.18);
};

export let fireRainbowBeam = (px: number, py: number, angle: number, charge: number = 1.0): void => {
    zzfxPlay(playerShoot);
    let dmg = BEAM_BASE_DAMAGE * (0.7 + charge * 0.6);

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


        if (i === 1 || i === 3 || i === 5) {
            for (let d = 0.4; d < hitDist; d += 0.45) {
                let bx = px + dx * d;
                let by = py + dy * d;

                for (let ei = activeCount - 1; ei >= 0; ei--) {
                    let es = active[ei];
                    if ((flags_[es] & (FLAG_ACTIVE | FLAG_ENEMY)) !== (FLAG_ACTIVE | FLAG_ENEMY)) continue;
                    if (hp_[es] <= 0) continue;

                    let ex = x_[es] - bx;
                    let ey = y_[es] - by;
                    if (ex * ex + ey * ey > BEAM_HIT_RADIUS * BEAM_HIT_RADIUS) continue;

                    hp_[es] -= dmg;

                    burstParticles(x_[es], y_[es], 0.55, 6, RAINBOW[i], 2.8, 0.25);

                    if (hp_[es] <= 0) {

                        burstParticles(x_[es], y_[es], 0.5, 12, 0xffffffff, 4.0, 0.4);
                        burstParticles(x_[es], y_[es], 0.4, 6, RAINBOW[(i + 3) % 7], 2.5, 0.35);
                        flags_[es] = 0;
                        entityRemove(ei);
                    }


                }
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

export let entityPlayerCollide = (px: number, py: number, playerRadius = 0.25, onDamage?: (activeIdx: number, dmg: number) => void): [number, number] => {
    let outX = px;
    let outY = py;

    for (let i = 0; i < activeCount; i++) {
        let s = active[i];
        if ((flags_[s] & (FLAG_ACTIVE | FLAG_DAMAGE)) !== (FLAG_ACTIVE | FLAG_DAMAGE)) continue;

        let er = (flags_[s] & FLAG_PROJECTILE) ? 0.15 : 0.4 * scale_[s];
        if (circleOverlap(outX, outY, playerRadius, x_[s], y_[s], er)) {
            if (onDamage) {
                onDamage(i, damage_[s]);
            }
            flags_[s] = 0;
        }
    }

    return [outX, outY];
};

let applySeparation = (s: number): void => {
    let sx = x_[s];
    let sy = y_[s];
    let pushX = 0;
    let pushY = 0;

    for (let j = 0; j < activeCount; j++) {
        let o = active[j];
        if (o === s) continue;
        if ((flags_[o] & (FLAG_ACTIVE | FLAG_SOLID | FLAG_ENEMY)) !== (FLAG_ACTIVE | FLAG_SOLID | FLAG_ENEMY)) continue;

        let dx = sx - x_[o];
        let dy = sy - y_[o];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.0001 || d2 > SEPARATION_RADIUS * SEPARATION_RADIUS) continue;

        let d = sqrt(d2);
        let force = (SEPARATION_RADIUS - d) / SEPARATION_RADIUS;
        force *= force;
        let inv = 1 / d;
        pushX += dx * inv * force;
        pushY += dy * inv * force;
    }

    vx_[s] += pushX * SEPARATION_STRENGTH;
    vy_[s] += pushY * SEPARATION_STRENGTH;
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

            if (data_[s] > 0) {
                data_[s] -= dt;
                if (data_[s] <= 0) {
                    flags_[s] = 0;
                    entityRemove(i);
                    continue;
                }
            }

            if (flags_[s] & FLAG_ENEMY) {
                let edx = px - x_[s];
                let edy = py - y_[s];
                let distSq = edx * edx + edy * edy;
                let dist = sqrt(distSq);
                let invDist = dist > 0.001 ? 1 / dist : 0;
                let ndx = edx * invDist;
                let ndy = edy * invDist;

                let typ = type_id_[s];
                let speed = MELEE_SPEED;
                let cooldown = MELEE_COOLDOWN;
                let attackRange = MELEE_ATTACK_RANGE;

                if (typ === ENEMY_TANK) {
                    speed = TANK_SPEED;
                    cooldown = TANK_COOLDOWN;
                } else if (typ === ENEMY_RANGED) {
                    speed = RANGED_SPEED;
                    cooldown = RANGED_COOLDOWN;
                    attackRange = RANGED_ATTACK_RANGE;
                }





                if (alert_[s] < 0) {

                    if (distSq < NOTICE_DIST_SQ) {
                        alert_[s] = NOTICE_DELAY_MIN + random() * (NOTICE_DELAY_MAX - NOTICE_DELAY_MIN);

                        facing_[s] = atan2(ndy, ndx);
                    } else {

                        if (random() < 0.01) {
                            let ang = random() * PI * 2;
                            preferX_[s] = cos(ang);
                            preferY_[s] = sin(ang);
                        }
                        vx_[s] = preferX_[s] * IDLE_WANDER_SPEED;
                        vy_[s] = preferY_[s] * IDLE_WANDER_SPEED;

                        applySeparation(s);
                    }
                } else if (alert_[s] > 0) {

                    alert_[s] -= dt;
                    facing_[s] = atan2(ndy, ndx);
                    vx_[s] = ndx * speed * 0.25;
                    vy_[s] = ndy * speed * 0.25;
                    applySeparation(s);
                    if (alert_[s] <= 0) alert_[s] = 0;
                }


                if (alert_[s] === 0) {
                    if (lastAttackTime__[s] > 0) {
                        lastAttackTime__[s] -= dt;
                    }

                    if (typ === ENEMY_RANGED) {
                        if (dist < RANGED_MIN_DIST) {
                            vx_[s] = -ndx * speed;
                            vy_[s] = -ndy * speed;
                        } else if (dist > RANGED_MAX_DIST) {
                            vx_[s] = ndx * speed;
                            vy_[s] = ndy * speed;
                        } else {
                            vx_[s] *= 0.85;
                            vy_[s] *= 0.85;
                            vx_[s] += -ndy * 0.35;
                            vy_[s] += ndx * 0.35;
                        }
                    } else {
                        if (dist > 0.55) {
                            vx_[s] = ndx * speed;
                            vy_[s] = ndy * speed;
                        } else {
                            vx_[s] = 0;
                            vy_[s] = 0;
                        }
                    }

                    facing_[s] = atan2(ndy, ndx);
                    applySeparation(s);

                    if (dist <= attackRange && lastAttackTime__[s] <= 0) {
                        lastAttackTime__[s] = cooldown;
                        if (typ === ENEMY_RANGED) {
                            spawnProjectile(x_[s], y_[s], edx, edy, damage_[s], 0xff22aaff);
                        } else {
                            spawnPseudoMelee(px, py, damage_[s]);
                        }
                    }
                }
            }

            let mdx = vx_[s] * dt;
            let mdy = vy_[s] * dt;
            let ox = x_[s];
            let oy = y_[s];
            let [nx, ny] = rayMove(ox, oy, mdx, mdy, 0.2);
            x_[s] = nx;
            y_[s] = ny;

            if ((flags_[s] & FLAG_PROJECTILE) && nx === ox && ny === oy && (mdx !== 0 || mdy !== 0)) {

                burstParticles(ox, oy, 0.4, 5, colour_[s], 2.0, 0.2);
                flags_[s] = 0;
                entityRemove(i);
                continue;
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


        if (flags_[s] & FLAG_PROJECTILE) {
            height = abs(SCREEN_HEIGHT / transformY) * 0.35 * size_[s];
        } else if ((flags_[s] & FLAG_DAMAGE) && !(flags_[s] & FLAG_ENEMY)) {
            height = abs(SCREEN_HEIGHT / transformY) * 0.5 * size_[s];
        }

        if (screenX < -height || screenX > SCREEN_WIDTH + height) continue;
        if (visibleCount >= MAX_VISIBLE) continue;

        let cellX = floor(x_[s]);
        let cellY = floor(y_[s]);
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


        if ((flags_[s] & FLAG_PARTICLE) !== 0 || (flags_[s] & FLAG_PROJECTILE) !== 0 ||
            ((flags_[s] & FLAG_DAMAGE) !== 0 && (flags_[s] & FLAG_ENEMY) === 0)) {

            let moteH = height;
            let sx = floor(screenX);
            if (sx < 0 || sx >= SCREEN_WIDTH) continue;
            if (dist > zBuffer[sx]) continue;

            let vOffset = ((z_[s] - 0.5) / dist) * (SCREEN_HEIGHT * 0.5);
            let drawY = SCREEN_HEIGHT * 0.5 - moteH * 0.5 - vOffset;

            let alpha = 0.55;
            if (flags_[s] & FLAG_PARTICLE) {
                alpha = min(0.38, 0.38 / dist);
            } else if (flags_[s] & FLAG_PROJECTILE) {
                alpha = 0.85;
            } else {

                alpha = min(0.7, data_[s] / PSEUDO_LIFETIME * 0.7);
            }

            let col = floor(alpha * 255) << 24 | (colour_[s] & 0xffffff);
            let lit = modulateABGR(col, light);

            glPushColorQuad(screenX - moteH * 0.5, drawY, moteH, moteH, lit);
            continue;
        }

        let tex = TEXTURE_CACHE[texId_[s]];
        assert(tex !== undefined, `missing texture from texture cache. id: ${texId_[s]}`);

        let litColour = modulateABGR(colour_[s], light);

        let halfW = height * 0.5;
        let drawStartX = screenX - halfW;
        let drawEndX = screenX + halfW;
        let bob = sin(now * 3 + phase_[s]) * (height * 0.04);
        let drawStartY = (SCREEN_HEIGHT - height) * 0.5 + bob;

        let startCol = max(0, floor(drawStartX));
        let endCol = min(SCREEN_WIDTH - 1, floor(drawEndX));
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

let collectFloorTiles = (rx: number, ry: number, rw: number, rh: number): void => {
    floorScratchCount = 0;
    let x0 = max(1, floor(rx));
    let y0 = max(1, floor(ry));
    let x1 = min(mapW - 2, floor(rx + rw));
    let y1 = min(mapH - 2, floor(ry + rh));

    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            if (mapData[y * mapW + x] !== CELL_FLOOR) continue;

            if (mapData[y * mapW + (x - 1)] === CELL_WALL ||
                mapData[y * mapW + (x + 1)] === CELL_WALL ||
                mapData[(y - 1) * mapW + x] === CELL_WALL ||
                mapData[(y + 1) * mapW + x] === CELL_WALL) continue;

            if (floorScratchCount >= 256) return;
            floorScratchX[floorScratchCount] = x + 0.5;
            floorScratchY[floorScratchCount] = y + 0.5;
            floorScratchCount++;
        }
    }
};

export let spawnEnemiesInRoom = (rx: number, ry: number, rw: number, rh: number, texId: number = 1): void => {
    collectFloorTiles(rx, ry, rw, rh);
    if (floorScratchCount === 0) return;

    let count = 1 + floor(random() * 3);
    if (count > floorScratchCount) count = floorScratchCount;

    for (let i = 0; i < count; i++) {
        let j = i + floor(random() * (floorScratchCount - i));
        let tx = floorScratchX[i];
        let ty = floorScratchY[i];
        floorScratchX[i] = floorScratchX[j];
        floorScratchY[i] = floorScratchY[j];
        floorScratchX[j] = tx;
        floorScratchY[j] = ty;
    }

    for (let i = 0; i < count; i++) {
        let sx = floorScratchX[i];
        let sy = floorScratchY[i];

        let r = random();
        let typ = ENEMY_MELEE;
        let scl = 0.95;
        let col = 0xffffffff;
        if (r > 0.72) {
            typ = ENEMY_RANGED;
            scl = 0.85;
            col = 0xffaaccff;
        } else if (r > 0.88) {
            typ = ENEMY_TANK;
            scl = 1.25;
            col = 0xffccaa88;
        }

        entityAdd(sx, sy, texId, scl, FLAG_BILLBOARD | FLAG_ACTIVE | FLAG_ENEMY | FLAG_SOLID, col, 0.5, typ);
    }
};
