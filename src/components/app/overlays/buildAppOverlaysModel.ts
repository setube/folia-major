import type React from 'react';
import type { MotionValue } from 'framer-motion';
import type FloatingPlayerControls from '../../FloatingPlayerControls';
import type QueuePopover from '../../player-controls/QueuePopover';
import type SearchWorkspace from '../search/SearchWorkspace';
import type DevDebugOverlay from '../../DevDebugOverlay';
import { PlayerState } from '../../../types';
import type { SongResult, UnifiedSong, LyricData, PlayerLoopMode } from '../../../types';

// src/components/app/overlays/buildAppOverlaysModel.ts

type SearchOverlayProps = React.ComponentProps<typeof SearchWorkspace>;
type FloatingControlsProps = React.ComponentProps<typeof FloatingPlayerControls>;
type DebugOverlayProps = React.ComponentProps<typeof DevDebugOverlay>;
type QueuePopoverProps = React.ComponentProps<typeof QueuePopover>;

export type AppOverlaysModel = {
    searchOverlay?: SearchOverlayProps | null;
    debugOverlay?: DebugOverlayProps | null;
    floatingControls?: FloatingControlsProps | null;
    queuePopover?: QueuePopoverProps | null;
};

type BuildAppOverlaysModelParams = {
    currentView: FloatingControlsProps['currentView'];
    isSearchOpen: boolean;
    theme: any;
    isDaylight: boolean;
    closeSearchView: () => void;
    handleSearchOverlaySubmit: SearchOverlayProps['onSubmitSearch'];
    handleSearchLoadMore: () => Promise<void>;
    handleSearchResultPlay: (track: UnifiedSong) => void;
    handleSearchResultAddToQueue: (track: UnifiedSong) => void;
    handleSearchResultArtistOpen: SearchOverlayProps['onOpenArtist'];
    handleSearchResultAlbumOpen: SearchOverlayProps['onOpenAlbum'];
    isDev: boolean;
    isDevDebugOverlayVisible: boolean;
    devDebugSnapshot: any;
    currentTime: MotionValue<number>;
    lyricCurrentTime: MotionValue<number>;
    currentSong: SongResult | null;
    playerState: PlayerState;
    duration: number;
    effectiveLoopMode: PlayerLoopMode;
    audioSrc: string | null;
    canToggleCurrentPlayback: boolean;
    isNowPlayingControlDisabled: boolean;
    lyrics: LyricData | null;
    activePlaybackContext: 'main' | 'stage';
    stageActiveEntryKind: string | null;
    syncStageLyricsClock: (timeSec: number, endTimeSec: number, nextPlayerState: PlayerState, startTimeSec?: number) => void;
    stageLyricsClockRef: React.MutableRefObject<{ startTimeSec: number }>;
    setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;
    togglePlay: FloatingControlsProps['onTogglePlay'];
    toggleLoop: FloatingControlsProps['onToggleLoop'];
    handleNextTrack: FloatingControlsProps['onNextTrack'];
    handlePrevTrack: FloatingControlsProps['onPrevTrack'];
    toggleQueuePanel: FloatingControlsProps['onToggleQueue'];
    openCurrentSongArtist: FloatingControlsProps['onOpenArtist'];
    isCurrentSongLiked: FloatingControlsProps['isLiked'];
    toggleCurrentSongLike: FloatingControlsProps['onToggleLike'];
    playerVolume: FloatingControlsProps['volume'];
    setPlayerVolume: FloatingControlsProps['onVolumeChange'];
    navigateToPlayer: () => void;
    isPlayerChromeHidden: boolean;
    shouldHidePlayerProgressBar: boolean;
    onSeekMainAudio: (time: number) => void;
    onStagePlayerSeek: () => Promise<unknown>;
    noTrackText: string;
    isQueuePopoverOpen: boolean;
    closeQueuePopover: () => void;
    playQueue: SongResult[];
    playSong: QueuePopoverProps['onPlaySong'];
    shuffleQueue: QueuePopoverProps['onShuffle'];
    removeQueueSong: QueuePopoverProps['onRemoveSong'];
    moveQueueSongToEnd: QueuePopoverProps['onMoveSongToEnd'];
    moveQueueSongToNext: QueuePopoverProps['onMoveSongToNext'];
    queueCoverUrl: string | null;
};

// Builds the full overlay model, including detail overlays and floating playback controls.
export const buildAppOverlaysModel = ({
    currentView,
    isSearchOpen,
    theme,
    isDaylight,
    closeSearchView,
    handleSearchOverlaySubmit,
    handleSearchLoadMore,
    handleSearchResultPlay,
    handleSearchResultAddToQueue,
    handleSearchResultArtistOpen,
    handleSearchResultAlbumOpen,
    isDev,
    isDevDebugOverlayVisible,
    devDebugSnapshot,
    currentTime,
    lyricCurrentTime,
    currentSong,
    playerState,
    duration,
    effectiveLoopMode,
    audioSrc,
    canToggleCurrentPlayback,
    isNowPlayingControlDisabled,
    lyrics,
    activePlaybackContext,
    stageActiveEntryKind,
    syncStageLyricsClock,
    stageLyricsClockRef,
    setPlayerState,
    togglePlay,
    toggleLoop,
    handleNextTrack,
    handlePrevTrack,
    toggleQueuePanel,
    openCurrentSongArtist,
    isCurrentSongLiked,
    toggleCurrentSongLike,
    playerVolume,
    setPlayerVolume,
    navigateToPlayer,
    isPlayerChromeHidden,
    shouldHidePlayerProgressBar,
    onSeekMainAudio,
    onStagePlayerSeek,
    noTrackText,
    isQueuePopoverOpen,
    closeQueuePopover,
    playQueue,
    playSong,
    shuffleQueue,
    removeQueueSong,
    moveQueueSongToEnd,
    moveQueueSongToNext,
    queueCoverUrl,
}: BuildAppOverlaysModelParams): AppOverlaysModel => ({
    // 播放页的队列在右下角面板里，浮层只服务其余视图，两者不会同时可见。
    queuePopover: currentView === 'player' ? null : {
        isOpen: isQueuePopoverOpen,
        onClose: closeQueuePopover,
        playQueue,
        currentSong,
        coverUrl: queueCoverUrl,
        onPlaySong: playSong,
        onShuffle: shuffleQueue,
        onRemoveSong: removeQueueSong,
        onMoveSongToEnd: moveQueueSongToEnd,
        onMoveSongToNext: moveQueueSongToNext,
        isDaylight,
    },
    searchOverlay: currentView === 'home'
        ? {
            theme,
            isDaylight,
            onClose: closeSearchView,
            onSubmitSearch: handleSearchOverlaySubmit,
            onLoadMore: handleSearchLoadMore,
            onPlayTrack: handleSearchResultPlay,
            onAddTrackToQueue: handleSearchResultAddToQueue,
            onOpenArtist: handleSearchResultArtistOpen,
            onOpenAlbum: handleSearchResultAlbumOpen,
        }
        : null,
    debugOverlay: isDev && currentView === 'player' && isDevDebugOverlayVisible
        ? {
            snapshot: devDebugSnapshot,
            currentTime,
            lyricCurrentTime,
            isDaylight,
        }
        : null,
    floatingControls: currentSong
        ? {
            currentSong,
            playerState,
            currentTime,
            lyricCurrentTime,
            duration,
            loopMode: effectiveLoopMode,
            currentView,
            audioSrc,
            canTogglePlay: canToggleCurrentPlayback,
            controlsDisabled: isNowPlayingControlDisabled,
            lyrics,
            onSeek: (time) => {
                if (isNowPlayingControlDisabled) {
                    return;
                }

                if (activePlaybackContext === 'stage' && stageActiveEntryKind === 'lyrics' && !audioSrc) {
                    syncStageLyricsClock(time, duration, playerState, stageLyricsClockRef.current.startTimeSec);
                    currentTime.set(time);
                    if (playerState !== PlayerState.PLAYING) {
                        setPlayerState(PlayerState.PLAYING);
                    }
                    void onStagePlayerSeek();
                } else {
                    onSeekMainAudio(time);
                }
            },
            onTogglePlay: togglePlay,
            onToggleLoop: toggleLoop,
            onNextTrack: handleNextTrack,
            onPrevTrack: handlePrevTrack,
            onToggleQueue: toggleQueuePanel,
            onOpenArtist: openCurrentSongArtist,
            isLiked: isCurrentSongLiked,
            onToggleLike: toggleCurrentSongLike,
            volume: playerVolume,
            onVolumeChange: setPlayerVolume,
            onNavigateToPlayer: navigateToPlayer,
            noTrackText,
            primaryColor: 'var(--text-primary)',
            secondaryColor: 'var(--text-secondary)',
            theme,
            isDaylight,
            isHidden: currentView === 'player' && isPlayerChromeHidden,
            hideControlBar: shouldHidePlayerProgressBar,
        }
        : null,
});
