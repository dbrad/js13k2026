#version 300 es
precision highp float;

in vec2 vu;
in vec4 vc;
in float vf;

uniform sampler2D tx;
uniform sampler2D l;

uniform vec2 r;
uniform vec2 s;
uniform vec2 pl;
uniform vec2 d;
uniform vec2 pn;

out vec4 oc;

const vec3 FOG_COLOR = vec3(0, 0, 0);
const float FOG_START = 2.0f;
const float FOG_END = 20.0f;
const float TEX_SIZE = 32.0f;
const float halfSize = 0.5f / TEX_SIZE;
const float TEX = 64.0f + 24.0f;

void main() {
    if(vu.x >= 10.0f) {
        vec2 frag = gl_FragCoord.xy - vec2(s.x, -s.y);
        float mid = r.y * 0.5f;
        float p = abs(frag.y - mid);

        if(p <= 0.5f)
            discard;

        float rowDist = r.y / (2.0f * p);
        float fog = clamp((rowDist - FOG_START) / (FOG_END - FOG_START), 0.0f, 1.0f);
        if(fog >= 1.0f) {
            oc = vec4(FOG_COLOR, 1.0f);
            return;
        }
        fog *= fog;

        float scale = 1.0f;
        if(frag.y <= mid) {
            scale = 2.0f;
        }

        vec2 rayDir = d + pn * ((2.0f * frag.x) / r.x - 1.0f);
        vec2 world = pl + rayDir * rowDist;
        vec2 lightUV = clamp(world * (1.0f / 50.0f), 0.0f, 1.0f);
        vec3 light = texture(l, lightUV).rgb;

        vec3 shade = min(1.0f, 1.0f / (1.0f + rowDist * 0.18f)) * 0.75f * light;

        vec2 t = clamp(fract(world * scale + 1e-5f), halfSize, 1.0f - halfSize);
        vec2 uv = vec2((TEX + 0.5f + t.x * (TEX_SIZE - 1.0f)) / 512.0f, (32.0f + 0.5f + t.y * (TEX_SIZE - 1.0f)) / 512.0f);
        vec3 lit = texture(tx, uv).rgb * shade;

        oc = vec4(mix(lit, FOG_COLOR, fog), 1.0f);
    } else if(vu.x >= 3.0f && vu.x <= 4.0f) {
        vec2 uv = vu - vec2(3.0f);
        float distance = distance(uv, vec2(0.5f));
        if(distance <= 0.5f) {
            oc = vc;
        } else {
            oc = vec4(0);
        }
    } else if(vu.x == 2.0f) {
        oc = vc;
    } else {
        vec4 tex = texture(tx, vu);
        if(vc.a == 0.0f) {
            oc = vec4(vec3(0.8f), tex.a);
        } else {
            vec3 lit = tex.rgb * vc.rgb;
            vec3 col = mix(lit, FOG_COLOR, vf);
            oc = vec4(col, tex.a * vc.a);
        }
    }
}