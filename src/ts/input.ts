import { requestFullscreen } from "./canvas";
import { glPushColorCircle, glPushText } from "./gl";
import { floor, hypot, isPointInCircle } from "./math";

let canvasRef: HTMLCanvasElement;
let pointerLocked = false;

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

export let isTouch = false;

let STICK_RADIUS = 50;
let STICK_DEADZONE = 0.01;
let LOOK_STICK_SENS = 0.035;

let LEFT_BASE_X = 72;
let LEFT_BASE_Y = SCREEN_HEIGHT - 96;
let RIGHT_BASE_X = SCREEN_WIDTH - 72;
let RIGHT_BASE_Y = SCREEN_HEIGHT - 96;

let leftActive = false;
let leftOriginX = 0, leftOriginY = 0;
let leftX = 0, leftY = 0;

let rightActive = false;
let rightOriginX = 0, rightOriginY = 0;
let rightX = 0, rightY = 0;

let buttonScale = 3;
let buttonSize = 16 * buttonScale;
let halfButtonSize = buttonSize / 2;

let [aButtonX, aButtonY] = [SCREEN_WIDTH - 140, SCREEN_HEIGHT - buttonSize - 160];
let [bButtonX, bButtonY] = [SCREEN_WIDTH - 60, SCREEN_HEIGHT - buttonSize - 180];

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

export let updateHardwareInput = (): void => {
    lookDeltaX = 0;
    lookDeltaY = 0;

    if (isTouch) {
        hardwareKeyState[LOOK_LEFT] = KEY_IS_UP;
        hardwareKeyState[LOOK_RIGHT] = KEY_IS_UP;
        hardwareKeyState[A_BUTTON] = KEY_IS_UP;
        hardwareKeyState[B_BUTTON] = KEY_IS_UP;
        hardwareKeyState[D_UP] = hardwareKeyState[D_DOWN] = hardwareKeyState[D_LEFT] = hardwareKeyState[D_RIGHT] = KEY_IS_UP;
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
        let leftFound = false;
        let rightFound = false;

        for (let i = 0; i < 6; i++) {
            let x = touches[i][X];
            let y = touches[i][Y];
            if (x === 0 && y === 0) continue;

            if (!leftFound && x < SCREEN_WIDTH * 0.5) {
                if (!leftActive) {
                    leftOriginX = x;
                    leftOriginY = y;
                    leftActive = true;
                }
                leftX = (x - leftOriginX) / STICK_RADIUS;
                leftY = (y - leftOriginY) / STICK_RADIUS;
                leftFound = true;
            }

            else if (!rightFound && x >= SCREEN_WIDTH * 0.5) {
                if (!rightActive) {
                    rightOriginX = x;
                    rightOriginY = y;
                    rightActive = true;
                }
                rightX = (x - rightOriginX) / STICK_RADIUS;
                rightY = (y - rightOriginY) / STICK_RADIUS;
                rightFound = true;
            }

            if (isPointInCircle(x, y, aButtonX + halfButtonSize, aButtonY + halfButtonSize, halfButtonSize))
                hardwareKeyState[A_BUTTON] = KEY_IS_DOWN;
            if (isPointInCircle(x, y, bButtonX + halfButtonSize, bButtonY + halfButtonSize, halfButtonSize))
                hardwareKeyState[B_BUTTON] = KEY_IS_DOWN;
        }

        if (!leftFound) {
            leftActive = false;
            leftX = leftY = 0;
        }
        if (!rightFound) {
            rightActive = false;
            rightX = rightY = 0;
        }

        let len = hypot(leftX, leftY);
        if (len > 1) { leftX /= len; leftY /= len; }
        if (len < STICK_DEADZONE) { leftX = leftY = 0; }

        len = hypot(rightX, rightY);
        if (len > 1) { rightX /= len; rightY /= len; }
        if (len < STICK_DEADZONE) { rightX = rightY = 0; }

        if (leftY < -0.35) hardwareKeyState[D_UP] = KEY_IS_DOWN;
        if (leftY > 0.35) hardwareKeyState[D_DOWN] = KEY_IS_DOWN;
        if (leftX < -0.35) hardwareKeyState[D_LEFT] = KEY_IS_DOWN;
        if (leftX > 0.35) hardwareKeyState[D_RIGHT] = KEY_IS_DOWN;

        lookDeltaX += rightX * LOOK_STICK_SENS;
        lookDeltaY += rightY * LOOK_STICK_SENS;
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

export let drawControls = (): void => {
    if (isTouch) {
        glPushColorCircle(
            LEFT_BASE_X - STICK_RADIUS, LEFT_BASE_Y - STICK_RADIUS,
            STICK_RADIUS * 2, 0x55ffffff
        );
        let nubX = LEFT_BASE_X + leftX * STICK_RADIUS * 0.7;
        let nubY = LEFT_BASE_Y + leftY * STICK_RADIUS * 0.7;
        glPushColorCircle(nubX - 18, nubY - 18, 36, 0xaaffffff);

        glPushColorCircle(
            RIGHT_BASE_X - STICK_RADIUS, RIGHT_BASE_Y - STICK_RADIUS,
            STICK_RADIUS * 2, 0x55ffffff
        );
        nubX = RIGHT_BASE_X + rightX * STICK_RADIUS * 0.7;
        nubY = RIGHT_BASE_Y + rightY * STICK_RADIUS * 0.7;
        glPushColorCircle(nubX - 18, nubY - 18, 36, 0xaaffffff);

        glPushColorCircle(aButtonX, aButtonY, buttonSize, 0x88ffffff);
        glPushText("a", aButtonX + halfButtonSize - 2, aButtonY + halfButtonSize + 4, 0xff000000, 3, TEXT_H_ALIGN_CENTER, TEXT_V_ALIGN_MIDDLE);
        glPushColorCircle(bButtonX, bButtonY, buttonSize, 0x88ffffff);
        glPushText("b", bButtonX + halfButtonSize - 0, bButtonY + halfButtonSize + 4, 0xff000000, 3, TEXT_H_ALIGN_CENTER, TEXT_V_ALIGN_MIDDLE);
    }

    // let help = !isTouch
    //     ? `wasd move / arrows or mouse look / click fire / c cancel`
    //     : `left stick move / right stick look / a fire / b cancel`;

    // glPushText(help, SCREEN_WIDTH / 2, SCREEN_HEIGHT - 8, 0xffffffff, 1, TEXT_H_ALIGN_CENTER);
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