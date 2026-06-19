/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type CSSProperties, type ReactNode } from "react";

export interface SgrState {
    fg: string | null;
    bg: string | null;
    bold: boolean;
    dim: boolean;
    inverse: boolean;
}

export interface ParseResult {
    nodes: ReactNode[];
    state: SgrState;
    tail: string;
}

export const INITIAL_SGR_STATE: SgrState = {
    fg: null,
    bg: null,
    bold: false,
    dim: false,
    inverse: false,
};

const ESC = "\x1b";

// 16-color palette tuned for the dark terminal background.
// Normal (30-37, 40-47) and bright (90-97, 100-107) variants.
const PALETTE: Record<number, string> = {
    30: "#3a3a3a", 31: "#e06c75", 32: "#98c379", 33: "#e5c07b",
    34: "#61afef", 35: "#c678dd", 36: "#56b6c2", 37: "#dcdcdc",
    90: "#5c6370", 91: "#ef8a93", 92: "#b6e08e", 93: "#f0d089",
    94: "#83c5f0", 95: "#d692ec", 96: "#80c8d1", 97: "#ffffff",
};

function spanStyle(state: SgrState): CSSProperties {
    const style: CSSProperties = {};
    const fg = state.inverse ? state.bg : state.fg;
    const bg = state.inverse ? state.fg : state.bg;
    if (fg) style.color = fg;
    if (bg) style.backgroundColor = bg;
    if (state.bold) style.fontWeight = 600;
    if (state.dim) style.opacity = 0.6;
    return style;
}

function isStyled(state: SgrState): boolean {
    return state.fg !== null || state.bg !== null || state.bold || state.dim || state.inverse;
}

function applyParam(state: SgrState, param: number): void {
    if (param === 0) {
        state.fg = null;
        state.bg = null;
        state.bold = false;
        state.dim = false;
        state.inverse = false;
    } else if (param === 1) {
        state.bold = true;
    } else if (param === 2) {
        state.dim = true;
    } else if (param === 7) {
        state.inverse = true;
    } else if (param === 22) {
        state.bold = false;
        state.dim = false;
    } else if (param === 27) {
        state.inverse = false;
    } else if (param === 39) {
        state.fg = null;
    } else if (param === 49) {
        state.bg = null;
    } else if ((param >= 30 && param <= 37) || (param >= 90 && param <= 97)) {
        state.fg = PALETTE[param] ?? null;
    } else if ((param >= 40 && param <= 47) || (param >= 100 && param <= 107)) {
        // Background codes mirror foreground codes shifted by 10:
        // 40-47 -> 30-37, 100-107 -> 90-97. The palette is keyed on fg codes.
        state.bg = PALETTE[param - 10] ?? null;
    }
    // Unsupported (256-color, truecolor, etc.) is silently ignored.
}

// Parse a chunk of text containing ANSI SGR escapes into React nodes.
// Maintains style state and a tail of any incomplete escape sequence so chunks
// split mid-escape by the WebSocket transport render correctly.
export function parseAnsi(input: string, prevState: SgrState, prevTail: string, startKey: number): ParseResult {
    const buffer = prevTail + input;
    const state: SgrState = { ...prevState };
    const nodes: ReactNode[] = [];
    let textStart = 0;
    let i = 0;
    let key = startKey;

    const flushText = (end: number): void => {
        if (end <= textStart) return;
        const text = buffer.slice(textStart, end);
        if (isStyled(state)) {
            nodes.push(
                <span key={key++} style={spanStyle(state)}>
                    {text}
                </span>,
            );
        } else {
            nodes.push(text);
        }
    };

    while (i < buffer.length) {
        if (buffer[i] !== ESC) {
            i++;
            continue;
        }
        // Found ESC. Need at least ESC + '[' + ... + final byte.
        if (i + 1 >= buffer.length) break; // incomplete, hold in tail
        if (buffer[i + 1] !== "[") {
            // Non-CSI escape: drop the ESC and the next byte from output.
            flushText(i);
            i += 2;
            textStart = i;
            continue;
        }
        // CSI: scan for final byte in range @–~ (0x40–0x7e).
        let j = i + 2;
        while (j < buffer.length) {
            const code = buffer.charCodeAt(j);
            if (code >= 0x40 && code <= 0x7e) break;
            j++;
        }
        if (j >= buffer.length) break; // incomplete sequence, hold in tail

        flushText(i);
        const final = buffer[j];
        const params = buffer.slice(i + 2, j);
        if (final === "m") {
            const parts = params.length === 0 ? [0] : params.split(";").map((p) => (p === "" ? 0 : Number(p)));
            for (const param of parts) {
                if (!Number.isNaN(param)) applyParam(state, param);
            }
        }
        // Non-SGR CSI sequences (cursor moves, etc.) are stripped.
        i = j + 1;
        textStart = i;
    }

    flushText(i);
    return { nodes, state, tail: buffer.slice(i) };
}
