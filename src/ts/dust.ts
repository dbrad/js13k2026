import { glPushColorQuad } from "./gl";
import { cos, min, PI, random, sin } from "./math";
import { FOV, mapH, mapW, rayIsSolid, zBuffer } from "./raycast";

let MAX_MOTES = 220;
let MAX_DIST = 19;
let MAX_DIST_SQ = MAX_DIST * MAX_DIST;
let DRIFT_SPEED = 0.15;
let STEER_STRENGTH = 1.25;

let Z_MIN = -0.10;
let Z_MAX = 1.35;

let time = 0;

let motes: Mote[] = new Array(MAX_MOTES);
for (let i = 0; i < MAX_MOTES; i++) {
    let ang = random() * PI * 2;
    motes[i] = {
        x_: 0, y_: 0, z_: 0.5,
        vx_: 0, vy_: 0, vz_: 0,
        preferX_: cos(ang), preferY_: sin(ang),
        phase_: 0, size_: 1, active_: false
    };
}

export let moteAdd = (px = 2.5, py = 2.5): void => {
    for (let i = 0; i < MAX_MOTES; i++) {
        respawn(motes[i], px, py);
    }
};

let respawn = (m: Mote, px: number, py: number): void => {
    let nx = 0, ny = 0;
    for (let tries = 0; tries < 30; tries++) {
        nx = 1 + random() * (mapW - 2);
        ny = 1 + random() * (mapH - 2);
        if (!rayIsSolid(nx, ny)) break;
    }

    m.x_ = nx;
    m.y_ = ny;
    m.z_ = Z_MIN + random() * (Z_MAX - Z_MIN);

    let ang = random() * PI * 2;
    m.preferX_ = cos(ang);
    m.preferY_ = sin(ang);

    m.vx_ = m.preferX_ * DRIFT_SPEED * (0.7 + random() * 0.6);
    m.vy_ = m.preferY_ * DRIFT_SPEED * (0.7 + random() * 0.6);
    m.vz_ = (random() - 0.5) * 0.2;

    m.phase_ = random() * PI * 2;
    m.size_ = 0.25 + random() * 1.0;
    m.active_ = true;
};

export let moteUpdate = (dt: number, px: number, py: number, angle: number): void => {
    time += dt;

    for (let i = 0; i < MAX_MOTES; i++) {
        let m = motes[i];
        if (!m.active_) {
            respawn(m, px, py);
            continue;
        }

        let dx = m.x_ - px;
        let dy = m.y_ - py;
        let distSq = dx * dx + dy * dy;

        if (distSq > MAX_DIST_SQ * 2.5) {
            respawn(m, px, py);
            continue;
        }

        m.vx_ += (m.preferX_ * DRIFT_SPEED - m.vx_) * STEER_STRENGTH * dt;
        m.vy_ += (m.preferY_ * DRIFT_SPEED - m.vy_) * STEER_STRENGTH * dt;

        if (random() < 0.003) {
            let ang = random() * PI * 2;
            m.preferX_ = cos(ang);
            m.preferY_ = sin(ang);
        }

        let drive1 = sin(time * 0.85 + m.phase_) * 0.22;
        let drive2 = cos(time * 1.35 + m.phase_ * 0.7) * 0.18;
        m.vz_ += (drive1 + drive2) * dt;
        if (m.z_ < Z_MIN) m.vz_ += (Z_MIN - m.z_) * 2.5 * dt;
        if (m.z_ > Z_MAX) m.vz_ += (Z_MAX - m.z_) * 2.5 * dt;

        m.vx_ *= 1.0 - 0.9 * dt;
        m.vy_ *= 1.0 - 0.9 * dt;
        m.vz_ *= 1.0 - 1.3 * dt;

        m.x_ += m.vx_ * dt;
        m.y_ += m.vy_ * dt;
        m.z_ += m.vz_ * dt;

        if (rayIsSolid(m.x_, m.y_)) {
            respawn(m, px, py);
            continue;
        }

        m.phase_ += dt * (1.2 + m.size_ * 0.4);
    }
};

export let moteDraw = (px: number, py: number, angle: number): void => {
    let dirX = cos(angle);
    let dirY = sin(angle);
    let planeX = -dirY * FOV;
    let planeY = dirX * FOV;
    let invDet = 1.0 / (planeX * dirY - dirX * planeY);

    for (let i = 0; i < MAX_MOTES; i++) {
        let m = motes[i];
        if (!m.active_) continue;

        let dx = m.x_ - px;
        let dy = m.y_ - py;

        let transformX = invDet * (dirY * dx - dirX * dy);
        let transformY = invDet * (-planeY * dx + planeX * dy);

        if (transformY <= 0.12) continue;

        let moteH = (SCREEN_HEIGHT / transformY) * 0.026 * m.size_;
        if (moteH < 1) continue;

        let screenX = (SCREEN_WIDTH * 0.5) * (1.0 + transformX / transformY);
        let sx = (screenX | 0);
        if (sx < 0 || sx >= SCREEN_WIDTH) continue;
        if (transformY > zBuffer[sx]) continue;

        let vOffset = ((m.z_ - 0.5) / transformY) * (SCREEN_HEIGHT * 0.5);
        let drawY = (SCREEN_HEIGHT * 0.5) - moteH * 0.5 - vOffset;

        let alpha = min(0.38, 0.38 / transformY);
        let col = ((alpha * 255) | 0) << 24 | 0x00E8F0FF;

        glPushColorQuad(screenX - moteH * 0.5, drawY, moteH, moteH, col);
    }
};