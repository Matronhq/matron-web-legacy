# No-Default-Homeserver Login

**Date:** 2026-06-25
**Status:** Approved design
**Repo:** matron-web (with a matron-desktop rebuild as the final integration step)

## Goal

Matron must never contact matrix.org. When no homeserver is configured, the login
screen shows an **empty homeserver field**; nothing is contacted until the user
enters their own server; the last-used server is remembered for next launch.

Matron is a bring-your-own-homeserver product: there is no Matron-hosted default
homeserver. Today the app ships Element's defaults (`default_server_name:
"matrix.org"`, `m.homeserver.base_url: "https://matrix-client.matrix.org"`), so on
launch matrix-react-sdk does a `.well-known` lookup + `/_matrix/client/versions`
fetch against matrix.org. That is the traffic to remove.

## Constraint that shapes the design

`src/vector/app.tsx` `verifyServerConfig()` (lines ~188–196) throws
`invalid_configuration_no_server` when none of `default_server_config` /
`default_server_name` / `default_hs_url` is set, and a logged-out user then gets a
hard config-error screen — not a homeserver-entry screen. matrix-react-sdk has **no
config flag** for "no default, prompt the user". So removing the default from
config alone is insufficient: it requires a code change to bootstrap an empty state.

The server-entry machinery already exists and works standalone:
`ServerPickerDialog` validates a user-typed homeserver via
`AutoDiscoveryUtils.validateServerConfigWithStaticUrls(hsUrl)` with no prior
default. The work is the bootstrap + an empty-state guard in `Login`, plus config
cleanup.

## Approach

Reuse the existing `Login` + `ServerPicker`; teach the app to operate in a "no
server selected yet" state. Chosen over a new dedicated pre-login screen because it
reuses working components and is contained to ~3 files + config. First-run UX:
the normal login screen with an empty homeserver field (per product decision).

## Components (all in matron-web unless noted)

### 1. `src/vector/app.tsx` — `verifyServerConfig()`

When none of `default_server_config` / `default_server_name` / `default_hs_url` is
configured **and** no remembered server exists (see #2), do NOT throw. Instead build
a synthetic empty `ValidatedServerConfig` and return it **without any network call**
(skip the `AutoDiscovery.fromDiscoveryConfig` / `findClientConfig` calls):

```ts
const EMPTY_SERVER_CONFIG: ValidatedServerConfig = {
    hsUrl: "",
    hsName: "",
    hsNameIsDifferent: false,
    isUrl: "",
    isDefault: false,
    isNameResolvable: false,
    warning: "",
};
```

When a default IS configured, behavior is unchanged (keeps other deployments and the
nightly variant working if they ever set one). The existing logged-in session
restore path (the `catch` at ~238–244 that reuses the session's `hsUrl`) is
untouched, so existing users keep working.

### 2. Last-server persistence (small util)

New helper, e.g. `src/utils/LastServer.ts`:
- `persistLastServer({ hsUrl, isUrl })` → `localStorage["mx_last_server_config"]`.
- `getLastServer()` → parsed value or `null`.

Wire-in:
- `MatrixChat.onServerConfigChange` (where the validated server config is accepted)
  calls `persistLastServer` with the new `hsUrl`/`isUrl`.
- `verifyServerConfig()` (#1): when no default is configured but `getLastServer()`
  returns a value, seed the initial config from it via
  `validateServerConfigWithStaticUrls(hsUrl, isUrl, true)`. This only ever contacts
  the user's OWN server, never matrix.org. If that validation throws (server gone),
  fall back to `EMPTY_SERVER_CONFIG`.

### 3. `src/components/structures/auth/Login.tsx`

- `initLoginLogic({ hsUrl, isUrl })`: early-return (no-op) when `hsUrl === ""` — do
  not call `checkServerLiveliness`, do not set `errorText`, do not create a
  `loginLogic`. Set `busy: false`.
- `render`: when `this.props.serverConfig.hsUrl === ""`, render the `ServerPicker`
  with a prompt ("Enter your homeserver to sign in") and DO NOT render the
  username/password form (`renderLoginComponentForFlows`). Once a server is set,
  render normally.

### 4. `src/components/views/elements/ServerPicker.tsx` (light touch)

When `serverConfig.hsUrl === ""`, show a neutral label ("Choose a homeserver")
instead of an empty/garbled server name, and keep the "Edit" action that opens
`ServerPickerDialog`.

## Config cleanup (matron-web + matron-desktop)

Strip Element/matrix.org defaults from all three configs — `matron-web/config.json`,
`matron-desktop/matron/release/config.json`, `matron-desktop/matron/nightly/config.json` —
then rebuild `webapp.asar` so the shipped config matches:

- **Remove** `default_server_name` and `default_server_config` (stops the matrix.org
  call; pairs with component #1).
- **Remove** `m.identity_server` (`vector.im`) — 3pid login already disabled.
- **Remove** `integrations_ui_url`, `integrations_rest_url`,
  `integrations_widgets_urls` (`scalar.vector.im`) — widgets already disabled.
- **Remove** `room_directory.servers` (`matrix.org`, `gitter.im`) — directory scopes
  to the logged-in server instead.

Leave Matron's own services untouched: `update_base_url`, `bug_report_endpoint_url`,
`posthog`, `terms_and_conditions_links`, `brand`, `branding`, `setting_defaults`,
`features`, `element_call`.

## Data flow

launch → `verifyServerConfig` (no default, no remembered) → empty config, ZERO
network → `MatrixChat` renders `Login` → `Login` sees empty `hsUrl` → shows server
entry only → user types URL → `ServerPickerDialog.validateServerConfigWithStaticUrls`
→ `onServerConfigChange` → `persistLastServer` + re-render → `Login` now has a real
server → `initLoginLogic` queries the user's server → normal login. Next logged-out
launch → `getLastServer()` seeds the field with their server.

## Error handling

- Invalid URL entry → existing `ServerPickerDialog` validation messages (unchanged).
- Remembered server unreachable at startup → caught, fall back to empty state.
- No server entered → screen waits; nothing contacted.

## Testing

Unit (jest, matron-web):
- `verifyServerConfig` returns `EMPTY_SERVER_CONFIG` with **no network call** when no
  default is set (assert `AutoDiscovery` not called).
- `verifyServerConfig` seeds from `getLastServer()` when present; falls back to empty
  when that server fails validation.
- `verifyServerConfig` still honors a configured `default_server_config` (regression).
- `Login` renders server-entry-only when `hsUrl === ""`; renders the full form once a
  server is set; `initLoginLogic` makes no request when `hsUrl === ""`.
- `LastServer` persists and loads round-trip.

Manual (the real proof, on the rebuilt desktop app):
1. Fresh launch with DevTools → Network open → confirm **zero requests to
   matrix.org / vector.im / scalar.vector.im**.
2. Enter a homeserver → log in successfully.
3. Relaunch (logged out) → homeserver field pre-filled with the last server.

## Desktop integration (one rebuild at the end)

After the matron-web changes land:
1. Build the matron-web webapp bundle.
2. Repack `matron-desktop/webapp.asar` with the cleaned config; verify
   `npx asar list webapp.asar | grep '^/config.json'` and that it has no matrix.org.
3. Run `matron-desktop/scripts/release-mac.sh` once → signed/notarized **universal +
   arm64** dmgs/zips.

## Success criteria

1. A fresh desktop launch makes **no network request to matrix.org** (or vector.im /
   scalar.vector.im).
2. A logged-out user sees an empty homeserver field and can enter their own server.
3. Entering a valid homeserver leads to a normal, working login.
4. The last-used server is remembered across launches.
5. Existing logged-in sessions continue to work unchanged.

## Out of scope

- Auto-update feed hosting (separate fast-follow, already tracked in
  matron-desktop).
- Any Matron-hosted homeserver (there is none by design).
- Registration / password-reset flows (disabled in config).
