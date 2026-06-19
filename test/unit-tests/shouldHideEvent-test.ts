/*
Copyright Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import shouldHideEvent from "../../src/shouldHideEvent";

describe("shouldHideEvent", () => {
    it("hides room encryption events", () => {
        const event = new MatrixEvent({
            type: EventType.RoomEncryption,
            room_id: "!room:example.org",
            state_key: "",
            content: {},
        });

        expect(shouldHideEvent(event)).toBe(true);
    });

    it("hides own invite and join membership ceremony events", () => {
        const context = {
            room: {
                client: {
                    getSafeUserId: () => "@user:example.org",
                },
            },
            showRedactions: true,
            showJoinLeaves: true,
            showAvatarChanges: true,
            showDisplaynameChanges: true,
        };
        const inviteEvent = new MatrixEvent({
            type: EventType.RoomMember,
            room_id: "!room:example.org",
            sender: "@bot:example.org",
            state_key: "@user:example.org",
            content: { membership: KnownMembership.Invite },
            unsigned: { prev_content: { membership: KnownMembership.Leave } },
        });
        const joinEvent = new MatrixEvent({
            type: EventType.RoomMember,
            room_id: "!room:example.org",
            sender: "@user:example.org",
            state_key: "@user:example.org",
            content: { membership: KnownMembership.Join },
            unsigned: { prev_content: { membership: KnownMembership.Invite } },
        });

        expect(shouldHideEvent(inviteEvent, context as never)).toBe(true);
        expect(shouldHideEvent(joinEvent, context as never)).toBe(true);
    });

    it("does not always hide other members joining", () => {
        const event = new MatrixEvent({
            type: EventType.RoomMember,
            room_id: "!room:example.org",
            sender: "@other:example.org",
            state_key: "@other:example.org",
            content: { membership: KnownMembership.Join },
            unsigned: { prev_content: { membership: KnownMembership.Invite } },
        });

        expect(shouldHideEvent(event)).toBe(false);
    });
});
