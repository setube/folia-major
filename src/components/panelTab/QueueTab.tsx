import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { ListEnd, ListPlus, Search, Shuffle, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SongResult } from '../../types';
import TextInputDialog from '../shared/TextInputDialog';
import { getSongUnavailableLabel, isSongUnavailable } from '../../services/onlineMusic/songAvailability';
import { getSongArtistLabel } from '../../services/onlineMusic/songMetadata';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
import { filterQueueSongs, type QueueSearchMatch } from '../../utils/queueSearch';

// src/components/panelTab/QueueTab.tsx

interface QueueTabProps {
    playQueue: SongResult[];
    currentSong: SongResult | null;
    onPlaySong: (song: SongResult, queue: SongResult[]) => void;
    queueScrollRef: React.RefObject<HTMLDivElement | null>;
    shouldScrollToCurrent?: boolean;
    onShuffle?: () => void;
    onRemoveSong: (index: number) => void;
    onMoveSongToEnd: (index: number) => void;
    onMoveSongToNext: (index: number) => void;
    canSaveLocalPlaylist?: boolean;
    onSaveCurrentQueueAsPlaylist?: (name: string) => Promise<void>;
    isDaylight?: boolean;
}

type QueueRowProps = {
    /** 过滤后的可见条目，每条带着它在完整队列中的下标。 */
    matches: QueueSearchMatch[];
    /** 完整队列。点歌要把它整个传出去，否则搜索时播放会把队列缩成搜索结果。 */
    playQueue: SongResult[];
    currentSongKey: string | null;
    onPlaySong: QueueTabProps['onPlaySong'];
    onMoveSongToNext: QueueTabProps['onMoveSongToNext'];
    onMoveSongToEnd: QueueTabProps['onMoveSongToEnd'];
    onRemoveSong: QueueTabProps['onRemoveSong'];
    isDaylight: boolean;
    labels: {
        unavailable: string;
        playNext: string;
        moveToEnd: string;
        remove: string;
    };
};

// Kept outside QueueTab so track changes update row data without remounting hovered action buttons.
const QueueRow = ({
    index,
    style,
    ariaAttributes,
    matches,
    playQueue,
    currentSongKey,
    onPlaySong,
    onMoveSongToNext,
    onMoveSongToEnd,
    onRemoveSong,
    isDaylight,
    labels,
}: RowComponentProps<QueueRowProps>): React.ReactElement => {
    // index 是可见行的序号；队列操作一律用 queueIndex（完整队列中的位置），
    // 否则搜索状态下删除会删错歌。
    const { song, index: queueIndex } = matches[index];
    const isLastInQueue = queueIndex === playQueue.length - 1;
    const isActive = currentSongKey === getPlaybackSongKey(song);
    const isUnavailable = isSongUnavailable(song);
    const unavailableTagText = getSongUnavailableLabel(song, labels.unavailable);
    const activeRowClass = isDaylight ? 'bg-black/[0.08]' : 'bg-white/20';
    const activeMarkerClass = isDaylight ? 'bg-zinc-700' : 'bg-white';
    const hoverRowClass = isDaylight ? 'hover:bg-black/[0.04]' : 'hover:bg-white/5';

    return (
        <div
            style={style}
            onClick={() => onPlaySong(song, playQueue)}
            data-active={isActive}
            {...ariaAttributes}
            className={`group flex items-center gap-3 px-2 py-1 rounded-lg cursor-pointer transition-colors
                ${isActive ? activeRowClass : hoverRowClass} ${isUnavailable ? 'opacity-55' : ''}`}
        >
            <div className={`w-1 h-6 rounded-full ${isActive ? activeMarkerClass : 'bg-transparent'}`} />
            <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">
                    {song.name}
                    {isUnavailable && (
                        <span className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium align-middle ${isDaylight ? 'border-black/8 bg-black/[0.04] text-zinc-600' : 'border-white/10 bg-white/[0.05] text-zinc-300'}`}>
                            {unavailableTagText}
                        </span>
                    )}
                </div>
                <div className="text-[10px] opacity-40 truncate">{getSongArtistLabel(song)}</div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto">
                {[
                    { label: labels.playNext, icon: ListPlus, action: onMoveSongToNext, hidden: false },
                    // 已经在队尾就不给这个按钮：点了也不会有任何变化。
                    { label: labels.moveToEnd, icon: ListEnd, action: onMoveSongToEnd, hidden: isLastInQueue },
                    { label: labels.remove, icon: Trash2, action: onRemoveSong, hidden: false },
                ].filter(({ hidden }) => !hidden).map(({ label, icon: Icon, action }) => (
                    <button
                        key={label}
                        type="button"
                        title={label}
                        aria-label={label}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (event.detail > 0) {
                                event.currentTarget.blur();
                            }
                            action(queueIndex);
                        }}
                        className={`rounded-md p-1.5 transition-colors ${isDaylight ? 'hover:bg-black/10' : 'hover:bg-white/10'}`}
                    >
                        <Icon size={13} />
                    </button>
                ))}
            </div>
        </div>
    );
};

// react-window 需要一个确定的列表高度，因此这些尺寸只能写死。
// 外层上限由各部分累加而来，而不是另写一个魔数 ——
// 之前加搜索框时上限没跟着涨，最后一行就被压掉了一截。
// 搜索框跟随应用明暗主题，不跟歌曲主题色 —— 功能性控件每首歌换色反而难认。
// 取值与同样跟随明暗的托盘菜单一致。
const SEARCH_SURFACE_LIGHT = 'rgba(250, 250, 252, 0.97)';
const SEARCH_SURFACE_DARK = 'rgba(32, 32, 36, 0.97)';
const SEARCH_BORDER_LIGHT = 'rgba(0, 0, 0, 0.10)';
const SEARCH_BORDER_DARK = 'rgba(255, 255, 255, 0.12)';

const ITEM_HEIGHT = 50;
const VISIBLE_ROW_COUNT = 5;
const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ROW_COUNT;
/** 标题行（含 pb-2）实测高度。 */
const HEADER_ROW_HEIGHT = 34;
// 搜索框是浮层，覆盖在标题行之上，不占布局高度，因此不计入上限。
const PANEL_MAX_HEIGHT = CONTAINER_HEIGHT + HEADER_ROW_HEIGHT;

const QueueTab: React.FC<QueueTabProps> = ({
    playQueue,
    currentSong,
    onPlaySong,
    queueScrollRef,
    shouldScrollToCurrent = false,
    onShuffle,
    onRemoveSong,
    onMoveSongToEnd,
    onMoveSongToNext,
    canSaveLocalPlaylist = false,
    onSaveCurrentQueueAsPlaylist,
    isDaylight = false,
}) => {
    const { t } = useTranslation();
    const currentSongKey = currentSong ? getPlaybackSongKey(currentSong) : null;
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const matches = React.useMemo(() => filterQueueSongs(playQueue, searchQuery), [playQueue, searchQuery]);
    const isSearching = searchQuery.trim().length > 0;

    // 队列换了内容（切歌单、清空）就把搜索条件收回，免得面板再打开时停在旧的过滤结果上。
    React.useEffect(() => {
        if (playQueue.length === 0) {
            setSearchQuery('');
            setIsSearchOpen(false);
        }
    }, [playQueue.length]);

    // 展开即聚焦，省一次点击。
    React.useEffect(() => {
        if (isSearchOpen) {
            searchInputRef.current?.focus();
        }
    }, [isSearchOpen]);

    // 关闭时清空关键词：留着会让列表停在过滤状态，而入口已经收起来了，看不出为什么少歌。
    const closeSearch = React.useCallback(() => {
        setIsSearchOpen(false);
        setSearchQuery('');
    }, []);
    const listRef = useListRef(null);
    const isInitialMountRef = React.useRef(true);
    const lastScrolledSongKeyRef = React.useRef<string | null>(null);
    const wasOpenRef = React.useRef(false);
    const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
    const rowProps = React.useMemo<QueueRowProps>(() => ({
        matches,
        playQueue,
        currentSongKey,
        onPlaySong,
        onMoveSongToNext,
        onMoveSongToEnd,
        onRemoveSong,
        isDaylight,
        labels: {
            unavailable: t('status.songUnavailableTag'),
            playNext: t('queue.playNext'),
            moveToEnd: t('queue.moveToEnd'),
            remove: t('queue.remove'),
        },
    }), [
        currentSongKey,
        isDaylight,
        matches,
        onMoveSongToEnd,
        onMoveSongToNext,
        onPlaySong,
        onRemoveSong,
        playQueue,
        t,
    ]);

    // Reset initial mount state when panel is opened
    React.useEffect(() => {
        if (shouldScrollToCurrent && !wasOpenRef.current) {
            isInitialMountRef.current = true;
            wasOpenRef.current = true;
        } else if (!shouldScrollToCurrent) {
            wasOpenRef.current = false;
        }
    }, [shouldScrollToCurrent]);

    // 自动滚到当前曲目。触发条件只有两个：面板刚打开、当前曲目换了。
    // 队列改动（移到队尾、删除、搜索过滤）不该把用户浏览的位置拽回来 ——
    // 之前按下标比较，改一次队列下标就变，于是每次操作后滚动条都被重置。
    React.useEffect(() => {
        if (!shouldScrollToCurrent || !currentSongKey || !listRef.current) {
            return;
        }

        const isInitialMount = isInitialMountRef.current;
        const songChanged = lastScrolledSongKeyRef.current !== currentSongKey;
        if (!isInitialMount && !songChanged) {
            return;
        }

        const currentIndex = matches.findIndex(match => getPlaybackSongKey(match.song) === currentSongKey);
        if (currentIndex < 0) {
            return;
        }

        const behavior = isInitialMount ? 'instant' : 'smooth';
        const delay = isInitialMount ? 0 : 50;

        setTimeout(() => {
            if (listRef.current) {
                listRef.current.scrollToRow({
                    index: currentIndex,
                    align: 'center',
                    behavior: behavior as 'instant' | 'smooth',
                });
                lastScrolledSongKeyRef.current = currentSongKey;
                isInitialMountRef.current = false;
            }
        }, delay);
    }, [shouldScrollToCurrent, currentSongKey, matches, listRef]);

    const handleSavePlaylist = async () => {
        if (!onSaveCurrentQueueAsPlaylist) {
            return;
        }
        setIsSaveDialogOpen(true);
    };

    // 浮在半透明面板之上，本身必须近乎不透明：再叠一层半透明只会糊成一条模糊色带。
    const searchFieldStyle: React.CSSProperties = isDaylight
        ? { backgroundColor: SEARCH_SURFACE_LIGHT, borderColor: SEARCH_BORDER_LIGHT }
        : { backgroundColor: SEARCH_SURFACE_DARK, borderColor: SEARCH_BORDER_DARK };

    if (playQueue.length === 0) {
        return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col h-full select-none" style={{ maxHeight: PANEL_MAX_HEIGHT }}>
                <div className="flex items-center justify-center h-full text-xs opacity-40">
                    {t('queue.empty')}
                </div>
            </motion.div>
        );
    }

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex flex-col h-full select-none" style={{ maxHeight: PANEL_MAX_HEIGHT }}>
                <div className="flex items-center justify-between px-2 pb-2 shrink-0">
                    <span className="text-xs font-medium opacity-60">
                        {t('queue.title')} ({isSearching ? `${matches.length}/${playQueue.length}` : playQueue.length})
                    </span>
                    <div className="flex items-center gap-1">
                        {canSaveLocalPlaylist && (
                            <button
                                onClick={handleSavePlaylist}
                                className="px-2 py-1 rounded-md hover:bg-white/10 transition-colors opacity-60 hover:opacity-100 text-[10px] font-medium"
                                title={t('localMusic.saveQueueAsPlaylist')}
                            >
                                {t('localMusic.saveQueueAsPlaylist')}
                            </button>
                        )}
                        {onShuffle && (
                            <button
                                onClick={onShuffle}
                                className="p-1.5 rounded-md hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
                                title={t('queue.shuffle')}
                            >
                                <Shuffle size={14} />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
                            aria-expanded={isSearchOpen}
                            title={t('queue.searchPlaceholder')}
                            aria-label={t('queue.searchPlaceholder')}
                            className={`p-1.5 rounded-md hover:bg-white/10 transition-colors hover:opacity-100 ${
                                isSearchOpen || isSearching ? 'opacity-100' : 'opacity-60'
                            }`}
                        >
                            <Search size={14} />
                        </button>
                    </div>
                </div>

                {/* 浮层而非独立一行：盖在标题行之上，不挤占列表高度，收起时列表也不会跳动 */}
                <AnimatePresence>
                    {isSearchOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-x-2 top-0 z-10"
                        >
                            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-lg" style={searchFieldStyle}>
                                <Search size={13} className="shrink-0 opacity-40" />
                                <input
                                    ref={searchInputRef}
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            event.stopPropagation();
                                            closeSearch();
                                        }
                                    }}
                                    placeholder={t('queue.searchPlaceholder')}
                                    aria-label={t('queue.searchPlaceholder')}
                                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-40 [&::-webkit-search-cancel-button]:hidden"
                                />
                                <button
                                    type="button"
                                    onClick={closeSearch}
                                    aria-label={t('ui.close')}
                                    title={t('ui.close')}
                                    className="shrink-0 rounded p-0.5 opacity-40 transition-opacity hover:opacity-90"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div
                    ref={queueScrollRef}
                    className="flex-1 -mx-2 px-2 overflow-hidden"
                >
                    {matches.length === 0 ? (
                        <div
                            className="flex items-center justify-center text-xs opacity-40"
                            style={{ height: CONTAINER_HEIGHT }}
                        >
                            {t('queue.searchEmpty')}
                        </div>
                    ) : (
                        <List
                            listRef={listRef}
                            rowCount={matches.length}
                            rowHeight={ITEM_HEIGHT}
                            rowComponent={QueueRow}
                            rowProps={rowProps}
                            overscanCount={5}
                            className="custom-scrollbar"
                            style={{ height: CONTAINER_HEIGHT, width: '100%' }}
                        />
                    )}
                </div>
            </motion.div>

            <TextInputDialog
                isOpen={isSaveDialogOpen}
                onClose={() => setIsSaveDialogOpen(false)}
                isDaylight={isDaylight}
                title={t('localMusic.saveQueueAsPlaylist')}
                description={t('localMusic.enterPlaylistName')}
                placeholder={t('localMusic.enterPlaylistName')}
                confirmLabel={t('localMusic.save')}
                onConfirm={async (playlistName) => {
                    try {
                        await onSaveCurrentQueueAsPlaylist?.(playlistName);
                    } catch (error) {
                        console.error('Failed to save local playlist', error);
                    }
                }}
            />
        </>
    );
};

export default QueueTab;
