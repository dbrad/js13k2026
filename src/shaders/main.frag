#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;
in float v_fog;

uniform sampler2D u_texture;
uniform sampler2D u_light;

uniform vec2 u_res;
uniform vec2 u_shake;
uniform vec2 u_player;
uniform vec2 u_dir;
uniform vec2 u_plane;

out vec4 outColor;

const vec3 FOG_COLOR = vec3(0.05f, 0.05f, 0.08f);
const float FOG_START = 1.0f;
const float FOG_END = 20.0f;

void main() {
    if(v_uv.x == 2.0f) {
        outColor = v_color;
        return;
    }

    if(v_uv.x >= 10.0f) {
        vec2 frag = gl_FragCoord.xy - vec2(u_shake.x, -u_shake.y);
        float mid = u_res.y * 0.5f;
        float p = abs(frag.y - mid);

        if(p <= 0.5f)
            discard;

        float rowDist = u_res.y / (2.0f * p);
        float fog = clamp((rowDist - FOG_START) / (FOG_END - FOG_START), 0.0f, 1.0f);
        if(fog >= 1.0f) {
            outColor = vec4(FOG_COLOR, 1.0f);
            return;
        }

        float scale = 1.0f;
        float shadeMul = 0.50f;
        float TEX = 64.0f + 24.0f;// 128.0f + 24.0f;
        float TEX_SIZE = 32.0f;

        if(frag.y <= mid) {
            // Floor
            scale = 2.0f;
            shadeMul = 0.85f;
            TEX = 64.0f + 24.0f;
        }

        vec2 rayDir = u_dir + u_plane * ((2.0f * frag.x) / u_res.x - 1.0f);
        vec2 world = u_player + rayDir * rowDist;
        vec2 lightUV = world * (1.0f / 50.0f);
        lightUV = clamp(lightUV, 0.0f, 1.0f);
        float light = texture(u_light, lightUV).r;

        float shade = min(1.0f, 1.0f / (1.0f + rowDist * 0.18f)) * shadeMul;
        shade *= light;

        float halfSize = 0.5f / TEX_SIZE;
        vec2 t = clamp(fract(world * scale + 1e-5f), halfSize, 1.0f - halfSize);
        vec2 uv = vec2((TEX + 0.5f + t.x * (TEX_SIZE - 1.0f)) / 512.0f, (64.0f + 0.5f + t.y * (TEX_SIZE - 1.0f)) / 512.0f);
        vec3 lit = texture(u_texture, uv).rgb * shade;
        fog *= fog;

        outColor = vec4(mix(lit, FOG_COLOR, fog), 1.0f);
        return;
    }

    vec4 tex = texture(u_texture, v_uv);
    vec3 lit = tex.rgb * v_color.rgb;
    vec3 col = mix(lit, FOG_COLOR, v_fog);
    outColor = vec4(col, tex.a * v_color.a);
}