import { describe, expect, it } from 'vitest';
import { buildQueueSearchIndex } from '@/components/command-palette/queueSearchIndex';
import { filterBySearchText } from '@/components/command-palette/search/normalize';
import type { SongResult } from '@/types';

// test/unit/command-palette/filterBySearchText.test.ts
// 侧边面板播放列表的搜索：结果必须是完整队列里的下标。
// 移除、下一首播、移到末尾都按下标寻址，返回过滤列表的下标会在搜索状态下删错歌。

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
const index = buildQueueSearchIndex(queue);

describe('filterBySearchText', () => {
    it('空关键词返回整条队列', () => {
        expect(filterBySearchText(index, '   ')).toEqual([0, 1, 2]);
    });

    it('返回完整队列中的下标', () => {
        expect(filterBySearchText(index, 'yesterday')).toEqual([2]);
    });

    it('曲名与歌手都能命中，不区分大小写', () => {
        expect(filterBySearchText(index, 'QUEEN')).toEqual([0]);
        expect(filterBySearchText(index, '周杰伦')).toEqual([1]);
    });

    it('每个词都要命中，顺序不限', () => {
        expect(filterBySearchText(index, 'beatles  yesterday')).toEqual([2]);
        expect(filterBySearchText(index, 'beatles queen')).toEqual([]);
    });
});
