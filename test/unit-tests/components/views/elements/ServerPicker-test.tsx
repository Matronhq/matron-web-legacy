/*
Copyright Matron Contributors.
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { render, screen } from "jest-matrix-react";
import React from "react";

import ServerPicker from "../../../../../src/components/views/elements/ServerPicker";
import { ValidatedServerConfig } from "../../../../../src/utils/ValidatedServerConfig";

describe("<ServerPicker />", () => {
    const defaultConfig: ValidatedServerConfig = {
        hsUrl: "https://matrix.org",
        hsName: "matrix.org",
        hsNameIsDifferent: false,
        isUrl: "https://vector.im",
        isDefault: true,
        isNameResolvable: true,
        warning: "",
    } as ValidatedServerConfig;

    it("shows the homeserver name when configured", () => {
        render(<ServerPicker serverConfig={defaultConfig} onServerConfigChange={jest.fn()} />);
        expect(screen.getByText("matrix.org")).toBeInTheDocument();
    });

    it("shows a choose-a-homeserver label when hsUrl is empty", () => {
        const emptyServer = {
            hsUrl: "",
            hsName: "",
            hsNameIsDifferent: false,
            isUrl: "",
            isDefault: false,
            isNameResolvable: false,
            warning: "",
        } as unknown as ValidatedServerConfig;
        render(<ServerPicker serverConfig={emptyServer} onServerConfigChange={jest.fn()} />);
        expect(screen.getByText(/choose a homeserver/i)).toBeInTheDocument();
    });
});
