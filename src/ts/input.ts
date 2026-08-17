import { floor, isPointInCircle, isPointInRect } from "./math";
import { requestFullscreen } from "./canvas";
import { glPushText, glPushTexture } from "./gl";

let hardwareKeyState = [0, 0, 0, 0, 0, 0, 0, 0];
let keyState = [0, 0, 0, 0, 0, 0, 0, 0];
let rateLimit = [0, 0, 0, 0, 0, 0, 0, 0];

export let UP_PRESSED = false, UP_IS_DOWN = false;
export let DOWN_PRESSED = false, DOWN_IS_DOWN = false;
export let LEFT_PRESSED = false, LEFT_IS_DOWN = false;
export let RIGHT_PRESSED = false, RIGHT_IS_DOWN = false;
export let A_PRESSED = false, A_IS_DOWN = false;
export let B_PRESSED = false, B_IS_DOWN = false;
export let LOOK_LEFT_PRESSED = false, LOOK_LEFT_IS_DOWN = false;
export let LOOK_RIGHT_PRESSED = false, LOOK_RIGHT_IS_DOWN = false;

export let lookDeltaX = 0;
export let lookDeltaY = 0;

export let buttonActions: string[] = ["fire", "cancel"];
export let isTouch = false;
export let fullKeyboardMode = false;

let canvasRef: HTMLCanvasElement;
let gamepad: Gamepad | null = null;
let pointerLocked = false;

let mouseButtons = 0;
let mouseWasDown = false;
let rawMouseDX = 0, rawMouseDY = 0;

let touches = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];

let keyMap: Record<string, number> = {
    "KeyW": D_UP,
    "KeyS": D_DOWN,
    "KeyA": D_LEFT,
    "KeyD": D_RIGHT,
    "KeyX": A_BUTTON, "KeyE": A_BUTTON,
    "KeyC": B_BUTTON, "Space": B_BUTTON,
    "ArrowLeft": LOOK_LEFT,
    "ArrowRight": LOOK_RIGHT,
};

export let initializeInput = (canvas: HTMLCanvasElement): void => {
    canvasRef = canvas;

    canvas.addEventListener("touchmove", setTouchPosition, { passive: false });
    canvas.addEventListener("touchstart", setTouchPosition, { passive: false });
    canvas.addEventListener("touchend", setTouchPosition, { passive: false });

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
            if (!pointerLocked && !isTouch) requestPointerLock();
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

    // window.addEventListener("gamepadconnected", (): void => {
    //     gamepad = navigator.getGamepads()[0];
    // });
    // window.addEventListener("gamepaddisconnected", (): void => {
    //     gamepad = null;
    // });
};

let requestPointerLock = (): void => {
    canvasRef.requestPointerLock?.();
};

export let isTouchEvent = (e: Event): void => {
    isTouch = (e.type[0] === "t");
};

let setTouchPosition = (e: TouchEvent): void => {
    e.preventDefault();
    if (isTouch && !document.fullscreenElement) requestFullscreen(canvasRef);
    isTouchEvent(e);

    let bounds = canvasRef.getBoundingClientRect();
    let scaleX = SCREEN_WIDTH / bounds.width;
    let scaleY = SCREEN_HEIGHT / bounds.height;

    for (let i = 0; i < 6; i++) {
        let t = e.touches[i];
        if (t) {
            touches[i][X] = floor((t.clientX - bounds.left) * scaleX);
            touches[i][Y] = floor((t.clientY - bounds.top) * scaleY);
        } else {
            touches[i][X] = 0;
            touches[i][Y] = 0;
        }
    }
};

let dpadScale = 7;
let dpadSize = 16 * dpadScale;
let dpadTouchCenter = floor(dpadSize / 3);
let [dpadX, dpadY] = [20, SCREEN_HEIGHT - dpadSize - 80];

let buttonScale = 3;
let buttonSize = 16 * buttonScale;
let halfButtonSize = buttonSize / 2;

let [aButtonX, aButtonY] = [SCREEN_WIDTH - 140, SCREEN_HEIGHT - buttonSize - 140];
let [bButtonX, bButtonY] = [SCREEN_WIDTH - 60, SCREEN_HEIGHT - buttonSize - 160];

let lookBtnSize = 48;
let lookBtnY = SCREEN_HEIGHT - 120;
let lookLeftX = SCREEN_WIDTH - 140;
let lookRightX = SCREEN_WIDTH - 60;

export let updateHardwareInput = (): void => {
    lookDeltaX = 0;
    lookDeltaY = 0;
    if (gamepad || isTouch) {
        hardwareKeyState[LOOK_LEFT] = KEY_IS_UP;
        hardwareKeyState[LOOK_RIGHT] = KEY_IS_UP;
        hardwareKeyState[A_BUTTON] = KEY_IS_UP;
        hardwareKeyState[B_BUTTON] = KEY_IS_UP;

        hardwareKeyState[D_UP] = hardwareKeyState[D_DOWN] =
            hardwareKeyState[D_LEFT] = hardwareKeyState[D_RIGHT] = KEY_IS_UP;
    }

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

    if (isTouch) {
        for (let i = 0; i < 6; i++) {
            let x = touches[i][X];
            let y = touches[i][Y];
            if (x === 0 && y === 0) continue;

            if (isPointInRect(x, y, dpadX - 20, dpadY - 20, dpadSize + 40, dpadTouchCenter + 20))
                hardwareKeyState[D_UP] = KEY_IS_DOWN;
            if (isPointInRect(x, y, dpadX - 20, dpadY + dpadTouchCenter * 2 + 1, dpadSize + 40, dpadTouchCenter + 20))
                hardwareKeyState[D_DOWN] = KEY_IS_DOWN;
            if (isPointInRect(x, y, dpadX - 20, dpadY - 20, dpadTouchCenter + 20, dpadSize + 40))
                hardwareKeyState[D_LEFT] = KEY_IS_DOWN;
            if (isPointInRect(x, y, dpadX + dpadTouchCenter * 2 + 1, dpadY - 20, dpadTouchCenter + 20, dpadSize + 40))
                hardwareKeyState[D_RIGHT] = KEY_IS_DOWN;

            if (isPointInRect(x, y, lookLeftX, lookBtnY, lookBtnSize, lookBtnSize))
                hardwareKeyState[LOOK_LEFT] = KEY_IS_DOWN;
            if (isPointInRect(x, y, lookRightX, lookBtnY, lookBtnSize, lookBtnSize))
                hardwareKeyState[LOOK_RIGHT] = KEY_IS_DOWN;

            if (isPointInCircle(x, y, aButtonX + halfButtonSize, aButtonY + halfButtonSize, halfButtonSize))
                hardwareKeyState[A_BUTTON] = KEY_IS_DOWN;
            if (isPointInCircle(x, y, bButtonX + halfButtonSize, bButtonY + halfButtonSize, halfButtonSize))
                hardwareKeyState[B_BUTTON] = KEY_IS_DOWN;
        }
    }

    // if (gamepad) {
    //     let buttons = gamepad.buttons;
    //     let axes = gamepad.axes;

    //     if (axes[1] < -0.25 || buttons[12]?.pressed) hardwareKeyState[D_UP] = KEY_IS_DOWN;
    //     if (axes[1] > 0.25 || buttons[13]?.pressed) hardwareKeyState[D_DOWN] = KEY_IS_DOWN;
    //     if (axes[0] < -0.25 || buttons[14]?.pressed) hardwareKeyState[D_LEFT] = KEY_IS_DOWN;
    //     if (axes[0] > 0.25 || buttons[15]?.pressed) hardwareKeyState[D_RIGHT] = KEY_IS_DOWN;

    //     lookDeltaX += axes[2] * 0.04;
    //     lookDeltaY += axes[3] * 0.04;

    //     if (buttons[0]?.pressed) hardwareKeyState[A_BUTTON] = KEY_IS_DOWN;
    //     if (buttons[1]?.pressed) hardwareKeyState[B_BUTTON] = KEY_IS_DOWN;
    // }


    if (fullKeyboardMode) {
    }
};

export let updateInputState = (delta: number, _dt: number): void => {
    for (let key = 0; key < 8; key++) {
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

    UP_PRESSED = keyState[D_UP] === KEY_WAS_DOWN;
    DOWN_PRESSED = keyState[D_DOWN] === KEY_WAS_DOWN;
    LEFT_PRESSED = keyState[D_LEFT] === KEY_WAS_DOWN;
    RIGHT_PRESSED = keyState[D_RIGHT] === KEY_WAS_DOWN;
    A_PRESSED = keyState[A_BUTTON] === KEY_WAS_DOWN;
    B_PRESSED = keyState[B_BUTTON] === KEY_WAS_DOWN;
    LOOK_LEFT_PRESSED = keyState[LOOK_LEFT] === KEY_WAS_DOWN;
    LOOK_RIGHT_PRESSED = keyState[LOOK_RIGHT] === KEY_WAS_DOWN;

    UP_IS_DOWN = keyState[D_UP] === KEY_IS_DOWN;
    DOWN_IS_DOWN = keyState[D_DOWN] === KEY_IS_DOWN;
    LEFT_IS_DOWN = keyState[D_LEFT] === KEY_IS_DOWN;
    RIGHT_IS_DOWN = keyState[D_RIGHT] === KEY_IS_DOWN;
    A_IS_DOWN = keyState[A_BUTTON] === KEY_IS_DOWN;
    B_IS_DOWN = keyState[B_BUTTON] === KEY_IS_DOWN;
    LOOK_LEFT_IS_DOWN = keyState[LOOK_LEFT] === KEY_IS_DOWN;
    LOOK_RIGHT_IS_DOWN = keyState[LOOK_RIGHT] === KEY_IS_DOWN;

    if (LOOK_LEFT_IS_DOWN) lookDeltaX -= 0.0027 * delta;
    if (LOOK_RIGHT_IS_DOWN) lookDeltaX += 0.0027 * delta;
};

let getButtonTexture = (key: number, base: number): number =>
    keyState[key] === KEY_IS_UP ? base : base + 2;

export let drawControls = (): void => {
    if (isTouch) {
        glPushTexture(TEXTURE_D_PAD, dpadX, dpadY, dpadScale);
        if (keyState[D_UP] !== KEY_IS_UP) glPushTexture(TEXTURE_D_PAD_UP, dpadX, dpadY, dpadScale);
        if (keyState[D_DOWN] !== KEY_IS_UP) glPushTexture(TEXTURE_D_PAD_UP, dpadX, dpadY, dpadScale, 0xffffffff, false, true);
        if (keyState[D_LEFT] !== KEY_IS_UP) glPushTexture(TEXTURE_D_PAD_RIGHT, dpadX, dpadY, dpadScale, 0xffffffff, true);
        if (keyState[D_RIGHT] !== KEY_IS_UP) glPushTexture(TEXTURE_D_PAD_RIGHT, dpadX, dpadY, dpadScale);
        glPushTexture(getButtonTexture(A_BUTTON, TEXTURE_A_BUTTON_UP), aButtonX, aButtonY, buttonScale);
        glPushTexture(getButtonTexture(B_BUTTON, TEXTURE_B_BUTTON_UP), bButtonX, bButtonY, buttonScale);
        glPushTexture(TEXTURE_D_PAD_RIGHT, lookLeftX, lookBtnY, 3, 0xffffffff, true);
        glPushTexture(TEXTURE_D_PAD_RIGHT, lookRightX, lookBtnY, 3);
    }

    let help = !gamepad && !isTouch
        ? (fullKeyboardMode
            ? `wasd move / arrows look / x|space fire / c cancel`
            : `wasd move / mouse look / click fire / c cancel`)
        : `stick move / look / a fire / b cancel`;

    glPushText(help, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 8, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
};

export let clearInput = (): void => {
    for (let i = 0; i < 8; i++) {
        hardwareKeyState[i] = KEY_IS_UP;
        keyState[i] = KEY_IS_UP;
        rateLimit[i] = 0;
    }
    mouseButtons = 0;
    lookDeltaX = lookDeltaY = 0;
    rawMouseDX = rawMouseDY = 0;

    UP_PRESSED = DOWN_PRESSED = LEFT_PRESSED = RIGHT_PRESSED = false;
    UP_IS_DOWN = DOWN_IS_DOWN = LEFT_IS_DOWN = RIGHT_IS_DOWN = false;
    A_PRESSED = B_PRESSED = LOOK_LEFT_PRESSED = LOOK_RIGHT_PRESSED = false;
    A_IS_DOWN = B_IS_DOWN = LOOK_LEFT_IS_DOWN = LOOK_RIGHT_IS_DOWN = false;
};