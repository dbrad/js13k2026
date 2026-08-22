import mainFragment from "@shaders/main.frag";
import mainVertex from "@shaders/main.vert";
import { assert } from "./__debug/debug";
import { TEXTURE_CACHE } from "./texture";

let MAX_QUADS = 8192;
let FLOATS_PER_VERTEX = 6; // x, y, u, v, colour, fog
let VERTICES_PER_QUAD = 6;
let VERTEX_FLOATS = MAX_QUADS * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;

export let gl: WebGL2RenderingContext;
let program: WebGLProgram;
let vbo: WebGLBuffer;
let vertexData = new Float32Array(VERTEX_FLOATS);
let colourData = new Uint32Array(vertexData.buffer);
let quadCount = 0;

let aPos: number;
let aUV: number;
let aColor: number;
let aFog: number;
let uTexture: WebGLUniformLocation | null;
let uLight: WebGLUniformLocation | null;
let uRes: WebGLUniformLocation | null;

export let uPlayer: WebGLUniformLocation | null;
export let uDir: WebGLUniformLocation | null;
export let uPlane: WebGLUniformLocation | null;
export let uShake: WebGLUniformLocation | null;

export let characterCodeMap: { [key: string]: number; } = {};
let FONT_GLYPH_SIZE = 8;

let lightmapTex: WebGLTexture;


let compileShader = (type: number, source: string): WebGLShader => {
    let s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
};

let createProgram = (vs: string, fs: string): WebGLProgram => {
    let p = gl.createProgram()!;
    gl.attachShader(p, compileShader(GL_VERTEX_SHADER, vs));
    gl.attachShader(p, compileShader(GL_FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    return p;
};

export let glUploadAtlas = (image: TexImageSource): void => {
    let tex = gl.createTexture()!;
    gl.activeTexture(GL_TEXTURE0);
    gl.bindTexture(GL_TEXTURE_2D, tex);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGBA, GL_RGBA, GL_UNSIGNED_BYTE, image);
};

export let glInit = (canvas: HTMLCanvasElement): void => {
    gl = canvas.getContext("webgl2")!;
    assert(gl !== null, "failed to get webgl2 context");

    lightmapTex = gl.createTexture();
    gl.activeTexture(GL_TEXTURE1);
    gl.bindTexture(GL_TEXTURE_2D, lightmapTex);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    gl.texParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    gl.texImage2D(GL_TEXTURE_2D, 0, GL_RGB32F, 50, 50, 0, GL_RGB, GL_FLOAT, new Float32Array(50 * 50 * 3));

    program = createProgram(mainVertex, mainFragment);
    gl.useProgram(program);

    aPos = gl.getAttribLocation(program, "p");
    aUV = gl.getAttribLocation(program, "u");
    aColor = gl.getAttribLocation(program, "c");
    aFog = gl.getAttribLocation(program, "f");

    uRes = gl.getUniformLocation(program, "r");
    uPlayer = gl.getUniformLocation(program, "pl");
    uDir = gl.getUniformLocation(program, "d");
    uPlane = gl.getUniformLocation(program, "pn");
    uShake = gl.getUniformLocation(program, "s");

    uTexture = gl.getUniformLocation(program, "tx");
    uLight = gl.getUniformLocation(program, "l");

    vbo = gl.createBuffer()!;
    gl.bindBuffer(GL_ARRAY_BUFFER, vbo);
    gl.bufferData(GL_ARRAY_BUFFER, vertexData.byteLength, GL_DYNAMIC_DRAW);

    gl.blendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    gl.enable(GL_BLEND);

    let stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, GL_FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, GL_FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, GL_UNSIGNED_BYTE, true, stride, 16);
    gl.enableVertexAttribArray(aFog);
    gl.vertexAttribPointer(aFog, 1, GL_FLOAT, false, stride, 20);

    gl.uniform2f(uRes, SCREEN_WIDTH, SCREEN_HEIGHT);
    gl.uniform1i(uTexture, 0);
    gl.uniform1i(uLight, 1);
};

export let updateLightmap = (lightmapData: Float32Array) => {
    gl.activeTexture(GL_TEXTURE1);
    gl.bindTexture(GL_TEXTURE_2D, lightmapTex);
    gl.texSubImage2D(GL_TEXTURE_2D, 0, 0, 0, 50, 50, GL_RGB, GL_FLOAT, lightmapData);
    gl.activeTexture(GL_TEXTURE0);
};

export let glClear = (r: number, g: number, b: number): void => {
    gl.clearColor(r, g, b, 1);
    gl.clear(GL_COLOR_BUFFER_BIT);
    quadCount = 0;
};

export let glPushColorQuad = (x: number, y: number, w: number, h: number, colour: number): void => {
    glPushQuad(x, y, w, h, 2.0, 0.0, 2.0, 0.0, colour);
};

export let glPushColorCircle = (x: number, y: number, d: number, colour: number): void => {
    glPushQuad(x, y, d, d, 3.0, 3.0, 4.0, 4.0, colour);
};

export let glPushTexture = (texId: number, x: number, y: number, scale = 1, colour: number = 0xffffffff, hFlip: boolean = false, vFlip: boolean = false, fog: number = 0): void => {
    let t = TEXTURE_CACHE[texId];
    if (!t) return;
    let u0 = t.u0_;
    let u1 = t.u1_;
    if (hFlip) {
        u0 = u1;
        u1 = t.u0_;
    }

    let v0 = t.v0_;
    let v1 = t.v1_;
    if (vFlip) {
        v0 = v1;
        v1 = t.v0_;
    }

    glPushQuad(x, y, t.w_ * scale, t.h_ * scale, u0, v0, u1, v1, colour, fog);
};

export let glPushQuad = (x: number, y: number, w: number, h: number, u0: number, v0: number, u1: number, v1: number, colour: number, fog: number = 0): void => {
    if (quadCount >= MAX_QUADS) return;

    let i = quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX;

    vertexData[i + 0] = x;
    vertexData[i + 1] = y;
    vertexData[i + 2] = u0;
    vertexData[i + 3] = v0;
    colourData[i + 4] = colour;
    vertexData[i + 5] = fog;

    vertexData[i + 6] = x + w;
    vertexData[i + 7] = y + h;
    vertexData[i + 8] = u1;
    vertexData[i + 9] = v1;
    colourData[i + 10] = colour;
    vertexData[i + 11] = fog;

    vertexData[i + 12] = x;
    vertexData[i + 13] = y + h;
    vertexData[i + 14] = u0;
    vertexData[i + 15] = v1;
    colourData[i + 16] = colour;
    vertexData[i + 17] = fog;

    vertexData[i + 18] = x;
    vertexData[i + 19] = y;
    vertexData[i + 20] = u0;
    vertexData[i + 21] = v0;
    colourData[i + 22] = colour;
    vertexData[i + 23] = fog;

    vertexData[i + 24] = x + w;
    vertexData[i + 25] = y;
    vertexData[i + 26] = u1;
    vertexData[i + 27] = v0;
    colourData[i + 28] = colour;
    vertexData[i + 29] = fog;

    vertexData[i + 30] = x + w;
    vertexData[i + 31] = y + h;
    vertexData[i + 32] = u1;
    vertexData[i + 33] = v1;
    colourData[i + 34] = colour;
    vertexData[i + 35] = fog;

    quadCount++;
};

export let glPushText = (text: string | number, x: number, y: number, colour: number = 0xffffffff, scale = 1, hAlign: number = TEXT_H_ALIGN_LEFT, vAlign: number = TEXT_V_ALIGN_TOP): void => {
    text = (text + "").toUpperCase();
    let letterSize = FONT_GLYPH_SIZE * scale;
    let lineHeight = letterSize + scale * 2;

    let yOffset = 0;
    if (vAlign === TEXT_V_ALIGN_MIDDLE) yOffset = lineHeight / 2;
    if (vAlign === TEXT_V_ALIGN_BOTTOM) yOffset = lineHeight;

    let lineWidth = text.length * letterSize;

    let xOffset = 0;
    if (hAlign === TEXT_H_ALIGN_CENTER) xOffset = -lineWidth / 2;
    if (hAlign === TEXT_H_ALIGN_RIGHT) xOffset = -lineWidth;

    for (let ci = 0; ci < text.length; ci++) {
        let ch = text[ci];
        if (ch === " ") {
            xOffset += letterSize;
            continue;
        }
        let code = characterCodeMap[ch];
        assert(code !== undefined, `undefined character: ${ch}`);

        let t = TEXTURE_CACHE[100 + code];
        assert(t !== undefined, "missing texture for " + ch);

        glPushQuad(
            x + xOffset,
            y - yOffset,
            letterSize, letterSize,
            t.u0_, t.v0_,
            t.u1_, t.v1_,
            colour
        );
        xOffset += letterSize;
    }
};

export let glFlush = (): void => {
    if (quadCount === 0) return;

    gl.bindBuffer(GL_ARRAY_BUFFER, vbo);
    gl.bufferSubData(
        GL_ARRAY_BUFFER,
        0,
        vertexData.subarray(0, quadCount * VERTICES_PER_QUAD * FLOATS_PER_VERTEX)
    );

    gl.drawArrays(GL_TRIANGLES, 0, quadCount * VERTICES_PER_QUAD);
    quadCount = 0;
};