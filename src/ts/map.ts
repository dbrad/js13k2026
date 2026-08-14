import { random } from "./math";
import { AMBIENT } from "./raycast";

type Room = {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    centerX: number;
    centerY: number;
};

export let generateDungeon = (width: number, height: number, minRoomSize: number, maxRoomSize: number, maxRooms: number, loopChance: number = 0.15, deadEndChance: number = 0.20): [Int8Array, Float32Array, number, number] => {
    let lightMap = new Float32Array(width * height);
    lightMap.fill(AMBIENT);                 // import or hardcode 0.32

    let grid = new Int8Array(width * height).fill(1); // 1 represents wall, 0 represents floor
    let rooms: Room[] = [];

    let intersects = (r1: Room, r2: Room): boolean => {
        return (
            r1.x < r2.x + r2.w + 1 &&
            r1.x + r1.w > r2.x - 1 &&
            r1.y < r2.y + r2.h + 1 &&
            r1.y + r1.h > r2.y - 1
        );
    };

    let carveHorizontalTunnel = (x1: number, x2: number, y: number) => {
        let start = Math.min(x1, x2);
        let end = Math.max(x1, x2);
        for (let x = start; x <= end; x++) {
            let index = y * width + x;
            if (grid[index] === 1) grid[index] = 0;
        }
    };

    let carveVerticalTunnel = (y1: number, y2: number, x: number) => {
        let start = Math.min(y1, y2);
        let end = Math.max(y1, y2);
        for (let y = start; y <= end; y++) {
            let index = y * width + x;
            if (grid[index] === 1) grid[index] = 0;
        }
    };
    let connectRooms = (r1: Room, r2: Room) => {
        if (random() < 0.5) {
            carveHorizontalTunnel(r1.centerX, r2.centerX, r1.centerY);
            carveVerticalTunnel(r1.centerY, r2.centerY, r2.centerX);
        } else {
            carveVerticalTunnel(r1.centerY, r2.centerY, r1.centerX);
            carveHorizontalTunnel(r1.centerX, r2.centerX, r2.centerY);
        }
    };

    // 1. Placement
    let roomIdCounter = 0;
    let px = 0;
    let py = 0;
    for (let i = 0; i < maxRooms; i++) {
        let w = Math.floor(random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
        let h = Math.floor(random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
        let x = Math.floor(random() * (width - w - 2)) + 1;
        let y = Math.floor(random() * (height - h - 2)) + 1;

        let newRoom: Room = {
            id: roomIdCounter,
            x, y, w, h,
            centerX: Math.floor(x + w / 2),
            centerY: Math.floor(y + h / 2)
        };

        let overlap = false;
        for (let otherRoom of rooms) {
            if (intersects(newRoom, otherRoom)) {
                overlap = true;
                break;
            }
        }

        if (!overlap) {
            for (let ry = newRoom.y; ry < newRoom.y + newRoom.h; ry++) {
                for (let rx = newRoom.x; rx < newRoom.x + newRoom.w; rx++) {
                    grid[ry * width + rx] = 0;
                }
            }
            if (px === 0 && py === 0) {
                px = newRoom.centerX;
                py = newRoom.centerY;
            }
            rooms.push(newRoom);
            roomIdCounter++;
        }
    }

    if (rooms.length < 2) return [grid, lightMap, px, py];

    // 2. Proximity Graph Generation
    let connections = new Set<string>();
    let connectedRoomIds = new Set<number>();

    connectedRoomIds.add(rooms[0].id);

    let getEdgeKey = (id1: number, id2: number) => `${Math.min(id1, id2)}-${Math.max(id1, id2)}`;

    while (connectedRoomIds.size < rooms.length) {
        let minDistance = Infinity;
        let bestEdge: [Room, Room] | null = null;

        for (let r1 of rooms) {
            if (!connectedRoomIds.has(r1.id)) continue;

            for (let r2 of rooms) {
                if (connectedRoomIds.has(r2.id)) continue;

                let dist = Math.abs(r1.centerX - r2.centerX) + Math.abs(r1.centerY - r2.centerY);
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
            connections.add(getEdgeKey(r1.id, r2.id));
            connectedRoomIds.add(r2.id);
        } else {
            let unconnected = rooms.find(r => !connectedRoomIds.has(r.id));
            if (unconnected) {
                connectedRoomIds.add(unconnected.id);
            }
        }
    }

    // 3. Loop Generation
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            let r1 = rooms[i];
            let r2 = rooms[j];
            let edgeKey = getEdgeKey(r1.id, r2.id);

            if (!connections.has(edgeKey)) {
                let dist = Math.abs(r1.centerX - r2.centerX) + Math.abs(r1.centerY - r2.centerY);

                // Only loop relatively close rooms to avoid long, layout-ruining hallways
                let maxSpread = Math.max(width, height) * 0.4;
                if (dist < maxSpread && random() < loopChance) {
                    connectRooms(r1, r2);
                    connections.add(edgeKey);
                }
            }
        }
    }

    return [grid, lightMap, px, py];
};