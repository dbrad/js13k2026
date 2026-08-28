let saveFileName = "js13k2026dbrad";
let storage = window.localStorage;

export let gameState: GameState = [0, 0, 100, 100, 0, 0, 0, 0];
export let saveState: SaveState = [0, 0, 0, 0];

export let saveFileExists = (): boolean => {
    return storage.getItem(saveFileName) !== null;
};

export let newGame = (): void => {
    saveState = [
        0, // GS_OPT_MUSIC
        0, // GS_OPT_BOB
        0, // GS_OPT_SHAKE
        0, // GS_OPT_AIM
    ];

    gameState = [
        0, // GS_SCENE
        0, // GS_SEED
        0, // GS_PLAYER_HP
        0, // GS_PLAYER_MAX_HP
        0, // GS_PLAYER_X
        0, // GS_PLAYER_Y
        0, // GS_PLAYER_ANGLE
        0, // GS_PLAYER_INVULNERABLE
    ];
};

export let saveGame = (): void => {
    let json = JSON.stringify(saveState);
    let b64 = btoa(json);
    storage.setItem(saveFileName, b64);
};

export let loadGame = (): void => {
    let b64 = storage.getItem(saveFileName);
    if (b64) {
        saveState = JSON.parse(atob(b64)) as SaveState;
    } else {
        newGame();
        saveGame();
    }
};
