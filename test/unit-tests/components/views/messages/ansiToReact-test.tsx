/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import {
    INITIAL_SGR_STATE,
    parseAnsi,
} from "../../../../../src/components/views/messages/ansiToReact";

function renderNodes(nodes: React.ReactNode[]): HTMLElement {
    const { container } = render(<pre>{nodes}</pre>);
    return container.firstChild as HTMLElement;
}

describe("parseAnsi", () => {
    it("returns plain text as a single string node when no escapes", () => {
        const r = parseAnsi("hello world", INITIAL_SGR_STATE, "", 0);
        expect(r.tail).toBe("");
        expect(r.nodes).toEqual(["hello world"]);
        expect(r.state).toEqual(INITIAL_SGR_STATE);
    });

    it("wraps colored runs in styled spans and resets to plain after [0m", () => {
        const r = parseAnsi("\x1b[31mred\x1b[0m end", INITIAL_SGR_STATE, "", 0);
        const pre = renderNodes(r.nodes);
        const span = pre.querySelector("span");
        expect(span?.textContent).toBe("red");
        expect(span?.getAttribute("style")).toContain("color: rgb(224, 108, 117)");
        expect(pre.textContent).toBe("red end");
        expect(r.state).toEqual(INITIAL_SGR_STATE);
    });

    it("preserves SGR state across calls so colors persist between chunks", () => {
        const a = parseAnsi("\x1b[32mhello ", INITIAL_SGR_STATE, "", 0);
        expect(a.state.fg).toBe("#98c379");
        const b = parseAnsi("world", a.state, a.tail, a.nodes.length);
        const pre = renderNodes([...a.nodes, ...b.nodes]);
        const spans = pre.querySelectorAll("span");
        expect(spans).toHaveLength(2);
        expect(spans[0].textContent).toBe("hello ");
        expect(spans[1].textContent).toBe("world");
        expect(spans[1].getAttribute("style")).toContain("color: rgb(152, 195, 121)");
    });

    it("holds an incomplete escape sequence in the tail until the rest arrives", () => {
        const a = parseAnsi("before\x1b[3", INITIAL_SGR_STATE, "", 0);
        expect(a.tail).toBe("\x1b[3");
        expect(renderNodes(a.nodes).textContent).toBe("before");
        const b = parseAnsi("4mblue", a.state, a.tail, a.nodes.length);
        expect(b.tail).toBe("");
        const pre = renderNodes(b.nodes);
        expect(pre.querySelector("span")?.textContent).toBe("blue");
        expect(pre.querySelector("span")?.getAttribute("style")).toContain("color: rgb(97, 175, 239)");
    });

    it("strips non-SGR CSI sequences without breaking surrounding text", () => {
        const r = parseAnsi("before\x1b[2Kafter", INITIAL_SGR_STATE, "", 0);
        expect(renderNodes(r.nodes).textContent).toBe("beforeafter");
        expect(r.state).toEqual(INITIAL_SGR_STATE);
    });

    it("applies bold via font-weight and dim via opacity, and clears them on [22m", () => {
        const a = parseAnsi("\x1b[1;2mdim-bold\x1b[22m plain", INITIAL_SGR_STATE, "", 0);
        const pre = renderNodes(a.nodes);
        const span = pre.querySelector("span");
        expect(span?.getAttribute("style")).toContain("font-weight: 600");
        expect(span?.getAttribute("style")).toContain("opacity: 0.6");
        expect(a.state.bold).toBe(false);
        expect(a.state.dim).toBe(false);
    });

    it("maps bright background codes (100-107) to the palette", () => {
        const r = parseAnsi("\x1b[103;30mwarn\x1b[0m", INITIAL_SGR_STATE, "", 0);
        const span = renderNodes(r.nodes).querySelector("span");
        expect(span?.getAttribute("style")).toContain("background-color: rgb(240, 208, 137)");
        expect(span?.getAttribute("style")).toContain("color: rgb(58, 58, 58)");
    });
});
