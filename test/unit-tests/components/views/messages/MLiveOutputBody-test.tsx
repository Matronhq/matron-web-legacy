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

    it("renders the command in the header", () => {
        const { getByText } = render(<MLiveOutputBody mxEvent={makeLiveOutputEvent()} />);
        expect(getByText("$ ls -la")).toBeInTheDocument();
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
});
