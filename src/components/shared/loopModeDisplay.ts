import { ListOrdered, Repeat, Repeat1, Shuffle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StageLoopMode } from '../../types';
// src/components/shared/loopModeDisplay.ts
// How the repeat button shows each repeat mode: its icon and the name of its label. Used by the
// side panel's song actions, the player bar's slot and the remote window.
// 循环按钮按 顺序播放 → 列表循环 → 单曲循环 → 随机播放 轮换，'off' 即顺序播放，图标用列表而不是划掉的循环。

export const loopModeIcon = (loopMode: StageLoopMode): LucideIcon => {
    if (loopMode === 'off') return ListOrdered;
    if (loopMode === 'one') return Repeat1;
    if (loopMode === 'shuffle') return Shuffle;
    return Repeat;
};

/** The last part of the label's i18n key: the main window's labels are `player.<name>`, the remote window's `remote.<name>`. */
export const loopModeLabelName = (loopMode: StageLoopMode): 'loopOff' | 'loopOne' | 'loopAll' | 'loopShuffle' => {
    if (loopMode === 'off') return 'loopOff';
    if (loopMode === 'one') return 'loopOne';
    if (loopMode === 'shuffle') return 'loopShuffle';
    return 'loopAll';
};
