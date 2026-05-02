// packages/matron-live-output/src/LiveOutputTile.tsx
import React, { useEffect, useState } from "react";
import type { MatrixEvent } from "@element-hq/element-web-module-api";
// CSS is imported and injected in `index.tsx` (via `?inline`) so the plugin
// bundle stays self-contained when loaded via dynamic `import()`.

interface LiveOutputContent {
    tool_use_id: string;
    command: string;
    viewer_url: string;
    expires_at: number;
}

interface Props {
    mxEvent: MatrixEvent;
}

export function LiveOutputTile({ mxEvent }: Props): React.JSX.Element {
    // The module-api MatrixEvent exposes `content` as a plain Record (already
    // decrypted by the host) — no `getContent()` method. See
    // node_modules/@element-hq/element-web-module-api/lib/element-web-module-api-alpha.d.ts
    // (interface MatrixEvent).
    const content = mxEvent.content["com.matron.live_output"] as LiveOutputContent | undefined;
    const [expanded, setExpanded] = useState(false);
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        if (!content) return;
        const remaining = content.expires_at * 1000 - Date.now();
        if (remaining <= 0) {
            setExpired(true);
            return;
        }
        const t = setTimeout(() => setExpired(true), remaining);
        return () => clearTimeout(t);
    }, [content?.expires_at]);

    if (!content) return <div className="mx_LiveOutput--invalid">Live output (invalid event)</div>;

    return (
        <div className="mx_LiveOutput">
            <div className="mx_LiveOutput_header">
                <code className="mx_LiveOutput_command">$ {content.command}</code>
                <button
                    className="mx_LiveOutput_toggle"
                    onClick={() => setExpanded((e) => !e)}
                    aria-label={expanded ? "Collapse" : "Expand"}
                >
                    {expanded ? "▾" : "▸"}
                </button>
            </div>
            {expired ? (
                <div className="mx_LiveOutput_expired">Output expired</div>
            ) : (
                <iframe
                    className="mx_LiveOutput_iframe"
                    src={content.viewer_url}
                    sandbox="allow-scripts"
                    style={{ height: expanded ? 600 : 240, width: "100%", border: "none", background: "#0d1117" }}
                    title={`Live output for ${content.command}`}
                />
            )}
        </div>
    );
}
