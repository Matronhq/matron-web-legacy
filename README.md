> **This repository is retained as a historical audit trail and is not maintained.** It is the pre-migration Element Web fork. The current browser client is **[matron-web](https://github.com/Matronhq/matron-web)**, which speaks the matron-journal protocol directly and has no Matrix dependency.

# Matron Web (legacy)

A web-based Matrix client. Runs in any modern browser and can be self-hosted; it powered [Matron Desktop (legacy)](https://github.com/Matronhq/matron-desktop-legacy).

Forked from [Element Web](https://github.com/element-hq/element-web). Built on the [Matrix JS SDK](https://github.com/matrix-org/matrix-js-sdk).

## Part of the Matron ecosystem

| Project                                                      | Description                       |
| ------------------------------------------------------------ | --------------------------------- |
| [Matron Desktop](https://github.com/matronhq/matron-desktop) | Desktop client                    |
| matron-web-legacy                                            | This repo — retired               |
| [matron-apple](https://github.com/Matronhq/matron-apple)     | iOS client                        |
| [Matron Server](https://github.com/matronhq/matron-server)   | Matrix homeserver                 |
| [Dev Boxer](https://github.com/matronhq/dev-boxer)           | One-command dev environment setup |

## Supported browsers

Matron Web supports the last two major versions of Chrome, Firefox, Edge, and Safari.

## Historical build instructions (no longer supported)

### Self-hosting

Download a [release tarball](https://github.com/matronhq/matron-web/releases), extract it, and serve the contents with any web server.

Create a `config.json` (see `config.sample.json`) and place it in the root directory.

> **Security note:** Matron Web should be served on its own domain, separate from your homeserver, to prevent XSS attacks from gaining homeserver access. Set appropriate `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options` headers.

### Prerequisites

Building or developing Matron Web requires:

- **Node.js ≥ 22.18** — check with `node --version`.
- **pnpm** — the repo pins its exact version via the `packageManager` field. The simplest way to match it is to let [Corepack](https://nodejs.org/api/corepack.html) (bundled with Node) manage pnpm for you:

  ```bash
  corepack enable
  ```

  Any `pnpm` command run inside the repo then uses the pinned version automatically. (You can install pnpm 10.x manually instead if you prefer.)

### Building from source

```bash
pnpm install
cp config.sample.json config.json  # edit as needed
pnpm run build
```

The built app will be in the `webapp/` directory — serve its contents with any static web server.

### Development

```bash
pnpm install
pnpm start  # starts dev server at http://localhost:8080
```

### Configuration

Copy `config.sample.json` to `config.json` and edit. Key options:

```json
{
    "default_server_config": {
        "m.homeserver": {
            "base_url": "https://matrix.org"
        }
    },
    "brand": "Matron"
}
```

See `docs/config.md` for full configuration reference.

## License

Multi-licensed under AGPL-3.0-only / GPL-3.0-only, at your option. See [LICENSE-AGPL-3.0](LICENSE-AGPL-3.0) and [LICENSE-GPL-3.0](LICENSE-GPL-3.0).
