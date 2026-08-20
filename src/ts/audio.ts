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

let zzfxVolume: number = 0.3;
let zzfxSampleRate: number = 44100;
let zzfxContext: AudioContext;

export let boop: number[];
export let boopGood: number[];
export let playerShoot: number[];
export let enemyShoot: number[];

let bass: number[];
let snare: number[];
let hihat: number[];
let bassSynthC: number[];
let bassSynthB: number[];
let bassSynthA: number[];

export let zzfxInit = (): void => {
    if (!zzfxContext) {
        zzfxContext = new AudioContext();
    }
    boop = zzfxGenerate(...[, , , .05, .05, , , , , , 200, .06, , , , , , .5, .05]);
    boopGood = zzfxGenerate(...[, , 440, .05, .05, , , , , , 200, .06, , , , , , .5, .05, 1]);
    playerShoot = zzfxGenerate(...[.6, , , .02, , .05, 4, , , , , , , , , , .2, , .01]);
    enemyShoot = zzfxGenerate(...[2, , 880, .28, , 0, 2, 4, , -83, 45, .06, .08, , , , .3, .7, .08, .3]);

    snare = zzfxGenerate(...[.9, , 655, , , .09, 3, 1.65, , , , , .02, 3.8, -.1, , .2]);
    hihat = zzfxGenerate(...[.7, , 2200, , , .04, 3, 2, , , 800, .02, , 4.8, , .01, .1]);
    bass = zzfxGenerate(...[2.25, , 43, , , .25, , , , , , , , 2]);

    bassSynthC = zzfxGenerate(...[.6, 0, 65.40639, .08, 1.5, 1, 2, .2, , , , , , .1, , , .19, .42, .15]);
    bassSynthB = zzfxGenerate(...[.6, 0, 123.4708, .08, .96, 1, 2, .2, , , , , , .1, , , .19, .42, .15]);
    bassSynthA = zzfxGenerate(...[.6, 0, 110, .08, 1.25, 1, 2, .2, , , , , , .1, , , .19, .42, .15]);
};

