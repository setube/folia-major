import React from 'react';
import FloatingPlayerControls from '../../FloatingPlayerControls';
import QueuePopover from '../../player-controls/QueuePopover';
import SearchWorkspace from '../search/SearchWorkspace';
import DevDebugOverlay from '../../DevDebugOverlay';
import type { AppOverlaysModel } from './buildAppOverlaysModel';

// Centralized app-level overlay renderer so App.tsx does not mount leaf overlays directly.
type AppOverlaysProps = {
    model: AppOverlaysModel;
};

const AppOverlays: React.FC<AppOverlaysProps> = ({ model }) => {
    const {
        searchOverlay,
        debugOverlay,
        floatingControls,
        queuePopover,
    } = model;

    return (
        <>
            {searchOverlay && <SearchWorkspace {...searchOverlay} />}

            {debugOverlay && <DevDebugOverlay {...debugOverlay} />}

            {floatingControls && <FloatingPlayerControls {...floatingControls} />}

            {queuePopover && <QueuePopover {...queuePopover} />}
        </>
    );
};

export default AppOverlays;
