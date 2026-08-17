import { entityAddParticle } from "./entity";
import { mapData, mapW } from "./map";
import { random } from "./math";

const MAX_EVENTS = 32;

const evType = new Uint8Array(MAX_EVENTS);
const evPayload = new Int32Array(MAX_EVENTS);
let evHead = 0;
let evTail = 0;

export const eventPush = (type: number, payload = 0): void => {
    evType[evHead] = type;
    evPayload[evHead] = payload;
    evHead = (evHead + 1) & (MAX_EVENTS - 1);
};

export const eventProcess = (): void => {
    while (evTail !== evHead) {
        const type = evType[evTail];
        const payload = evPayload[evTail];
        evTail = (evTail + 1) & (MAX_EVENTS - 1);

        switch (type) {
            case EVENT_DOOR_OPEN:
                mapData[payload] = CELL_FLOOR;
                break;

            case EVENT_DOOR_CLOSE:
                mapData[payload] = CELL_HORIZONTAL_DOOR;
                break;

            case EVENT_WALL_DESTROY: {

                const cell = payload;
                mapData[cell] = CELL_FLOOR;
                const cx = (cell % mapW) + 0.5;
                const cy = (cell / mapW | 0) + 0.5;
                for (let k = 0; k < 10; k++) {
                    entityAddParticle(cx, cy, 0.4 + random() * 0.4, 1.2, 0xff6688aa);
                }
                break;
            }

            case EVENT_BOSS_SPAWN:


                break;

            case EVENT_BOSS_DIED:

                break;

            case EVENT_SPAWN_PARTICLES:

                break;
        }
    }
};