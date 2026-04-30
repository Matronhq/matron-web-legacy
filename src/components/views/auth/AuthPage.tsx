/*
Copyright Matron Contributors.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import SdkConfig from "../../../SdkConfig";

interface IProps {
    /**
     * Whether to add a blurred shadow around the modal.
     *
     * If the modal component provides its own shadow or blurring, this can be
     * disabled.  Defaults to `true`.
     */
    addBlur?: boolean;
}

export default class AuthPage extends React.PureComponent<React.PropsWithChildren<IProps>> {
    private static welcomeBackground?: string;

    // cache the background as a static to prevent it changing without refreshing
    private static getWelcomeBackground(): string {
        if (AuthPage.welcomeBackground) return AuthPage.welcomeBackground;

        const brandingConfig = SdkConfig.getObject("branding");
        AuthPage.welcomeBackground = "#fbfaf6";

        const configuredUrl = brandingConfig?.get("welcome_background_url");
        if (configuredUrl) {
            if (Array.isArray(configuredUrl)) {
                const index = Math.floor(Math.random() * configuredUrl.length);
                AuthPage.welcomeBackground = `center/cover fixed url(${configuredUrl[index]})`;
            } else {
                AuthPage.welcomeBackground = `center/cover fixed url(${configuredUrl})`;
            }
        }

        return AuthPage.welcomeBackground;
    }

    public render(): React.ReactElement {
        const pageStyle = {
            background: AuthPage.getWelcomeBackground(),
        };

        const modalStyle: React.CSSProperties = {
            position: "relative",
            background: "initial",
        };

        const blurStyle: React.CSSProperties = {
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            filter: "blur(40px)",
            background: pageStyle.background,
        };

        const modalContentStyle: React.CSSProperties = {
            display: "flex",
            zIndex: 1,
            borderRadius: "inherit",
        };

        let modalBlur;
        if (this.props.addBlur !== false) {
            // Blur out the background: add a `div` which covers the content behind the modal,
            // and blurs it out.
            modalBlur = <div className="mx_AuthPage_modalBlur" style={blurStyle} />;
        }

        const modalClasses = classNames({
            mx_AuthPage_modal: true,
            mx_AuthPage_modal_withBlur: this.props.addBlur !== false,
        });

        return (
            <div className="mx_AuthPage" style={pageStyle}>
                <div className={modalClasses} style={modalStyle}>
                    {modalBlur}
                    <main
                        className="mx_AuthPage_modalContent"
                        style={modalContentStyle}
                        tabIndex={-1}
                        aria-live="polite"
                    >
                        {this.props.children}
                    </main>
                </div>
            </div>
        );
    }
}
