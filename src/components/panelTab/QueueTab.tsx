import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { List, useListRef, type RowComponentProps } from 'react-window';
import { ListEnd, ListMusic, ListPlus, PanelsTopLeft, Search, Shuffle, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SongResult } from '../../types';
import TextInputDialog from '../shared/TextInputDialog';
import { Button } from '../modal/settings/kit';
import { useKitReducedMotion } from '../modal/settings/kit/motion';
import { getSongTag, isSongUnavailable } from '../../services/onlineMusic/songAvailability';
import { getSongArtistLabel } from '../../services/onlineMusic/songMetadata';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
import { buildQueueSearchIndex } from '../command-palette/queueSearchIndex';
import { filterBySearchText } from '../command-palette/search/normalize';
import { EmptyState } from './shell/EmptyState';
import { PanelIconButton } from './shell/PanelIconButton';

// src/components/panelTab/QueueTab.tsx
// The panel's queue tab: a line with the number of songs and the queue's own buttons, then the
// queue as a list that scrolls inside itself. The list is as tall as its rows, seven and a half
// of them at most, and lower where the window leaves less (--pn-tab-room, from the panel's frame);
// while more rows follow it fades at the bottom. A row plays its song; its three actions show
// under the pointer and when the keyboard reaches them.
// 标题行的搜索按钮展开一个浮在标题行上的搜索框，按曲名、歌手等过滤列表；检索文本与遥控窗口的队列搜索同一份。

const ROW_PX = 48;
/** The line above the list. */
const HEAD_PX = 36;
/** Seven and a half rows: the half row says that more follow. */
const LIST_MAX_PX = 7.5 * ROW_PX;
/** The list fades over this much of its bottom while more rows follow. */
const FADE = 'linear-gradient(#000 calc(100% - 32px), transparent)';

// 搜索框跟随应用明暗主题，不跟歌曲主题色：功能性控件每首歌换色反而难认。
// 它浮在半透明面板之上，本身必须近乎不透明，再叠一层半透明只会糊成一条模糊色带。
const SEARCH_SURFACE_LIGHT = 'rgba(250, 250, 252, 0.97)';
const SEARCH_SURFACE_DARK = 'rgba(32, 32, 36, 0.97)';
const SEARCH_BORDER_LIGHT = 'rgba(0, 0, 0, 0.10)';
const SEARCH_BORDER_DARK = 'rgba(255, 255, 255, 0.12)';

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
    /** Opens the same queue as a poster wall; absent when the host has no wall to show. */
    onOpenLattice?: () => void;
    onSaveCurrentQueueAsPlaylist?: (name: string) => Promise<void>;
    isDaylight?: boolean;
}

type QueueRowProps = {
    /** 可见行对应的完整队列下标（搜索时是过滤结果）。 */
    matches: number[];
    /** 完整队列。点歌要把它整个传出去，否则搜索时播放会把队列缩成搜索结果。 */
    playQueue: SongResult[];
    currentSongKey: string | null;
    onPlaySong: QueueTabProps['onPlaySong'];
    onMoveSongToNext: QueueTabProps['onMoveSongToNext'];
    onMoveSongToEnd: QueueTabProps['onMoveSongToEnd'];
    onRemoveSong: QueueTabProps['onRemoveSong'];
    labels: {
        unavailable: string;
        video: string;
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
    labels,
}: RowComponentProps<QueueRowProps>): React.ReactElement => {
    // index 是可见行的序号；队列操作一律用 queueIndex（完整队列中的位置），否则搜索状态下删除会删错歌。
    const queueIndex = matches[index];
    const song = playQueue[queueIndex];
    const isLastInQueue = queueIndex === playQueue.length - 1;
    const isActive = currentSongKey === getPlaybackSongKey(song);
    const isUnavailable = isSongUnavailable(song);
    const tag = getSongTag(song, labels);

    return (
        <div
            style={style}
            onClick={() => onPlaySong(song, playQueue)}
            data-active={isActive}
            {...ariaAttributes}
            className={`st-t-fast group flex cursor-pointer items-center rounded-lg pl-3 pr-1.5 transition-colors ${isActive ? 'bg-[var(--st-fill)]' : 'hover:bg-[var(--st-fill)] focus-within:bg-[var(--st-fill)]'}`}
        >
            {isActive && <span aria-hidden className="absolute inset-y-3.5 left-0 w-[3px] rounded-r-sm bg-[var(--st-accent)]" />}
            <div className={`min-w-0 flex-1 ${isUnavailable ? 'opacity-55' : ''}`}>
                <div className="flex items-center gap-2 text-[13px] leading-[19px]">
                    <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>{song.name}</span>
                    {tag && (
                        <span className="shrink-0 rounded bg-[var(--st-fill2)] px-[5px] py-px text-[11px] leading-[15px] text-[color:var(--st-t2)]">
                            {tag}
                        </span>
                    )}
                </div>
                <div className="truncate text-xs leading-[17px] text-[color:var(--st-t3)]">{getSongArtistLabel(song)}</div>
            </div>
            {/* No width until the pointer or the keyboard is on the row, so a long name has the whole row. Tab changes the panel's tab, so the keyboard does not walk into a row: the actions are the pointer's, as before. */}
            <div className="st-t-fast flex w-0 shrink-0 items-center gap-0.5 overflow-hidden opacity-0 transition-opacity group-focus-within:ml-2 group-focus-within:w-auto group-focus-within:opacity-100 group-hover:ml-2 group-hover:w-auto group-hover:opacity-100">
                {[
                    { label: labels.playNext, icon: ListPlus, action: onMoveSongToNext, hidden: false },
                    // 已经在队尾就不给这个按钮：点了也不会有任何变化。
                    { label: labels.moveToEnd, icon: ListEnd, action: onMoveSongToEnd, hidden: isLastInQueue },
                    { label: labels.remove, icon: Trash2, action: onRemoveSong, hidden: false },
                ].filter(({ hidden }) => !hidden).map(({ label, icon: Icon, action }) => (
                    <PanelIconButton
                        key={label}
                        size="s"
                        label={label}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (event.detail > 0) {
                                event.currentTarget.blur();
                            }
                            action(queueIndex);
                        }}
                    >
                        <Icon size={15} />
                    </PanelIconButton>
                ))}
            </div>
        </div>
    );
};

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
    onOpenLattice,
    onSaveCurrentQueueAsPlaylist,
    isDaylight = false,
}) => {
    const { t } = useTranslation();
    const reduced = useKitReducedMotion();
    const currentSongKey = currentSong ? getPlaybackSongKey(currentSong) : null;
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isSearchOpen, setIsSearchOpen] = React.useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const isSearching = searchQuery.trim().length > 0;
    // 只在搜索时建索引：长队列不搜的时候不必为它付这份开销。
    const searchIndex = React.useMemo(
        () => (isSearching ? buildQueueSearchIndex(playQueue) : null),
        [isSearching, playQueue],
    );
    const matches = React.useMemo(
        () => (searchIndex ? filterBySearchText(searchIndex, searchQuery) : playQueue.map((_, index) => index)),
        [playQueue, searchIndex, searchQuery],
    );
    // As tall as its rows up to the most it shows; never under two rows, so in a very low window
    // the tab scrolls instead.
    const rowsPx = Math.min(Math.max(matches.length, 1) * ROW_PX, LIST_MAX_PX);
    const listHeight = `clamp(${Math.min(rowsPx, 2 * ROW_PX)}px, calc(var(--pn-tab-room, 100vh) - ${HEAD_PX}px), ${rowsPx}px)`;

    // 队列清空（切歌单、清空）就把搜索收回，免得面板再打开时停在旧的过滤结果上。
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
    const [hasMoreBelow, setHasMoreBelow] = React.useState(false);
    const rowProps = React.useMemo<QueueRowProps>(() => ({
        matches,
        playQueue,
        currentSongKey,
        onPlaySong,
        onMoveSongToNext,
        onMoveSongToEnd,
        onRemoveSong,
        labels: {
            unavailable: t('status.songUnavailableTag'),
            video: t('status.songVideoTag'),
            playNext: t('queue.playNext'),
            moveToEnd: t('queue.moveToEnd'),
            remove: t('queue.remove'),
        },
    }), [
        currentSongKey,
        matches,
        onMoveSongToEnd,
        onMoveSongToNext,
        onPlaySong,
        onRemoveSong,
        playQueue,
        t,
    ]);

    // Whether rows follow under what the list shows: read before the first frame is drawn, and
    // when the list scrolls, changes size or length. On the first frame the list's handle has no
    // element yet; the list is the one child of the element around it.
    const readHasMoreBelow = React.useCallback(() => {
        const list = listRef.current?.element ?? queueScrollRef.current?.firstElementChild;
        if (list) {
            setHasMoreBelow(list.scrollHeight - list.scrollTop - list.clientHeight > 4);
        }
    }, [listRef, queueScrollRef]);
    React.useLayoutEffect(readHasMoreBelow, [matches.length, readHasMoreBelow]);

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
    // 队列改动（移到队尾、删除、搜索过滤）不该把用户浏览的位置拽回来，所以按曲目身份比较，不按下标。
    React.useEffect(() => {
        if (!shouldScrollToCurrent || !currentSongKey || !listRef.current) {
            return;
        }

        const isInitialMount = isInitialMountRef.current;
        const songChanged = lastScrolledSongKeyRef.current !== currentSongKey;
        if (!isInitialMount && !songChanged) {
            return;
        }

        const currentRow = matches.findIndex(queueIndex => getPlaybackSongKey(playQueue[queueIndex]) === currentSongKey);
        if (currentRow < 0) {
            return;
        }

        const behavior = (isInitialMount || reduced) ? 'instant' : 'smooth';
        const delay = isInitialMount ? 0 : 50;

        setTimeout(() => {
            if (listRef.current) {
                // The row before the playing one goes to the top: the rows line up with
                // the list's top edge, and what was just played stays in view.
                listRef.current.scrollToRow({
                    index: Math.max(0, currentRow - 1),
                    align: 'start',
                    behavior: behavior as 'instant' | 'smooth',
                });
                lastScrolledSongKeyRef.current = currentSongKey;
                isInitialMountRef.current = false;
            }
        }, delay);
    }, [shouldScrollToCurrent, currentSongKey, matches, playQueue, listRef, reduced]);

    const handleSavePlaylist = async () => {
        if (!onSaveCurrentQueueAsPlaylist) {
            return;
        }
        setIsSaveDialogOpen(true);
    };

    const searchFieldStyle: React.CSSProperties = isDaylight
        ? { backgroundColor: SEARCH_SURFACE_LIGHT, borderColor: SEARCH_BORDER_LIGHT }
        : { backgroundColor: SEARCH_SURFACE_DARK, borderColor: SEARCH_BORDER_DARK };

    if (playQueue.length === 0) {
        return <EmptyState icon={<ListMusic size={28} />}>{t('queue.empty')}</EmptyState>;
    }

    return (
        <>
            <div className="relative select-none">
                <div className="flex items-center gap-0.5 pb-1 pl-1" style={{ height: HEAD_PX }}>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[color:var(--st-t2)]">
                        {t('queue.title')}
                        <span className="ml-1.5 font-normal text-[color:var(--st-t3)]">
                            {isSearching ? `${matches.length}/${playQueue.length}` : playQueue.length}
                        </span>
                    </span>
                    {canSaveLocalPlaylist && (
                        <Button variant="quiet" onClick={handleSavePlaylist}>
                            {t('localMusic.saveQueueAsPlaylist')}
                        </Button>
                    )}
                    {onOpenLattice && (
                        <PanelIconButton size="s" label={t('home.lattice')} onClick={onOpenLattice}>
                            <PanelsTopLeft size={15} />
                        </PanelIconButton>
                    )}
                    {onShuffle && (
                        <PanelIconButton size="s" label={t('queue.shuffle')} onClick={onShuffle}>
                            <Shuffle size={15} />
                        </PanelIconButton>
                    )}
                    <PanelIconButton
                        size="s"
                        label={t('queue.searchPlaceholder')}
                        pressed={isSearchOpen || isSearching}
                        aria-expanded={isSearchOpen}
                        onClick={() => (isSearchOpen ? closeSearch() : setIsSearchOpen(true))}
                    >
                        <Search size={15} />
                    </PanelIconButton>
                </div>

                {/* 浮层而非独立一行：盖在标题行之上，不挤占列表高度，收起时列表也不会跳动 */}
                <AnimatePresence>
                    {isSearchOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: reduced ? 0 : -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: reduced ? 0 : -6 }}
                            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute inset-x-1 top-0 z-10"
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

                <div ref={queueScrollRef}>
                    {matches.length === 0 ? (
                        <div
                            className="flex items-center justify-center text-xs text-[color:var(--st-t3)]"
                            style={{ height: 2 * ROW_PX }}
                        >
                            {t('queue.searchEmpty')}
                        </div>
                    ) : (
                        <List
                            listRef={listRef}
                            rowCount={matches.length}
                            rowHeight={ROW_PX}
                            // The list measures itself after its first frame; until then it takes this height, so that frame has all its rows.
                            defaultHeight={rowsPx}
                            rowComponent={QueueRow}
                            rowProps={rowProps}
                            overscanCount={5}
                            onScroll={readHasMoreBelow}
                            onResize={readHasMoreBelow}
                            className="st-scroll"
                            style={{ height: listHeight, width: '100%', maskImage: hasMoreBelow ? FADE : undefined }}
                        />
                    )}
                </div>
            </div>

            <TextInputDialog
                isOpen={isSaveDialogOpen}
                onClose={() => setIsSaveDialogOpen(false)}
                isDaylight={isDaylight}
                title={t('localMusic.saveQueueAsPlaylist')}
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
