/*
Copyright 2026 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { UIComponent, UIFeature } from "../settings/UIFeature";

export const enum MatronSurface {
    Spaces = "spaces",
    AdvancedSettings = "advanced_settings",
    Integrations = "integrations",
    Labs = "labs",
    Calls = "calls",
    LocationSharing = "location_sharing",
}

const hiddenComponents = new Set<UIComponent>([
    UIComponent.CreateSpaces,
    UIComponent.ExploreRooms,
    UIComponent.AddIntegrations,
    UIComponent.FilterContainer,
    UIComponent.RoomOptionsMenu,
]);

const hiddenSurfaces = new Set<MatronSurface>([
    MatronSurface.Spaces,
    MatronSurface.AdvancedSettings,
    MatronSurface.Integrations,
    MatronSurface.Labs,
    MatronSurface.Calls,
    MatronSurface.LocationSharing,
]);

export const disabledUIFeatureDefaults: readonly UIFeature[] = [
    UIFeature.AdvancedSettings,
    UIFeature.Feedback,
    UIFeature.LocationSharing,
    UIFeature.Registration,
    UIFeature.PasswordReset,
    UIFeature.ShareQRCode,
    UIFeature.ShareSocial,
    UIFeature.Widgets,
    UIFeature.Voip,
    UIFeature.AllowCreatingPublicRooms,
    UIFeature.AllowCreatingPublicSpaces,
];

export function shouldShowUIComponent(component: UIComponent): boolean {
    return !hiddenComponents.has(component);
}

export function isMatronSurfaceEnabled(surface: MatronSurface): boolean {
    return !hiddenSurfaces.has(surface);
}
