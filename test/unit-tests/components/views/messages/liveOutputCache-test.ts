/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import {
    type CachedEntry,
    deleteEntry,
    gc,
    loadEntry,
    resetForTesting,
    saveEntry,
} from "../../../../../src/components/views/messages/liveOutputCache";

function makeEntry(overrides: Partial<CachedEntry> = {}): CachedEntry {
    return {
        toolUseId: "toolu_test",
        command: "ls",
        rawText: "hello\n",
        status: "running",
        exitCode: null,
        truncated: false,
        cachedAt: Date.now(),
        ...overrides,
    };
}

describe("liveOutputCache", () => {
    beforeEach(() => {
        // Each test gets a fresh in-memory IDB and resets the cached connection promise.
        (globalThis as any).indexedDB = new IDBFactory();
        resetForTesting();
    });

    it("returns null for an unknown key", async () => {
        await expect(loadEntry("missing")).resolves.toBeNull();
    });

    it("round-trips a saved entry", async () => {
        const entry = makeEntry({ rawText: "abc" });
        await saveEntry(entry);
        const loaded = await loadEntry("toolu_test");
        expect(loaded).not.toBeNull();
        expect(loaded?.rawText).toBe("abc");
        expect(loaded?.toolUseId).toBe("toolu_test");
    });

    it("treats entries older than 24h as missing and deletes them on read", async () => {
        const staleCachedAt = Date.now() - 25 * 60 * 60 * 1000;
        await saveEntry(makeEntry({ cachedAt: staleCachedAt }));

        const first = await loadEntry("toolu_test");
        expect(first).toBeNull();

        // Re-save fresh to confirm the stale entry was actually evicted on the prior read.
        await saveEntry(makeEntry({ rawText: "fresh", cachedAt: Date.now() }));
        const second = await loadEntry("toolu_test");
        expect(second?.rawText).toBe("fresh");
    });

    it("deleteEntry removes a specific entry without touching others", async () => {
        await saveEntry(makeEntry({ toolUseId: "a", rawText: "keep" }));
        await saveEntry(makeEntry({ toolUseId: "b", rawText: "remove" }));
        await deleteEntry("b");
        expect((await loadEntry("a"))?.rawText).toBe("keep");
        expect(await loadEntry("b")).toBeNull();
    });

    it("gc() deletes all entries older than 24h and leaves fresh ones intact", async () => {
        const stale = Date.now() - 30 * 60 * 60 * 1000;
        await saveEntry(makeEntry({ toolUseId: "old1", cachedAt: stale }));
        await saveEntry(makeEntry({ toolUseId: "old2", cachedAt: stale }));
        await saveEntry(makeEntry({ toolUseId: "fresh", cachedAt: Date.now() }));

        await gc();

        expect(await loadEntry("old1")).toBeNull();
        expect(await loadEntry("old2")).toBeNull();
        expect(await loadEntry("fresh")).not.toBeNull();
    });

    it("returns null when IndexedDB is unavailable (e.g. browser-blocked)", async () => {
        const original = (globalThis as any).indexedDB;
        (globalThis as any).indexedDB = undefined;
        resetForTesting();
        try {
            await expect(loadEntry("anything")).resolves.toBeNull();
            // Save and delete should not throw either — they degrade silently.
            await expect(saveEntry(makeEntry())).resolves.toBeUndefined();
            await expect(deleteEntry("anything")).resolves.toBeUndefined();
        } finally {
            (globalThis as any).indexedDB = original;
            resetForTesting();
        }
    });
});
