// packages/matron-live-output/src/index.tsx
//
// Module entrypoint for the @matron/live-output plugin. This package follows
// the @element-hq/element-web-module-api plugin shape: the default export is
// a `ModuleFactory` class with a `moduleApiVersion`, a constructor that
// receives the host `Api` instance, and an async `load()` method that
// registers the custom renderer.
//
// See node_modules/@element-hq/element-web-module-api/lib/element-web-module-api-alpha.d.ts
// (interface Module / interface ModuleFactory) and
// src/modules/customComponentApi.ts (the host implementation of
// `customComponents.registerMessageRenderer`).
//
// At runtime, the matron-web client picks up plugins via
// `SdkConfig.get("modules")` (see src/vector/init.tsx -> loadPlugins): it
// performs a dynamic `import(url)` of each entry and passes the loaded module
// to `ModuleLoader.load(module)`. To wire this package up, build it as a
// standalone ESM bundle and add its URL to the deployed config's `modules`
// list.

import React from "react";
import type { Api, Module } from "@element-hq/element-web-module-api";

import { LiveOutputTile } from "./LiveOutputTile";
// Inline the CSS as a string at build time and inject it as a <style> tag when
// the plugin loads. Vite's lib mode would otherwise emit the CSS as a separate
// file (`dist/live-output.css`) which the host has no way to load — the plugin
// is dynamic-imported as a single ESM URL, so the bundle must be self-contained.
import liveOutputCss from "./LiveOutputTile.css?inline";

const LIVE_OUTPUT_EVENT_TYPE = "com.matron.live_output.v1";

function injectStyles(css: string, id: string): void {
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
}

class LiveOutputModule implements Module {
    public static readonly moduleApiVersion = "^1.9.0";

    public constructor(private readonly api: Api) {}

    public async load(): Promise<void> {
        injectStyles(liveOutputCss, "matron-live-output-styles");
        this.api.customComponents.registerMessageRenderer(LIVE_OUTPUT_EVENT_TYPE, (props) => {
            return <LiveOutputTile mxEvent={props.mxEvent} />;
        });
    }
}

export default LiveOutputModule;
