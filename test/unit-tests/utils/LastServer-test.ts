/*
Copyright Matron Contributors.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { persistLastServer, getLastServer, LAST_SERVER_KEY } from "../../../src/utils/LastServer";

describe("LastServer", () => {
    beforeEach(() => localStorage.clear());

    it("returns null when nothing stored", () => {
        expect(getLastServer()).toBeNull();
    });

    it("round-trips a stored server", () => {
        persistLastServer({ hsUrl: "https://hs.example", isUrl: "https://is.example" });
        expect(getLastServer()).toEqual({ hsUrl: "https://hs.example", isUrl: "https://is.example" });
        expect(localStorage.getItem(LAST_SERVER_KEY)).toContain("hs.example");
    });

    it("does not persist an empty hsUrl", () => {
        persistLastServer({ hsUrl: "" });
        expect(getLastServer()).toBeNull();
    });

    it("returns null on corrupt JSON", () => {
        localStorage.setItem(LAST_SERVER_KEY, "{not json");
        expect(getLastServer()).toBeNull();
    });
});
