/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";

import { JournalDatabase } from "../../../src/journal/database";
import { type JournalEvent } from "../../../src/journal/types";

function event(
    seq: number,
    sender: string,
    type = "text",
    payload: Record<string, unknown> = { body: `m${seq}` },
): JournalEvent {
    return { kind: "journal", seq, convo_id: "c1", ts: seq * 1_000, sender, type, payload };
}

describe("JournalDatabase", () => {
    beforeEach(() => {
        globalThis.indexedDB = new IDBFactory();
    });

    it("applies ordered frames atomically and ignores replay duplicates", async () => {
        const database = await JournalDatabase.open("https://journal.example", 1);
        await database.replaceWithSnapshot({
            seq: 0,
            conversations: [
                {
                    id: "c1",
                    title: "Agent",
                    session_state: "running",
                    last_seq: 0,
                    unread_count: 0,
                    snippet: "",
                    created_at: 1,
                },
            ],
        });

        expect(await database.applyJournal(event(1, "agent:dev"))).toBe(true);
        expect(await database.applyJournal(event(1, "agent:dev"))).toBe(false);
        expect(await database.cursor()).toBe(1);
        expect(await database.events("c1")).toHaveLength(1);
        expect((await database.conversations())[0]).toMatchObject({ last_seq: 1, unread_count: 1, snippet: "m1" });
        database.close();
    });

    it("keeps own messages unread-free and converges read markers", async () => {
        const database = await JournalDatabase.open("https://journal.example", 2);
        await database.replaceWithSnapshot({
            seq: 0,
            conversations: [
                {
                    id: "c1",
                    title: "Agent",
                    session_state: "running",
                    last_seq: 0,
                    unread_count: 0,
                    snippet: "",
                    created_at: 1,
                },
            ],
        });
        await database.applyJournal(event(1, "user:dan"));
        await database.applyJournal(event(2, "agent:dev"));
        await database.applyJournal(event(3, "user:dan", "read_marker", { convo_id: "c1", up_to_seq: 2 }));
        expect((await database.conversations())[0]).toMatchObject({ unread_count: 0, read_up_to_seq: 2 });
        database.close();
    });

    it("persists and reconciles the idempotent send outbox", async () => {
        const database = await JournalDatabase.open("https://journal.example", 3);
        await database.replaceWithSnapshot({ seq: 0, conversations: [] });
        await database.addToOutbox({ localId: "local-1", convoId: "c1", body: "ship it", createdAt: 10 });
        expect(await database.outbox("c1")).toHaveLength(1);
        await database.reconcileOwnMessage(event(1, "user:dan", "text", { body: "ship it" }));
        expect(await database.outbox("c1")).toHaveLength(0);
        database.close();
    });
});
