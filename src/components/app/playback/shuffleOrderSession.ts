// src/components/app/playback/shuffleOrderSession.ts
// 随机播放路线图的会话级唯一实例。
// 切歌（usePlaybackQueueController）、automix 与预取（nextTransitionSong）必须读同一条路线，
// 否则过渡会混进路线之外的歌；所以路线放在模块里，不放在某个 hook 的 ref 里。
// 只在切歌、插队、队列增删时读写，不参与渲染。落盘由 usePlaybackQueueController 负责。

import { createShuffleOrderState, type ShuffleOrderState } from './shuffleOrder';

let shuffleOrderState: ShuffleOrderState = createShuffleOrderState();

export const getShuffleOrderState = (): ShuffleOrderState => shuffleOrderState;

export const setShuffleOrderState = (state: ShuffleOrderState): void => {
    shuffleOrderState = state;
};

/** 测试用：回到空路线。 */
export const resetShuffleOrderState = (): void => {
    shuffleOrderState = createShuffleOrderState();
};
