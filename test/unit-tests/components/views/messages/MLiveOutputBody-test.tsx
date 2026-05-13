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

function makeLiveOutputEvent(overrides: Record<string, any> = {}) {
    const expires_at = overrides.expires_at ?? Math.floor(Date.now() / 1000) + 3600;
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
                tool_use_id: "toolu_01",
                command: "ls -la",
                viewer_url: "https://viewer.example/live?token=abc",
                expires_at,
            },
        },
    });
}

describe("<MLiveOutputBody/>", () => {
    const realWebSocket = globalThis.WebSocket;
    beforeEach(() => installMockWebSocket());
    afterEach(() => restoreWebSocket(realWebSocket));

    it("opens a WebSocket to the live-output endpoint and shows 'running…' once open", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        expect(ws.url).toBe("wss://viewer.example/live/ws?token=abc");
        act(() => ws._open());
        expect(getByText("running…")).toBeInTheDocument();
    });

    it("appends streamed data chunks into the pre", () => {
        const { getByText, container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._message({ type: "data", chunk: "hello\n" }));
        act(() => ws._message({ type: "data", chunk: "world\n" }));
        const pre = container.querySelector(".mx_MLiveOutputBody_output");
        expect(pre?.textContent).toContain("hello");
        expect(pre?.textContent).toContain("world");
        expect(getByText("running…")).toBeInTheDocument();
    });

    it("transitions to ✓ exit 0 on a complete frame with exitCode 0", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: false }));
        expect(getByText("✓ exit 0")).toBeInTheDocument();
    });

    it("transitions to ✗ exit N for non-zero exit codes", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._message({ type: "complete", exitCode: 1, denied: false, truncated: false }));
        expect(getByText("✗ exit 1")).toBeInTheDocument();
    });

    it("appends '· truncated' to ✓ exit 0 when complete frame is truncated", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: true }));
        expect(getByText("✓ exit 0 · truncated")).toBeInTheDocument();
    });

    it("transitions to 'not executed' on denied", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._message({ type: "complete", exitCode: null, denied: true, truncated: false }));
        expect(getByText("not executed")).toBeInTheDocument();
        expect(getByText("Command not executed")).toBeInTheDocument();
    });

    it("transitions to ⚠ disconnected when WS closes abnormally before complete", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._close(1006, "abnormal"));
        expect(getByText("⚠ disconnected")).toBeInTheDocument();
    });

    it("stays on ✓ exit 0 when WS closes normally after complete", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._message({ type: "complete", exitCode: 0, denied: false, truncated: false }));
        act(() => ws._close(1000, "done"));
        expect(getByText("✓ exit 0")).toBeInTheDocument();
    });

    it("transitions to ⚠ disconnected on a WebSocket error before complete", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        const ws = MockWebSocket.last();
        act(() => ws._open());
        act(() => ws._error());
        expect(getByText("⚠ disconnected")).toBeInTheDocument();
    });

    it("renders the command in the header", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        expect(getByText("$ ls -la")).toBeInTheDocument();
    });

    it("flips to 'expired' when the expiry timer fires while mounted", () => {
        jest.useFakeTimers();
        try {
            const expires_at = Math.floor(Date.now() / 1000) + 2;
            const { getByText } = render(
                <MLiveOutputBody mxEvent={makeLiveOutputEvent({ expires_at })} />,
            );
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

    it("renders 'expired' and skips WS connect when expires_at is in the past at mount", () => {
        const past = Math.floor(Date.now() / 1000) - 60;
        const { getByText } = render(
            <MLiveOutputBody mxEvent={makeLiveOutputEvent({ expires_at: past })} />,
        );
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

    it("auto-scrolls to bottom when streaming while sticky-bottom is engaged", () => {
        const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
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

    it("disengages sticky-bottom when the user scrolls up, re-engages near bottom", () => {
        const { container } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
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
});
