import { bossActive, inCombat } from "./entity";
import { saveState } from "./gameState";
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
export let sfxHeal: number[];
export let sfxWall: number[];
export let sfxEnemyMelee: number[];
export let sfxEnemyAlert: number[];
export let sfxEnemyRanged: number[];
export let sfxEnemyDeath: number[];

let pulse: number[];
let bass: number[];
let kick: number[];
let clap: number[];
let snare: number[];
let hihat: number[];

export let zzfxInit = (): void => {
    if (!zzfxContext) {
        zzfxContext = new AudioContext();
    }

    sfxFootstep = zzfxGenerate(...[.12, .18, 95, .005, .015, .06, 4, 1.6, , , , , , 2.8, , .12, .08]);
    sfxLaserCharge = zzfxGenerate(...[.15, , 354, .2, 1, .5, 3, 2, 1, , , , , , 40, , , .5, , , 308]);
    sfxLaserFire = zzfxGenerate(...[.7, .03, 880, .02, .05, .18, 1, 1.4, -12, 3, 220, .04, , .1, .8, , .05, .9, .02]);

    sfxPlayerHurt = zzfxGenerate(...[.8, .08, 320, .01, .02, .22, 3, 2.2, -8, , -180, .08, , 1.5, , .1, .15]);
    sfxHeal = zzfxGenerate(...[, , 261, .01, .2, .3, 1, , 2, , 300, .05, .05, , , , .1, .7]);
    sfxWall = zzfxGenerate(...[, , 60, .05, , 1, 4, .3, -1, -9, , , , , , .8, , .7]);
    sfxEnemyMelee = zzfxGenerate(...[.9, .05, 110, .01, .04, .18, 3, 1.9, , , , , , 2.2, , .15, .2]);
    sfxEnemyAlert = zzfxGenerate(...[.55, .1, 520, .02, .05, .12, 2, 2.4, 4, , 180, .06, , .8, , .08, .1]);
    sfxEnemyRanged = zzfxGenerate(...[.65, .04, 280, .03, .08, .22, 1, 1.7, -6, 2, -90, .05, , .4, 1.1, , .12, .7, .04]);
    sfxEnemyDeath = zzfxGenerate(...[1, .12, 180, .02, .15, .4, 3, 2.6, -4, , -120, .12, , 3, , .2, .25]);

    pulse = zzfxGenerate(...[.4, 0, 48, .08, .4, .6, 2, .8, , , , , .5, 1.2, , , .2, .7, .3]);

    snare = zzfxGenerate(...[.9, , 655, , , .09, 3, 1.65, , , , , .02, 3.8, -.1, , .2]);
    bass = zzfxGenerate(...[3, 0, 45, , .1, .25, , , , , , , , 2]);
    kick = zzfxGenerate(...[3, , 65, , , , , , , , , , , 1, 10, , , , .05, , 40]);
    clap = zzfxGenerate(...[.7, , , , , , 4, 1.75, -0.1, , , , , , , .1]);
    hihat = zzfxGenerate(...[.7, , , , , , 4, , , , , , , , , , , , .03, , 6e3]);
};

let beat = 0;
let timer = 0;
let bpm = (1 / (55 / 60) * 1000) * 0.25;
let bpm2 = (1 / (120 / 60) * 1000) * 0.25;

export let playMusic = (delta: number) => {
    if (!saveState[GS_OPT_MUSIC]) return;

    const boss = bossActive();
    const combat = inCombat();

    const step = boss || combat ? bpm2 : bpm;

    timer -= delta;
    if (timer <= 0) {
        timer = step;

        if (boss) {
            if (beat % 4 === 0) zzfxPlay(kick);
            if (beat % 16 === 3 || beat % 16 === 6) zzfxPlay(bass);
            if (beat % 8 === 4) zzfxPlay(clap);
            if (beat % 4 === 2) zzfxPlay(hihat);

            if (beat % 32 === 0) zzfxPlay(pulse);
        } else if (combat) {
            if (beat % 16 === 0 || beat % 16 === 7 || beat % 16 === 10 || beat % 16 === 12) zzfxPlay(kick);
            if (beat % 16 === 4 || beat % 16 === 12) zzfxPlay(snare);
            if (beat % 4 === 2) zzfxPlay(hihat);
            if (beat % 16 === 0 || beat % 16 === 7 || beat % 16 === 10) zzfxPlay(bass);

            if (beat % 32 === 0) zzfxPlay(pulse);
        } else {
            if (beat % 16 === 0) zzfxPlay(bass);
            if ((beat - 6) % 16 === 0) zzfxPlay(snare);

            if (beat % 32 === 0) zzfxPlay(pulse);
        }

        beat = (beat + 1) % 128;
    }
};