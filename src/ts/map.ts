import { max, min, randInt, random } from "./math";

export let mapW = 0;
export let mapH = 0;
export let mapData: Int8Array;
export let mapOffsetData: Float32Array;

export let lightMap: Float32Array;
export let lightCalculated: Int8Array;
export let LIGHT_DECAY = 6.5;
export let LIGHT_CAP = 2;

export let AMBIENT = 0.15;
export let PLAYER_TORCH_INTENSITY = 1.0;
export let updatePlayerTorch = (charging: boolean) => {
    PLAYER_TORCH_INTENSITY = charging ? 1.3 : 1;
};

type Room = { id_: number; type_: number, x_: number; y_: number; w_: number; h_: number; n_: number[]; };
export let rooms: Room[] = [];

export let generateDungeon = (width: number, height: number): [number, number] => {
    mapW = width;
    mapH = height;
    lightMap = new Float32Array(width * height).fill(AMBIENT);
    lightCalculated = new Int8Array(width * height);
    mapData = new Int8Array(width * height).fill(CELL_WALL);
    mapOffsetData = new Float32Array(width * height);
    rooms = [];

    let startX = 2, startY = 2;
    let addRoom = (x: number, y: number, w: number, h: number, parent: number, dir: number): number => {
        for (let ry = y + 1; ry <= y + (h - 2); ry++)
            for (let rx = x + 1; rx <= x + (w - 2); rx++)
                mapData[ry * width + rx] = CELL_FLOOR;
        let newRoom: Room = { id_: rooms.length, type_: ROOM_TYPE_NORMAL, x_: x + 1, y_: y + 1, w_: w - 2, h_: h - 2, n_: [WALL_FREE, WALL_FREE, WALL_FREE, WALL_FREE] };
        if (x < 4) newRoom.n_[WALL_WEST] = WALL_MAP_BLOCKED;
        if (y < 4) newRoom.n_[WALL_NORTH] = WALL_MAP_BLOCKED;
        if (x + w >= 46) newRoom.n_[WALL_EAST] = WALL_MAP_BLOCKED;
        if (y + h >= 46) newRoom.n_[WALL_SOUTH] = WALL_MAP_BLOCKED;
        rooms.push(newRoom);
        if (parent > -1) {
            newRoom.n_[(dir + 2) % 4] = parent;
            rooms[parent].n_[dir] = newRoom.id_;
        }
        return newRoom.id_;
    };

    let addDoor = (room1Id: number, room2Id: number, wall: number, type: number = 0) => {
        if (type === 1) {
            let room = rooms[room1Id];
            let x = randInt(room.x_ + 1, room.x_ + (room.w_ - 2));
            mapData[(room.y_ - 1) * mapW + x] = CELL_HORIZONTAL_DOOR;
            mapData[(room.y_ - 2) * mapW + x] = CELL_EXIT;
        } else {
            let room1 = rooms[room1Id];
            let room2 = rooms[room2Id];
            let x = 0;
            let y = 0;
            switch (wall) {
                case WALL_NORTH:
                case WALL_SOUTH:
                    x = max(0, randInt(max(room1.x_, room2.x_), min(room1.x_ + room1.w_ - 1, room2.x_ + room2.w_ - 1)));
                    y = max(0, wall === WALL_NORTH ? room1.y_ - 1 : room1.y_ + room1.h_);
                    mapData[y * mapW + x] = CELL_HORIZONTAL_DOOR;
                    break;
                case WALL_WEST:
                case WALL_EAST:
                    x = max(0, wall === WALL_WEST ? room1.x_ - 1 : room1.x_ + room1.w_);
                    y = max(0, randInt(max(room1.y_, room2.y_), min(room1.y_ + (room1.h_ - 1), room2.y_ + (room2.h_ - 1))));
                    mapData[y * mapW + x] = CELL_VERTICAL_DOOR;
                    break;
            }
        }
    };

    let getOverlap = (nx: number, ny: number, nw: number, nh: number, oldRoom: Room): boolean => {
        let x = Math.max(nx, oldRoom.x_);
        let y = Math.max(ny, oldRoom.y_);
        let w = Math.min(nx + nw, oldRoom.x_ + oldRoom.w_) - x;
        let h = Math.min(ny + nh, oldRoom.y_ + oldRoom.h_) - y;

        return w > 0 && h > 0;
    };

    let i = addRoom(startX, startY, 12, 12, -1, -1);
    addDoor(i, -1, random() > 0.5 ? WALL_NORTH : WALL_WEST, 1);
    rooms[i].type_ = ROOM_TYPE_BOSS;
    rooms[i].n_[WALL_NORTH] = WALL_MAP_BLOCKED;
    rooms[i].n_[WALL_WEST] = WALL_MAP_BLOCKED;

    let parentRoom: Room | null = rooms[i];
    while (parentRoom) {
        let wall = -1;
        for (let w = 0; w < 4; w++) {
            if (parentRoom.n_[w] === WALL_FREE) {
                wall = w;
                break;
            }
        }
        if (wall > -1) {
            let w = 5;
            let h = 5;
            let testW = w;
            let testH = h;
            let x: number = 0, y: number = 0;
            let maxW = randInt(8, 14);
            let maxH = randInt(8, 14);
            switch (wall) {
                case WALL_NORTH:
                case WALL_SOUTH:
                    x = max(0, randInt(parentRoom.x_ - (w - 2), parentRoom.x_ + (parentRoom.w_ - 3)));
                    y = max(0, wall === WALL_NORTH ? parentRoom.y_ - h : parentRoom.y_ + parentRoom.h_);
                    break;
                case WALL_WEST:
                case WALL_EAST:
                    x = max(0, wall === WALL_WEST ? parentRoom.x_ - w : parentRoom.x_ + parentRoom.w_);
                    y = max(0, randInt(parentRoom.y_ - (h - 2), parentRoom.y_ + (parentRoom.h_ - 3)));
                    break;
            }
            let testX = x;
            let testY = y;
            while (true) {
                let doesOverlap = false;
                for (let roomId = 0; roomId < rooms.length; roomId++) {
                    doesOverlap ||= getOverlap(testX, testY, testW, testH, rooms[roomId]);
                    if (doesOverlap) break;
                }
                if (doesOverlap || w >= maxW || h >= maxH || x < 0 || y < 0 || x + w >= mapW || y + h >= mapH) {
                    break;
                }
                w = testW;
                h = testH;
                x = testX;
                y = testY;
                if (random() < 0.5) {
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
            let newRoomId = addRoom(x, y, w, h, parentRoom.id_, wall);
            addDoor(parentRoom.id_, newRoomId, wall);
        }
        parentRoom = null;
        for (let ri = 0; ri < rooms.length; ri++) {
            if (rooms[ri].n_[WALL_NORTH] === WALL_FREE || rooms[ri].n_[WALL_EAST] === WALL_FREE ||
                rooms[ri].n_[WALL_SOUTH] === WALL_FREE || rooms[ri].n_[WALL_WEST] === WALL_FREE) {
                parentRoom = rooms[ri];
                break;
            }
        }
    }

    let secretsLeft = 3;
    m: for (let mapY = 0; mapY < mapH - 5; mapY++) {
        for (let mapX = 0; mapX < mapW - 5; mapX++) {
            let validRoom = true;
            r: for (let roomY = mapY; roomY < mapY + 5; roomY++) {
                for (let roomX = mapX; roomX < mapX + 5; roomX++) {
                    if (mapData[roomY * mapW + roomX] !== CELL_WALL) {
                        validRoom = false;
                        break r;
                    }
                }
            }
            if (validRoom) {
                let i = addRoom(mapX, mapY, 5, 5, -1, -1);
                rooms[i].type_ = ROOM_TYPE_SECRET;
                // TODO(agent): check each wall, start at the center of the wall, if the next tile outward is a floor, replace the wall tile we checked from with a cracked wall
                if (--secretsLeft === 0) {
                    break m;
                }
                mapX += 4;
            }
        }
    }
    // Find fartheest room from room 0, spawn player in middle of that
    return [5, 5];
};
