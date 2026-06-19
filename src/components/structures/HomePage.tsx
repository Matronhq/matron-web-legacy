/*
Copyright Matron Contributors.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AutoHideScrollbar from "./AutoHideScrollbar";
import { getHomePageUrl } from "../../utils/pages";
import SdkConfig from "../../SdkConfig";
import { useMatrixClientContext } from "../../contexts/MatrixClientContext";
import EmbeddedPage from "./EmbeddedPage";

interface IProps {
    justRegistered?: boolean;
}

const HomePage: React.FC<IProps> = () => {
    const cli = useMatrixClientContext();
    const config = SdkConfig.get();
    const pageUrl = getHomePageUrl(config, cli);

    if (pageUrl) {
        return <EmbeddedPage className="mx_HomePage" url={pageUrl} scrollbar={true} />;
    }

    const brandingConfig = SdkConfig.getObject("branding");
    const logoUrl = brandingConfig?.get("auth_header_logo_url") ?? "themes/element/img/logos/matron-logo-simple.svg";

    return (
        <AutoHideScrollbar className="mx_HomePage mx_HomePage_default" element="main">
            <div className="mx_HomePage_default_wrapper">
                <img src={logoUrl} alt={config.brand} />
                <h1>Welcome to Matron</h1>
            </div>
        </AutoHideScrollbar>
    );
};

export default HomePage;
