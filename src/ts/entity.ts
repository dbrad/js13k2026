import { assert } from "./__debug/debug";
import { sfxEnemyAlert, sfxEnemyDeath, sfxEnemyMelee, sfxEnemyRanged, sfxLaserFire, zzfxPlay } from "./audio";
import { glPushColorCircle, glPushQuad } from "./gl";
import { AMBIENT, LIGHT_LEVEL_CAP, lightMap, mapData, mapH, mapW } from "./map";
import { abs, circleOverlap, cos, floor, max, min, PI, randInt, random, sin, sqrt } from "./math";
import { fogFactor, FOV, rayIsSolid, rayMove, zBuffer } from "./raycast";
import { shakeTrigger } from "./shake";
import { TEXTURE_CACHE } from "./texture";

let RAINBOW = [
    0xff0000ff,
    0xff0080ff,
    0xff00ffff,
    0xff00ff00,
    0xffffff00,
    0xffff0000,
    0xffff00ff,
];

let RAINBOWf = [
    [1.5, 0, 0],
    [1.5, 0.75, 0],
    [1.5, 1.5, 0],
    [0, 1.5, 0],
    [0, 1.5, 1.5],
    [0, 0, 1.5],
    [1.5, 0, 1.5],
];

let x_: Float32Array = new Float32Array(MAX_ENTITIES);
let y_: Float32Array = new Float32Array(MAX_ENTITIES);
let z_: Float32Array = new Float32Array(MAX_ENTITIES);
let vx_: Float32Array = new Float32Array(MAX_ENTITIES);
let vy_: Float32Array = new Float32Array(MAX_ENTITIES);
let vz_: Float32Array = new Float32Array(MAX_ENTITIES);
let preferX_: Float32Array = new Float32Array(MAX_ENTITIES);
let preferY_: Float32Array = new Float32Array(MAX_ENTITIES);
let scale_: Float32Array = new Float32Array(MAX_ENTITIES);
let size_: Float32Array = new Float32Array(MAX_ENTITIES);
let phase_: Float32Array = new Float32Array(MAX_ENTITIES);
let verticalBob_: Float32Array = new Float32Array(MAX_ENTITIES);
let data_: Float32Array = new Float32Array(MAX_ENTITIES);
let colour_: Int32Array = new Int32Array(MAX_ENTITIES);
let texId_: Int32Array = new Int32Array(MAX_ENTITIES);
let flags_: Int32Array = new Int32Array(MAX_ENTITIES);
let type_id_: Int32Array = new Int32Array(MAX_ENTITIES);
let hp_: Float32Array = new Float32Array(MAX_ENTITIES);
let max_hp_: Float32Array = new Float32Array(MAX_ENTITIES);
let damage_: Float32Array = new Float32Array(MAX_ENTITIES);
let targetX_: Float32Array = new Float32Array(MAX_ENTITIES);
let targetY_: Float32Array = new Float32Array(MAX_ENTITIES);
let lastAttackTime_: Float32Array = new Float32Array(MAX_ENTITIES);
let alert_: Float32Array = new Float32Array(MAX_ENTITIES);
let flashTimer_: Float32Array = new Float32Array(MAX_ENTITIES);

let active: Int32Array = new Int32Array(MAX_ENTITIES * 0.5);
let activeCount: number = 0;

let activeParticles: Int32Array = new Int32Array(MAX_ENTITIES * 0.5);
let activeParticleCount: number = 0;

let free_: Int32Array = new Int32Array(MAX_ENTITIES);
let freeCount: number = MAX_ENTITIES;
for (let i = 0; i < MAX_ENTITIES; i++) free_[i] = i;

let visIdx_: Int32Array = new Int32Array(MAX_VISIBLE);
let visDist_: Float32Array = new Float32Array(MAX_VISIBLE);
let visScreenX_: Float32Array = new Float32Array(MAX_VISIBLE);
let visHeight_: Float32Array = new Float32Array(MAX_VISIBLE);
let visibleCount: number = 0;

let particleTime: number = 0;

let modulateABGR = (abgr: number, r: number, g: number, b: number): number => {
    let outR = min(255, ((abgr >>> 0) & 0xff) * r);
    let outG = min(255, ((abgr >>> 8) & 0xff) * g);
    let outB = min(255, ((abgr >>> 16) & 0xff) * b);
    let a = (abgr >>> 24) & 0xff;
    return (a << 24) | (outB << 16) | (outG << 8) | floor(outR);
};

export let entityClear = (): void => {
    for (let i = 0; i < activeCount; i++) flags_[active[i]] = 0;
    for (let i = 0; i < activeParticleCount; i++) flags_[activeParticles[i]] = 0;
    activeCount = 0;
    activeParticleCount = 0;
    freeCount = MAX_ENTITIES;
    for (let i = 0; i < MAX_ENTITIES; i++) free_[i] = i;
};

export let entityAimAssist = (px: number, py: number, angle: number, maxRange = 10, coneCos = 0.65, strength = 0.8): number => {
    let dirX = cos(angle);
    let dirY = sin(angle);
    let bestCross = 0;
    let bestScore = 0;

    for (let i = 0; i < activeCount; i++) {
        let s = active[i];
        if ((flags_[s] & (FLAG_ACTIVE | FLAG_ENEMY)) !== (FLAG_ACTIVE | FLAG_ENEMY) || hp_[s] <= 0) continue;

        let dx = x_[s] - px;
        let dy = y_[s] - py;
        let distSq = dx * dx + dy * dy;
        if (distSq > maxRange * maxRange || distSq < 0.25) continue;

        if (!hasLineOfSight(px, py, x_[s], y_[s])) continue;

        let inv = 1 / sqrt(distSq);
        let ndx = dx * inv;
        let ndy = dy * inv;

        let dot = dirX * ndx + dirY * ndy;
        if (dot < coneCos) continue;          // outside cone

        let cross = dirX * ndy - dirY * ndx;  // sin(Δθ)
        // prefer closer + more centered
        let score = (1 - abs(cross)) * inv;
        if (score > bestScore) {
            bestScore = score;
            bestCross = cross;
        }
    }
    return bestCross * strength;
};

let enemyStats: [number, number][] = [
    [0, 0],
    [15, 3],          // melee
    [20, 1],         // tank
    [10, 2],          // ranged
    [180, 4],        // bullet hell
    [140, 2],        // brood
    [220, 8],        // charge
];

export let entityAdd = (x: number, y: number, texId: number, scale = 1, flags: number = FLAG_ACTIVE, colour = 0xffffffff, z = 0.5, type_id: number = ENEMY_NONE): number => {
    if (freeCount === 0) {
        assert(false, `entity pool exhausted`);
    }
    let slot = free_[--freeCount];

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
    phase_[slot] = 0;
    verticalBob_[slot] = random() * PI * 2;
    size_[slot] = 1;
    flags_[slot] = flags | FLAG_ACTIVE;
    data_[slot] = 0;
    type_id_[slot] = type_id;
    hp_[slot] = 0;
    max_hp_[slot] = 0;
    damage_[slot] = 0;
    targetX_[slot] = 0;
    targetY_[slot] = 0;
    lastAttackTime_[slot] = 0;
    alert_[slot] = 0;

    if (type_id > ENEMY_NONE) {
        let stats = enemyStats[type_id];
        hp_[slot] = stats[0];
        max_hp_[slot] = stats[0];
        damage_[slot] = stats[1];
        flags_[slot] |= FLAG_ENEMY | FLAG_SOLID;
        alert_[slot] = -1;
    }

    if (flags & FLAG_PARTICLE) {
        activeParticles[activeParticleCount] = slot;
        return activeParticleCount++;
    } else {
        active[activeCount] = slot;
        return activeCount++;
    }
};

export let entityAddBoss = (x: number, y: number, typ: number, texId = TEXTURE_DEMON_LARGE): number => {
    let id = entityAdd(x, y, texId, 1.2, FLAG_ACTIVE | FLAG_ENEMY | FLAG_SOLID, 0xffffffff, 0.55, typ);
    let s = active[id];
    preferX_[s] = x;          // home
    preferY_[s] = y;
    data_[s] = 1.5;           // initial delay
    return id;
};

export let entityAddParticle = (x: number, y: number, z = 0.5, size = 1, col = 0xffffffff): number => {
    let id = entityAdd(x, y, 0, 1, FLAG_PARTICLE | FLAG_ACTIVE, col, z);
    let slot = activeParticles[id];
    size_[slot] = size;
    return id;
};

export let entityRemove = (activeIdx: number): void => {
    if (activeIdx < 0 || activeIdx >= activeCount) return;
    let slot = active[activeIdx];
    flags_[slot] = 0;
    free_[freeCount++] = slot;

    let last = activeCount - 1;
    if (activeIdx !== last) {
        active[activeIdx] = active[last];
    }
    activeCount = last;
};

export let entityRemoveParticle = (activeIdx: number): void => {
    if (activeIdx < 0 || activeIdx >= activeParticleCount) return;
    let slot = activeParticles[activeIdx];
    flags_[slot] = 0;
    free_[freeCount++] = slot;

    let last = activeParticleCount - 1;
    if (activeIdx !== last) {
        activeParticles[activeIdx] = activeParticles[last];
    }
    activeParticleCount = last;
};

let burstParticles = (ox: number, oy: number, oz: number, count: number, col: number, speed: number, life: number): void => {
    for (let k = 0; k < count; k++) {
        let id = entityAddParticle(
            ox + (random() - 0.5) * 0.25,
            oy + (random() - 0.5) * 0.25,
            oz + (random() - 0.5) * 0.15,
            1.7 + random() * 1.1,
            col
        );
        let s = activeParticles[id];
        let ang = random() * PI * 2;
        let sp = speed * (0.5 + random());
        vx_[s] = cos(ang) * sp;
        vy_[s] = sin(ang) * sp;
        vz_[s] = (random() - 0.3) * speed * 0.8;
        data_[s] = life * (1.6 + random() * 0.5);
        size_[s] = 2.6 + random() * 1.2;
    }
};

let spawnBeamParticle = (x: number, y: number, z: number, size: number, col: number, life: number, vx: number, vy: number, vz: number): void => {
    let id = entityAddParticle(x, y, z, size, col);
    let s = activeParticles[id];
    vx_[s] = vx;
    vy_[s] = vy;
    vz_[s] = vz;
    data_[s] = life;
};

let spawnProjectile = (sx: number, sy: number, dx: number, dy: number, dmg: number, col: number): void => {
    let len = sqrt(dx * dx + dy * dy);
    if (len < 0.001) return;
    let inv = 1 / len;
    let ndx = dx * inv;
    let ndy = dy * inv;

    let id = entityAdd(sx, sy, 0, 0.45, FLAG_PROJECTILE | FLAG_DAMAGE | FLAG_ACTIVE, col, 0.45);
    let s = active[id];
    vx_[s] = ndx * PROJECTILE_SPEED;
    vy_[s] = ndy * PROJECTILE_SPEED;
    damage_[s] = dmg;
    data_[s] = PROJECTILE_LIFETIME;
    size_[s] = 0.3;
    colour_[s] = col;

    burstParticles(sx + ndx * 0.3, sy + ndy * 0.3, 0.45, 5, col, 2.2, 0.22);
};

let spawnPseudoMelee = (tx: number, ty: number, dmg: number): void => {
    let id = entityAdd(tx, ty, 0, 0.85, FLAG_DAMAGE | FLAG_ACTIVE, 0xff4488ff, 0.4);
    let s = active[id];
    damage_[s] = dmg;
    data_[s] = PSEUDO_LIFETIME;
    size_[s] = 1.2;
    vx_[s] = 0;
    vy_[s] = 0;

    burstParticles(tx, ty, 0.5, 8, 0xff2222ff, 3.5, 0.28);
    burstParticles(tx, ty, 0.35, 4, 0xffffffff, 1.8, 0.18);
};

export let fireRainbowBeam = (px: number, py: number, angle: number, charge: number = 1.0): void => {
    zzfxPlay(sfxLaserFire);
    shakeTrigger(8, 100);

    let dmg = BEAM_BASE_DAMAGE * (0.7 + charge * 0.6);
    let range = floor(3 + 2 * charge);

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
                    spawnBeamParticle(
                        x + (random() - 0.5) * 0.4,
                        y + (random() - 0.5) * 0.4,
                        0.4 + random() * 0.3,
                        0.9 + random() * 0.8,
                        0xff6688aa,
                        0.35 + random() * 0.25,
                        (random() - 0.5) * 2.2,
                        (random() - 0.5) * 2.2,
                        0.8 + random() * 1.4
                    );
                }
                break;
            }
        }

        // Damage on odd rays only
        if (i & 1) {
            for (let d = 0.4; d < hitDist; d += 0.45) {
                let bx = px + dx * d;
                let by = py + dy * d;
                for (let ei = activeCount - 1; ei >= 0; ei--) {
                    let es = active[ei];
                    if ((flags_[es] & (FLAG_ACTIVE | FLAG_ENEMY)) !== (FLAG_ACTIVE | FLAG_ENEMY) || hp_[es] <= 0 || flashTimer_[es] > 0) continue;

                    let ex = x_[es] - bx;
                    let ey = y_[es] - by;
                    if (ex * ex + ey * ey > BEAM_HIT_RADIUS * BEAM_HIT_RADIUS) continue;

                    flashTimer_[es] = ENEMY_FLASH_DURATION;
                    hp_[es] -= dmg;
                    zzfxPlay(sfxEnemyAlert);
                    burstParticles(x_[es], y_[es], 0.55, 6, RAINBOW[i], 2.8, 0.25);

                    if (hp_[es] <= 0) {
                        burstParticles(x_[es], y_[es], 0.5, 12, 0xff0000ff, 4.0, 0.4);
                        burstParticles(x_[es], y_[es], 0.4, 6, RAINBOW[(i + 3) % 7], 2.5, 0.35);
                        zzfxPlay(sfxEnemyDeath);
                        entityRemove(ei);
                    }
                }
            }
        }

        // Unified trail particles
        let n = 14 + floor(charge * 10);
        for (let p = 0; p < n; p++) {
            let u = p / (n - 1 || 1);
            let x = px + dx * hitDist * u;
            let y = py + dy * hitDist * u;
            spawnBeamParticle(
                x, y,
                0.42 + (random() - 0.5) * 0.12,
                1.1 + random() * 0.9,
                RAINBOW[i],
                0.12 + random() * 0.10,
                dx * (0.9 + random() * 0.7) + (random() - 0.5) * 0.4,
                dy * (0.9 + random() * 0.7) + (random() - 0.5) * 0.4,
                (random() - 0.5) * 0.6
            );
        }

        // Fewer large core particles
        for (let p = 0; p < 3; p++) {
            let u = random() * 0.95;
            spawnBeamParticle(
                px + dx * hitDist * u,
                py + dy * hitDist * u,
                0.3,
                2.0 + random(),
                RAINBOW[i],
                0.38 + random() * 0.15,
                dx * 0.18,
                dy * 0.18,
                0
            );
        }

        // Light only on center ray
        if (i === 3) {
            for (let d = -1; d < hitDist; d += 1) {
                let mx = floor(px + dx * d);
                let my = floor(py + dy * d);
                if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) continue;
                for (let lx = mx - range; lx <= mx + range; lx++) {
                    for (let ly = my - range; ly <= my + range; ly++) {
                        if (lx < 0 || lx >= mapW || ly < 0 || ly >= mapH) continue;
                        let dist = sqrt((mx - lx) * (mx - lx) + (my - ly) * (my - ly));
                        let lightIdx = (ly * mapW + lx) * 3;
                        let rnd = randInt(0, 6);
                        lightMap[lightIdx] = max(lightMap[lightIdx], min(0.5 + charge, AMBIENT + max(0, RAINBOWf[rnd][0] - 0.3 * dist)));
                        lightMap[lightIdx + 1] = max(lightMap[lightIdx + 1], min(0.5 + charge, AMBIENT + max(0.2, RAINBOWf[rnd][1] - 0.3 * dist)));
                        lightMap[lightIdx + 2] = max(lightMap[lightIdx + 2], min(0.5 + charge, AMBIENT + max(0.2, RAINBOWf[rnd][2] - 0.3 * dist)));
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
    verticalBob_[slot] = random() * PI * 2;
    size_[slot] = 0.1 + random() * 0.75;
    flags_[slot] = FLAG_ACTIVE | FLAG_DUST_MOTE | FLAG_PARTICLE;
    data_[slot] = 20;
};

export let entitySpawnDust = (px: number, py: number, count = 220): void => {
    for (let i = 0; i < count; i++) {
        let id = entityAddParticle(px, py);
        respawnDustMote(activeParticles[id]);
    }
};

export let entityPlayerCollide = (px: number, py: number, playerRadius = 0.25, onDamage?: (activeIdx: number, dmg: number) => void): [number, number] => {
    for (let i = 0; i < activeCount; i++) {
        let s = active[i];
        if ((flags_[s] & (FLAG_ACTIVE | FLAG_DAMAGE)) !== (FLAG_ACTIVE | FLAG_DAMAGE)) continue;

        let er = (flags_[s] & FLAG_PROJECTILE) ? 0.15 : 0.4 * scale_[s];
        if (circleOverlap(px, py, playerRadius, x_[s], y_[s], er)) {
            if (onDamage) onDamage(i, damage_[s]);
            burstParticles(x_[s], y_[s], 0.4, 15, colour_[s], 2.0, 0.3);
            flags_[s] = 0;
        }
    }
    return [px, py];
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

let hasLineOfSight = (x0: number, y0: number, x1: number, y1: number): boolean => {
    let dx = x1 - x0;
    let dy = y1 - y0;
    let steps = floor(max(abs(dx), abs(dy)) * 2) + 1;
    if (steps < 1) return true;
    let inv = 1 / steps;
    for (let i = 1; i < steps; i++) {
        let t = i * inv;
        let mx = floor(x0 + dx * t);
        let my = floor(y0 + dy * t);
        if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) return false;
        if (mapData[my * mapW + mx] !== CELL_FLOOR) return false;
    }
    return true;
};

export let entityUpdate = (dt: number, px: number, py: number): void => {
    particleTime += dt;

    // Entity Pool
    for (let i = activeCount - 1; i >= 0; i--) {
        let s = active[i];
        if ((flags_[s] & FLAG_ACTIVE) === 0) {
            entityRemove(i);
            continue;
        }

        if (flags_[s] & (FLAG_ENEMY | FLAG_PROJECTILE)) {
            if (flags_[s] & FLAG_PROJECTILE && data_[s] > 0) {
                data_[s] -= dt;
                if (data_[s] <= 0) {
                    flags_[s] = 0;
                    entityRemove(i);
                    continue;
                }
            }

            if (flags_[s] & FLAG_ENEMY) {
                if (flashTimer_[s] > 0) flashTimer_[s] = max(0, flashTimer_[s] - dt);
                let doLight = false;
                let edx = px - x_[s];
                let edy = py - y_[s];
                let distSq = edx * edx + edy * edy;
                let dist = sqrt(distSq);
                let invDist = dist > 0.001 ? 1 / dist : 0;
                let ndx = edx * invDist;
                let ndy = edy * invDist;

                let typ = type_id_[s];
                let speed: number = MELEE_SPEED;
                let cooldown: number = MELEE_COOLDOWN;
                let attackRange: number = MELEE_ATTACK_RANGE;

                if (typ === ENEMY_TANK) {
                    speed = TANK_SPEED;
                    cooldown = TANK_COOLDOWN;
                } else if (typ === ENEMY_RANGED) {
                    speed = RANGED_SPEED;
                    cooldown = RANGED_COOLDOWN;
                    attackRange = RANGED_ATTACK_RANGE;
                }

                if (alert_[s] < 0) {
                    if (hasLineOfSight(x_[s], y_[s], px, py)) {
                        zzfxPlay(sfxEnemyAlert);
                        alert_[s] = NOTICE_DELAY_MIN + random() * (NOTICE_DELAY_MAX - NOTICE_DELAY_MIN);
                    } else {
                        if (random() < 0.01) {
                            let ang = random() * PI * 2;
                            preferX_[s] = cos(ang);
                            preferY_[s] = sin(ang);
                        }
                        vx_[s] = preferX_[s] * IDLE_WANDER_SPEED;
                        vy_[s] = preferY_[s] * IDLE_WANDER_SPEED;
                    }
                } else if (alert_[s] > 0) {
                    alert_[s] -= dt;
                    if (alert_[s] <= 0) alert_[s] = 0;
                    vx_[s] = ndx * speed * 0.25;
                    vy_[s] = ndy * speed * 0.25;
                }

                if (typ < ENEMY_BOSS_BULLET && alert_[s] === 0) {
                    doLight = true;
                    if (lastAttackTime_[s] > 0) lastAttackTime_[s] -= dt;

                    if (typ === ENEMY_RANGED) {
                        if (dist > RANGED_MAX_DIST) {
                            vx_[s] = ndx * speed;
                            vy_[s] = ndy * speed;
                        } else {
                            vx_[s] = vx_[s] * 0.85 - ndy * 0.35;
                            vy_[s] = vy_[s] * 0.85 + ndx * 0.35;
                        }
                    } else {
                        vx_[s] = dist > 0.75 ? ndx * speed : 0;
                        vy_[s] = dist > 0.75 ? ndy * speed : 0;
                    }

                    if (dist <= attackRange && lastAttackTime_[s] <= 0) {
                        lastAttackTime_[s] = cooldown;
                        if (typ === ENEMY_RANGED) {
                            zzfxPlay(sfxEnemyRanged);
                            spawnProjectile(x_[s], y_[s], edx, edy, damage_[s], 0xff2222ff);
                        } else {
                            zzfxPlay(sfxEnemyMelee);
                            spawnPseudoMelee(px, py, damage_[s]);
                        }
                    }
                }

                if (typ >= ENEMY_BOSS_BULLET) {
                    doLight = true;
                    if (typ === ENEMY_BOSS_BULLET) {
                        // stay near home
                        let hx = preferX_[s] - x_[s];
                        let hy = preferY_[s] - y_[s];
                        vx_[s] = hx * 0.6;
                        vy_[s] = hy * 0.6;

                        data_[s] -= dt;
                        if (data_[s] <= 0) {
                            // fire radial wave
                            let base = phase_[s];
                            for (let a = 0; a < PI * 2; a += PI / 12) {   // 15°
                                let ang = base + a;
                                spawnProjectile(x_[s], y_[s], cos(ang), sin(ang), damage_[s], 0xff000088);
                            }
                            phase_[s] += 0.18;          // slight rotate next volley
                            data_[s] = 1.1 + random() * 0.3;  // pause
                        }
                    }
                    else if (typ === ENEMY_BOSS_BROOD) {
                        if (dist < 5.5) {
                            vx_[s] = -ndx * RANGED_SPEED * 0.9;
                            vy_[s] = -ndy * RANGED_SPEED * 0.9;
                        } else {
                            vx_[s] *= 0.9; vy_[s] *= 0.9;
                        }

                        data_[s] -= dt;
                        if (data_[s] <= 0 && activeCount < MAX_ENTITIES - 40) {
                            let ang = random() * PI * 2;
                            entityAdd(x_[s] + cos(ang) * 1.2, y_[s] + sin(ang) * 1.2, 1, 0.75, FLAG_ACTIVE | FLAG_ENEMY | FLAG_SOLID, 0xffaaffcc, 0.5, ENEMY_MELEE);
                            data_[s] = 2.8 + random() * 1.2;
                        }
                    }
                    else if (typ === ENEMY_BOSS_CHARGE) {
                        // state machine on phase_ (0=idle/circle, 1=windup, 2=dash, 3=recover)
                        if (phase_[s] === 0) {
                            // circle or face
                            vx_[s] = -ndy * TANK_SPEED * 0.7 + ndx * 0.15;
                            vy_[s] = ndx * TANK_SPEED * 0.7 + ndy * 0.15;
                            data_[s] -= dt;
                            if (data_[s] <= 0) {
                                phase_[s] = 1;
                                data_[s] = 0.55;           // wind-up
                                // optional telegraph particles
                            }
                        } else if (phase_[s] === 1) {
                            vx_[s] = vy_[s] = 0;
                            data_[s] -= dt;
                            if (data_[s] <= 0) {
                                phase_[s] = 2;
                                data_[s] = 0.85;           // dash duration
                                // lock direction
                                preferX_[s] = ndx;
                                preferY_[s] = ndy;
                            }
                        } else if (phase_[s] === 2) {
                            vx_[s] = preferX_[s] * 3.2;
                            vy_[s] = preferY_[s] * 3.2;
                            data_[s] -= dt;
                            // on wall hit or timer → recover
                            if (data_[s] <= 0) {
                                phase_[s] = 3;
                                data_[s] = 1.4;
                            }
                        } else { // recover
                            vx_[s] *= 0.85; vy_[s] *= 0.85;
                            data_[s] -= dt;
                            if (data_[s] <= 0) {
                                phase_[s] = 0;
                                data_[s] = 2.0 + random();
                            }
                        }
                    }
                }

                applySeparation(s);

                let mdx = vx_[s] * dt;
                let mdy = vy_[s] * dt;
                [x_[s], y_[s]] = rayMove(x_[s], y_[s], mdx, mdy, 0.2);

                if (doLight) {
                    let lidx = (floor(y_[s]) * mapW + floor(x_[s])) * 3;
                    lightMap[lidx] = min(LIGHT_LEVEL_CAP, lightMap[lidx] + 0.01);
                }
                continue;
            }

            let mdx = vx_[s] * dt;
            let mdy = vy_[s] * dt;
            let nx = x_[s] + mdx;
            let ny = y_[s] + mdy;
            if (mapData[floor(ny) * mapW + floor(nx)] === CELL_FLOOR) {
                x_[s] = nx;
                y_[s] = ny;
            } else {
                burstParticles(x_[s], y_[s], 0.4, 15, colour_[s], 2.0, 0.3);
                entityRemove(i);
                continue;
            }

            let lidx = (floor(y_[s]) * mapW + floor(x_[s])) * 3;
            lightMap[lidx] = min(LIGHT_LEVEL_CAP, lightMap[lidx] + 0.01);
        }
    }

    // Particle Pool
    for (let i = activeParticleCount - 1; i >= 0; i--) {
        let s = activeParticles[i];
        data_[s] -= dt;

        if (flags_[s] & FLAG_DUST_MOTE) {
            let dx = x_[s] - px;
            let dy = y_[s] - py;
            let distSq = dx * dx + dy * dy;

            if (distSq > MAX_PARTICLE_DIST_SQ * 2.5) {
                respawnDustMote(s);
                continue;
            }

            vx_[s] += (preferX_[s] * DRIFT_SPEED - vx_[s]) * STEER_STRENGTH * dt;
            vy_[s] += (preferY_[s] * DRIFT_SPEED - vy_[s]) * STEER_STRENGTH * dt;

            if (random() < 0.003) {
                let ang = random() * PI * 2;
                preferX_[s] = cos(ang);
                preferY_[s] = sin(ang);
            }

            let drive1 = sin(particleTime * 0.85 + verticalBob_[s]) * 0.22;
            let drive2 = cos(particleTime * 1.35 + verticalBob_[s] * 0.7) * 0.18;
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
                entityRemoveParticle(i);
            }
            continue;
        }

        verticalBob_[s] += dt * (1.2 + size_[s] * 0.4);
    }
};

let collectEntities = (px: number, py: number, angle: number, arr: Int32Array, count: number) => {
    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (let i = 0; i < count; i++) {
        let s = arr[i];
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

        visIdx_[visibleCount] = s;
        visDist_[visibleCount] = transformY;
        visScreenX_[visibleCount] = screenX;
        visHeight_[visibleCount] = height;
        visibleCount++;
    }
};

export let entityCollect = (px: number, py: number, angle: number): void => {
    visibleCount = 0;

    collectEntities(px, py, angle, active, activeCount);
    collectEntities(px, py, angle, activeParticles, activeParticleCount);

    // Sort
    for (let i = 1; i < visibleCount; i++) {
        let tIdx = visIdx_[i];
        let tDist = visDist_[i];
        let tSX = visScreenX_[i];
        let tH = visHeight_[i];

        let j = i - 1;
        while (j >= 0 && visDist_[j] < tDist) {
            visIdx_[j + 1] = visIdx_[j];
            visDist_[j + 1] = visDist_[j];
            visScreenX_[j + 1] = visScreenX_[j];
            visHeight_[j + 1] = visHeight_[j];
            j--;
        }
        visIdx_[j + 1] = tIdx;
        visDist_[j + 1] = tDist;
        visScreenX_[j + 1] = tSX;
        visHeight_[j + 1] = tH;
    }
};

export let entityDraw = (px: number, py: number, angle: number, now: number): void => {
    for (let i = 0; i < visibleCount; i++) {
        let s = visIdx_[i];
        if ((flags_[s] & FLAG_ACTIVE) === 0) continue;

        let cellX = floor(x_[s]);
        let cellY = floor(y_[s]);
        let dist = visDist_[i];
        let screenX = visScreenX_[i];
        let height = visHeight_[i];
        let lightIdx = (cellY * mapW + cellX) * 3;
        let lightR = lightMap[lightIdx];
        let lightG = lightMap[lightIdx + 1];
        let lightB = lightMap[lightIdx + 2];
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
            let lit = modulateABGR(col, lightR, lightG, lightB);

            glPushColorCircle(screenX - moteH * 0.5, drawY, moteH, lit);
            continue;
        }

        let tex = TEXTURE_CACHE[texId_[s]];
        assert(tex !== undefined, `missing texture from texture cache. id: ${texId_[s]}`);

        let flashColour = (flashTimer_[s] > 0) ? 0x00ffffff : colour_[s];
        let litColour = modulateABGR(flashColour, lightR, lightG, lightB);

        let halfW = height * 0.5;
        let drawStartX = screenX - halfW;
        let drawEndX = screenX + halfW;
        let bob = sin(now * 3 + verticalBob_[s]) * (height * 0.04);
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

export let spawnEnemiesInRoom = (rx: number, ry: number, rw: number, rh: number, texId: number = 1): void => {
    let count = 1 + floor(random() * 3);

    for (let i = 0; i < count; i++) {
        let sx = randInt(rx + 1, rx + rw - 2) + 0.5;
        let sy = randInt(ry + 1, ry + rh - 2) + 0.5;

        let r = random();
        let typ: number = ENEMY_MELEE;
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

        entityAdd(sx, sy, texId, scl, FLAG_ACTIVE | FLAG_ENEMY | FLAG_SOLID, col, 0.5, typ);
    }
};
