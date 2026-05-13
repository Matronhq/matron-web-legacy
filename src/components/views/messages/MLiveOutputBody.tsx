/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MATRON_LIVE_OUTPUT_CONTENT_KEY } from "../../../matron/EventTypes";

interface IProps {
    mxEvent: MatrixEvent;
}

interface LiveOutputContent {
    tool_use_id: string;
    command: string;
    viewer_url: string;
    expires_at: number;
}

const MLiveOutputBody: React.FC<IProps> = ({ mxEvent }) => {
    const content = mxEvent.getContent()[MATRON_LIVE_OUTPUT_CONTENT_KEY] as LiveOutputContent | undefined;
    if (!content) return null;
    return (
        <div className="mx_MLiveOutputBody">
            <header className="mx_MLiveOutputBody_header">
                <code className="mx_MLiveOutputBody_cmd">$ {content.command}</code>
            </header>
        </div>
    );
};

export default MLiveOutputBody;
