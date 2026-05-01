/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import BaseDialog from "./BaseDialog";
import { getSessionSummaryText } from "../../../utils/sessionSummary";

interface SessionSummaryDialogProps {
    mxEvent: MatrixEvent;
    onFinished(): void;
}

export function SessionSummaryDialog({ mxEvent, onFinished }: SessionSummaryDialogProps): JSX.Element {
    return (
        <BaseDialog className="mx_SessionSummaryDialog" title="Session summary" onFinished={onFinished}>
            <div className="mx_Dialog_content mx_SessionSummaryDialog_content">{getSessionSummaryText(mxEvent)}</div>
        </BaseDialog>
    );
}
