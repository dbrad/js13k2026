import { doorAdd } from "./doors";
import { abs, floor, max, min, random } from "./math";
import { AMBIENT } from "./raycast";

export let generateDungeon = (width: number, height: number, minRoomSize: number, maxRoomSize: number, maxRooms: number, loopChance: number = 0.15, deadEndChance: number = 0.20): [Int8Array, Float32Array, number, number] => {
    let lightMap = new Float32Array(width * height);
    lightMap.fill(AMBIENT);

    //  0 represents floor, 1 represents wall, 2 is cracked wall, 3 is door
    let grid = new Int8Array(width * height).fill(1);
    let rooms: Room[] = [];

    let intersects = (r1: Room, r2: Room): boolean => {
        return (
            r1.x_ < r2.x_ + r2.w_ + 1 &&
            r1.x_ + r1.w_ > r2.x_ - 1 &&
            r1.y_ < r2.y_ + r2.h_ + 1 &&
            r1.y_ + r1.h_ > r2.y_ - 1
        );
    };

    let carveHorizontalTunnel = (x1: number, x2: number, y: number) => {
        let start = min(x1, x2);
        let end = max(x1, x2);
        let hitWall = false;
        for (let x = start; x <= end; x++) {
            let index = y * width + x;
            if (grid[index] === 1) {
                if (!hitWall) {
                    hitWall = true;
                }
                grid[index] = 0;
            }
        }
    };

    let carveVerticalTunnel = (y1: number, y2: number, x: number) => {
        let start = min(y1, y2);
        let end = max(y1, y2);
        for (let y = start; y <= end; y++) {
            let index = y * width + x;
            if (grid[index] === 1) {
                grid[index] = 0;
            }
        }
    };

    let placeCorridorEntrances = (id: number) => {
        let isFloor = (x: number, y: number) =>
            grid[y * width + x] === 0;

        let setIfFloor = (x: number, y: number) => {
            let idx = y * width + x;
            if (grid[idx] === 0 && random() > 0.50) {
                grid[idx] = id;
            }
        };

        for (let y = 2; y < height - 2; y++) {
            for (let x = 2; x < width - 2; x++) {

                if (!isFloor(x, y)) {
                    continue;
                }

                // Room below, corridor continues above
                if (
                    grid[y * width + (x - 1)] === 1 &&
                    grid[y * width + (x + 1)] === 1 &&

                    isFloor(x, y - 1) &&

                    isFloor(x - 1, y + 1) &&
                    isFloor(x, y + 1) &&
                    isFloor(x + 1, y + 1)
                ) {
                    doorAdd(x, y, true);
                    grid[y * width + x] = CELL_DOOR;
                    // setIfFloor(x, y);
                    continue;
                }

                // Room above, corridor continues below
                if (
                    grid[y * width + (x - 1)] === 1 &&
                    grid[y * width + (x + 1)] === 1 &&

                    isFloor(x, y + 1) &&

                    isFloor(x - 1, y - 1) &&
                    isFloor(x, y - 1) &&
                    isFloor(x + 1, y - 1)
                ) {
                    doorAdd(x, y, true);
                    grid[y * width + x] = CELL_DOOR;
                    // setIfFloor(x, y);
                    continue;
                }

                // Room right, corridor continues left
                if (
                    grid[(y - 1) * width + x] === 1 &&
                    grid[(y + 1) * width + x] === 1 &&

                    isFloor(x - 1, y) &&

                    isFloor(x + 1, y - 1) &&
                    isFloor(x + 1, y) &&
                    isFloor(x + 1, y + 1)
                ) {
                    doorAdd(x, y, true);
                    grid[y * width + x] = CELL_DOOR;
                    // setIfFloor(x, y);
                    continue;
                }

                // Room left, corridor continues right
                if (
                    grid[(y - 1) * width + x] === 1 &&
                    grid[(y + 1) * width + x] === 1 &&

                    isFloor(x + 1, y) &&

                    isFloor(x - 1, y - 1) &&
                    isFloor(x - 1, y) &&
                    isFloor(x - 1, y + 1)
                ) {
                    doorAdd(x, y, true);
                    grid[y * width + x] = CELL_DOOR;
                    // setIfFloor(x, y);
                    continue;
                }
            }
        }
    };

    let connectRooms = (r1: Room, r2: Room) => {
        if (random() < 0.5) {
            carveHorizontalTunnel(r1.centerX_, r2.centerX_, r1.centerY_);
            carveVerticalTunnel(r1.centerY_, r2.centerY_, r2.centerX_);
        } else {
            carveVerticalTunnel(r1.centerY_, r2.centerY_, r1.centerX_);
            carveHorizontalTunnel(r1.centerX_, r2.centerX_, r2.centerY_);
        }
    };

    // 1. Placement
    let roomIdCounter = 0;
    let px = 0;
    let py = 0;
    for (let i = 0; i < maxRooms; i++) {
        let w = floor(random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
        let h = floor(random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
        let x = floor(random() * (width - w - 2)) + 1;
        let y = floor(random() * (height - h - 2)) + 1;

        let newRoom: Room = {
            id_: roomIdCounter,
            x_: x, y_: y, w_: w, h_: h,
            centerX_: floor(x + w / 2),
            centerY_: floor(y + h / 2)
        };

        let overlap = false;
        for (let otherRoom of rooms) {
            if (intersects(newRoom, otherRoom)) {
                overlap = true;
                break;
            }
        }

        if (!overlap) {
            for (let ry = newRoom.y_; ry < newRoom.y_ + newRoom.h_; ry++) {
                for (let rx = newRoom.x_; rx < newRoom.x_ + newRoom.w_; rx++) {
                    grid[ry * width + rx] = 0;
                }
            }
            if (px === 0 && py === 0) {
                px = newRoom.centerX_;
                py = newRoom.centerY_;
            }
            rooms.push(newRoom);
            roomIdCounter++;
        }
    }

    if (rooms.length < 2) return [grid, lightMap, px, py];

    // 2. Proximity Graph Generation
    let connections = new Set<string>();
    let connectedRoomIds = new Set<number>();

    connectedRoomIds.add(rooms[0].id_);

    let getEdgeKey = (id1: number, id2: number) => `${min(id1, id2)}-${max(id1, id2)}`;

    while (connectedRoomIds.size < rooms.length) {
        let minDistance = Infinity;
        let bestEdge: [Room, Room] | null = null;

        for (let r1 of rooms) {
            if (!connectedRoomIds.has(r1.id_)) continue;

            for (let r2 of rooms) {
                if (connectedRoomIds.has(r2.id_)) continue;

                let dist = abs(r1.centerX_ - r2.centerX_) + abs(r1.centerY_ - r2.centerY_);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestEdge = [r1, r2];
                }
            }
        }

        if (bestEdge) {
            let [r1, r2] = bestEdge;
            if (random() < deadEndChance && connectedRoomIds.size > 1) {
                continue;
            }

            connectRooms(r1, r2);
            connections.add(getEdgeKey(r1.id_, r2.id_));
            connectedRoomIds.add(r2.id_);
        } else {
            let unconnected = rooms.find(r => !connectedRoomIds.has(r.id_));
            if (unconnected) {
                connectedRoomIds.add(unconnected.id_);
            }
        }
    }

    // 3. Loop Generation
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            let r1 = rooms[i];
            let r2 = rooms[j];
            let edgeKey = getEdgeKey(r1.id_, r2.id_);
            if (!connections.has(edgeKey)) {
                let dist = abs(r1.centerX_ - r2.centerX_) + abs(r1.centerY_ - r2.centerY_);
                let maxSpread = max(width, height) * 0.4;
                if (dist < maxSpread && random() < loopChance) {
                    connectRooms(r1, r2);
                    connections.add(edgeKey);
                }
            }
        }
    }

    placeCorridorEntrances(2);

    return [grid, lightMap, px, py];
};