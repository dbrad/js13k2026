import { assert } from "./__debug/debug";
import { entityAddBoss } from "./entity";
import { floor, max, min, randInt, random } from "./math";

export let mapW = 0;
export let mapH = 0;
export let mapSize = 0;
export let mapData: Int32Array;
export let mapOffsetData: Float32Array;

export let doorAnimT: Float32Array;
export let doorAnimActive: Int32Array;

export let lightMap: Float32Array;
export let lightCalculated: Int32Array;
export let LIGHT_DECAY = 6.5;
export let LIGHT_LEVEL_CAP = 2;

export let AMBIENT = 0.15;
export let PLAYER_TORCH_INTENSITY = 1.0; // TODO: move into gamestate?
export let updatePlayerTorch = (charging: boolean) => {
    PLAYER_TORCH_INTENSITY = charging ? 1.2 : 0.9;
};

type Room = { id_: number; type_: number; x_: number; y_: number; w_: number; h_: number; n_: number[]; };
export let rooms: Room[] = [];

export let generateDungeon = (width: number, height: number): [number, number] => {
    mapW = width;
    mapH = height;
    mapSize = width * height;

    lightMap = new Float32Array(mapSize * 3).fill(AMBIENT);
    lightCalculated = new Int32Array(mapSize);
    mapData = new Int32Array(mapSize).fill(CELL_WALL);
    mapOffsetData = new Float32Array(mapSize);
    doorAnimT = new Float32Array(width * width);
    doorAnimActive = new Int32Array(width * width);
    rooms = [];

    let addRoom = (x: number, y: number, w: number, h: number, parent: number, dir: number): number => {
        for (let ry = y + 1; ry <= y + h - 2; ry++)
            for (let rx = x + 1; rx <= x + w - 2; rx++)
                mapData[ry * width + rx] = CELL_FLOOR;
        let r: Room = { id_: rooms.length, type_: ROOM_TYPE_NORMAL, x_: x + 1, y_: y + 1, w_: w - 2, h_: h - 2, n_: [WALL_FREE, WALL_FREE, WALL_FREE, WALL_FREE] };
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

    let addDoor = (a: number, b: number, wall: number, type = 0) => {
        if (type === 1) {
            let r = rooms[a], x = randInt(r.x_ + 1, r.x_ + r.w_ - 2);
            mapData[(r.y_ - 1) * mapW + x] = CELL_HORIZONTAL_DOOR;
            mapData[(r.y_ - 2) * mapW + x] = CELL_EXIT;
        } else {
            let r1 = rooms[a], r2 = rooms[b], x = 0, y = 0;
            if (wall === WALL_NORTH || wall === WALL_SOUTH) {
                x = max(0, randInt(max(r1.x_, r2.x_), min(r1.x_ + r1.w_ - 1, r2.x_ + r2.w_ - 1)));
                y = max(0, wall === WALL_NORTH ? r1.y_ - 1 : r1.y_ + r1.h_);
                mapData[y * mapW + x] = CELL_HORIZONTAL_DOOR;
            } else {
                x = max(0, wall === WALL_WEST ? r1.x_ - 1 : r1.x_ + r1.w_);
                y = max(0, randInt(max(r1.y_, r2.y_), min(r1.y_ + r1.h_ - 1, r2.y_ + r2.h_ - 1)));
                mapData[y * mapW + x] = CELL_VERTICAL_DOOR;
            }
        }
    };

    let i = addRoom(2, 2, 12, 12, -1, -1);
    addDoor(i, -1, random() > .5 ? WALL_NORTH : WALL_WEST, 1);
    let bossRoom = rooms[i];
    bossRoom.type_ = ROOM_TYPE_BOSS;
    bossRoom.n_[WALL_NORTH] = bossRoom.n_[WALL_WEST] = bossRoom.n_[WALL_EAST] = WALL_MAP_BLOCKED;
    entityAddBoss(bossRoom.x_ + floor(bossRoom.w_ / 2) + 0.5, bossRoom.y_ + floor(bossRoom.h_ / 2) + 0.5, ENEMY_BOSS_BULLET);

    let parent: Room | null = bossRoom;
    while (parent) {
        let wall = -1;
        for (let w = 0; w < 4; w++) if (parent.n_[w] === WALL_FREE) { wall = w; break; }
        if (wall > -1) {
            let w = 5, h = 5, x = 0, y = 0, maxW = randInt(8, 14), maxH = randInt(8, 14);
            if (wall === WALL_NORTH || wall === WALL_SOUTH) {
                x = max(0, randInt(parent.x_ - 3, parent.x_ + parent.w_ - 3));
                y = max(0, wall === WALL_NORTH ? parent.y_ - h : parent.y_ + parent.h_);
            } else {
                x = max(0, wall === WALL_WEST ? parent.x_ - w : parent.x_ + parent.w_);
                y = max(0, randInt(parent.y_ - 3, parent.y_ + parent.h_ - 3));
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
                if (random() < .5) {
                    if (wall === WALL_WEST) testX++;
                    testW++;
                } else {
                    if (wall === WALL_NORTH) testY++;
                    testH++;
                }
            }
            if (w === 5 && h === 5 && testW === 5 && testH === 5) {
                parent.n_[wall] = WALL_BLOCKED;
                continue;
            }
            let nid = addRoom(x, y, w, h, parent.id_, wall);
            addDoor(parent.id_, nid, wall);
        }
        parent = null;
        for (let ri = 0; ri < rooms.length; ri++) {
            let n = rooms[ri].n_;
            if (n[WALL_NORTH] === WALL_FREE || n[WALL_EAST] === WALL_FREE || n[WALL_SOUTH] === WALL_FREE || n[WALL_WEST] === WALL_FREE) {
                parent = rooms[ri];
                break;
            }
        }
    }

    for (let my = 0; my < mapH - 5; my++)
        for (let mx = 0; mx < mapW - 5; mx++) {
            let ok = 1;
            o: for (let ry = my; ry < my + 5; ry++)
                for (let rx = mx; rx < mx + 5; rx++)
                    if (mapData[ry * mapW + rx] !== CELL_WALL) { ok = 0; break o; }
            if (ok) {
                let sid = addRoom(mx, my, 5, 5, -1, -1);
                rooms[sid].type_ = ROOM_TYPE_SECRET;
                if (my > 0 && mapData[(my - 1) * mapW + mx + 2] === CELL_FLOOR) mapData[my * mapW + mx + 2] = CELL_CRACKED;
                if (my + 5 < mapH && mapData[(my + 5) * mapW + mx + 2] === CELL_FLOOR) mapData[(my + 4) * mapW + mx + 2] = CELL_CRACKED;
                if (mx > 0 && mapData[(my + 2) * mapW + mx - 1] === CELL_FLOOR) mapData[(my + 2) * mapW + mx] = CELL_CRACKED;
                if (mx + 5 < mapW && mapData[(my + 2) * mapW + mx + 5] === CELL_FLOOR) mapData[(my + 2) * mapW + mx + 4] = CELL_CRACKED;
                mx += 4;
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


    return [bossRoom.x_ + bossRoom.w_ / 2, bossRoom.y_ + bossRoom.h_ / 2];

    // return [rooms[best].x_ + rooms[best].w_ / 2, rooms[best].y_ + rooms[best].h_ / 2];
};