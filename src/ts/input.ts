import { floor, isPointInCircle, isPointInRect } from "./math";
import { requestFullscreen } from "./canvas";
import { glPushText, glPushTexture } from "./gl";

let hardwareKeyState = [0, 0, 0, 0, 0, 0];
let keyState = [0, 0, 0, 0, 0, 0];
let canvasRef: HTMLCanvasElement;
export let buttonActions: string[] = ["accept", "cancel"];

export let UP_PRESSED: boolean = false;
export let UP_IS_DOWN: boolean = false;
export let DOWN_PRESSED: boolean = false;
export let DOWN_IS_DOWN: boolean = false;
export let LEFT_PRESSED: boolean = false;
export let LEFT_IS_DOWN: boolean = false;
export let RIGHT_PRESSED: boolean = false;
export let RIGHT_IS_DOWN: boolean = false;

export let A_PRESSED: boolean = false;
export let A_IS_DOWN: boolean = false;
export let B_PRESSED: boolean = false;
export let B_IS_DOWN: boolean = false;

let keyMap: Record<string, number> = {
    "ArrowLeft": D_LEFT,
    "ArrowUp": D_UP,
    "ArrowRight": D_RIGHT,
    "ArrowDown": D_DOWN,
    "KeyX": A_BUTTON,
    "KeyC": B_BUTTON,
};

let gamepad: Gamepad | null = null;

export let isTouch: boolean = false;
let touches = [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]];

export let isTouchEvent = (e: Event | PointerEvent | TouchEvent): void => {
    isTouch = (e.type[0] === "t");
};

let setTouchPosition = (e: TouchEvent): void => {
    e.preventDefault();
    if (isTouch && !document.fullscreenElement) {
        requestFullscreen(canvasRef);
    }

    let canvasBounds = canvasRef.getBoundingClientRect();
    isTouchEvent(e);
    for (let i = 0; i < 6; i++) {
        let touch = e.touches[i];
        if (touch) {
            touches[i][X] = floor((touch.clientX - canvasBounds.left) / (canvasBounds.width / SCREEN_WIDTH));
            touches[i][Y] = floor((touch.clientY - canvasBounds.top) / (canvasBounds.height / SCREEN_HEIGHT));
        } else {
            touches[i][X] = 0;
            touches[i][Y] = 0;
        }
    }
};

let isMappedKey = (key: number): key is number => {
    return (key !== undefined);
};

export let initializeInput = (canvas: HTMLCanvasElement): void => {
    canvasRef = canvas;

    canvasRef.addEventListener("touchmove", setTouchPosition);
    canvasRef.addEventListener("touchstart", setTouchPosition);
    canvasRef.addEventListener("touchend", setTouchPosition);
    document.addEventListener("keydown", (e: KeyboardEvent): void => {
        let key = keyMap[e.code];
        if (isMappedKey(key)) {
            e.preventDefault();
            hardwareKeyState[key] = KEY_IS_DOWN;
        }
    });
    document.addEventListener("keyup", (e: KeyboardEvent): void => {
        let key = keyMap[e.code];
        if (isMappedKey(key)) {
            e.preventDefault();
            hardwareKeyState[key] = KEY_IS_UP;
        }
    });
    window.addEventListener("gamepadconnected", (): void => {
        gamepad = navigator.getGamepads()[0];
    });
    window.addEventListener("gamepaddisconnected", (): void => {
        gamepad = null;
    });
};

let dpadScale = 7;
let dpadSize = 16 * dpadScale;
let dpadTouchCenter = floor(dpadSize / 3);
let [dpadX, dpadY] = [20, SCREEN_HEIGHT - dpadSize - 100];

let buttonScale = 3;
let buttonSize = 16 * buttonScale;
let halfButtonSize = buttonSize / 2;

let [aButtonX, aButtonY] = [SCREEN_WIDTH - buttonSize - 80, SCREEN_HEIGHT - buttonSize - 120];
let [bButtonX, bButtonY] = [SCREEN_WIDTH - buttonSize - 20, SCREEN_HEIGHT - buttonSize - 140];

export let updateHardwareInput = (): void => {
    if (gamepad || isTouch) {
        hardwareKeyState[A_BUTTON] = KEY_IS_UP;
        hardwareKeyState[B_BUTTON] = KEY_IS_UP;
        hardwareKeyState[D_UP] = KEY_IS_UP;
        hardwareKeyState[D_DOWN] = KEY_IS_UP;
        hardwareKeyState[D_LEFT] = KEY_IS_UP;
        hardwareKeyState[D_RIGHT] = KEY_IS_UP;
    }
    if (isTouch) {
        for (let i = 0; i < 6; i++) {
            let x = touches[i][X];
            let y = touches[i][Y];

            // D-pad Checks
            if (isPointInRect(x, y, dpadX - 20, dpadY - 20, dpadSize + 40, dpadTouchCenter + 20)) {
                hardwareKeyState[D_UP] = KEY_IS_DOWN;
            }
            if (isPointInRect(x, y, dpadX - 20, dpadY + dpadTouchCenter * 2 + 1, dpadSize + 40, dpadTouchCenter + 20)) {
                hardwareKeyState[D_DOWN] = KEY_IS_DOWN;
            }
            if (isPointInRect(x, y, dpadX - 20, dpadY - 20, dpadTouchCenter + 20, dpadSize + 40)) {
                hardwareKeyState[D_LEFT] = KEY_IS_DOWN;
            }
            if (isPointInRect(x, y, dpadX + dpadTouchCenter * 2 + 1, dpadY - 20, dpadTouchCenter + 20, dpadSize + 40)) {
                hardwareKeyState[D_RIGHT] = KEY_IS_DOWN;
            }
            // Button Checks
            if (isPointInCircle(x, y, aButtonX + halfButtonSize, aButtonY + halfButtonSize, halfButtonSize)) {
                hardwareKeyState[A_BUTTON] = KEY_IS_DOWN;
            }
            if (isPointInCircle(x, y, bButtonX + halfButtonSize, bButtonY + halfButtonSize, halfButtonSize)) {
                hardwareKeyState[B_BUTTON] = KEY_IS_DOWN;
            }
        }
    };
    if (gamepad) {
        let buttons = gamepad.buttons;
        let axes = gamepad.axes;

        if (buttons[12].pressed || axes[1] < -0.2) {
            hardwareKeyState[D_UP] = KEY_IS_DOWN;
        }
        if (buttons[13].pressed || axes[1] > 0.2) {
            hardwareKeyState[D_DOWN] = KEY_IS_DOWN;
        }
        if (buttons[14].pressed || axes[0] < -0.2) {
            hardwareKeyState[D_LEFT] = KEY_IS_DOWN;
        }
        if (buttons[15].pressed || axes[0] > 0.2) {
            hardwareKeyState[D_RIGHT] = KEY_IS_DOWN;
        }
        if (buttons[0].pressed) {
            hardwareKeyState[A_BUTTON] = KEY_IS_DOWN;
        }
        if (buttons[1].pressed) {
            hardwareKeyState[B_BUTTON] = KEY_IS_DOWN;
        }
    }
};

let rateLimit: number[] = [0, 0, 0, 0, 0, 0];
export let updateInputState = (delta: number, dt: number): void => {
    for (let key = 0; key <= 5; key++) {
        if (rateLimit[key] > 0) {
            rateLimit[key] -= delta;
        }

        if (hardwareKeyState[key] === KEY_IS_DOWN) {
            keyState[key] = KEY_IS_DOWN;
        } else {
            if (keyState[key] === KEY_IS_DOWN && rateLimit[key] <= 0) {
                keyState[key] = KEY_WAS_DOWN;
                rateLimit[key] = 250;
            } else {
                keyState[key] = KEY_IS_UP;
                rateLimit[key] = 0;
            }
        }
    };

    UP_PRESSED = keyState[D_UP] === KEY_WAS_DOWN;
    DOWN_PRESSED = keyState[D_DOWN] === KEY_WAS_DOWN;
    LEFT_PRESSED = keyState[D_LEFT] === KEY_WAS_DOWN;
    RIGHT_PRESSED = keyState[D_RIGHT] === KEY_WAS_DOWN;

    UP_IS_DOWN = keyState[D_UP] === KEY_IS_DOWN;
    DOWN_IS_DOWN = keyState[D_DOWN] === KEY_IS_DOWN;
    LEFT_IS_DOWN = keyState[D_LEFT] === KEY_IS_DOWN;
    RIGHT_IS_DOWN = keyState[D_RIGHT] === KEY_IS_DOWN;

    A_PRESSED = keyState[A_BUTTON] === KEY_WAS_DOWN;
    B_PRESSED = keyState[B_BUTTON] === KEY_WAS_DOWN;

    A_IS_DOWN = keyState[A_BUTTON] === KEY_IS_DOWN;
    B_IS_DOWN = keyState[B_BUTTON] === KEY_IS_DOWN;
};

let getButtonTexture = (key: number, baseTexture: number): number => keyState[key] === KEY_IS_UP ? baseTexture : baseTexture + 2;
export let drawControls = (): void => {
    let helpText = "";
    if (isTouch) {
        glPushTexture(TEXTURE_D_PAD, dpadX, dpadY, dpadScale);

        if (keyState[D_UP] !== KEY_IS_UP) {
            glPushTexture(TEXTURE_D_PAD_UP, dpadX, dpadY, dpadScale);
        }
        if (keyState[D_DOWN] !== KEY_IS_UP) {
            glPushTexture(TEXTURE_D_PAD_UP, dpadX, dpadY, dpadScale, 0xffffffff, false, true);
        }
        if (keyState[D_LEFT] !== KEY_IS_UP) {
            glPushTexture(TEXTURE_D_PAD_RIGHT, dpadX, dpadY, dpadScale, 0xffffffff, true);
        }
        if (keyState[D_RIGHT] !== KEY_IS_UP) {
            glPushTexture(TEXTURE_D_PAD_RIGHT, dpadX, dpadY, dpadScale);
        }
        glPushTexture(getButtonTexture(B_BUTTON, TEXTURE_B_BUTTON_UP), bButtonX, bButtonY, buttonScale);
        glPushTexture(getButtonTexture(A_BUTTON, TEXTURE_A_BUTTON_UP), aButtonX, aButtonY, buttonScale);
    };

    if (!gamepad && !isTouch) {
        helpText = `arrow keys / x. ${buttonActions[0]} / c. ${buttonActions[1]}`;
    } else {
        helpText = `dpad / a. ${buttonActions[0]} / b. ${buttonActions[1]}`;
    }

    glPushText(helpText, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 8, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
};

export let clearInput = (): void => {
    for (let key = 0; key <= 5; key++) {
        hardwareKeyState[key] = KEY_IS_UP;
        keyState[key] = KEY_IS_UP;
    }
    UP_PRESSED = false;
    DOWN_PRESSED = false;
    LEFT_PRESSED = false;
    RIGHT_PRESSED = false;
    UP_IS_DOWN = false;
    DOWN_IS_DOWN = false;
    LEFT_IS_DOWN = false;
    RIGHT_IS_DOWN = false;

    A_PRESSED = false;
    B_PRESSED = false;
};
