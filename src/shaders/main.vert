#version 300 es
precision highp float;
in vec2 p, u;
in vec4 c;
in float f;

out vec2 vu;
out vec4 vc;
out float vf;

uniform vec2 r;
uniform vec2 s;

void main() {
    vu = u;
    vc = c;
    vf = f;
    vec2 pos = p + s;
    vec2 clip = (pos / r) * 2.0f - 1.0f;
    gl_Position = vec4(clip * vec2(1.0f, -1.0f), 0.0f, 1.0f);
}