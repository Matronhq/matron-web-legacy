/*
Copyright Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import SdkConfig from "../../../src/SdkConfig";
import { shouldAutoJoinMatronInvite } from "../../../src/utils/matronAutoJoin";

const OWN_USER_ID = "@agent:example.org";

function makeRoom(membership: KnownMembership, inviterUserId?: string): Room {
    return {
        getMyMembership: () => membership,
        getMember: () => ({
            events: {
                member: {
                    getSender: () => inviterUserId,
                },
            },
        }),
    } as unknown as Room;
}

describe("shouldAutoJoinMatronInvite", () => {
    afterEach(() => {
        SdkConfig.reset();
    });

    it("auto-joins same-homeserver invites automatically", () => {
        expect(shouldAutoJoinMatronInvite(makeRoom(KnownMembership.Invite, "@other:example.org"), OWN_USER_ID)).toBe(
            true,
        );
    });

    it("does not auto-join invites from another homeserver by default", () => {
        expect(shouldAutoJoinMatronInvite(makeRoom(KnownMembership.Invite, "@dev-3:server.test"), OWN_USER_ID)).toBe(
            false,
        );
    });

    it("auto-joins invites from exact allowlisted bot user IDs", () => {
        SdkConfig.put({ matron_auto_join_bot_user_ids: ["@support-bot:example.org"] });

        expect(
            shouldAutoJoinMatronInvite(makeRoom(KnownMembership.Invite, "@support-bot:example.org"), OWN_USER_ID),
        ).toBe(true);
    });

    it("supports wildcard full MXID allowlist entries", () => {
        SdkConfig.put({ matron_auto_join_bot_user_ids: ["@support-bot:*"] });

        expect(shouldAutoJoinMatronInvite(makeRoom(KnownMembership.Invite, "@support-bot:server.test"), OWN_USER_ID))
            .toBe(true);
    });

    it("only auto-joins invite rooms", () => {
        SdkConfig.put({ matron_auto_join_bot_user_ids: ["@support-bot:example.org"] });

        expect(shouldAutoJoinMatronInvite(makeRoom(KnownMembership.Join, "@support-bot:example.org"), OWN_USER_ID)).toBe(
            false,
        );
    });
});
