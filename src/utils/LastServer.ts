/*
Copyright Matron Contributors.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";

export const LAST_SERVER_KEY = "mx_last_server_config";

interface LastServer {
    hsUrl: string;
    isUrl?: string;
}

export function persistLastServer(value: LastServer): void {
    if (!value.hsUrl) return;
    try {
        localStorage.setItem(LAST_SERVER_KEY, JSON.stringify({ hsUrl: value.hsUrl, isUrl: value.isUrl }));
    } catch (e) {
        logger.warn("Failed to persist last server", e);
    }
}

export function getLastServer(): LastServer | null {
    const raw = localStorage.getItem(LAST_SERVER_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.hsUrl === "string" && parsed.hsUrl) return parsed;
        return null;
    } catch {
        return null;
    }
}
