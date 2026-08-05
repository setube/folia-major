import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import TitlebarDragZone from '../TitlebarDragZone';
import WindowControls from '../WindowControls';

// Shared shell for the app container, Electron titlebar, and mounted audio node.
type AppShellProps = {
    appStyle: React.CSSProperties;
    isElectronWindow: boolean;
    usesCustomWindowChrome: boolean;
    useCustomWindowRadius: boolean;
    showTransparentWindowBorder: boolean;
    isPlayerView: boolean;
    isTitlebarRevealed: boolean;
    alwaysShowMainWindowTitlebar: boolean;
    isDaylight: boolean;
    audioElement: React.ReactNode;
    children: React.ReactNode;
};

const AppShell: React.FC<AppShellProps> = ({
    appStyle,
    isElectronWindow,
    usesCustomWindowChrome,
    useCustomWindowRadius,
    showTransparentWindowBorder,
    isPlayerView,
    isTitlebarRevealed,
    alwaysShowMainWindowTitlebar,
    isDaylight,
    audioElement,
    children,
}) => {
    const { t } = useTranslation();
    const [isWindowMaximized, setIsWindowMaximized] = useState(false);

    useEffect(() => {
        if (!useCustomWindowRadius || !window.electron?.isWindowMaximized) {
            setIsWindowMaximized(false);
            return;
        }

        let isCancelled = false;

        const syncMaximizedState = async () => {
            try {
                const nextValue = await window.electron!.isWindowMaximized();
                if (!isCancelled) {
                    setIsWindowMaximized(nextValue);
                }
            } catch {
                if (!isCancelled) {
                    setIsWindowMaximized(false);
                }
            }
        };

        void syncMaximizedState();
        window.addEventListener('resize', syncMaximizedState);

        return () => {
            isCancelled = true;
            window.removeEventListener('resize', syncMaximizedState);
        };
    }, [useCustomWindowRadius]);

    const shouldApplyWindowRadius = useCustomWindowRadius && !isWindowMaximized;
    const areTitlebarControlsVisible = isTitlebarRevealed || alwaysShowMainWindowTitlebar;
    const shouldRenderTitlebarBackdrop = !isPlayerView || useCustomWindowRadius;
    const titlebarBackdropClassName = `absolute inset-0 backdrop-blur-sm ${
        isDaylight
            ? isPlayerView
                ? 'bg-white/[0.18] border-b border-white/25 shadow-[0_8px_28px_rgba(0,0,0,0.06)]'
                : 'bg-white/[0.12] border-b border-white/15'
            : isPlayerView
                ? 'bg-black/[0.18] border-b border-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.20)]'
                : ''
    }`;

    return (
        <div
            className="fixed inset-0 w-full h-full flex flex-col overflow-hidden font-sans transition-colors duration-500"
            style={{
                ...appStyle,
                borderRadius: shouldApplyWindowRadius ? '18px' : undefined,
                boxShadow: showTransparentWindowBorder ? 'inset 0 0 0 1px rgba(255,255,255,0.24)' : undefined,
            }}
        >
            {usesCustomWindowChrome && (
                <div className="absolute top-0 left-0 right-0 z-[9999] h-8 pointer-events-none">
                    {shouldRenderTitlebarBackdrop && (
                        <motion.div
                            initial={false}
                            animate={{
                                opacity: isTitlebarRevealed ? 1 : 0,
                            }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className={titlebarBackdropClassName}
                        />
                    )}
                    <div className="relative h-full">
                        <TitlebarDragZone active={usesCustomWindowChrome} />
                        <div className="pointer-events-auto absolute top-0 right-0 z-10 h-full">
                            <WindowControls
                                revealed={areTitlebarControlsVisible}
                                isDaylight={isDaylight}
                            />
                        </div>
                    </div>
                </div>
            )}

            {audioElement}
            {children}
        </div>
    );
};

export default AppShell;
