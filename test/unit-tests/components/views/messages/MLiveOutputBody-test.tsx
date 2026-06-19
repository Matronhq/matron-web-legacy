/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { act, render } from "jest-matrix-react";
import { MatrixEvent } from "matrix-js-sdk/src/matrix";

import MLiveOutputBody from "../../../../../src/components/views/messages/MLiveOutputBody";
import {
    MATRON_LIVE_OUTPUT_EVENT_TYPE,
    MATRON_LIVE_OUTPUT_CONTENT_KEY,
} from "../../../../../src/matron/EventTypes";
import { MockWebSocket, installMockWebSocket, restoreWebSocket } from "./__mocks__/MockWebSocket";
import {
    type CachedEntry,
    type CachedStatus,
    loadEntry,
    saveEntry,
} from "../../../../../src/components/views/messages/liveOutputCache";

jest.mock("../../../../../src/components/views/messages/liveOutputCache", () => ({
    loadEntry: jest.fn().mockResolvedValue(null),
    saveEntry: jest.fn().mockResolvedValue(undefined),
    deleteEntry: jest.fn().mockResolvedValue(undefined),
    gc: jest.fn().mockResolvedValue(undefined),
}));

const mockLoadEntry = loadEntry as jest.MockedFunction<typeof loadEntry>;
const mockSaveEntry = saveEntry as jest.MockedFunction<typeof saveEntry>;

function makeLiveOutputEvent(overrides: Record<string, any> = {}) {
    const expires_at = overrides.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
    const tool_use_id = overrides.tool_use_id ?? "toolu_01";
    return new MatrixEvent({
        type: MATRON_LIVE_OUTPUT_EVENT_TYPE,
        sender: "@user:server",
        room_id: "!room:server",
        event_id: "$evt1",
        origin_server_ts: Date.now(),
        content: {
            msgtype: "m.text",
            body: "$ ls -la\n[live output: https://viewer.example/live?token=abc]",
            [MATRON_LIVE_OUTPUT_CONTENT_KEY]: {
                tool_use_id,
                command: "ls -la",
                viewer_url: "https://viewer.example/live?token=abc",
                expires_at,
            },
        },
    });
}

function makeCachedEntry(overrides: Partial<CachedEntry> = {}): CachedEntry {
    return {
        toolUseId: "toolu_01",
        command: "ls -la",
        rawText: "",
        status: "running" as CachedStatus,
        exitCode: null,
        truncated: false,
        cachedAt: Date.now(),
        ...overrides,
    };
}

// Flush the cache-load microtask plus any state updates that follow.
async function flushCacheLoad(): Promise<void> {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("<MLiveOutputBody/>", () => {
    const realWebSocket = globalThis.WebSocket;
    beforeEach(() => {
        installMockWebSocket();
        mockLoadEntry.mockResolvedValue(null);
        mockSaveEntry.mockClear();
        mockSaveEntry.mockResolvedValue(undefined);
    });
    afterEach(() => restoreWebSocket(realWebSocket));

    describe("when no cache exists", () => {
        it("opens a WebSocket to the live-output endpoint and shows 'running…' once open", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            expect(ws.url).toBe("wss://viewer.example/live/ws?token=abc");
            act(() => ws._open());
            expect(getByText("running…")).toBeInTheDocument();
        });

        it("appends streamed data chunks into the pre", async () => {
            const { getByText, container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "data", chunk: "hello\n" }));
            act(() => ws._message({ type: "data", chunk: "world\n" }));
            const pre = container.querySelector(".mx_MLiveOutputBody_output");
            expect(pre?.textContent).toContain("hello");
            expect(pre?.textContent).toContain("world");
            expect(getByText("running…")).toBeInTheDocument();
        });

        it("transitions to ✓ exit 0 on a complete frame with exitCode 0", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: false }));
            expect(getByText("✓ exit 0")).toBeInTheDocument();
        });

        it("transitions to ✗ exit N for non-zero exit codes", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "complete", exitCode: 1, denied: false, truncated: false }));
            expect(getByText("✗ exit 1")).toBeInTheDocument();
        });

        it("appends '· truncated' to ✓ exit 0 when complete frame is truncated", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: true }));
            expect(getByText("✓ exit 0 · truncated")).toBeInTheDocument();
        });

        it("appends '· truncated' to ✗ exit N when complete frame is truncated", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "complete", exitCode: 1, denied: false, truncated: true }));
            expect(getByText("✗ exit 1 · truncated")).toBeInTheDocument();
        });

        it("transitions to 'not executed' on denied", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "complete", exitCode: null, denied: true, truncated: false }));
            expect(getByText("not executed")).toBeInTheDocument();
            expect(getByText("Command not executed")).toBeInTheDocument();
        });

        it("transitions to ⚠ disconnected when WS closes abnormally before complete", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._close(1006, "abnormal"));
            expect(getByText("⚠ disconnected")).toBeInTheDocument();
        });

        it("stays on ✓ exit 0 when WS closes normally after complete", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: false }));
            act(() => ws._close(1000, "done"));
            expect(getByText("✓ exit 0")).toBeInTheDocument();
        });

        it("transitions to ⚠ disconnected on a WebSocket error before complete", async () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._error());
            expect(getByText("⚠ disconnected")).toBeInTheDocument();
        });

        it("renders the command in the header", () => {
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            expect(getByText("$ ls -la")).toBeInTheDocument();
        });

        it("flips to 'expired' when the expiry timer fires while mounted", async () => {
            jest.useFakeTimers();
            try {
                const expires_at = Math.floor(Date.now() / 1000) + 2;
                const { getByText } = render(
                    <MLiveOutputBody mxEvent={makeLiveOutputEvent({ expires_at })} />,
                );
                // jest.useFakeTimers also stops microtask flushing via setImmediate,
                // so use Promise resolution directly to flush the cache load.
                await act(async () => { await Promise.resolve(); await Promise.resolve(); });
                const ws = MockWebSocket.last();
                act(() => ws._open());
                expect(getByText("running…")).toBeInTheDocument();
                act(() => { jest.advanceTimersByTime(2500); });
                expect(getByText("expired")).toBeInTheDocument();
                expect(ws.readyState).toBe(3); // CLOSED
            } finally {
                jest.useRealTimers();
            }
        });

        it("renders 'expired' and skips WS connect when expires_at is in the past at mount", async () => {
            const past = Math.floor(Date.now() / 1000) - 60;
            const { getByText } = render(
                <MLiveOutputBody mxEvent={makeLiveOutputEvent({ expires_at: past })} />,
            );
            await flushCacheLoad();
            expect(MockWebSocket.instances).toHaveLength(0);
            expect(getByText("expired")).toBeInTheDocument();
            expect(getByText("Output expired")).toBeInTheDocument();
        });

        it("renders nothing when the live-output content key is missing", () => {
            const event = new MatrixEvent({
                type: MATRON_LIVE_OUTPUT_EVENT_TYPE,
                sender: "@user:server",
                room_id: "!room:server",
                event_id: "$evt-no-content",
                origin_server_ts: Date.now(),
                content: {
                    msgtype: "m.text",
                    body: "no live output content here",
                },
            });
            const { container } = render(<MLiveOutputBody mxEvent={event} />);
            expect(container.firstChild).toBeNull();
        });

        it("auto-scrolls to bottom when streaming while sticky-bottom is engaged", async () => {
            const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            const pre = container.querySelector(".mx_MLiveOutputBody_output") as HTMLPreElement;
            // jsdom doesn't implement layout, so stub scroll properties
            Object.defineProperty(pre, "scrollHeight", { configurable: true, get: () => 1000 });
            Object.defineProperty(pre, "clientHeight", { configurable: true, get: () => 200 });
            let observedScrollTop = 0;
            Object.defineProperty(pre, "scrollTop", {
                configurable: true,
                get: () => observedScrollTop,
                set: (v: number) => { observedScrollTop = v; },
            });
            act(() => ws._message({ type: "data", chunk: "line\n" }));
            expect(observedScrollTop).toBe(1000); // pinned to bottom
        });

        it("disengages sticky-bottom when the user scrolls up, re-engages near bottom", async () => {
            const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            const pre = container.querySelector(".mx_MLiveOutputBody_output") as HTMLPreElement;
            let scrollTop = 100;
            Object.defineProperty(pre, "scrollHeight", { configurable: true, get: () => 1000 });
            Object.defineProperty(pre, "clientHeight", { configurable: true, get: () => 200 });
            Object.defineProperty(pre, "scrollTop", {
                configurable: true,
                get: () => scrollTop,
                set: (v: number) => { scrollTop = v; },
            });
            // User scrolled up: dispatch scroll event
            act(() => { pre.dispatchEvent(new Event("scroll")); });
            act(() => ws._message({ type: "data", chunk: "more\n" }));
            expect(scrollTop).toBe(100); // unchanged — sticky disengaged

            // User scrolls back near bottom (clientHeight + scrollTop >= scrollHeight - 8)
            scrollTop = 800; // 800 + 200 = 1000 >= 1000 - 8 ✓
            act(() => { pre.dispatchEvent(new Event("scroll")); });
            act(() => ws._message({ type: "data", chunk: "and more\n" }));
            expect(scrollTop).toBe(1000); // re-engaged → pinned to bottom
        });

        it("starts collapsed (data-expanded=false) and toggles via the expand button", () => {
            const { container, getByRole } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            const root = container.querySelector(".mx_MLiveOutputBody")!;
            expect(root.getAttribute("data-expanded")).toBe("false");
            const toggle = getByRole("button", { name: /expand/i });
            act(() => toggle.click());
            expect(root.getAttribute("data-expanded")).toBe("true");
            const collapseBtn = getByRole("button", { name: /collapse/i });
            act(() => collapseBtn.click());
            expect(root.getAttribute("data-expanded")).toBe("false");
        });

        it("renders an inline truncation marker in the pre when complete is truncated", async () => {
            const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "data", chunk: "lots of output\n" }));
            act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: true }));
            const pre = container.querySelector(".mx_MLiveOutputBody_output");
            expect(pre?.textContent).toContain("output truncated");
        });
    });

    describe("with cache", () => {
        it("does NOT open a WebSocket when cache holds a terminal (complete) entry", async () => {
            mockLoadEntry.mockResolvedValue(
                makeCachedEntry({ rawText: "cached complete output\n", status: "complete", exitCode: 0 }),
            );
            const { getByText, container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            expect(MockWebSocket.instances).toHaveLength(0);
            expect(getByText("✓ exit 0")).toBeInTheDocument();
            expect(container.querySelector(".mx_MLiveOutputBody_output")?.textContent)
                .toContain("cached complete output");
        });

        it("does NOT open a WebSocket when cache holds a terminal (denied) entry", async () => {
            mockLoadEntry.mockResolvedValue(makeCachedEntry({ rawText: "", status: "denied" }));
            const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            expect(MockWebSocket.instances).toHaveLength(0);
            expect(getByText("not executed")).toBeInTheDocument();
        });

        it("renders cached truncation marker for a complete+truncated cached entry", async () => {
            mockLoadEntry.mockResolvedValue(
                makeCachedEntry({
                    rawText: "stuff\n",
                    status: "complete",
                    exitCode: 0,
                    truncated: true,
                }),
            );
            const { container, getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            expect(getByText("✓ exit 0 · truncated")).toBeInTheDocument();
            expect(container.querySelector(".mx_MLiveOutputBody_output")?.textContent)
                .toContain("output truncated");
        });

        it("opens a WebSocket but skips the cached prefix on replay", async () => {
            mockLoadEntry.mockResolvedValue(makeCachedEntry({ rawText: "hello\n", status: "running" }));
            const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();

            // Cached output is rendered before the WS connects
            const preInitial = container.querySelector(".mx_MLiveOutputBody_output");
            expect(preInitial?.textContent).toContain("hello");

            const ws = MockWebSocket.last();
            expect(ws).toBeDefined();
            act(() => ws._open());

            // Server replays everything from byte 0. We feed it as one chunk: cached + new.
            act(() => ws._message({ type: "data", chunk: "hello\nworld\n" }));

            const pre = container.querySelector(".mx_MLiveOutputBody_output");
            // "hello" should appear exactly once (cached + skipped on replay), not twice.
            expect(pre?.textContent?.match(/hello/g)).toHaveLength(1);
            expect(pre?.textContent).toContain("world");
        });

        it("dedupes when replay arrives across multiple chunks straddling the cached prefix", async () => {
            mockLoadEntry.mockResolvedValue(makeCachedEntry({ rawText: "abc", status: "running" }));
            const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            // Two chunks: first fully inside cache; second straddles the boundary.
            act(() => ws._message({ type: "data", chunk: "ab" }));
            act(() => ws._message({ type: "data", chunk: "cdef" }));
            const pre = container.querySelector(".mx_MLiveOutputBody_output");
            expect(pre?.textContent).toBe("abcdef");
        });

        it("persists a snapshot when the WS completes (terminal save)", async () => {
            const { } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
            await flushCacheLoad();
            const ws = MockWebSocket.last();
            act(() => ws._open());
            act(() => ws._message({ type: "data", chunk: "result\n" }));
            act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: false }));
            expect(mockSaveEntry).toHaveBeenCalled();
            const lastCall = mockSaveEntry.mock.calls[mockSaveEntry.mock.calls.length - 1][0];
            expect(lastCall.status).toBe("complete");
            expect(lastCall.exitCode).toBe(0);
            expect(lastCall.rawText).toBe("result\n");
            expect(lastCall.toolUseId).toBe("toolu_01");
        });

        it("renders cached output + 'expired' badge when the viewer token has expired but content was cached", async () => {
            const past = Math.floor(Date.now() / 1000) - 60;
            mockLoadEntry.mockResolvedValue(
                makeCachedEntry({ rawText: "old running output\n", status: "running" }),
            );
            const { getByText, container } = render(
                <MLiveOutputBody mxEvent={makeLiveOutputEvent({ expires_at: past })} />,
            );
            await flushCacheLoad();
            expect(MockWebSocket.instances).toHaveLength(0);
            expect(getByText("expired")).toBeInTheDocument();
            // Cached content shown alongside the expired badge — no placeholder displaces it.
            expect(container.querySelector(".mx_MLiveOutputBody_output")?.textContent)
                .toContain("old running output");
        });
    });
});
