/*
Copyright Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import SdkConfig from "../SdkConfig";

function getAutoJoinBotUserIds(): string[] {
    const configuredValues = SdkConfig.get("matron_auto_join_bot_user_ids");
    if (!Array.isArray(configuredValues)) return [];

    return configuredValues
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean);
}

function globToRegExp(glob: string): RegExp {
    const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
}

function matchesPattern(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
        if (pattern.includes("*")) {
            return globToRegExp(pattern).test(value);
        }

        return pattern === value;
    });
}

function getServerName(userId: string | undefined): string | undefined {
    const match = userId?.match(/^@[^:]+:(.+)$/);
    if (!match) return;
    return match[1];
}

export function shouldAutoJoinMatronInvite(room: Room, ownUserId: string): boolean {
    if (room.getMyMembership() !== KnownMembership.Invite) return false;

    const inviterUserId = room.getMember(ownUserId)?.events.member?.getSender();
    if (!inviterUserId) return false;
    if (matchesPattern(inviterUserId, getAutoJoinBotUserIds())) return true;

    return getServerName(ownUserId) === getServerName(inviterUserId);
}
