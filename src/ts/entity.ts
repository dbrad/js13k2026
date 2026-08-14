import { glPushQuad } from "./gl";
import { abs, cos, max, min, PI, random, sin } from "./math";
import { AMBIENT, FOG_END, FOG_START, lightMap, mapH, mapW, zBuffer } from "./raycast";
import { TEXTURE_CACHE } from "./texture";

let FOV = 0.75;

let MAX_ENTITIES = 256;
let MAX_VISIBLE = 128;

let entities: Entity[] = new Array(MAX_ENTITIES);
let visible: VisibleSprite[] = new Array(MAX_VISIBLE);
let entityCount = 0;
let visibleCount = 0;

for (let i = 0; i < MAX_ENTITIES; i++) {
    entities[i] = {
        x_: 0, y_: 0,
        texId_: 0,
        scale_: 1,
        colour_: 0xffffffff,
        active_: false,
        data_: 0,
    };
}
for (let i = 0; i < MAX_VISIBLE; i++) {
    visible[i] = {
        entity_: entities[0],
        dist_: 0,
        screenX_: 0,
        height_: 0,
        light_: 1
    };
}

let fogFactor = (dist: number): number => {
    let t = (dist - FOG_START) / (FOG_END - FOG_START);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return t * t;
};

let packABGR = (r: number, g: number, b: number, a = 1): number => {
    let R = (r * 255) | 0;
    let G = (g * 255) | 0;
    let B = (b * 255) | 0;
    let A = (a * 255) | 0;
    let out = (A & 0xff) << 8 >>> 0;
    out = (out | (B & 0xff)) << 8 >>> 0;
    out = (out | (G & 0xff)) << 8 >>> 0;
    out = (out | (R & 0xff)) >>> 0;
    return out;
};

let modulateABGR = (abgr: number, light: number): number => {
    let r = ((abgr >>> 0) & 0xff) * light;
    let g = ((abgr >>> 8) & 0xff) * light;
    let b = ((abgr >>> 16) & 0xff) * light;
    let a = (abgr >>> 24) & 0xff;
    if (r > 255) r = 255;
    if (g > 255) g = 255;
    if (b > 255) b = 255;
    return (a << 24) | (b << 16) | (g << 8) | (r | 0);
};

export let entityClear = (): void => {
    for (let i = 0; i < entityCount; i++) {
        entities[i].active_ = false;
    }
    entityCount = 0;
};

export let entityAdd = (x: number, y: number, texId: number, scale = 1, r = 1, g = 1, b = 1, a = 1): number => {
    if (entityCount >= MAX_ENTITIES) return -1;

    let e = entities[entityCount];
    e.x_ = x;
    e.y_ = y;
    e.texId_ = texId;
    e.scale_ = scale;
    e.colour_ = packABGR(r, g, b, a);
    e.active_ = true;
    e.data_ = random() * PI * 2;
    return entityCount++;
};

export let entityRemove = (index: number): void => {
    if (index < 0 || index >= entityCount) return;
    let last = entityCount - 1;
    if (index !== last) {
        let tmp = entities[index];
        entities[index] = entities[last];
        entities[last] = tmp;
    }
    entities[last].active_ = false;
    entityCount = last;
};

export let entityAt = (index: number): Entity => {
    return entities[index];
};

export let entityCountActive = (): number => {
    return entityCount;
};

export let entityCollect = (px: number, py: number, angle: number): void => {
    visibleCount = 0;

    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (let i = 0; i < entityCount; i++) {
        let e = entities[i];
        if (!e.active_) continue;

        let dx = e.x_ - px;
        let dy = e.y_ - py;

        let transformX = invDet * (dirY * dx - dirX * dy);
        let transformY = invDet * (-planeY * dx + planeX * dy);

        if (transformY <= 0.15) continue;

        let screenX = (SCREEN_WIDTH * 0.5) * (1 + transformX / transformY);
        let height = abs(SCREEN_HEIGHT / transformY) * e.scale_;

        if (screenX < -height || screenX > SCREEN_WIDTH + height) continue;

        if (visibleCount < MAX_VISIBLE) {
            let cellX = e.x_ | 0;
            let cellY = e.y_ | 0;
            let cellLight = AMBIENT;
            if (cellX >= 0 && cellY >= 0 && cellX < mapW && cellY < mapH) {
                cellLight = lightMap[cellY * mapW + cellX];
            }

            let slot = visible[visibleCount++];
            slot.entity_ = e;
            slot.dist_ = transformY;
            slot.screenX_ = screenX;
            slot.height_ = height;
            slot.light_ = min(1.6, cellLight);
        }
    }

    for (let i = 1; i < visibleCount; i++) {
        let tmp = visible[i];
        let j = i - 1;
        while (j >= 0 && visible[j].dist_ < tmp.dist_) {
            visible[j + 1] = visible[j];
            j--;
        }
        visible[j + 1] = tmp;
    }
};

export let entityDraw = (dt: number): void => {
    for (let i = 0; i < visibleCount; i++) {
        let s = visible[i];
        let e = s.entity_;
        let tex = TEXTURE_CACHE[e.texId_];
        if (!tex) continue;

        let phase = sin(dt * 3 + e.data_);

        let fog = fogFactor(s.dist_);
        let halfW = s.height_ * 0.5;
        let drawStartX = s.screenX_ - halfW;
        let drawEndX = s.screenX_ + halfW;
        let bob = phase * (s.height_ * 0.04);
        let drawStartY = (SCREEN_HEIGHT - s.height_) * 0.5 + bob;
        let litColour = modulateABGR(e.colour_, s.light_);

        let startCol = max(0, drawStartX | 0);
        let endCol = min(SCREEN_WIDTH - 1, drawEndX | 0);
        if (endCol < startCol) continue;

        let uSpan = tex.u1_ - tex.u0_;
        let invW = 1 / s.height_;

        for (let col = startCol; col <= endCol; col++) {
            if (s.dist_ >= zBuffer[col]) continue;

            let texU = tex.u0_ + uSpan * ((col - drawStartX) * invW);
            glPushQuad(
                col, drawStartY,
                1, s.height_,
                texU, tex.v0_, texU, tex.v1_,
                litColour, fog
            );
        }
    }
};