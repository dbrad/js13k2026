import { abs, cos, floor, max, min, PI, random, round, sin, tan } from "./math";

export let zzfxPlay = (sample: number[]): void => {
    let buffer = zzfxContext.createBuffer(1, sample.length, zzfxSampleRate);
    let source = zzfxContext.createBufferSource();
    buffer.getChannelData(0).set(sample);
    source.buffer = buffer;
    source.connect(zzfxContext.destination);
    source.start();
};

let zzfxGenerate = (volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0, release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0, pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0, filter = 0): number[] => {
    let PI2 = PI * 2,
        sign = (v: number) => v < 0 ? -1 : 1,
        sampleRate = zzfxSampleRate,
        startSlide = slide *= 500 * PI2 / sampleRate / sampleRate,
        startFrequency = frequency *= (1 + randomness * 2 * random() - randomness) * PI2 / sampleRate,
        b = [], t = 0, tm = 0, i = 0, j = 1, r = 0, c = 0, s = 0, f, length,
        quality = 2, w = PI2 * abs(filter) * 2 / sampleRate,
        cosVal = cos(w), alpha = sin(w) / 2 / quality,
        a0 = 1 + alpha, a1 = -2 * cosVal / a0, a2 = (1 - alpha) / a0,
        b0 = (1 + sign(filter) * cosVal) / 2 / a0,
        b1 = -(sign(filter) + cosVal) / a0, b2 = b0,
        x2 = 0, x1 = 0, y2 = 0, y1 = 0;

    attack = attack * sampleRate + 9;
    decay *= sampleRate;
    sustain *= sampleRate;
    release *= sampleRate;
    delay *= sampleRate;
    deltaSlide *= 500 * PI2 / sampleRate ** 3;
    modulation *= PI2 / sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;
    repeatTime = floor(repeatTime * sampleRate);
    volume *= zzfxVolume;

    for (length = floor(attack + decay + sustain + release + delay);
        i < length; b[i++] = s * volume) {
        if (!(++c % floor(bitCrush * 100))) {
            s = shape ? shape > 1 ? shape > 2 ? shape > 3 ?
                sin(t ** 3) :
                max(min(tan(t), 1), -1) :
                1 - (2 * t / PI2 % 2 + 2) % 2 :
                1 - 4 * abs(round(t / PI2) - t / PI2) :
                sin(t);

            s = (repeatTime ?
                1 - tremolo + tremolo * sin(PI2 * i / repeatTime)
                : 1) *
                sign(s) * (abs(s) ** shapeCurve) *
                (i < attack ? i / attack :
                    i < attack + decay ?
                        1 - ((i - attack) / decay) * (1 - sustainVolume) :
                        i < attack + decay + sustain ?
                            sustainVolume :
                            i < length - delay ?
                                (length - i - delay) / release *
                                sustainVolume :
                                0);

            s = delay ? s / 2 + (delay > i ? 0 :
                (i < length - delay ? 1 : (length - i) / delay) *
                b[floor(i - delay)] / 2 / volume) : s;

            if (filter)
                s = y1 = b2 * x2 + b1 * (x2 = x1) + b0 * (x1 = s) - a2 * y2 - a1 * (y2 = y1);
        }

        f = (frequency += slide += deltaSlide) *
            cos(modulation * tm++);
        t += f + f * noise * sin(i ** 5);

        if (j && ++j > pitchJumpTime) {
            frequency += pitchJump;
            startFrequency += pitchJump;
            j = 0;
        }

        if (repeatTime && !(++r % repeatTime)) {
            frequency = startFrequency;
            slide = startSlide;
            j = j || 1;
        }
    }

    return b;
};

export let zzfx = (m: (number | undefined)[]) => zzfxPlay(zzfxGenerate(...m));

let zzfxVolume: number = 0.2;
let zzfxSampleRate: number = 44100;
let zzfxContext: AudioContext;

export let sfxFootstep: number[];
export let sfxLaserCharge: number[];
export let sfxLaserFire: number[];
export let sfxPlayerHurt: number[];
export let sfxEnemyMelee: number[];
export let sfxEnemyAlert: number[];
export let sfxEnemyRanged: number[];
export let sfxEnemyDeath: number[];

let droneA: number[];
let droneB: number[];
let pulse: number[];
let pad: number[];
let bass: number[];
let snare: number[];

export let zzfxInit = (): void => {
    if (!zzfxContext) {
        zzfxContext = new AudioContext();
    }

    // Player Footsteps – soft, slightly organic hoof thud
    sfxFootstep = zzfxGenerate(...[
        .12, .18, 95,           // vol, rand, freq
        .005, .015, .06,        // attack, sustain, release
        4, 1.6,                 // noise wave, shapeCurve
        , , , , ,               // no slide / jump
        2.8,                    // high noise amount
        , .12, .08              // bitcrush lightly, short delay for body
    ]);

    // Player Laser Charging – rising magical energy
    sfxLaserCharge = zzfxGenerate(...[.25, , 354, .2, 1, .5, 3, 2, 1, , , , , , 40, , , .5, , , 308]);

    // Player Laser Firing – bright rainbow beam zap
    sfxLaserFire = zzfxGenerate(...[
        .7, .03, 880, .02, .05, .18, 1, 1.4, -12, 3, 220, .04, , .1, .8, , .05, .9, .02
    ]);

    // Player Hurt – sharp, painful unicorn cry
    sfxPlayerHurt = zzfxGenerate(...[
        .8, .08, 320, .01, .02, .22, 3, 2.2, -8, , -180, .08, , 1.5, , .1, .15
    ]);

    // Enemy Melee Attack – heavy occult swipe
    sfxEnemyMelee = zzfxGenerate(...[
        .9, .05, 110, .01, .04, .18, 3, 1.9, , , , , , 2.2, , .15, .2
    ]);

    // Enemy Alert Noise – short, creepy vocal-ish chirp
    sfxEnemyAlert = zzfxGenerate(...[
        .55, .1, 520, .02, .05, .12, 2, 2.4, 4, , 180, .06, , .8, , .08, .1
    ]);

    // Enemy Ranged Attack – dark energy bolt
    sfxEnemyRanged = zzfxGenerate(...[
        .65, .04, 280, .03, .08, .22, 1, 1.7, -6, 2, -90, .05, , .4, 1.1, , .12, .7, .04
    ]);

    // Enemy Death Cry – distorted, dying cultist scream
    sfxEnemyDeath = zzfxGenerate(...[
        1, .12, 180, .02, .15, .4, 3, 2.6, -4, , -120, .12, , 3, , .2, .25
    ]);

    // ─── Dark Ambient Layers ────────────────────────────
    // Low ominous drone (foundation)
    droneA = zzfxGenerate(...[
        .35, 0, 55, .5, 4, 3, 0, 1, , , , , , .15, .4, , .4, .6, .8, .3, -40
    ]);

    // Slightly higher, more dissonant drone
    droneB = zzfxGenerate(...[
        .28, 0, 82.5, .6, 3.5, 2.8, 0, 1.1, , , , , , .2, .6, , .35, .55, .7, .4, -55
    ]);

    // Slow pulse / heartbeat
    pulse = zzfxGenerate(...[
        .4, 0, 48, .08, .4, .6, 2, .8, , , , , .5, 1.2, , , .2, .7, .3
    ]);

    // Distant cold pad (adds atmosphere)
    pad = zzfxGenerate(...[
        .22, 0, 110, 1, 3, 2.5, 0, 1.3, , , , , , .1, .3, , .5, .4, .9, .5, -30
    ]);

    snare = zzfxGenerate(...[.9, , 655, , , .09, 3, 1.65, , , , , .02, 3.8, -.1, , .2]);
    bass = zzfxGenerate(...[2.25, , 43, , , .25, , , , , , , , 2]);
};

let beat = 0;
let timer = 0;
let bpm = (1 / (55 / 60) * 1000) * 0.25;

export let playMusic = (delta: number) => {
    // if (gameState[GS_MUTEMUSIC]) return;

    timer -= delta;
    if (timer <= 0) {
        timer = bpm;

        if (beat % 16 === 0) {
            zzfxPlay(bass);
        }
        if ((beat - 6) % 16 === 0) {
            zzfxPlay(snare);
        }

        // Continuous low drones (play every few bars so they overlap and never die)
        if (beat % 32 === 0) zzfxPlay(droneA);
        if (beat % 48 === 16) zzfxPlay(droneB);

        // Slow pulse every 8 beats
        if (beat % 32 === 0) zzfxPlay(pulse);

        // Sparse cold pad
        if (beat % 64 === 24) zzfxPlay(pad);

        beat = (beat + 1) % 128;
    }
};