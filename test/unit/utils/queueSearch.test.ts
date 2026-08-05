import { describe, expect, it } from 'vitest';
import { buildQueueSongFilterText, buildQueueSongSearchText, filterQueueSongs, normalizeQueueSearchText } from '@/utils/queueSearch';
import type { SongResult } from '@/types';

// test/unit/utils/queueSearch.test.ts
// 重点锁定"过滤后仍返回完整队列中的下标"——队列的移除/置顶/移到末尾都按下标寻址，
// 若返回过滤列表的下标，搜索状态下删除会删错歌。

const song = (id: number, name: string, artist: string): SongResult => ({
    id,
    name,
    ar: [{ id: id * 10, name: artist }],
    al: { id: id * 100, name: `${name} 专辑`, picUrl: '' },
} as unknown as SongResult);

const queue: SongResult[] = [
    song(1, 'Bohemian Rhapsody', 'Queen'),
    song(2, '晴天', '周杰伦'),
    song(3, 'Yesterday', 'The Beatles'),
];

describe('normalizeQueueSearchText', () => {
    it('去空白、转小写、压缩连续空格', () => {
        expect(normalizeQueueSearchText('  Hello   World ')).toBe('hello world');
    });
});

describe('buildQueueSongSearchText', () => {
    it('命令面板用的文本包含序号、曲名、歌手与专辑', () => {
        const text = buildQueueSongSearchText(queue[1], 1);

        expect(text).toContain('2');
        expect(text).toContain('晴天');
        expect(text).toContain('周杰伦');
        expect(text).toContain('专辑');
    });
});

describe('buildQueueSongFilterText', () => {
    it('播放列表用的文本只含曲名与歌手', () => {
        const text = buildQueueSongFilterText(queue[1]);

        expect(text).toContain('晴天');
        expect(text).toContain('周杰伦');
        expect(text).not.toContain('专辑');
    });
});

describe('filterQueueSongs', () => {
    it('空关键词返回整条队列，下标与原队列一致', () => {
        expect(filterQueueSongs(queue, '   ')).toEqual([
            { song: queue[0], index: 0 },
            { song: queue[1], index: 1 },
            { song: queue[2], index: 2 },
        ]);
    });

    it('过滤结果保留在完整队列中的下标，而不是过滤列表的下标', () => {
        const matches = filterQueueSongs(queue, 'yesterday');

        expect(matches).toHaveLength(1);
        expect(matches[0].index).toBe(2);
        expect(matches[0].song).toBe(queue[2]);
    });

    it('曲名与歌手都能命中，且不区分大小写', () => {
        expect(filterQueueSongs(queue, 'QUEEN').map(m => m.index)).toEqual([0]);
        expect(filterQueueSongs(queue, '周杰伦').map(m => m.index)).toEqual([1]);
    });

    it('只匹配曲名与歌手：序号与专辑不参与过滤', () => {
        expect(filterQueueSongs(queue, '3')).toEqual([]);
        expect(filterQueueSongs(queue, '专辑')).toEqual([]);
    });

    it('无匹配时返回空数组', () => {
        expect(filterQueueSongs(queue, 'zzzz')).toEqual([]);
    });
});
