# Matron Web

The browser client for Matron, a chat system for talking to Claude Code agents. It speaks the lightweight [matron-journal](https://github.com/Matronhq/matron-journal) protocol directly—there is no Matrix client or homeserver in the shipped application.

This repository began as an Element Web fork. The old Element source remains in the tree to preserve fork history and make the UI migration auditable, but webpack ships only the journal-native client under `src/journal/`.

## Architecture

- `POST /login`, `GET /snapshot`, conversation pagination, and authenticated media over HTTP.
- One resumable `/ws` connection for ordered journal frames and ephemeral streaming.
- IndexedDB stores the cursor, conversation summaries, lazy-loaded events, and an idempotent send outbox.
- The same bundle is packaged by [Matron Desktop](https://github.com/Matronhq/matron-desktop).

The event renderer supports text, prompts and permission requests, prompt replies, tool output (including live byte-offset streams and the 24-hour cache TTL), diffs, files, images, activity, and session status. Unknown event types get a JSON fallback.

## Development

Requires Node 22.18+ and the pnpm version pinned in `package.json`.

```bash
corepack enable
pnpm install

# matron-journal defaults to http://127.0.0.1:9810
pnpm start
```

The dev server runs at `http://localhost:8080` and proxies `/journal` to the local journal service. Override its target when needed:

```bash
MATRON_JOURNAL_URL=https://chat.example.com pnpm start
```

Run the focused client checks:

```bash
pnpm exec jest --runInBand test/unit-tests/journal
pnpm exec nx build --skip-nx-cache
```

## Production deployment

Build into `webapp/`:

```bash
pnpm build
```

The recommended browser deployment keeps journal requests same-origin. Put the static app at your public origin, proxy `/journal/` to matron-journal, and use:

```json
{
    "brand": "Matron",
    "journal_server_url": "/journal"
}
```

Example nginx location (alongside the static webapp):

```nginx
location /journal/ {
    proxy_pass http://127.0.0.1:9810/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

matron-journal does not currently emit browser CORS headers. An absolute `journal_server_url` therefore requires a trusted proxy which adds suitable CORS headers; the same-origin layout above needs none.

See [docs/config.md](docs/config.md) for the small runtime configuration surface.

## License

Multi-licensed under AGPL-3.0-only / GPL-3.0-only, at your option. See [LICENSE-AGPL-3.0](LICENSE-AGPL-3.0) and [LICENSE-GPL-3.0](LICENSE-GPL-3.0).
