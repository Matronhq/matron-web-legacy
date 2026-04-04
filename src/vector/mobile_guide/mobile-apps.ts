/*
Copyright 2025 Matron Contributors.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/*
 * Shared code that is used by the mobile guide.
 */

export enum MobileAppVariant {
    Classic = "matron-classic",
    X = "matron",
    Pro = "matron-pro",
}

export interface MobileAppMetadata {
    name: string;
    appleAppId: string;
    appStoreUrl: string;
    playStoreUrl: string;
    fDroidUrl?: string;
    deepLinkPath: string;
    usesLegacyDeepLink: boolean;
    isProApp: boolean;
}

export const mobileApps: Record<MobileAppVariant, MobileAppMetadata> = {
    [MobileAppVariant.Classic]: {
        name: "Matron",
        appleAppId: "id1083446067",
        appStoreUrl: "https://apps.apple.com/app/matron/id1083446067",
        playStoreUrl: "https://play.google.com/store/apps/details?id=chat.matron.app",
        fDroidUrl: "https://f-droid.org/packages/chat.matron.app",
        deepLinkPath: "",
        usesLegacyDeepLink: true,
        isProApp: false,
    },
    [MobileAppVariant.X]: {
        name: "Matron",
        appleAppId: "id1631335820",
        appStoreUrl: "https://apps.apple.com/app/matron/id1631335820",
        playStoreUrl: "https://play.google.com/store/apps/details?id=chat.matron.android",
        fDroidUrl: "https://f-droid.org/packages/chat.matron.android",
        deepLinkPath: "/matron",
        usesLegacyDeepLink: false,
        isProApp: false,
    },
    [MobileAppVariant.Pro]: {
        name: "Matron Pro",
        appleAppId: "id6502951615",
        appStoreUrl: "https://apps.apple.com/app/matron-pro/id6502951615",
        playStoreUrl: "https://play.google.com/store/apps/details?id=chat.matron.enterprise",
        deepLinkPath: "/matron-pro",
        usesLegacyDeepLink: false,
        isProApp: true,
    },
};

export function updateMobilePage(metadata: MobileAppMetadata, deepLinkUrl: string, server: string | undefined): void {
    const appleMeta = document.querySelector('meta[name="apple-itunes-app"]') as Element;
    appleMeta.setAttribute("content", `app-id=${metadata.appleAppId}`);

    if (server) {
        (document.getElementById("header_title") as HTMLHeadingElement).innerText = `Join ${server} on Matron`;
    }
    (document.getElementById("app_store_link") as HTMLAnchorElement).href = metadata.appStoreUrl;
    (document.getElementById("play_store_link") as HTMLAnchorElement).href = metadata.playStoreUrl;

    if (metadata.fDroidUrl) {
        (document.getElementById("f_droid_link") as HTMLAnchorElement).href = metadata.fDroidUrl;
    } else {
        document.getElementById("f_droid_section")!.style.display = "none";
    }

    const step1Heading = document.getElementById("step1_heading")!;
    step1Heading.innerHTML = step1Heading!.innerHTML.replace("Matron", metadata.name);

    // Step 2 is only shown on the mobile guide
    if (document.getElementById("step2_container")) {
        document.getElementById("step2_container")!.style.display = "block";
        if (metadata.isProApp) {
            document.getElementById("step2_description")!.innerHTML = "Use your work email to join";
        }
        (document.getElementById("deep_link_button") as HTMLAnchorElement).href = deepLinkUrl;
    }
}
