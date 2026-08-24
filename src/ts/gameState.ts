let saveFileName = "js13k2026dbrad";
let storage = window.localStorage;

export let gameState: GameState = [10, 10, 0, 0, 0, 0, 1];

export let saveFileExists = (): boolean => {
    return storage.getItem(saveFileName) !== null;
};

export let newGame = (): void => {
    gameState = [
        0, // GS_PLAYER_HP
        0, // GS_PLAYER_MAX_HP
        0, // GS_PLAYER_X
        0, // GS_PLAYER_Y
        0, // GS_PLAYER_ANGLE
        0, // GS_MUTEMUSIC
        1, // GS_SCREENSHAKE
    ];
};

export let saveGame = (): void => {
    let json = JSON.stringify(gameState);
    let b64 = btoa(json);
    storage.setItem(saveFileName, b64);
};

export let loadGame = (): void => {
    let b64 = storage.getItem(saveFileName);
    if (b64) {
        gameState = JSON.parse(atob(b64)) as GameState;
    } else {
        newGame();
        saveGame();
    }
};
