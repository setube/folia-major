// src/utils/audioFade.ts
// 播放淡入淡出的纯计算层：时长档位、场景缩放，以及对 AudioParam 的斜坡调度。
//
// 场景划分参照网易云客户端 cloudmusic.dll 里的九个常量
// （PauseFadeIn/PauseFadeOut、SeekFadeIn/SeekFadeOut、ManualTrackChangeFade*、
// AutoTrackChangeFade*、StopFadeOut）—— 它并不是一个全局淡变，而是按场景分别配时长。
// 执行者是 player::AudioVolumeFade，一个定时器驱动的音量斜坡；浏览器侧用
// AudioParam 的 linearRampToValueAtTime 表达同一件事，精度还更高（跑在音频线程）。

export type AudioFadeDuration = 'fast' | 'standard' | 'smooth';

/** 淡变涉及的场景。trackStart 只有淡入，stop 只有淡出。 */
export type AudioFadeScene = 'pause' | 'resume' | 'seek' | 'trackStart' | 'stop';

export const AUDIO_FADE_DURATIONS: readonly AudioFadeDuration[] = ['fast', 'standard', 'smooth'];

export const AUDIO_FADE_DURATION_MS: Record<AudioFadeDuration, number> = {
    fast: 200,
    standard: 400,
    smooth: 800,
};

// 拖动进度只需要极短的遮蔽盖住解码跳变，用完整时长会让人觉得"音量在抖"；
// 切歌起播则希望比暂停恢复更从容一点。
const SCENE_SCALE: Record<AudioFadeScene, number> = {
    pause: 1,
    resume: 1,
    seek: 0.35,
    trackStart: 1.25,
    stop: 1,
};

export const isAudioFadeDuration = (value: unknown): value is AudioFadeDuration =>
    typeof value === 'string' && (AUDIO_FADE_DURATIONS as readonly string[]).includes(value);

/** 关闭开关时一律返回 0，调用方据此走"直接赋值"的旧路径。 */
export const resolveFadeMs = (
    enabled: boolean,
    duration: AudioFadeDuration,
    scene: AudioFadeScene,
): number => {
    if (!enabled) {
        return 0;
    }

    return Math.round(AUDIO_FADE_DURATION_MS[duration] * SCENE_SCALE[scene]);
};

/** AudioParam 中本模块实际用到的部分，便于单测用假对象替身。 */
export interface FadeRampParam {
    readonly value: number;
    cancelScheduledValues(startTime: number): void;
    setValueAtTime(value: number, startTime: number): void;
    linearRampToValueAtTime(value: number, endTime: number): void;
}

/**
 * 把增益斜坡到目标值。
 *
 * 起点取 `param.value`（当前真实增益）而不是上一次的目标值：打断一段进行中的淡变时，
 * 若不先把当前值锚定下来，cancelScheduledValues 之后的 ramp 会从上一个 setValueAtTime
 * 的值起算，听感上就是一次跳变。
 */
export const rampGainTo = (
    param: FadeRampParam,
    currentTime: number,
    targetValue: number,
    fadeMs: number,
): void => {
    param.cancelScheduledValues(currentTime);

    if (fadeMs <= 0) {
        param.setValueAtTime(targetValue, currentTime);
        return;
    }

    param.setValueAtTime(param.value, currentTime);
    param.linearRampToValueAtTime(targetValue, currentTime + fadeMs / 1000);
};
