/*
Copyright Matron Contributors.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.
Copyright 2021, 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent, type Relations } from "matrix-js-sdk/src/matrix";
import { CopyIcon, InlineCodeIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { copyPlaintext, getSelectedText } from "../../../utils/strings";
import { type MenuProps } from "../../structures/ContextMenu";
import ViewSource from "../../structures/ViewSource";
import { type GetRelationsForEvent, type IEventTileOps } from "../rooms/EventTile";
import { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps extends MenuProps {
    /* the MatrixEvent associated with the context menu */
    mxEvent: MatrixEvent;
    // An optional EventTileOps implementation that can be used to unhide preview widgets
    eventTileOps?: IEventTileOps;
    // Callback called when the menu is dismissed
    permalinkCreator?: RoomPermalinkCreator;
    /* an optional function to be called when the user clicks collapse thread, if not provided hide button */
    collapseReplyChain?(): void;
    /* callback called when the menu is dismissed */
    onFinished(): void;
    // If the menu is inside a dialog, we sometimes need to close that dialog after click (forwarding)
    onCloseDialog?(): void;
    // True if the menu is being used as a right click menu
    rightClick?: boolean;
    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations | null;
    // A permalink to this event or an href of an anchor element the user has clicked
    link?: string;

    getRelationsForEvent?: GetRelationsForEvent;
}

export default class MessageContextMenu extends React.Component<IProps> {
    private onViewSourceClick = (): void => {
        Modal.createDialog(
            ViewSource,
            {
                mxEvent: this.props.mxEvent,
            },
            "mx_Dialog_viewsource",
        );
        this.closeMenu();
    };

    private closeMenu = (): void => {
        this.props.onFinished();
    };

    private getTextToCopy(): string {
        const selectedText = getSelectedText();
        if (selectedText) return selectedText;

        const body = this.props.mxEvent.getContent().body;
        return typeof body === "string" ? body : "";
    }

    private onCopyClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        copyPlaintext(this.getTextToCopy());
        this.closeMenu();
    };

    public render(): React.ReactNode {
        const { mxEvent, rightClick, link, eventTileOps, reactions, collapseReplyChain, ...other } = this.props;
        delete other.getRelationsForEvent;
        delete other.permalinkCreator;

        // This is specifically not behind the developerMode flag to give people insight into the Matrix
        const viewSourceButton = (
            <IconizedContextMenuOption
                icon={<InlineCodeIcon />}
                label={_t("timeline|context_menu|view_source")}
                onClick={this.onViewSourceClick}
            />
        );

        let copyButton: React.ReactNode;
        if (this.getTextToCopy()) {
            copyButton = (
                <IconizedContextMenuOption
                    icon={<CopyIcon />}
                    label={_t("action|copy")}
                    triggerOnMouseDown={true} // We use onMouseDown so that the selection isn't cleared when we click
                    onClick={this.onCopyClick}
                />
            );
        }

        const commonItemsList = (
            <IconizedContextMenuOptionList>
                {copyButton}
                {viewSourceButton}
            </IconizedContextMenuOptionList>
        );

        return (
            <IconizedContextMenu
                {...other}
                className="mx_MessageContextMenu"
                compact={true}
                data-testid="mx_MessageContextMenu"
            >
                {commonItemsList}
            </IconizedContextMenu>
        );
    }
}
