# No-Default-Homeserver Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Matron run with no configured homeserver — show an empty homeserver field, contact nothing until the user enters their own server, remember the last-used server — and strip all matrix.org/Element defaults from config.

**Architecture:** `verifyServerConfig()` in `src/vector/app.tsx` stops throwing when no default is configured and instead returns a synthetic empty `ValidatedServerConfig` (no network). `Login` renders server-entry-only while `hsUrl` is empty. A small `LastServer` util persists/restores the chosen server. Config files drop the Element defaults.

**Tech Stack:** TypeScript, React, matrix-react-sdk fork, Jest 30 + @testing-library + @fetch-mock/jest. Test runner: `yarn test` (`nx test:unit`); run a single file with `yarn jest <path>`.

## Global Constraints

- Repo: **matron-web**, branch `matron-ui-divergence`. Desktop integration (Task 7) is in **matron-desktop**.
- No homeserver is Matron-hosted; there is no default homeserver by design.
- Empty server is represented by `hsUrl === ""` on `ValidatedServerConfig`.
- localStorage key for the remembered server: `mx_last_server_config`.
- Never contact matrix.org / vector.im / scalar.vector.im.
- When a default server IS configured, all existing behavior must be unchanged (regression guard).
- Preserve the logged-in session-restore path in `app.tsx` (the `catch` at ~238–244).
- License header on any new file: copy the SPDX header from an existing `src/utils/*.ts` file.

---

### Task 1: Allow no default server (empty config, no network)

**Files:**
- Modify: `src/vector/app.tsx` (function `verifyServerConfig`, the throw at ~193–196)
- Test: `test/unit-tests/vector/app-test.ts`

**Interfaces:**
- Produces: `verifyServerConfig()` returns an `IConfigOptions` whose
  `validated_server_config` has `hsUrl === ""` when no default/name/hs_url is set,
  making **no** network request.

- [ ] **Step 1: Write the failing test**

Add to `test/unit-tests/vector/app-test.ts` (inside the top-level `describe`, a new block):

```ts
describe("no default homeserver", () => {
    beforeEach(() => {
        SdkConfig.reset();
        SdkConfig.put({ brand: "Matron" }); // no default_server_config / _name / _hs_url
    });

    it("loads without contacting matrix.org and yields an empty server config", async () => {
        // No fetchMock route is registered; any network call would throw.
        await expect(loadApp({}, jest.fn())).resolves.toBeTruthy();
        const cfg = SdkConfig.get("validated_server_config");
        expect(cfg).toBeTruthy();
        expect(cfg!.hsUrl).toBe("");
        expect(cfg!.isDefault).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest test/unit-tests/vector/app-test.ts -t "empty server config"`
Expected: FAIL — currently throws `UserFriendlyError("error|invalid_configuration_no_server")`.

- [ ] **Step 3: Implement the empty-config path**

In `src/vector/app.tsx`, replace the no-server throw:

```ts
        if (incompatibleOptions.length < 1) {
            // noinspection ExceptionCaughtLocallyJS
            throw new UserFriendlyError("error|invalid_configuration_no_server");
        }
```

with an early return of a synthetic empty config (no discovery, no network):

```ts
        if (incompatibleOptions.length < 1) {
            // Matron is bring-your-own-homeserver: with no default configured we do
            // NOT contact any server. Return an empty config; the login screen will
            // prompt the user to enter their homeserver.
            const emptyConfig: ValidatedServerConfig = {
                hsUrl: "",
                hsName: "",
                hsNameIsDifferent: false,
                isUrl: "",
                isDefault: false,
                isNameResolvable: false,
                warning: "",
            };
            logger.log("No default server configured - starting with empty server config");
            SdkConfig.add({ validated_server_config: emptyConfig });
            return SdkConfig.get();
        }
```

Ensure `ValidatedServerConfig` is imported in `app.tsx` (add to the existing import from `../utils/ValidatedServerConfig` if not already present).

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest test/unit-tests/vector/app-test.ts -t "empty server config"`
Expected: PASS.

- [ ] **Step 5: Run the full app-test file (regression)**

Run: `yarn jest test/unit-tests/vector/app-test.ts`
Expected: PASS — the existing `default_server_config` tests still pass (default path unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/vector/app.tsx test/unit-tests/vector/app-test.ts
git commit -m "Allow no default homeserver (empty server config, no network)"
```

---

### Task 2: LastServer persistence util

**Files:**
- Create: `src/utils/LastServer.ts`
- Test: `test/unit-tests/utils/LastServer-test.ts`

**Interfaces:**
- Produces:
  - `persistLastServer(value: { hsUrl: string; isUrl?: string }): void`
  - `getLastServer(): { hsUrl: string; isUrl?: string } | null`
  - `const LAST_SERVER_KEY = "mx_last_server_config"`

- [ ] **Step 1: Write the failing test**

Create `test/unit-tests/utils/LastServer-test.ts`:

```ts
import { persistLastServer, getLastServer, LAST_SERVER_KEY } from "../../../src/utils/LastServer";

describe("LastServer", () => {
    beforeEach(() => localStorage.clear());

    it("returns null when nothing stored", () => {
        expect(getLastServer()).toBeNull();
    });

    it("round-trips a stored server", () => {
        persistLastServer({ hsUrl: "https://hs.example", isUrl: "https://is.example" });
        expect(getLastServer()).toEqual({ hsUrl: "https://hs.example", isUrl: "https://is.example" });
        expect(localStorage.getItem(LAST_SERVER_KEY)).toContain("hs.example");
    });

    it("does not persist an empty hsUrl", () => {
        persistLastServer({ hsUrl: "" });
        expect(getLastServer()).toBeNull();
    });

    it("returns null on corrupt JSON", () => {
        localStorage.setItem(LAST_SERVER_KEY, "{not json");
        expect(getLastServer()).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest test/unit-tests/utils/LastServer-test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

Create `src/utils/LastServer.ts` (copy the SPDX license header from `src/utils/ValidatedServerConfig.ts`):

```ts
import { logger } from "matrix-js-sdk/src/logger";

export const LAST_SERVER_KEY = "mx_last_server_config";

interface LastServer {
    hsUrl: string;
    isUrl?: string;
}

export function persistLastServer(value: LastServer): void {
    if (!value.hsUrl) return;
    try {
        localStorage.setItem(LAST_SERVER_KEY, JSON.stringify({ hsUrl: value.hsUrl, isUrl: value.isUrl }));
    } catch (e) {
        logger.warn("Failed to persist last server", e);
    }
}

export function getLastServer(): LastServer | null {
    const raw = localStorage.getItem(LAST_SERVER_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.hsUrl === "string" && parsed.hsUrl) return parsed;
        return null;
    } catch {
        return null;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest test/unit-tests/utils/LastServer-test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add src/utils/LastServer.ts test/unit-tests/utils/LastServer-test.ts
git commit -m "Add LastServer persistence util"
```

---

### Task 3: Wire persistence — seed on startup, persist on change

**Files:**
- Modify: `src/vector/app.tsx` (the empty-config branch from Task 1)
- Modify: `src/components/structures/MatrixChat.tsx:2135` (`onServerConfigChange`)
- Test: `test/unit-tests/vector/app-test.ts`

**Interfaces:**
- Consumes: `getLastServer` (Task 2), `AutoDiscoveryUtils.validateServerConfigWithStaticUrls`.
- Produces: on startup with no default but a remembered server, `validated_server_config.hsUrl` equals the remembered server.

- [ ] **Step 1: Write the failing test**

Add to the "no default homeserver" describe in `test/unit-tests/vector/app-test.ts`:

```ts
it("seeds from the remembered server when present", async () => {
    localStorage.setItem(
        "mx_last_server_config",
        JSON.stringify({ hsUrl: "https://synapse" }),
    );
    fetchMock.get("https://synapse/_matrix/client/versions", { versions: ["v1.1"] });
    await loadApp({}, jest.fn());
    const cfg = SdkConfig.get("validated_server_config");
    expect(cfg!.hsUrl).toBe("https://synapse");
});

it("falls back to empty when the remembered server fails validation", async () => {
    localStorage.setItem("mx_last_server_config", JSON.stringify({ hsUrl: "https://dead" }));
    fetchMock.get("https://dead/_matrix/client/versions", { throws: new Error("offline") });
    await loadApp({}, jest.fn());
    expect(SdkConfig.get("validated_server_config")!.hsUrl).toBe("");
});
```

Add `beforeEach(() => localStorage.clear());` to the "no default homeserver" describe if not already clearing.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest test/unit-tests/vector/app-test.ts -t "remembered server"`
Expected: FAIL — currently always returns the empty config.

- [ ] **Step 3: Implement remembered-server seeding in app.tsx**

In the empty-config branch from Task 1, before constructing `emptyConfig`, try the remembered server:

```ts
        if (incompatibleOptions.length < 1) {
            // Matron is bring-your-own-homeserver. Try the last server the user used.
            const last = getLastServer();
            if (last?.hsUrl) {
                try {
                    const remembered = await AutoDiscoveryUtils.validateServerConfigWithStaticUrls(
                        last.hsUrl,
                        last.isUrl,
                        true,
                    );
                    logger.log("Seeding server config from remembered server", last.hsUrl);
                    SdkConfig.add({ validated_server_config: remembered });
                    return SdkConfig.get();
                } catch (e) {
                    logger.warn("Remembered server failed validation; starting empty", e);
                }
            }
            const emptyConfig: ValidatedServerConfig = {
                hsUrl: "",
                hsName: "",
                hsNameIsDifferent: false,
                isUrl: "",
                isDefault: false,
                isNameResolvable: false,
                warning: "",
            };
            logger.log("No default server configured - starting with empty server config");
            SdkConfig.add({ validated_server_config: emptyConfig });
            return SdkConfig.get();
        }
```

Add the import: `import { getLastServer } from "../utils/LastServer";` (ensure `AutoDiscoveryUtils` is already imported — it is, used elsewhere in app.tsx).

- [ ] **Step 4: Persist on server change in MatrixChat**

Modify `src/components/structures/MatrixChat.tsx:2135`:

```ts
    private onServerConfigChange = (serverConfig: ValidatedServerConfig): void => {
        persistLastServer({ hsUrl: serverConfig.hsUrl, isUrl: serverConfig.isUrl });
        this.setState({ serverConfig });
    };
```

Add the import near the other util imports: `import { persistLastServer } from "../../utils/LastServer";`

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn jest test/unit-tests/vector/app-test.ts`
Expected: PASS (empty, remembered-seed, and fallback cases, plus existing default tests).

- [ ] **Step 6: Commit**

```bash
git add src/vector/app.tsx src/components/structures/MatrixChat.tsx test/unit-tests/vector/app-test.ts
git commit -m "Remember and restore the last-used homeserver"
```

---

### Task 4: Login empty-state guard + render

**Files:**
- Modify: `src/components/structures/auth/Login.tsx` (`initLoginLogic` ~335, `render` ~the ServerPicker/`renderLoginComponentForFlows` block)
- Test: `test/unit-tests/components/structures/auth/Login-test.tsx`

**Interfaces:**
- Consumes: `serverConfig.hsUrl` (empty string from Task 1).
- Produces: when `hsUrl === ""`, no login-flow network call and no password form.

- [ ] **Step 1: Write the failing test**

Append to `test/unit-tests/components/structures/auth/Login-test.tsx` (follow the existing render-helper / props in that file; use an empty server config):

```ts
it("prompts for a homeserver and makes no request when hsUrl is empty", async () => {
    const emptyServer = {
        hsUrl: "", hsName: "", hsNameIsDifferent: false, isUrl: "",
        isDefault: false, isNameResolvable: false, warning: "",
    };
    const { container } = render(getRawComponent({ serverConfig: emptyServer }));
    // No username/password form is rendered without a server.
    expect(container.querySelector("form")).toBeNull();
    // The "enter your homeserver" prompt is shown.
    expect(screen.getByText(/enter your homeserver/i)).toBeInTheDocument();
});
```

(If the file's helper is named differently than `getRawComponent`, use that file's existing render helper and pass `serverConfig: emptyServer`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest test/unit-tests/components/structures/auth/Login-test.tsx -t "prompts for a homeserver"`
Expected: FAIL — the form renders and the prompt text is absent.

- [ ] **Step 3: Guard `initLoginLogic`**

At the top of `initLoginLogic` (`src/components/structures/auth/Login.tsx:335`):

```ts
    private async initLoginLogic({ hsUrl, isUrl }: ValidatedServerConfig): Promise<void> {
        if (!hsUrl) {
            // No server selected yet: don't query anything.
            this.setState({ busy: false, busyLoggingIn: false, errorText: null, serverIsAlive: true });
            return;
        }
        let isDefaultServer = false;
```

- [ ] **Step 4: Gate the form in `render`**

In `render`, replace `{this.renderLoginComponentForFlows()}` with a guard that shows a prompt when there is no server:

```tsx
                    {this.props.serverConfig.hsUrl ? (
                        this.renderLoginComponentForFlows()
                    ) : (
                        <div className="mx_Login_prompt">{_t("auth|enter_your_homeserver")}</div>
                    )}
```

Add the i18n string. In `src/i18n/strings/en_EN.json`, under the `"auth"` object, add:

```json
        "enter_your_homeserver": "Enter your homeserver to sign in",
```

(Place it in alphabetical order among the `auth` keys to satisfy i18n lint.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn jest test/unit-tests/components/structures/auth/Login-test.tsx`
Expected: PASS — new test passes and existing Login tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/structures/auth/Login.tsx src/i18n/strings/en_EN.json test/unit-tests/components/structures/auth/Login-test.tsx
git commit -m "Show homeserver prompt and skip login query when no server selected"
```

---

### Task 5: ServerPicker empty label

**Files:**
- Modify: `src/components/views/elements/ServerPicker.tsx:106` (the `serverName` derivation)
- Test: `test/unit-tests/components/views/elements/ServerPicker-test.tsx`

**Interfaces:**
- Consumes: `serverConfig.hsUrl === ""`.
- Produces: a neutral "Choose a homeserver" label instead of an empty string.

- [ ] **Step 1: Write the failing test**

Append to (or create, mirroring sibling element tests) `test/unit-tests/components/views/elements/ServerPicker-test.tsx`:

```ts
it("shows a choose-a-homeserver label when hsUrl is empty", () => {
    const emptyServer = {
        hsUrl: "", hsName: "", hsNameIsDifferent: false, isUrl: "",
        isDefault: false, isNameResolvable: false, warning: "",
    };
    render(<ServerPicker serverConfig={emptyServer} onServerConfigChange={jest.fn()} />);
    expect(screen.getByText(/choose a homeserver/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn jest test/unit-tests/components/views/elements/ServerPicker-test.tsx -t "choose-a-homeserver"`
Expected: FAIL — empty label renders.

- [ ] **Step 3: Implement the empty label**

At `src/components/views/elements/ServerPicker.tsx:106`, change the `serverName` return:

```ts
    if (!serverConfig.hsUrl) return _t("auth|choose_a_homeserver");
    return serverConfig.isNameResolvable && serverConfig.hsName ? serverConfig.hsName : serverConfig.hsUrl;
```

Ensure `_t` is imported in the file (it is used in matron-web components widely; add `import { _t } from "../../../languageHandler";` if missing). Add to `src/i18n/strings/en_EN.json` under `"auth"` (alphabetical):

```json
        "choose_a_homeserver": "Choose a homeserver",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn jest test/unit-tests/components/views/elements/ServerPicker-test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/views/elements/ServerPicker.tsx src/i18n/strings/en_EN.json test/unit-tests/components/views/elements/ServerPicker-test.tsx
git commit -m "Show choose-a-homeserver label in ServerPicker when empty"
```

---

### Task 6: Strip Element/matrix.org defaults from config

**Files:**
- Modify: `config.json` (matron-web)
- Modify (matron-desktop): `matron/release/config.json`, `matron/nightly/config.json`

**Interfaces:**
- Produces: configs with no `default_server_name`, `default_server_config`,
  `m.identity_server`, `integrations_*`, or `room_directory`.

- [ ] **Step 1: Edit matron-web `config.json`**

Remove these keys entirely: `default_server_name`, `default_server_config`,
`integrations_ui_url`, `integrations_rest_url`, `integrations_widgets_urls`, and the
`room_directory` block. (There is no top-level `m.identity_server` here; it lived
inside `default_server_config`, removed with it.) Keep `update_base_url`,
`bug_report_endpoint_url`, `posthog`, `terms_and_conditions_links`, `brand`,
`branding`, `setting_defaults`, `features`, `element_call`.

- [ ] **Step 2: Verify it is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('config.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 3: Confirm no matrix.org / vector.im / scalar remain**

Run: `grep -nE "matrix\.org|vector\.im|scalar" config.json || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit (matron-web)**

```bash
git add config.json
git commit -m "Remove matrix.org/Element defaults from config"
```

- [ ] **Step 5: Mirror the edits in matron-desktop**

In `/Users/danbarker/Dev/matron-desktop`, apply the same key removals to
`matron/release/config.json` and `matron/nightly/config.json` (the nightly file also
has a `posthog.dsn` of `sentry.matrix.org` — leave Sentry as-is unless you also want
it changed; it is out of scope here). Verify:

```bash
cd /Users/danbarker/Dev/matron-desktop
for f in matron/release/config.json matron/nightly/config.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && \
  grep -nE "default_server_name|default_server_config|scalar|gitter" "$f" && echo "STILL PRESENT in $f" || echo "$f clean"
done
```
Expected: both `clean`.

- [ ] **Step 6: Commit (matron-desktop)**

```bash
cd /Users/danbarker/Dev/matron-desktop
git add matron/release/config.json matron/nightly/config.json
git commit -m "Remove matrix.org/Element defaults from desktop config"
```

---

### Task 7: Desktop integration — rebuild webapp, repack asar, release

**Files:**
- Produces (matron-desktop): `webapp.asar` (rebuilt), `dist/Matron-*-universal.*`, `dist/Matron-*-arm64.*`

**Interfaces:**
- Consumes: the matron-web build output + cleaned config from Tasks 1–6.

- [ ] **Step 1: Run the full matron-web unit suite**

```bash
cd /Users/danbarker/Dev/matron-web
yarn test
```
Expected: green. Fix any regressions before proceeding.

- [ ] **Step 2: Build the matron-web webapp bundle**

```bash
cd /Users/danbarker/Dev/matron-web
yarn build
```
Expected: produces the `webapp/` output (the dir the desktop symlink points at).

- [ ] **Step 3: Repack webapp.asar with cleaned config and verify config is inside**

```bash
cd /Users/danbarker/Dev/matron-desktop
pnpm run asar-webapp
npx asar list webapp.asar | grep '^/config.json'                 # expect: /config.json
npx asar extract-file webapp.asar config.json && grep -nE "matrix\.org|vector\.im|scalar" config.json && echo "DIRTY" || echo "config clean"; rm -f config.json
```
Expected: `/config.json` present and `config clean`.

- [ ] **Step 4: Build the signed/notarized universal + arm64 release**

```bash
cd /Users/danbarker/Dev/matron-desktop
./scripts/release-mac.sh
```
Expected: ends with the artifact list including `Matron-<ver>-universal.dmg` and `Matron-<ver>-arm64.dmg`, both stapled.

- [ ] **Step 5: Manual proof — no matrix.org traffic**

Open `dist/Matron-<ver>-universal.dmg`, drag to /Applications, launch with DevTools → Network tab open (View menu / toggle dev tools). Confirm:
1. **No requests to matrix.org, vector.im, or scalar.vector.im** on launch.
2. The login screen shows an empty homeserver field with the "Enter your homeserver" prompt.
3. Enter a real homeserver → login works.
4. Quit and relaunch (logged out) → homeserver field is pre-filled with the last server.

- [ ] **Step 6: Commit any desktop changes**

```bash
cd /Users/danbarker/Dev/matron-desktop
git add webapp.asar
git commit -m "Rebuild webapp.asar with no-default-homeserver config"
```

(The large `webapp.asar` may be git-ignored; if `git add` reports nothing, that is expected — the artifact is produced by the build, not tracked.)

---

## Notes for the executor

- Tasks 1–5 are matron-web code (TDD, jest). Task 6 is config in both repos. Task 7 is the one-time desktop rebuild + the real-world verification.
- The success criterion that matters most is Task 7 Step 5: **zero matrix.org requests on a fresh launch.**
- If a matron-web test helper name differs from what is shown (e.g. the Login render helper), use the file's existing helper — the props (`serverConfig` with empty `hsUrl`) are what matter.
