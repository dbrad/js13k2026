import { abs, cos, max, min, sin } from "./math";
import { mapData, mapH, mapW } from "./raycast";

const MAX_DOORS = 48;

export let doorX = new Int16Array(MAX_DOORS);
export let doorY = new Int16Array(MAX_DOORS);
export let doorDir = new Int8Array(MAX_DOORS);   // 0 = slides on X axis, 1 = on Y
export let doorOpen = new Float32Array(MAX_DOORS); // 0 = closed → 1 = fully open
export let doorTarget = new Float32Array(MAX_DOORS);
export let doorSpeed = new Float32Array(MAX_DOORS);
export let doorCount = 0;

// Tunables – these feel good for a 13k game
export let DOOR_SPEED = 2.8;   // seconds to fully open/close ≈ 0.36 s
export let DOOR_INTERACT = 1.55;  // how far in front the player can trigger
export let DOOR_SIDE_TOL = 0.65;  // how far left/right of centre is still accepted

/** Call once after map generation when you decide a cell should be a door */
export let doorAdd = (x: number, y: number, horizontal: boolean, speed = 3.2): number => {
    if (doorCount >= MAX_DOORS) return -1;
    let i = doorCount++;
    doorX[i] = x;
    doorY[i] = y;
    doorDir[i] = horizontal ? 0 : 1;
    doorOpen[i] = 0;
    doorTarget[i] = 0;
    doorSpeed[i] = speed;
    // mapData[y * mapW + x] = CELL_DOOR;
    return i;
};

/** Per-frame update – call from your main loop */
export let doorUpdate = (dt: number): void => {
    for (let i = 0; i < doorCount; i++) {
        let diff = doorTarget[i] - doorOpen[i];
        if (abs(diff) < 0.001) {
            doorOpen[i] = doorTarget[i];
            continue;
        }
        let step = doorSpeed[i] * dt;
        doorOpen[i] = diff > 0
            ? min(doorTarget[i], doorOpen[i] + step)
            : max(doorTarget[i], doorOpen[i] - step);
    }
};

/** Player interaction – call when the interact key is pressed */
export let doorTryToggle = (px: number, py: number, angle: number): void => {
    let dx = cos(angle);
    let dy = sin(angle);

    // Cast a short ray and also check a small cross of cells
    // This is far more forgiving than a single cell test.
    for (let d = 0.4; d <= DOOR_INTERACT; d += 0.25) {
        let tx = px + dx * d;
        let ty = py + dy * d;

        // centre cell + left/right offsets so you don’t have to be perfectly aligned
        let candidates = [
            [tx | 0, ty | 0],
            [(tx + dy * DOOR_SIDE_TOL) | 0, (ty - dx * DOOR_SIDE_TOL) | 0],
            [(tx - dy * DOOR_SIDE_TOL) | 0, (ty + dx * DOOR_SIDE_TOL) | 0],
        ];

        for (let c = 0; c < 3; c++) {
            let mx = candidates[c][0];
            let my = candidates[c][1];
            if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) continue;

            for (let i = 0; i < doorCount; i++) {
                if (doorX[i] === mx && doorY[i] === my) {
                    // toggle
                    doorTarget[i] = doorTarget[i] > 0.5 ? 0 : 1;
                    return; // only one door at a time
                }
            }
        }
    }
};

/** Used by the raycaster – returns true if the ray is still blocked by this door */
export let doorBlocks = (mx: number, my: number, side: number, wallX: number): boolean => {
    for (let i = 0; i < doorCount; i++) {
        if (doorX[i] === mx && doorY[i] === my) {
            let open = doorOpen[i];
            if (open >= 0.98) return false;          // fully open → treat as empty

            // simple but good-looking approximation:
            // the door slides from 0 → 1, so when open is 0.3 the ray only hits
            // if it lands on the still-closed portion of the cell.
            if (doorDir[i] === 0) {                 // horizontal slide (moves on X)
                // wallX is the fractional hit position across the face
                return wallX > open;
            } else {                                // vertical slide
                return wallX > open;
            }
        }
    }
    return true; // unknown door cell → treat as solid
};

export let doorClear = (): void => {
    doorCount = 0;
};