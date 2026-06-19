/*
 * Copyright Matron Contributors.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, useEffect, useState, type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import DialPadIcon from "@vector-im/compound-design-tokens/assets/web/icons/dial-pad";
import ExploreIcon from "@vector-im/compound-design-tokens/assets/web/icons/explore";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import { Flex, useCreateAutoDisposedViewModel, useViewModel } from "@element-hq/web-shared-components";

import { RoomListSearchViewModel } from "../../../../viewmodels/room-list/RoomListSearchViewModel";
import { _t } from "../../../../languageHandler";

type RoomListSearchProps = {
    /**
     * Current active space
     * The explore button is only displayed in the Home meta space
     */
    activeSpace: string;
    onSearchQueryChange: (query: string) => void;
};

/**
 * A search component to be displayed at the top of the room list
 * The `Explore` button is displayed only in the Home meta space and when UIComponent.ExploreRooms is enabled.
 */
export function RoomListSearch({ activeSpace, onSearchQueryChange }: RoomListSearchProps): JSX.Element {
    const vm = useCreateAutoDisposedViewModel(() => new RoomListSearchViewModel({ activeSpace }));
    const { displayExploreButton, displayDialButton } = useViewModel(vm);
    const [query, setQuery] = useState("");

    useEffect(() => {
        vm.setActiveSpace(activeSpace);
    }, [activeSpace, vm]);

    const onChange = useCallback(
        (ev: React.ChangeEvent<HTMLInputElement>): void => {
            const value = ev.target.value;
            setQuery(value);
            onSearchQueryChange(value);
        },
        [onSearchQueryChange],
    );

    const onKeyDown = useCallback(
        (ev: React.KeyboardEvent<HTMLInputElement>): void => {
            if (ev.key === "Escape" && query) {
                setQuery("");
                onSearchQueryChange("");
                ev.stopPropagation();
            }
        },
        [onSearchQueryChange, query],
    );

    return (
        <Flex
            data-testid="room-list-search"
            className="mx_RoomListSearch"
            role="search"
            gap="var(--cpd-space-2x)"
            align="center"
        >
            <label className="mx_RoomListSearch_inputWrapper mx_no_textinput" htmlFor="room-list-search-input">
                <SearchIcon aria-hidden />
                <input
                    id="room-list-search-input"
                    className="mx_RoomListSearch_input"
                    type="search"
                    value={query}
                    placeholder={_t("action|search")}
                    aria-label={_t("action|search")}
                    autoComplete="off"
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                />
            </label>
            {displayDialButton && (
                <Button
                    kind="secondary"
                    size="sm"
                    Icon={DialPadIcon}
                    iconOnly={true}
                    aria-label={_t("left_panel|open_dial_pad")}
                    onClick={vm.onDialPadClick}
                />
            )}
            {displayExploreButton && (
                <Button
                    kind="secondary"
                    size="sm"
                    Icon={ExploreIcon}
                    iconOnly={true}
                    aria-label={_t("action|explore_rooms")}
                    onClick={vm.onExploreClick}
                />
            )}
        </Flex>
    );
}
