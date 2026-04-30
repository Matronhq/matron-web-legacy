/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useEffect, useState } from "react";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type RoomMessageEventContent } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { MATRON_BUTTONS, MATRON_BUTTON_RESPONSE, MATRON_BUTTON_ANSWER } from "../../../matron/EventTypes";
import { type GetRelationsForEvent } from "../rooms/EventTile";

interface MatronButton {
    id: string;
    label: string;
    value: string;
}

interface MatronButtons {
    mode: "pick_one" | "pick_many";
    prompt: string;
    buttons: MatronButton[];
}

interface IProps {
    mxEvent: MatrixEvent;
    getRelationsForEvent?: GetRelationsForEvent;
}

export default function MButtonGroupBody({ mxEvent, getRelationsForEvent }: IProps): React.JSX.Element {
    const content = mxEvent.getContent();
    const buttonsData: MatronButtons | undefined = content[MATRON_BUTTONS];

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!getRelationsForEvent) return;
        const eventId = mxEvent.getId();
        if (!eventId) return;

        const relations = getRelationsForEvent(eventId, MATRON_BUTTON_ANSWER, "m.room.message");
        if (!relations) return;

        const myUserId = MatrixClientPeg.safeGet().getUserId();
        const events = relations.getRelations?.() ?? [];
        for (const ev of events) {
            const responseContent = ev.getContent()?.[MATRON_BUTTON_RESPONSE];
            if (ev.getSender() === myUserId && responseContent) {
                setSubmitted(true);
                if (buttonsData) {
                    let values: string[];
                    if (
                        typeof responseContent === "object" &&
                        Array.isArray((responseContent as { selected_values?: unknown }).selected_values)
                    ) {
                        values = (responseContent as { selected_values: string[] }).selected_values;
                    } else {
                        values = (ev.getContent().body || "").split(", ");
                    }
                    const ids = new Set<string>();
                    for (const btn of buttonsData.buttons) {
                        if (values.includes(btn.value)) ids.add(btn.id);
                    }
                    setSelectedIds(ids);
                }
                break;
            }
        }
    }, [mxEvent, getRelationsForEvent, buttonsData]);

    const sendResponse = useCallback(
        async (values: string[]) => {
            const cli = MatrixClientPeg.safeGet();
            const roomId = mxEvent.getRoomId();
            const eventId = mxEvent.getId();
            if (!roomId || !eventId) return;

            const responseContent = {
                "msgtype": MsgType.Text,
                "body": values.join(", "),
                [MATRON_BUTTON_RESPONSE]: {
                    selected_values: values,
                },
                "m.relates_to": {
                    rel_type: MATRON_BUTTON_ANSWER,
                    event_id: eventId,
                },
            } as unknown as RoomMessageEventContent;

            await cli.sendMessage(roomId, responseContent);
        },
        [mxEvent],
    );

    const handlePickOne = useCallback(
        (btn: MatronButton) => {
            if (submitted) return;
            setSelectedIds(new Set([btn.id]));
            setSubmitted(true);
            sendResponse([btn.value]);
        },
        [submitted, sendResponse],
    );

    const handleToggle = useCallback(
        (btn: MatronButton) => {
            if (submitted) return;
            setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(btn.id)) next.delete(btn.id);
                else next.add(btn.id);
                return next;
            });
        },
        [submitted],
    );

    const handleSubmitMany = useCallback(() => {
        if (submitted || !buttonsData) return;
        const selectedValues = buttonsData.buttons.filter((btn) => selectedIds.has(btn.id)).map((btn) => btn.value);
        if (selectedValues.length === 0) return;
        setSubmitted(true);
        sendResponse(selectedValues);
    }, [submitted, buttonsData, selectedIds, sendResponse]);

    if (!buttonsData) return <></>;

    const { mode, prompt, buttons } = buttonsData;
    const totalLabelLength = buttons.reduce((sum, button) => sum + button.label.length, 0);
    const useVertical = buttons.length > 4 || totalLabelLength > 60;

    return (
        <div className="mx_MButtonGroupBody">
            <div className="mx_MButtonGroupBody_prompt">{prompt}</div>
            <div
                className={`mx_MButtonGroupBody_buttons ${
                    useVertical ? "mx_MButtonGroupBody_vertical" : "mx_MButtonGroupBody_horizontal"
                }`}
            >
                {buttons.map((btn) => {
                    const isSelected = selectedIds.has(btn.id);
                    let className = "mx_MButtonGroupBody_button";
                    if (isSelected) className += " mx_MButtonGroupBody_button_selected";
                    if (submitted && !isSelected) className += " mx_MButtonGroupBody_button_disabled";
                    if (submitted) className += " mx_MButtonGroupBody_button_submitted";

                    return (
                        <button
                            key={btn.id}
                            className={className}
                            disabled={submitted}
                            onClick={() => (mode === "pick_one" ? handlePickOne(btn) : handleToggle(btn))}
                        >
                            {btn.label}
                        </button>
                    );
                })}
            </div>
            {mode === "pick_many" && !submitted && (
                <button
                    className="mx_MButtonGroupBody_submit"
                    disabled={selectedIds.size === 0}
                    onClick={handleSubmitMany}
                >
                    Submit
                </button>
            )}
            {mode === "pick_many" && submitted && <div className="mx_MButtonGroupBody_submitted">Submitted</div>}
        </div>
    );
}
