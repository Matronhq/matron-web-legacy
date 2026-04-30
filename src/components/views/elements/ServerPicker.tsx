/*
Copyright Matron Contributors.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { InfoIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { AutoDiscovery } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import AccessibleButton from "./AccessibleButton";
import { type ValidatedServerConfig } from "../../../utils/ValidatedServerConfig";
import { _t, UserFriendlyError } from "../../../languageHandler";
import TextWithTooltip from "./TextWithTooltip";
import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import ServerPickerDialog from "../dialogs/ServerPickerDialog";
import InfoDialog from "../dialogs/InfoDialog";
import Field from "./Field";
import withValidation, { type IFieldState, type IValidationResult } from "./Validation";
import AutoDiscoveryUtils from "../../../utils/AutoDiscoveryUtils";

interface IProps {
    title?: string;
    dialogTitle?: string;
    serverConfig: ValidatedServerConfig;
    disabled?: boolean;
    inlineField?: boolean;
    onServerConfigChange?(config: ValidatedServerConfig): void;
}

async function validateHomeserver(value: string): Promise<ValidatedServerConfig> {
    let hsUrl = value.trim();

    if (!hsUrl.includes("://")) {
        try {
            const discoveryResult = await AutoDiscovery.findClientConfig(hsUrl);
            return await AutoDiscoveryUtils.buildValidatedConfigFromDiscovery(hsUrl, discoveryResult);
        } catch (e) {
            logger.error(`Attempted ${hsUrl} as a server_name but it failed`, e);
        }
    }

    if (!hsUrl.includes("://")) {
        hsUrl = "https://" + hsUrl;
    }

    try {
        return await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl);
    } catch (e) {
        logger.error(e);

        const stateForError = AutoDiscoveryUtils.authComponentStateForError(e);
        if (stateForError.serverErrorIsFatal) {
            let error = _t("auth|server_picker_failed_validate_homeserver");
            if (e instanceof UserFriendlyError && e.translatedMessage) {
                error = e.translatedMessage;
            }
            throw new Error(error);
        }

        try {
            return await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl, undefined, true);
        } catch (e) {
            logger.error(e);
            throw new Error(_t("auth|server_picker_invalid_url"));
        }
    }
}

const validateHomeserverField = withValidation<void, { error?: string }>({
    deriveData: async ({ value }): Promise<{ error?: string }> => {
        const homeserver = value?.trim();
        if (!homeserver) return {};

        try {
            await validateHomeserver(homeserver);
            return {};
        } catch (e) {
            return { error: e instanceof Error ? e.message : _t("auth|server_picker_invalid_url") };
        }
    },
    rules: [
        {
            key: "required",
            test: ({ value, allowEmpty }) => allowEmpty || !!value,
            invalid: () => _t("auth|server_picker_required"),
        },
        {
            key: "valid",
            test: async function ({ value }, { error }): Promise<boolean> {
                if (!value) return true;
                return !error;
            },
            invalid: function ({ error }) {
                return error ?? null;
            },
        },
    ],
});

function serverConfigToInputValue(serverConfig: ValidatedServerConfig): string {
    return serverConfig.isNameResolvable && serverConfig.hsName ? serverConfig.hsName : serverConfig.hsUrl;
}

const showPickerDialog = (
    title: string | undefined,
    serverConfig: ValidatedServerConfig,
    onFinished: (config?: ValidatedServerConfig) => void,
): void => {
    const { finished } = Modal.createDialog(ServerPickerDialog, { title, serverConfig });
    finished.then(([config]) => onFinished(config));
};

const onHelpClick = (): void => {
    const brand = SdkConfig.get().brand;
    Modal.createDialog(
        InfoDialog,
        {
            title: _t("auth|server_picker_title_default"),
            description: _t("auth|server_picker_description", { brand }),
            button: _t("action|dismiss"),
            hasCloseButton: false,
            fixedWidth: false,
        },
        "mx_ServerPicker_helpDialog",
    );
};

const ServerPicker: React.FC<IProps> = ({
    title,
    dialogTitle,
    serverConfig,
    onServerConfigChange,
    disabled,
    inlineField,
}) => {
    const disableCustomUrls = SdkConfig.get("disable_custom_urls");
    const fieldRef = React.useRef<Field>(null);
    const [homeserver, setHomeserver] = React.useState(serverConfigToInputValue(serverConfig));

    React.useEffect(() => {
        setHomeserver(serverConfigToInputValue(serverConfig));
    }, [serverConfig]);

    const onHomeserverChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        setHomeserver(ev.target.value);
    };

    const onHomeserverValidate = (fieldState: IFieldState): Promise<IValidationResult> =>
        validateHomeserverField(fieldState);

    const applyHomeserver = async (): Promise<void> => {
        if (disabled || disableCustomUrls || !onServerConfigChange) return;
        if (homeserver.trim() === serverConfigToInputValue(serverConfig)) return;

        const valid = await fieldRef.current?.validate({ allowEmpty: false });
        if (!valid) {
            fieldRef.current?.focus();
            fieldRef.current?.validate({ allowEmpty: false, focused: true });
            return;
        }

        onServerConfigChange(await validateHomeserver(homeserver));
    };

    if (inlineField && !disableCustomUrls && onServerConfigChange) {
        return (
            <div className="mx_ServerPicker mx_ServerPicker_inline">
                <Field
                    id="mx_LoginForm_homeserver"
                    label={title || _t("common|homeserver")}
                    type="text"
                    autoComplete="url"
                    value={homeserver}
                    onChange={onHomeserverChange}
                    onBlur={applyHomeserver}
                    onValidate={onHomeserverValidate}
                    validateOnChange={false}
                    validateOnFocus={false}
                    disabled={disabled}
                    ref={fieldRef}
                />
            </div>
        );
    }

    let editBtn;
    if (!disableCustomUrls && onServerConfigChange) {
        const onClick = (): void => {
            showPickerDialog(dialogTitle, serverConfig, (config?: ValidatedServerConfig) => {
                if (config) {
                    onServerConfigChange(config);
                }
            });
        };
        editBtn = (
            <AccessibleButton className="mx_ServerPicker_change" kind="link" onClick={onClick} disabled={disabled}>
                {_t("action|edit")}
            </AccessibleButton>
        );
    }

    let serverName: React.ReactNode = serverConfig.isNameResolvable ? serverConfig.hsName : serverConfig.hsUrl;
    if (serverConfig.hsNameIsDifferent) {
        serverName = (
            <TextWithTooltip className="mx_Login_underlinedServerName" tooltip={serverConfig.hsUrl}>
                {serverConfig.hsName}
            </TextWithTooltip>
        );
    }

    let desc;
    if (serverConfig.hsName === "matrix.org") {
        desc = <span className="mx_ServerPicker_desc">{_t("auth|server_picker_description_matrix.org")}</span>;
    }

    return (
        <div className="mx_ServerPicker">
            <h2>{title || _t("common|homeserver")}</h2>
            {!disableCustomUrls ? (
                <AccessibleButton className="mx_ServerPicker_help" onClick={onHelpClick} aria-label={_t("common|help")}>
                    <InfoIcon />
                </AccessibleButton>
            ) : null}
            <span className="mx_ServerPicker_server" title={typeof serverName === "string" ? serverName : undefined}>
                {serverName}
            </span>
            {editBtn}
            {desc}
        </div>
    );
};

export default ServerPicker;
