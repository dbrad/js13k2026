#version 300 es
precision highp float;
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_color;
in float a_fog;

out vec2 v_uv;
out vec4 v_color;
out float v_fog;

uniform vec2 u_res;
uniform vec2 u_shake;

void main() {
    v_uv = a_uv;
    v_color = a_color;
    v_fog = a_fog;
    vec2 pos = a_pos + u_shake;
    vec2 clip = (pos / u_res) * 2.0f - 1.0f;
    gl_Position = vec4(clip * vec2(1.0f, -1.0f), 0.0f, 1.0f);
}