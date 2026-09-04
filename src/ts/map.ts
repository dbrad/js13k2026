import { assert } from "./__debug/debug";
import { entityAdd, entityAddBoss, entityAddHealthPack, entitySpawnDust, spawnEnemiesInRoom } from "./entity";
import { gameState } from "./gameState";
import { glPushColorQuad } from "./gl";
import { floor, max, min, PI, srand, srandInt, srandSeed, srandShuffle } from "./math";

export let mapW = 0;
export let mapH = 0;
export let mapSize = 0;
export let mapData: Int32Array;
export let mapOffsetData: Float32Array;
export let minimapData: Int32Array;
export let viewData: Int32Array;

export let doorAnimT: Float32Array;
export let doorAnimActive: Int32Array;

export let lightMap: Float32Array;
export let lightCalculated: Int32Array;

export let AMBIENT = 0.1;
export let PLAYER_TORCH_INTENSITY = 0.9;
export let updatePlayerTorch = (charging: boolean) => {
    PLAYER_TORCH_INTENSITY = charging ? 1 : 0.9;
};

type Room = { id_: number; type_: number; enemyCount_: number, x_: number; y_: number; w_: number; h_: number; n_: number[]; };
export let rooms: Room[] = [];
export let exitDoorIdx: number = -1;
export let bossDoorIdx: number = -1;
let bossBag = [ENEMY_BOSS_BULLET, ENEMY_BOSS_BROOD, ENEMY_BOSS_CHARGE];

export let updateLight = (cellIdx: number, r: number = 0, g: number = 0, b: number = 0) => {
    lightMap[cellIdx] = min(LIGHT_LEVEL_CAP, max(lightMap[cellIdx], lightMap[cellIdx] + r));
    lightMap[cellIdx + 1] = min(LIGHT_LEVEL_CAP, max(lightMap[cellIdx + 1], lightMap[cellIdx + 1] + g));
    lightMap[cellIdx + 2] = min(LIGHT_LEVEL_CAP, max(lightMap[cellIdx + 2], lightMap[cellIdx + 2] + b));
};

export let decayLight = (cellIdx: number, desiredValue: number, dt: number) => {
    lightMap[cellIdx] += (desiredValue - lightMap[cellIdx]) * min(LIGHT_LEVEL_CAP, LIGHT_DECAY * dt);
    lightMap[cellIdx + 1] += (desiredValue - lightMap[cellIdx + 1]) * min(LIGHT_LEVEL_CAP, LIGHT_DECAY * dt);
    lightMap[cellIdx + 2] += (desiredValue - lightMap[cellIdx + 2]) * min(LIGHT_LEVEL_CAP, LIGHT_DECAY * dt);
};

export let initMap = () => {
    mapW = 50;
    mapH = 50;
    mapSize = 50 * 50;

    lightMap = new Float32Array(mapSize * 3).fill(AMBIENT);
    lightCalculated = new Int32Array(mapSize);
    mapData = new Int32Array(mapSize).fill(CELL_WALL);
    minimapData = new Int32Array(mapSize).fill(-1);
    viewData = new Int32Array(mapSize).fill(-1);
    mapOffsetData = new Float32Array(mapSize);
    doorAnimT = new Float32Array(mapSize);
    doorAnimActive = new Int32Array(mapSize);
};

export let generateDungeon = () => {
    srandSeed(gameState[GS_SEED]);
    if (gameState[GS_LEVEL] === 0)
        bossBag = srandShuffle(bossBag);

    PLAYER_TORCH_INTENSITY = 0.9;
    mapData.fill(CELL_WALL);
    minimapData.fill(-1);
    mapOffsetData.fill(0);
    doorAnimT.fill(0);
    doorAnimActive.fill(0);
    rooms = [];

    let addRoom = (x: number, y: number, w: number, h: number, parent: number, dir: number): number => {
        for (let ry = y + 1; ry <= y + h - 2; ry++)
            for (let rx = x + 1; rx <= x + w - 2; rx++)
                mapData[ry * mapW + rx] = CELL_FLOOR;
        let r: Room = { id_: rooms.length, type_: ROOM_TYPE_NORMAL, enemyCount_: 0, x_: x + 1, y_: y + 1, w_: w - 2, h_: h - 2, n_: [WALL_FREE, WALL_FREE, WALL_FREE, WALL_FREE] };
        if (x < 4) r.n_[WALL_WEST] = WALL_MAP_BLOCKED;
        if (y < 4) r.n_[WALL_NORTH] = WALL_MAP_BLOCKED;
        if (x + w >= 46) r.n_[WALL_EAST] = WALL_MAP_BLOCKED;
        if (y + h >= 46) r.n_[WALL_SOUTH] = WALL_MAP_BLOCKED;
        rooms.push(r);
        if (parent > -1) {
            r.n_[(dir + 2) % 4] = parent;
            rooms[parent].n_[dir] = r.id_;
        }
        return r.id_;
    };

    let addDoor = (roomA: number, roomB: number, wall: number, type = 0) => {
        if (type === 1) {
            let r = rooms[roomA],
                x = r.x_ + floor(r.w_ * 0.5),
                y = wall === WALL_NORTH ? r.y_ - 1 : r.y_ + r.h_,
                dy = wall === WALL_NORTH ? -1 : 1;
            exitDoorIdx = y * mapW + x;
            mapData[y * mapW + x] = CELL_LOCKED_H;
            mapData[(y + dy) * mapW + x] = CELL_EXIT;
            mapData[(y + 2 * dy) * mapW + x] = CELL_EXIT;
            mapData[(y + dy) * mapW + x - 1] = CELL_EXIT;
            mapData[(y + dy) * mapW + x + 1] = CELL_EXIT;
        } else {
            let r1 = rooms[roomA], r2 = rooms[roomB], x = 0, y = 0;
            if (wall === WALL_NORTH || wall === WALL_SOUTH) {
                x = max(0, srandInt(max(r1.x_, r2.x_), min(r1.x_ + r1.w_ - 1, r2.x_ + r2.w_ - 1)));
                y = max(0, wall === WALL_NORTH ? r1.y_ - 1 : r1.y_ + r1.h_);
                mapData[y * mapW + x] = CELL_HORIZONTAL_DOOR;
            } else {
                x = max(0, wall === WALL_WEST ? r1.x_ - 1 : r1.x_ + r1.w_);
                y = max(0, srandInt(max(r1.y_, r2.y_), min(r1.y_ + r1.h_ - 1, r2.y_ + r2.h_ - 1)));
                mapData[y * mapW + x] = CELL_VERTICAL_DOOR;
            }
            if (roomA === 0) {
                bossDoorIdx = y * mapW + x;
                mapData[y * mapW + x] = CELL_BOSS_DOOR;
            }
        }
    };

    let c = srandInt(0, 3),
        i = addRoom(c & 1 ? 36 : 2, c > 1 ? 36 : 2, 12, 12, -1, -1),
        bossRoom = rooms[i],
        exitW = c > 1 ? WALL_SOUTH : WALL_NORTH;

    addDoor(i, -1, exitW, 1);
    bossRoom.type_ = ROOM_TYPE_BOSS;
    bossRoom.n_[exitW] = bossRoom.n_[WALL_WEST] = bossRoom.n_[WALL_EAST] = WALL_MAP_BLOCKED;
    bossRoom.enemyCount_ = 1;
    entityAddBoss(bossRoom.x_ + floor(bossRoom.w_ / 2) + 0.5, bossRoom.y_ + floor(bossRoom.h_ / 2) + 0.5, bossBag[gameState[GS_LEVEL]]);

    let parentRoom: Room | null = bossRoom;
    while (parentRoom) {
        let wall = -1;
        for (let w = 0; w < 4; w++) if (parentRoom.n_[w] === WALL_FREE) { wall = w; break; }
        if (wall > -1) {
            let w = 5, h = 5, x = 0, y = 0, maxW = srandInt(8, 14), maxH = srandInt(8, 14);
            if (wall === WALL_NORTH || wall === WALL_SOUTH) {
                x = max(0, srandInt(parentRoom.x_ - 3, parentRoom.x_ + parentRoom.w_ - 3));
                y = max(0, wall === WALL_NORTH ? parentRoom.y_ - h : parentRoom.y_ + parentRoom.h_);
            } else {
                x = max(0, wall === WALL_WEST ? parentRoom.x_ - w : parentRoom.x_ + parentRoom.w_);
                y = max(0, srandInt(parentRoom.y_ - 3, parentRoom.y_ + parentRoom.h_ - 3));
            }
            let testX = x, testY = y, testW = w, testH = h;
            for (; ;) {
                let overlap = 0;
                for (let ri = 0; ri < rooms.length; ri++) {
                    let o = rooms[ri];
                    if (max(testX, o.x_) < min(testX + testW, o.x_ + o.w_) && max(testY, o.y_) < min(testY + testH, o.y_ + o.h_)) {
                        overlap = 1;
                        break;
                    }
                }
                if (overlap || w >= maxW || h >= maxH || x < 0 || y < 0 || x + w >= mapW || y + h >= mapH) break;
                w = testW; h = testH; x = testX; y = testY;
                if (srand() < .5) {
                    if (wall === WALL_WEST) testX++;
                    testW++;
                } else {
                    if (wall === WALL_NORTH) testY++;
                    testH++;
                }
            }
            if (w === 5 && h === 5 && testW === 5 && testH === 5) {
                parentRoom.n_[wall] = WALL_BLOCKED;
                continue;
            }
            let nid = addRoom(x, y, w, h, parentRoom.id_, wall);
            addDoor(parentRoom.id_, nid, wall);
        }
        parentRoom = null;
        for (let ri = 0; ri < rooms.length; ri++) {
            let n = rooms[ri].n_;
            if (n[WALL_NORTH] === WALL_FREE || n[WALL_EAST] === WALL_FREE || n[WALL_SOUTH] === WALL_FREE || n[WALL_WEST] === WALL_FREE) {
                parentRoom = rooms[ri];
                break;
            }
        }
    }

    for (let my = 0; my < mapH - 5; my++) {
        for (let mx = 0; mx < mapW - 5; mx++) {
            let ok = 1;
            o: for (let ry = my; ry < my + 5; ry++)
                for (let rx = mx; rx < mx + 5; rx++)
                    if (mapData[ry * mapW + rx] !== CELL_WALL) { ok = 0; break o; }
            if (ok) {
                let sid = addRoom(mx, my, 5, 5, -1, -1);
                rooms[sid].type_ = ROOM_TYPE_SECRET;
                entityAddHealthPack(mx + 5 * 0.5, my + 5 * 0.5);
                if (my > 0 && mapData[(my - 1) * mapW + mx + 2] === CELL_FLOOR) mapData[my * mapW + mx + 2] = CELL_CRACKED;
                if (my + 5 < mapH && mapData[(my + 5) * mapW + mx + 2] === CELL_FLOOR) mapData[(my + 4) * mapW + mx + 2] = CELL_CRACKED;
                if (mx > 0 && mapData[(my + 2) * mapW + mx - 1] === CELL_FLOOR) mapData[(my + 2) * mapW + mx] = CELL_CRACKED;
                if (mx + 5 < mapW && mapData[(my + 2) * mapW + mx + 5] === CELL_FLOOR) mapData[(my + 2) * mapW + mx + 4] = CELL_CRACKED;
                mx += 4;
            }
        }
    }

    let best = -1, maxD = -1, boss = rooms[0], bx = boss.x_ + boss.w_ / 2, by = boss.y_ + boss.h_ / 2;
    for (let i = 0; i < rooms.length; i++) {
        let r = rooms[i];
        if (r.type_ === ROOM_TYPE_NORMAL) {
            let d = (r.x_ + r.w_ / 2 - bx) ** 2 + (r.y_ + r.h_ / 2 - by) ** 2;
            if (d > maxD) { maxD = d; best = i; }
        }
    }
    assert(best !== -1, "somehow no room to spawn player in");
    rooms[best].type_ = ROOM_TYPE_PLAYER;

    let enemyPool = rooms.length * 2;
    let healthPackPool = 20;
    for (let i = 1; i < rooms.length; i++) {
        let r = rooms[i];
        if (r.type_ === ROOM_TYPE_NORMAL) {
            if (enemyPool > 0) { enemyPool -= spawnEnemiesInRoom(i, r.x_, r.y_, r.w_, r.h_); }
            if (srand() > 0.66 && healthPackPool > 0) { healthPackPool--; entityAddHealthPack(floor(r.x_ + r.w_ * 0.5) + 0.5, floor(r.y_ + r.h_ * 0.5) + 0.5); }

        }
    }

    entitySpawnDust(gameState[GS_PLAYER_X], gameState[GS_PLAYER_Y], 220);

    gameState[GS_PLAYER_X] = rooms[best].x_ + rooms[best].w_ / 2;
    gameState[GS_PLAYER_Y] = rooms[best].y_ + rooms[best].h_ - 0.5;
    gameState[GS_PLAYER_ANGLE] = -PI * 0.5;
};

export let createMainMenuScene = () => {
    mapData.fill(CELL_WALL);
    for (let y = 1; y < 6; y++) {
        for (let x = 1; x < 5; x++) {
            mapData[y * mapW + x] = CELL_FLOOR;
        }
    }

    entityAdd(3, 4, TEXTURE_DEMON_LARGE, 1, FLAG_ACTIVE | FLAG_SOLID, 0xffffffff, 0.5, ENEMY_MELEE);
    entitySpawnDust(gameState[GS_PLAYER_X], gameState[GS_PLAYER_Y], 20);

    PLAYER_TORCH_INTENSITY = 0.75;
    gameState[GS_PLAYER_X] = 1.5;
    gameState[GS_PLAYER_Y] = 3.5;
    gameState[GS_PLAYER_ANGLE] = 0;
};

export let renderMap = (px: number, py: number) => {
    glPushColorQuad(15, 15, SCREEN_WIDTH - 30, SCREEN_HEIGHT - 30, 0x66000000);
    for (let x = 0; x < mapW; x++) {
        for (let y = 0; y < mapH; y++) {
            let idx = y * mapW + x;
            let col = 0x00000000;
            let vcol = 0x00000000;
            if (viewData[idx] > 0) {
                vcol = 0x33ffffff;
            }
            if (minimapData[idx] < 0) {
            } else if (minimapData[idx] === CELL_BOSS_DOOR) {
                col = 0xff0000ff;
            } else if (minimapData[idx] === CELL_WALL || minimapData[idx] === CELL_CRACKED) {
                col = 0xff666666;
            } else if (minimapData[idx] === CELL_FLOOR) {
                col = 0xff333333;
            } else if (minimapData[idx] === CELL_HORIZONTAL_DOOR || minimapData[idx] === CELL_VERTICAL_DOOR) {
                col = 0xff00ffff;
            } else if (minimapData[idx] === CELL_LOCKED_H) {
                col = 0xff00ff00;
            }
            if (px >= x && px < x + 1 && py >= y && py < y + 1) {
                col = 0xffffffff;
            }
            if (col > 0) {
                glPushColorQuad(170 + x * 6, 30 + y * 6, 6, 6, col);
                if (vcol > 0) glPushColorQuad(170 + x * 6, 30 + y * 6, 6, 6, vcol);
            }
        }
    }
};