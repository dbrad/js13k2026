declare var DEBUG: boolean;

declare module '*.vert' {
    let content: string;
    export default content;
}

declare module '*.frag' {
    let content: string;
    export default content;
}

declare module '*.txt' {
    let content: string;
    export default content;
}

declare module '*.webp' {
    let content: string;
    export default content;
}

type GameState = [
    GS_PLAYER_HP: number,
    GS_PLAYER_MAX_HP: number,
    GS_PLAYER_X: number,
    GS_PLAYER_Y: number,
    GS_PLAYER_ANGLE: number,
    GS_MUTEMUSIC: number,
    GS_SCREENSHAKE: number,
    GS_PLAYER_INVULNERABLE: number
];

type Texture = {
    w_: number,
    h_: number,
    u0_: number,
    v0_: number,
    u1_: number,
    v1_: number,
};

type TextureCache = Texture[];

type V2 = [number, number];
type V3 = [number, number, number];
type V4 = [number, number, number, number];

type V2f = Float32Array;
type V3f = Float32Array;
type V4f = Float32Array;

type Room = {
    id_: number;
    x_: number;
    y_: number;
    w_: number;
    h_: number;
    centerX_: number;
    centerY_: number;
};
