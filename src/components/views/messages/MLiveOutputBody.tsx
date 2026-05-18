/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { MATRON_LIVE_OUTPUT_CONTENT_KEY } from "../../../matron/EventTypes";
import { INITIAL_SGR_STATE, parseAnsi, type SgrState } from "./ansiToReact";
import {
    type CachedEntry,
    type CachedStatus,
    loadEntry,
    saveEntry,
} from "./liveOutputCache";

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

const PERSIST_INTERVAL_MS = 3000;

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

function persistableStatus(status: Status): CachedStatus {
    // Map UI statuses to the subset we cache: "connecting" persists as "running".
    if (status === "connecting") return "running";
    return status;
}

const MLiveOutputBody: React.FC<IProps> = ({ mxEvent }) => {
    const content = mxEvent.getContent()[MATRON_LIVE_OUTPUT_CONTENT_KEY] as LiveOutputContent | undefined;
    const [status, setStatus] = useState<Status>("connecting");
    const [exitCode, setExitCode] = useState<number | null>(null);
    const [truncated, setTruncated] = useState(false);
    const [nodes, setNodes] = useState<ReactNode[]>([]);
    const [stickyBottom, setStickyBottom] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const preRef = useRef<HTMLPreElement | null>(null);

    useEffect(() => {
        if (!stickyBottom) return;
        const pre = preRef.current;
        if (!pre) return;
        pre.scrollTop = pre.scrollHeight;
    }, [nodes, stickyBottom]);

    const onScroll: React.UIEventHandler<HTMLPreElement> = (e) => {
        const pre = e.currentTarget;
        const nearBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
        setStickyBottom(nearBottom);
    };

    useEffect(() => {
        if (!content) return;

        let cancelled = false;
        let terminal = false;
        let ws: WebSocket | null = null;
        let saveTimer: ReturnType<typeof setInterval> | null = null;

        const rawText = { current: "" };
        const cachedPrefixLen = { current: 0 };
        const bytesReceived = { current: 0 };
        const sgr: { state: SgrState; tail: string; key: number } = {
            state: { ...INITIAL_SGR_STATE },
            tail: "",
            key: 0,
        };
        let curStatus: Status = "connecting";
        let curExitCode: number | null = null;
        let curTruncated = false;

        const buildEntry = (): CachedEntry => ({
            toolUseId: content.tool_use_id,
            command: content.command,
            rawText: rawText.current,
            status: persistableStatus(curStatus),
            exitCode: curExitCode,
            truncated: curTruncated,
            cachedAt: Date.now(),
        });

        const persist = (): Promise<void> => {
            if (!rawText.current) return Promise.resolve();
            return saveEntry(buildEntry());
        };

        const stopSaveTimer = (): void => {
            if (saveTimer) {
                clearInterval(saveTimer);
                saveTimer = null;
            }
        };

        const markTerminal = (next: Status): void => {
            terminal = true;
            curStatus = next;
            setStatus(next);
            stopSaveTimer();
            void persist();
        };

        const appendNewText = (text: string): void => {
            if (!text) return;
            rawText.current += text;
            const parsed = parseAnsi(text, sgr.state, sgr.tail, sgr.key);
            sgr.state = parsed.state;
            sgr.tail = parsed.tail;
            sgr.key += parsed.nodes.length;
            if (parsed.nodes.length > 0) {
                setNodes((prev) => [...prev, ...parsed.nodes]);
            }
        };

        const handleDataChunk = (chunk: string): void => {
            const prevReceived = bytesReceived.current;
            bytesReceived.current = prevReceived + chunk.length;
            const cached = cachedPrefixLen.current;
            // Replay from server starts at offset 0; skip whatever's already in the cache.
            if (bytesReceived.current <= cached) return;
            const effective = prevReceived < cached ? chunk.slice(cached - prevReceived) : chunk;
            appendNewText(effective);
        };

        const startWs = (): void => {
            ws = new WebSocket(viewerUrlToWsUrl(content.viewer_url));
            ws.onopen = (): void => {
                if (cancelled || terminal) return;
                curStatus = "running";
                setStatus((s) => (s === "connecting" ? "running" : s));
            };
            ws.onmessage = (ev: MessageEvent): void => {
                if (cancelled) return;
                let frame: any;
                try { frame = JSON.parse(ev.data); }
                catch { logger.warn("MLiveOutputBody: malformed frame", ev.data); return; }
                if (frame.type === "data" && typeof frame.chunk === "string") {
                    handleDataChunk(frame.chunk);
                } else if (frame.type === "complete") {
                    curExitCode = frame.exitCode ?? null;
                    curTruncated = !!frame.truncated;
                    setExitCode(curExitCode);
                    setTruncated(curTruncated);
                    markTerminal(frame.denied ? "denied" : "complete");
                }
            };
            ws.onclose = (ev: CloseEvent): void => {
                if (terminal || cancelled) return;
                if (ev.code === 1000) return;
                markTerminal("error");
            };
            ws.onerror = (): void => {
                if (terminal || cancelled) return;
                markTerminal("error");
            };
        };

        const restoreFromCache = (cached: CachedEntry): void => {
            rawText.current = cached.rawText;
            cachedPrefixLen.current = cached.rawText.length;
            curExitCode = cached.exitCode;
            curTruncated = cached.truncated;
            setExitCode(cached.exitCode);
            setTruncated(cached.truncated);
            if (cached.rawText) {
                const parsed = parseAnsi(cached.rawText, INITIAL_SGR_STATE, "", 0);
                sgr.state = parsed.state;
                sgr.tail = parsed.tail;
                sgr.key = parsed.nodes.length;
                if (parsed.nodes.length > 0) setNodes(parsed.nodes);
            }
        };

        const msUntilExpiry = content.expires_at * 1000 - Date.now();
        const expiryTimer =
            msUntilExpiry > 0
                ? setTimeout(() => {
                      if (terminal || cancelled) return;
                      markTerminal("expired");
                      try { ws?.close(); } catch { /* noop */ }
                  }, msUntilExpiry)
                : null;

        void (async () => {
            const cached = await loadEntry(content.tool_use_id);
            if (cancelled) return;

            const tokenExpired = Date.now() >= content.expires_at * 1000;

            if (cached) {
                restoreFromCache(cached);
                const cachedTerminal = cached.status === "complete" || cached.status === "denied";
                if (cachedTerminal) {
                    terminal = true;
                    curStatus = cached.status as Status;
                    setStatus(cached.status as Status);
                    return;
                }
                if (tokenExpired) {
                    markTerminal("expired");
                    return;
                }
            } else if (tokenExpired) {
                markTerminal("expired");
                return;
            }

            startWs();
            saveTimer = setInterval(() => { void persist(); }, PERSIST_INTERVAL_MS);
        })();

        return (): void => {
            cancelled = true;
            if (expiryTimer) clearTimeout(expiryTimer);
            stopSaveTimer();
            try { ws?.close(); } catch { /* noop */ }
            // One last best-effort save while output is still streaming.
            if (!terminal && rawText.current) void persist();
        };
    }, [content?.tool_use_id, content?.viewer_url, content?.expires_at]);

    if (!content) return null;

    const hasOutput = nodes.length > 0;
    const showPre = hasOutput || (status !== "expired" && status !== "denied");

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
            {showPre && (
                <pre ref={preRef} className="mx_MLiveOutputBody_output" onScroll={onScroll}>
                    {nodes}
                    {truncated && "\n[output truncated]\n"}
                </pre>
            )}
            {status === "denied" && !hasOutput && (
                <p className="mx_MLiveOutputBody_placeholder">Command not executed</p>
            )}
            {status === "expired" && !hasOutput && (
                <p className="mx_MLiveOutputBody_placeholder">Output expired</p>
            )}
        </div>
    );
};

export default MLiveOutputBody;
