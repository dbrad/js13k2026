let saveFileName = "js13k2026dbrad";
let storage = window.localStorage;

export let gameState: GameState = [0, 0, 0, 3, 0, 1, 10, 10, 0, 0, 0, 0];
export let saveState: SaveState = [1, 1, 1, 1, 0];

export let saveFileExists = (): boolean => {
    return storage.getItem(saveFileName) !== null;
};

export let newGame = (): void => {
    gameState[GS_PLAYER_HP] = 10;
    gameState[GS_PLAYER_MAX_HP] = 10;
    gameState[GS_MAX_CHARGE] = 1;
    gameState[GS_LIVES] = 3;
    gameState[GS_LEVEL] = 0;
};

export let saveOptions = (): void => {
    let json = JSON.stringify(saveState);
    let b64 = btoa(json);
    storage.setItem(saveFileName, b64);
};

export let loadOptions = (): void => {
    let b64 = storage.getItem(saveFileName);
    if (b64) {
        saveState = JSON.parse(atob(b64)) as SaveState;
    } else {
        saveState = [
            1, // GS_OPT_MUSIC
            1, // GS_OPT_BOB
            1, // GS_OPT_SHAKE
            1, // GS_OPT_AIM
            0, // GS_OPT_KEYMAP
        ];
        saveOptions();
    }
};
