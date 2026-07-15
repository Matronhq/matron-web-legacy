/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { MatronJournalClient } from "../../../src/journal/client";
import { type ClientState, type Conversation, type PendingMessage, type Session } from "../../../src/journal/types";

const SESSION: Session = {
    serverUrl: "https://journal.example",
    token: "token",
    deviceId: 1,
    userId: 2,
    username: "dan",
};

const CONVERSATIONS: Conversation[] = [
    {
        id: "c1",
        title: "One",
        session_state: "running",
        last_seq: 10,
        unread_count: 0,
        snippet: "",
        created_at: 1,
        read_up_to_seq: 0,
    },
    {
        id: "c2",
        title: "Two",
        session_state: "running",
        last_seq: 20,
        unread_count: 0,
        snippet: "",
        created_at: 2,
        read_up_to_seq: 0,
    },
];

interface FakeDatabase {
    reset?: () => Promise<void>;
    events: (conversationId: string) => Promise<[]>;
    outbox: (conversationId?: string) => Promise<PendingMessage[]>;
    putHistory: (events: []) => Promise<void>;
    markLocallyRead: (conversationId: string, upToSeq: number) => Promise<void>;
    conversations: () => Promise<Conversation[]>;
    addToOutbox: (message: PendingMessage) => Promise<void>;
}

interface ClientInternals {
    state: ClientState;
    database?: FakeDatabase;
    api?: { messages: () => Promise<{ events: [] }> };
    connection?: { send: ReturnType<typeof jest.fn> };
    readHighWater: Map<string, number>;
    readTimers: Map<string, number>;
    pendingAck: number;
    scheduleRead(conversationId: string, upToSeq: number, delay?: number): void;
    flushRead(conversationId: string): Promise<void>;
}

function internals(client: MatronJournalClient): ClientInternals {
    return client as unknown as ClientInternals;
}

function signedInState(client: MatronJournalClient, selectedConversationId = "c1"): ClientState {
    return {
        ...client.getSnapshot(),
        phase: "signed-in",
        session: SESSION,
        conversations: CONVERSATIONS,
        selectedConversationId,
        connection: "online",
    };
}

function fakeDatabase(overrides: Partial<FakeDatabase> = {}): FakeDatabase {
    return {
        events: jest.fn().mockResolvedValue([]),
        outbox: jest.fn().mockResolvedValue([]),
        putHistory: jest.fn().mockResolvedValue(undefined),
        markLocallyRead: jest.fn().mockResolvedValue(undefined),
        conversations: jest.fn().mockResolvedValue(CONVERSATIONS),
        addToOutbox: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe("MatronJournalClient state handling", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("clears pending acknowledgements and every conversation read timer on logout", async () => {
        jest.useFakeTimers();
        const client = new MatronJournalClient();
        const state = internals(client);
        state.pendingAck = 91;
        state.scheduleRead("c1", 10);
        state.scheduleRead("c2", 20);
        expect(state.readTimers.size).toBe(2);

        await client.logout();

        expect(state.pendingAck).toBe(0);
        expect(state.readHighWater.size).toBe(0);
        expect(state.readTimers.size).toBe(0);
        expect(jest.getTimerCount()).toBe(0);
    });

    it("flushes a read marker even after another conversation is selected", async () => {
        const client = new MatronJournalClient();
        const state = internals(client);
        const database = fakeDatabase();
        const send = jest.fn().mockReturnValue(true);
        state.state = signedInState(client, "c2");
        state.database = database;
        state.connection = { send };
        state.readHighWater.set("c1", 10);

        await state.flushRead("c1");

        expect(send).toHaveBeenCalledWith({ op: "read_marker", convo_id: "c1", up_to_seq: 10 });
        expect(database.markLocallyRead).toHaveBeenCalledWith("c1", 10);
        expect(state.readHighWater.has("c1")).toBe(false);
    });

    it("stores the open conversation and clears it when returning to the list", async () => {
        const client = new MatronJournalClient();
        const state = internals(client);
        state.state = signedInState(client);
        state.database = fakeDatabase();

        await client.selectConversation("c2");

        const selectionKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).find(
            (key) => key?.startsWith("matron_journal_selected_conversation_v1:"),
        );
        expect(selectionKey).toBeDefined();
        expect(localStorage.getItem(selectionKey!)).toBe("c2");

        client.clearSelection();
        expect(localStorage.getItem(selectionKey!)).toBeNull();
    });

    it("clears a history error after a successful retry", async () => {
        const client = new MatronJournalClient();
        const state = internals(client);
        const messages = jest
            .fn()
            .mockRejectedValueOnce(new Error("History unavailable"))
            .mockResolvedValueOnce({ events: [] });
        state.state = signedInState(client);
        state.database = fakeDatabase();
        state.api = { messages };

        await client.loadOlderHistory();
        expect(client.getSnapshot().connectionError).toBe("History unavailable");

        await client.loadOlderHistory();
        expect(client.getSnapshot().connectionError).toBeUndefined();
    });

    it("mirrors the local id into the outgoing payload for exact reconciliation", async () => {
        const client = new MatronJournalClient();
        const state = internals(client);
        const send = jest.fn().mockReturnValue(true);
        state.state = signedInState(client);
        state.database = fakeDatabase();
        state.connection = { send };

        await client.sendMessage("same message");

        const operation = send.mock.calls[0][0] as {
            local_id: string;
            payload: { body: string; local_id: string };
        };
        expect(operation.payload).toEqual({ body: "same message", local_id: operation.local_id });
    });
});
