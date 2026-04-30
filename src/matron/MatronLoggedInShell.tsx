/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import classNames from "classnames";

import type PageTypes from "../PageTypes";
import ResizeHandle from "../components/views/elements/ResizeHandle";
import LeftPanel from "../components/structures/LeftPanel";
import { BackdropPanel } from "../components/structures/BackdropPanel";
import SpacePanel from "../components/views/spaces/SpacePanel";
import LeftPanelLiveShareWarning from "../components/views/beacon/LeftPanelLiveShareWarning";
import type ResizeNotifier from "../utils/ResizeNotifier";
import { isMatronSurfaceEnabled, MatronSurface } from "./FeaturePolicy";

interface MatronLoggedInShellProps {
    backgroundImage?: string;
    hideToSRUsers: boolean;
    isModuleRenderer: boolean;
    onKeyDown: (ev: KeyboardEvent) => void;
    onPaste: (ev: ClipboardEvent) => void;
    pageElement: ReactNode;
    pageType?: string;
    resizeContainerRef: React.RefObject<HTMLDivElement | null>;
    resizeHandlerRef: React.RefObject<HTMLDivElement | null>;
    resizeNotifier: ResizeNotifier;
    shouldUseMinimizedUI: boolean;
    useCompactLayout: boolean;
    useNewRoomList: boolean;
}

export function MatronLoggedInShell({
    backgroundImage,
    hideToSRUsers,
    isModuleRenderer,
    onKeyDown,
    onPaste,
    pageElement,
    pageType,
    resizeContainerRef,
    resizeHandlerRef,
    resizeNotifier,
    shouldUseMinimizedUI,
    useCompactLayout,
    useNewRoomList,
}: MatronLoggedInShellProps): React.ReactElement {
    const showSpaces = isMatronSurfaceEnabled(MatronSurface.Spaces);
    const showLocationSharing = isMatronSurfaceEnabled(MatronSurface.LocationSharing);

    const wrapperClasses = classNames({
        mx_MatrixChat_wrapper: true,
        mx_MatrixChat_useCompactLayout: useCompactLayout,
    });
    const bodyClasses = classNames({
        "mx_MatrixChat": true,
        "mx_MatrixChat--with-avatar": backgroundImage,
    });
    const leftPanelWrapperClasses = classNames({
        mx_LeftPanel_wrapper: true,
        mx_LeftPanel_newRoomList: useNewRoomList,
    });

    return (
        <div onPaste={onPaste} onKeyDown={onKeyDown} className={wrapperClasses} aria-hidden={hideToSRUsers}>
            <div className={bodyClasses}>
                <div className="mx_LeftPanel_outerWrapper">
                    {showLocationSharing && <LeftPanelLiveShareWarning isMinimized={shouldUseMinimizedUI} />}
                    <div className={leftPanelWrapperClasses}>
                        {!useNewRoomList && <BackdropPanel blurMultiplier={0.5} backgroundImage={backgroundImage} />}
                        {showSpaces && <SpacePanel />}
                        {!useNewRoomList && <BackdropPanel backgroundImage={backgroundImage} />}
                        {!isModuleRenderer && (
                            <div
                                className="mx_LeftPanel_wrapper--user"
                                ref={resizeContainerRef}
                                data-collapsed={shouldUseMinimizedUI ? true : undefined}
                            >
                                <LeftPanel
                                    pageType={pageType as PageTypes}
                                    isMinimized={shouldUseMinimizedUI}
                                    resizeNotifier={resizeNotifier}
                                />
                            </div>
                        )}
                    </div>
                </div>
                {!isModuleRenderer && <ResizeHandle passRef={resizeHandlerRef} id="lp-resizer" />}
                <div className="mx_RoomView_wrapper">{pageElement}</div>
            </div>
        </div>
    );
}
