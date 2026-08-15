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
    GS_PROGRESS: number,
    GS_RUNCOUNT: number,
    GS_MUTEMUSIC: number,
    GS_SCREENSHAKE: number,
];

type TextureDefinition = [
    number,     // Entry Type (TEXTURE_TYPE_SPRITE, TEXTURE_TYPE_SPRITE_STRIP)
    number[],   // Texture Id(s)
    number,     // x offset
    number,     // y offset
    number,     // sprite width
    number,     // sprite height
    number,     // atlas column
    number      // atlas row
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

type TimedFunction = (delta: number, dt: number) => void;

type Scene = {
    id_: number,
    setup_: VoidFunction,
    update_: TimedFunction,
    draw_: TimedFunction,
    drawGUI_: VoidFunction,
};

type Room = {
    id_: number;
    x_: number;
    y_: number;
    w_: number;
    h_: number;
    centerX_: number;
    centerY_: number;
};

type Mote = {
    x_: number;
    y_: number;
    z_: number;
    vx_: number;
    vy_: number;
    vz_: number;
    preferX_: number;
    preferY_: number;
    phase_: number;
    size_: number;
    active_: boolean;
};

type Entity = {
    x_: number;
    y_: number;
    z_: number;
    vx_: number;
    vy_: number;
    vz_: number;
    preferX_: number;
    preferY_: number;
    texId_: number;
    scale_: number;
    colour_: number;
    facing_: number;
    phase_: number;
    size_: number;
    flags_: number;
    data_: number;
};

type Visible = {
    idx_: number;
    dist_: number;
    screenX_: number;
    height_: number;
    light_: number;
};
