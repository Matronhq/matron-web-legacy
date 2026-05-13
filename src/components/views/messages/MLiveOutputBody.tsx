/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useRef, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { MATRON_LIVE_OUTPUT_CONTENT_KEY } from "../../../matron/EventTypes";

interface IProps {
    mxEvent: MatrixEvent;
}

interface LiveOutputContent {
    tool_use_id: string;
    command: string;
    viewer_url: string;
    expires_at: number;
}

type Status = "connecting" | "running" | "complete" | "expired" | "denied" | "error";

function viewerUrlToWsUrl(viewerUrl: string): string {
    // http(s)://host/live?token=… -> ws(s)://host/live/ws?token=…
    const wsScheme = viewerUrl.replace(/^http/, "ws");
    return wsScheme.replace(/\/live(?=\?|$)/, "/live/ws");
}

function statusLabel(status: Status, exitCode: number | null, truncated: boolean): string {
    switch (status) {
        case "connecting": return "connecting…";
        case "running":    return "running…";
        case "complete": {
            const base = exitCode === 0 ? "✓ exit 0" : `✗ exit ${exitCode ?? "?"}`;
            return truncated ? `${base} · truncated` : base;
        }
        case "denied":     return "not executed";
        case "expired":    return "expired";
        case "error":      return "⚠ disconnected";
    }
}

const MLiveOutputBody: React.FC<IProps> = ({ mxEvent }) => {
    const content = mxEvent.getContent()[MATRON_LIVE_OUTPUT_CONTENT_KEY] as LiveOutputContent | undefined;
    const initialStatus: Status =
        content && Date.now() >= content.expires_at * 1000 ? "expired" : "connecting";
    const [status, setStatus] = useState<Status>(initialStatus);
    const [exitCode, setExitCode] = useState<number | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [output, setOutput] = useState<string>("");
    const [stickyBottom, setStickyBottom] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const preRef = useRef<HTMLPreElement | null>(null);

    useEffect(() => {
        if (!stickyBottom) return;
        const pre = preRef.current;
        if (!pre) return;
        pre.scrollTop = pre.scrollHeight;
    }, [output, stickyBottom]);

    const onScroll: React.UIEventHandler<HTMLPreElement> = (e) => {
        const pre = e.currentTarget;
        const nearBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
        setStickyBottom(nearBottom);
    };

    useEffect(() => {
        if (!content) return;
        if (Date.now() >= content.expires_at * 1000) return;
        let terminal = false;
        const ws = new WebSocket(viewerUrlToWsUrl(content.viewer_url));
        ws.onopen = () => setStatus(s => (s === "connecting" ? "running" : s));
        ws.onmessage = (ev: MessageEvent) => {
            let frame: any;
            try { frame = JSON.parse(ev.data); }
            catch { logger.warn("MLiveOutputBody: malformed frame", ev.data); return; }
            if (frame.type === "data" && typeof frame.chunk === "string") {
                setOutput(o => o + frame.chunk);
            } else if (frame.type === "complete") {
                terminal = true;
                setExitCode(frame.exitCode ?? null);
                setTruncated(!!frame.truncated);
                setStatus(frame.denied ? "denied" : "complete");
            }
        };
        ws.onclose = (ev: CloseEvent) => {
            if (terminal) return;
            if (ev.code === 1000) return;
            setStatus("error");
        };
        ws.onerror = () => {
            if (terminal) return;
            setStatus("error");
        };
        const msUntilExpiry = content.expires_at * 1000 - Date.now();
        const expiryTimer = setTimeout(() => {
            terminal = true;
            setStatus("expired");
            try { ws.close(); } catch { /* noop */ }
        }, msUntilExpiry);
        return () => {
            clearTimeout(expiryTimer);
            try { ws.close(); } catch { /* noop */ }
        };
    }, [content?.viewer_url]);

    if (!content) return null;

    return (
        <div className="mx_MLiveOutputBody" data-status={status} data-expanded={expanded}>
            <header className="mx_MLiveOutputBody_header">
                <code className="mx_MLiveOutputBody_cmd">$ {content.command}</code>
                <span className="mx_MLiveOutputBody_status" aria-live="polite">
                    {statusLabel(status, exitCode, truncated)}
                </span>
                <button
                    type="button"
                    className="mx_MLiveOutputBody_toggle"
                    aria-label={expanded ? "Collapse" : "Expand"}
                    onClick={() => setExpanded(e => !e)}
                >
                    {expanded ? "−" : "+"}
                </button>
            </header>
            {status !== "expired" && status !== "denied" && (
                <pre ref={preRef} className="mx_MLiveOutputBody_output" onScroll={onScroll}>
                    {output}
                    {truncated && "\n[output truncated]\n"}
                </pre>
            )}
            {status === "denied" && (
                <p className="mx_MLiveOutputBody_placeholder">Command not executed</p>
            )}
            {status === "expired" && (
                <p className="mx_MLiveOutputBody_placeholder">Output expired</p>
            )}
        </div>
    );
};

export default MLiveOutputBody;
