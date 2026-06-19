/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import AutocompleteProvider from "./AutocompleteProvider";
import { TextualCompletion } from "./Components";
import { type ICompletion, type ISelectionRange } from "./Autocompleter";
import { type TimelineRenderingType } from "../contexts/RoomContext";
import { MATRON_COMMANDS } from "../matron/EventTypes";

const COMMAND_RE = /(^\/\w*)(?: .*)?/g;

interface MatronCommand {
    command: string;
    args?: string;
    description: string;
}

export default class MatronCommandProvider extends AutocompleteProvider {
    private room: Room;

    public constructor(room: Room, renderingType?: TimelineRenderingType) {
        super({ commandRegex: COMMAND_RE, renderingType });
        this.room = room;
    }

    private getMatronCommands(): MatronCommand[] {
        const stateEvent = this.room.currentState.getStateEvents(MATRON_COMMANDS, "");
        return stateEvent?.getContent()?.commands || [];
    }

    public async getCompletions(
        query: string,
        selection: ISelectionRange,
        force?: boolean,
        limit = -1,
    ): Promise<ICompletion[]> {
        const { command, range } = this.getCurrentCommand(query, selection);
        if (!command) return [];

        const commands = this.getMatronCommands();
        if (commands.length === 0) return [];

        const inputCmd = command[1].slice(1).toLowerCase();

        let matches: MatronCommand[];
        if (query === "/") {
            matches = commands;
        } else if (command[0] !== command[1]) {
            matches = commands.filter((cmd) => cmd.command === inputCmd);
            if (matches.length > 0) return [];
        } else {
            matches = commands.filter((cmd) => cmd.command.startsWith(inputCmd));
        }

        if (limit > 0) {
            matches = matches.slice(0, limit);
        }

        return matches.map((cmd) => ({
            completion: `/${cmd.command} `,
            type: "command" as const,
            component: (
                <TextualCompletion title={`/${cmd.command}`} subtitle={cmd.args} description={cmd.description} />
            ),
            range: range!,
        }));
    }

    public getName(): string {
        return "Matron Commands";
    }

    public renderCompletions(completions: React.ReactNode[]): React.ReactNode {
        return (
            <div
                className="mx_Autocomplete_Completion_container_pill"
                role="presentation"
                aria-label="Matron Command Autocomplete"
            >
                {completions}
            </div>
        );
    }
}
