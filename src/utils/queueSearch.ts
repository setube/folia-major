import type { SongResult } from '../types';
import { getProviderSongMetadata, getSongAlbumLabel, getSongArtistLabel } from '../services/onlineMusic/songMetadata';

// src/utils/queueSearch.ts
// 播放队列的文本检索，命令面板与播放列表共用同一套归一化规则。
//
// 两处的可检索字段不同：播放列表只认曲名与歌手（面板窄，用户找的就是这两样）；
// 命令面板还带上序号、专辑、别名与译名 —— 它的条目本来就标着 "Queue #N"，
// 序号是个有效入口。归一化共用，字段范围各自决定。

export interface QueueSearchMatch {
    song: SongResult;
    /** 在**完整队列**中的下标。移除、置顶、移到末尾都按它操作。 */
    index: number;
}

export const normalizeQueueSearchText = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

/** 播放列表面板用：只认曲名与歌手。 */
export const buildQueueSongFilterText = (song: SongResult): string =>
    [song.name, getSongArtistLabel(song)].filter(Boolean).join(' ');

/** 命令面板用：序号、曲名、歌手、专辑、别名与译名都可检索。 */
export const buildQueueSongSearchText = (song: SongResult, index: number): string => {
    const metadata = getProviderSongMetadata(song);
    return [
        String(index + 1),
        song.name,
        getSongArtistLabel(song),
        getSongAlbumLabel(song),
        ...metadata.aliases,
        ...metadata.translatedNames,
    ].filter(Boolean).join(' ');
};

/**
 * 按关键词过滤队列，保留每首歌在原队列中的下标。
 *
 * 返回下标而不是只返回歌曲，是因为队列操作（移除 / 下一首播 / 移到末尾）全按下标寻址：
 * 过滤后若用过滤列表的下标去调用，删的会是另一首歌。
 */
export const filterQueueSongs = (playQueue: SongResult[], query: string): QueueSearchMatch[] => {
    const entries = playQueue.map((song, index) => ({ song, index }));
    const normalizedQuery = normalizeQueueSearchText(query);
    if (!normalizedQuery) {
        return entries;
    }

    return entries.filter(({ song }) =>
        normalizeQueueSearchText(buildQueueSongFilterText(song)).includes(normalizedQuery));
};
