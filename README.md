# Matron Web

A web-based Matrix client. Runs in any modern browser, powers [Matron Desktop](https://github.com/matronhq/matron-desktop), and can be self-hosted.

Forked from [Element Web](https://github.com/element-hq/element-web). Built on the [Matrix JS SDK](https://github.com/matrix-org/matrix-js-sdk).

## Part of the Matron ecosystem

| Project | Description |
|---------|-------------|
| [Matron Desktop](https://github.com/matronhq/matron-desktop) | Desktop client |
| **Matron Web** | Web client (this repo) |
| [Matron iOS](https://github.com/matronhq/matron-ios) | iOS client |
| [Matron Server](https://github.com/matronhq/matron-server) | Matrix homeserver |
| [Dev Boxer](https://github.com/matronhq/dev-boxer) | One-command dev environment setup |

## Supported browsers

Matron Web supports the last two major versions of Chrome, Firefox, Edge, and Safari.

## Getting started

### Self-hosting

Download a [release tarball](https://github.com/matronhq/matron-web/releases), extract it, and serve the contents with any web server.

Create a `config.json` (see `config.sample.json`) and place it in the root directory.

> **Security note:** Matron Web should be served on its own domain, separate from your homeserver, to prevent XSS attacks from gaining homeserver access. Set appropriate `Content-Security-Policy`, `X-Content-Type-Options`, and `X-Frame-Options` headers.

### Building from source

```bash
pnpm install
cp config.sample.json config.json  # edit as needed
pnpm run build
```

The built app will be in the `webapp/` directory.

### Development

```bash
pnpm install
pnpm start  # starts dev server at http://localhost:8080
```

## Configuration

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
