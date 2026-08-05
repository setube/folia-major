import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Disc } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import QueueTab from '../panelTab/QueueTab';
import type { SongResult } from '../../types';

// src/components/player-controls/QueuePopover.tsx
// 播放列表浮层：控制栏的播放列表按钮唯一的落点，所有视图通用。
//
// 视觉沿用播放页右下角面板（UnifiedPanel）的那张玻璃卡片 —— 同样的宽度、圆角、
// 顶部方形封面与曲目信息，让两处观感一致。但只承载播放列表本身：
// 不带标签切换、不带设置入口，避免在不该出现设置的视图里把它一起带出来。

const POPOVER_WIDTH_CLASS = 'w-80';

export type QueuePopoverProps = {
    isOpen: boolean;
    onClose: () => void;
    playQueue: SongResult[];
    currentSong: SongResult | null;
    coverUrl: string | null;
    onPlaySong: (song: SongResult, queue: SongResult[]) => void;
    onShuffle?: () => void;
    onRemoveSong: (index: number) => void;
    onMoveSongToEnd: (index: number) => void;
    onMoveSongToNext: (index: number) => void;
    isDaylight: boolean;
};

const QueuePopover: React.FC<QueuePopoverProps> = ({
    isOpen,
    onClose,
    playQueue,
    currentSong,
    coverUrl,
    onPlaySong,
    onShuffle,
    onRemoveSong,
    onMoveSongToEnd,
    onMoveSongToNext,
    isDaylight,
}) => {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const glassBg = isDaylight ? 'bg-white/60' : 'bg-black/40';
    const placeholderBg = isDaylight ? 'bg-stone-200' : 'bg-zinc-900';

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        // 用 pointerdown 而不是 click：click 会先被列表行的播放处理吃掉一次，
        // 点自己的行会先关闭浮层再播放，观感是"点一下就没了"。
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target || containerRef.current?.contains(target)) {
                return;
            }
            // 控制栏上的播放列表按钮自己会 toggle，别让这里再关一次，否则点它等于没反应。
            if (target instanceof Element && target.closest('[data-queue-popover-trigger="true"]')) {
                return;
            }
            onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('pointerdown', handlePointerDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('pointerdown', handlePointerDown);
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={containerRef}
                    initial={{ opacity: 0, scale: 0.9, originY: 1, originX: 1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    role="dialog"
                    aria-label={t('queue.title')}
                    className={`fixed bottom-28 right-4 md:right-8 z-[60] ${POPOVER_WIDTH_CLASS} max-h-[calc(100dvh-9rem)] ${glassBg} backdrop-blur-3xl rounded-3xl shadow-2xl flex flex-col overflow-y-auto hide-scrollbar`}
                    style={{ color: 'var(--text-primary)' }}
                >
                    <div className="p-5 flex flex-col">
                        <div className={`w-full aspect-square rounded-2xl overflow-hidden shadow-lg relative mb-4 ${placeholderBg} flex items-center justify-center`}>
                            {coverUrl
                                ? <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                                : <Disc size={40} className="text-white/20" />}
                        </div>

                        <div className="flex-1 min-h-[70px]">
                            <QueueTab
                                playQueue={playQueue}
                                currentSong={currentSong}
                                onPlaySong={onPlaySong}
                                queueScrollRef={scrollRef}
                                shouldScrollToCurrent={isOpen}
                                onShuffle={onShuffle}
                                onRemoveSong={onRemoveSong}
                                onMoveSongToEnd={onMoveSongToEnd}
                                onMoveSongToNext={onMoveSongToNext}
                                isDaylight={isDaylight}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default QueuePopover;
