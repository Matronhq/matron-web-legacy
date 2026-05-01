/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { render, screen } from "jest-matrix-react";
import { mocked } from "jest-mock";
import userEvent from "@testing-library/user-event";

import { RoomListSearch } from "../../../../../../src/components/views/rooms/RoomListPanel/RoomListSearch";
import { MetaSpace } from "../../../../../../src/stores/spaces";
import { shouldShowComponent } from "../../../../../../src/customisations/helpers/UIComponents";
import LegacyCallHandler from "../../../../../../src/LegacyCallHandler";

jest.mock("../../../../../../src/customisations/helpers/UIComponents", () => ({
    shouldShowComponent: jest.fn(),
}));

describe("<RoomListSearch />", () => {
    const onSearchQueryChange = jest.fn();

    function renderComponent(activeSpace = MetaSpace.Home) {
        return render(<RoomListSearch activeSpace={activeSpace} onSearchQueryChange={onSearchQueryChange} />);
    }

    beforeEach(() => {
        jest.clearAllMocks();
        // By default, we consider shouldShowComponent(UIComponent.ExploreRooms) should return true
        mocked(shouldShowComponent).mockReturnValue(true);
        jest.spyOn(LegacyCallHandler.instance, "getSupportsPstnProtocol").mockReturnValue(false);
    });

    it("renders", () => {
        const { asFragment } = renderComponent(MetaSpace.VideoRooms);
        expect(asFragment()).toMatchSnapshot();
    });

    it("filters inline when the search input changes", async () => {
        const user = userEvent.setup();
        renderComponent();

        await user.type(screen.getByRole("searchbox", { name: "Search" }), "general");

        expect(onSearchQueryChange).toHaveBeenLastCalledWith("general");
    });
});
