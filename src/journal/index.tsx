/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { createRoot } from "react-dom/client";
import "@element-hq/web-shared-components/dist/element-web-shared-components.css";
import "@fontsource/fira-code/latin-400.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import { TooltipProvider } from "@vector-im/compound-web";
import "../../res/themes/light/css/light.pcss";

import { MatronJournalClient } from "./client";
import { MatronApp } from "./components";
import "./journal.pcss";

const container = document.getElementById("matron");
if (!container) throw new Error("Matron application container is missing");

const client = new MatronJournalClient();
createRoot(container).render(
    <React.StrictMode>
        <TooltipProvider>
            <MatronApp client={client} />
        </TooltipProvider>
    </React.StrictMode>,
);
void client.initialise();
