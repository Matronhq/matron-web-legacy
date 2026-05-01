/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";

import { MATRON_COMMANDS } from "./EventTypes";

interface MatronCommand {
    command: string;
}

function normalizeCommandName(command: string): string {
    return command.trim().replace(/^\/+/, "").toLowerCase();
}

export function isMatronCommand(room: Room, commandName: string): boolean {
    const stateEvent = room.currentState.getStateEvents(MATRON_COMMANDS, "");
    const commands = stateEvent?.getContent()?.commands;
    if (!Array.isArray(commands)) return false;

    const normalizedCommandName = normalizeCommandName(commandName);
    return commands.some(
        (command: Partial<MatronCommand>) =>
            typeof command.command === "string" && normalizeCommandName(command.command) === normalizedCommandName,
    );
}
