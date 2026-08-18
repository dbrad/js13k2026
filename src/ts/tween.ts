import { eventPush } from "./event";

let MAX_TWEENS = 48;

let tActive = new Uint32Array(MAX_TWEENS);
let tIndex = new Uint32Array(MAX_TWEENS);
let tStart = new Float32Array(MAX_TWEENS);
let tEnd = new Float32Array(MAX_TWEENS);
let tDuration = new Float32Array(MAX_TWEENS);
let tElapsed = new Float32Array(MAX_TWEENS);
let tEase = new Uint32Array(MAX_TWEENS);

let tTarget: Float32Array[] = new Array(MAX_TWEENS);
let tAction = new Uint32Array(MAX_TWEENS);
let tPayload = new Uint32Array(MAX_TWEENS);

let tActiveList = new Uint32Array(MAX_TWEENS);
let tCount = 0;

export let tweenClear = (): void => {
    for (let i = 0; i < tCount; i++) tActive[tActiveList[i]] = 0;
    tCount = 0;
};

export let tweenTo = (arr: Float32Array, idx: number, target: number, duration: number, ease: number = EASE_LINEAR, actionId: number = -1, actionPayload: number = -1): number => {
    for (let i = tCount - 1; i >= 0; i--) {
        let s = tActiveList[i];
        if (tTarget[s] === arr && tIndex[s] === idx) {
            tActive[s] = 0;
            let last = tCount - 1;
            if (i !== last) tActiveList[i] = tActiveList[last];
            tCount = last;
        }
    }

    if (tCount >= MAX_TWEENS) return -1;

    let slot = -1;
    for (let i = 0; i < MAX_TWEENS; i++) {
        if (!tActive[i]) { slot = i; break; }
    }
    if (slot < 0) return -1;

    tTarget[slot] = arr;
    tIndex[slot] = idx;
    tStart[slot] = arr[idx];
    tEnd[slot] = target;
    tDuration[slot] = duration > 0 ? duration : 0.0001;
    tElapsed[slot] = 0;
    tEase[slot] = ease;
    tActive[slot] = 1;
    tAction[slot] = actionId;
    tPayload[slot] = actionPayload;

    tActiveList[tCount++] = slot;
    return slot;
};

export let tweenUpdate = (dt: number): void => {
    for (let i = tCount - 1; i >= 0; i--) {
        let s = tActiveList[i];
        tElapsed[s] += dt;

        let t = tElapsed[s] / tDuration[s];
        if (t >= 1) {
            t = 1;
            if (tAction[s] > -1) {
                eventPush(tAction[s], tPayload[s]);
            }
            tTarget[s][tIndex[s]] = tEnd[s];
            tActive[s] = 0;
            let last = tCount - 1;
            if (i !== last) tActiveList[i] = tActiveList[last];
            tCount = last;
            continue;
        }

        let u = t;
        if (tEase[s] === EASE_SMOOTHSTEP) {
            u = u * u * (3 - 2 * u);
        }

        tTarget[s][tIndex[s]] = tStart[s] + (tEnd[s] - tStart[s]) * u;
    }
};

export let tweenIsActive = (slot: number): boolean => slot >= 0 && !!tActive[slot];
export let tweenCount = (): number => tCount;