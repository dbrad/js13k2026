import { mapData } from "./map";

let MAX_EVENTS = 32;

let evType = new Uint8Array(MAX_EVENTS);
let evPayload = new Int32Array(MAX_EVENTS);
let evHead = 0;
let evTail = 0;

export let eventPush = (type: number, payload = 0): void => {
    evType[evHead] = type;
    evPayload[evHead] = payload;
    evHead = (evHead + 1) & (MAX_EVENTS - 1);
};

export let eventProcess = (): void => {
    while (evTail !== evHead) {
        let type = evType[evTail];
        let payload = evPayload[evTail];
        evTail = (evTail + 1) & (MAX_EVENTS - 1);
        switch (type) {
            case EVENT_DOOR_OPEN:
                mapData[payload] = CELL_FLOOR;
                break;
            case EVENT_DOOR_CLOSE:
                mapData[payload] = CELL_HORIZONTAL_DOOR;
                break;
            case EVENT_BOSS_SPAWN:
                break;
            case EVENT_BOSS_DIED:
                break;
            case EVENT_SPAWN_PARTICLES:
                break;
        }
    }
};