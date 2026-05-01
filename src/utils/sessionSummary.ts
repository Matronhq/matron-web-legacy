/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

export const SESSION_SUMMARY_CONTENT_KEY = "com.matron.session_summary";

export function isSessionSummaryEvent(event: MatrixEvent | null | undefined): event is MatrixEvent {
    if (!event) return false;

    const content = event.getContent();
    if (content[SESSION_SUMMARY_CONTENT_KEY] === true) return true;

    const body = typeof content.body === "string" ? content.body.trimStart() : "";
    return /^📌?\s*Session Summary\b/i.test(body);
}

export function getSessionSummaryText(event: MatrixEvent): string {
    const body = event.getContent().body;
    return typeof body === "string" ? body : "";
}
