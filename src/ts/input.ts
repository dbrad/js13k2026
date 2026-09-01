import { saveState } from "./gameState";

let canvasRef: HTMLCanvasElement;
let pointerLocked = false;

let hardwareKeyState = [0, 0, 0, 0, 0, 0, 0, 0, 0];
export let keyState = [0, 0, 0, 0, 0, 0, 0, 0, 0];
let rateLimit = [0, 0, 0, 0, 0, 0, 0, 0, 0];

export let lookDeltaX = 0;
export let lookDeltaY = 0;

let mouseButtons = 0;
let mouseWasDown = false;
let rawMouseDX = 0, rawMouseDY = 0;
let shared: Record<string, number> = {
    "ArrowUp": D_UP,
    "KeyS": D_DOWN, "ArrowDown": D_DOWN,
    "KeyD": D_RIGHT,
    "KeyE": A_BUTTON, "Enter": A_BUTTON,
    "Space": B_BUTTON,
    "ArrowLeft": LOOK_LEFT,
    "ArrowRight": LOOK_RIGHT,
    "KeyM": MAP_BUTTON
};

let WASD: Record<string, number> = {
    "KeyW": D_UP, "KeyA": D_LEFT,
};

let ZQSD: Record<string, number> = {
    "KeyZ": D_UP, "KeyQ": D_LEFT,
};

let keyMap: Record<string, number> = {};

export let setKeyMap = () => {
    if (saveState[GS_OPT_KEYMAP] === 0) {
        keyMap = { ...shared, ...WASD };
    } else {
        keyMap = { ...shared, ...ZQSD };
    }
};

export let initializeInput = (canvas: HTMLCanvasElement): void => {
    canvasRef = canvas;

    document.addEventListener("keydown", (e: KeyboardEvent): void => {
        let key = keyMap[e.code];
        if (key !== undefined) {
            e.preventDefault();
            hardwareKeyState[key] = KEY_IS_DOWN;
        }
        if (e.code === "KeyF" && !pointerLocked) requestPointerLock();
    });
    document.addEventListener("keyup", (e: KeyboardEvent): void => {
        let key = keyMap[e.code];
        if (key !== undefined) {
            e.preventDefault();
            hardwareKeyState[key] = KEY_IS_UP;
        }
    });

    canvas.addEventListener("mousedown", (e: MouseEvent): void => {
        if (e.button === 0) {
            mouseButtons |= 1;
            if (!pointerLocked) requestPointerLock();
        }
    });
    canvas.addEventListener("mouseup", (e: MouseEvent): void => {
        if (e.button === 0) mouseButtons &= ~1;
    });
    document.addEventListener("mousemove", (e: MouseEvent): void => {
        if (pointerLocked) {
            rawMouseDX += e.movementX;
            rawMouseDY += e.movementY;
        }
    });
    document.addEventListener("pointerlockchange", (): void => {
        pointerLocked = document.pointerLockElement === canvasRef;
    });
};

let requestPointerLock = (): void => {
    canvasRef.requestPointerLock?.();
};

export let updateHardwareInput = (): void => {
    lookDeltaX = 0;
    lookDeltaY = 0;

    if (mouseButtons & 1) {
        hardwareKeyState[B_BUTTON] = KEY_IS_DOWN;
        mouseWasDown = true;
    } else if (mouseButtons === 0 && mouseWasDown) {
        hardwareKeyState[B_BUTTON] = KEY_IS_UP;
        mouseWasDown = false;
    }

    lookDeltaX += rawMouseDX * 0.0022;
    lookDeltaY += rawMouseDY * 0.0022;
    rawMouseDX = 0;
    rawMouseDY = 0;
};

export let updateInputState = (delta: number): void => {
    for (let key = 0; key < 9; key++) {
        if (rateLimit[key] > 0) rateLimit[key] -= delta;

        if (hardwareKeyState[key] === KEY_IS_DOWN) {
            keyState[key] = KEY_IS_DOWN;
        } else {
            if (keyState[key] === KEY_IS_DOWN && rateLimit[key] <= 0) {
                keyState[key] = KEY_WAS_DOWN;
                rateLimit[key] = 180;
            } else {
                keyState[key] = KEY_IS_UP;
                rateLimit[key] = 0;
            }
        }
    }

    if (keyState[LOOK_LEFT] === KEY_IS_DOWN) lookDeltaX -= 0.0027 * delta;
    if (keyState[LOOK_RIGHT] === KEY_IS_DOWN) lookDeltaX += 0.0027 * delta;
};

export let clearInput = (): void => {
    for (let i = 0; i < 9; i++) {
        hardwareKeyState[i] = KEY_IS_UP;
        keyState[i] = KEY_IS_UP;
        rateLimit[i] = 0;
    }
    mouseButtons = 0;
    lookDeltaX = lookDeltaY = 0;
    rawMouseDX = rawMouseDY = 0;
};