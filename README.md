# Matron

Matron is a Matrix web client, forked from [Element Web](https://github.com/element-hq/element-web).
It is built using the [Matrix JS SDK](https://github.com/matrix-org/matrix-js-sdk).

## Supported Environments

Matron has several tiers of support for different environments:

- Supported
    - Definition:
        - Issues **actively triaged**, regressions **block** the release
    - Last 2 major versions of Chrome, Firefox, and Edge on desktop OSes
    - Last 2 versions of Safari
    - Desktop OSes means macOS, Windows, and Linux versions for desktop devices
      that are actively supported by the OS vendor and receive security updates
- Best effort
    - Definition:
        - Issues **accepted**, regressions **do not block** the release
    - Last major release of Firefox ESR and Chrome/Edge Extended Stable
- Community Supported
    - Definition:
        - Issues **accepted**, regressions **do not block** the release
        - Community contributions are welcome to support these issues
    - Mobile web for current stable version of Chrome, Firefox, and Safari on Android, iOS, and iPadOS
- Not supported
    - Definition: Issues only affecting unsupported environments are **closed**
    - Everything else

## Getting Started

To host your own instance of Matron see [Installing Matron Web](docs/install.md).

## Important Security Notes

### Separate domains

We do not recommend running Matron from the same domain name as your Matrix
homeserver. The reason is the risk of XSS (cross-site-scripting)
vulnerabilities that could occur if someone caused Matron to load and render
malicious user generated content from a Matrix API which then had trusted
access to Matron (or other apps) due to sharing the same domain.

### Configuration best practices

Unless you have special requirements, you will want to add the following to
your web server configuration when hosting Matron Web:

- The `X-Frame-Options: SAMEORIGIN` header, to prevent Matron Web from being
  framed and protect from [clickjacking][owasp-clickjacking].
- The `frame-ancestors 'self'` directive to your `Content-Security-Policy`
  header, as the modern replacement for `X-Frame-Options` (though both should be
  included since not all browsers support it yet, see
  [this][owasp-clickjacking-csp]).
- The `X-Content-Type-Options: nosniff` header, to [disable MIME
  sniffing][mime-sniffing].
- The `X-XSS-Protection: 1; mode=block;` header, for basic XSS protection in
  legacy browsers.

[mime-sniffing]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#mime_sniffing
[owasp-clickjacking-csp]: https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html#content-security-policy-frame-ancestors-examples
[owasp-clickjacking]: https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html

If you are using nginx, this would look something like the following:

```
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Content-Security-Policy "frame-ancestors 'self'";
```

For Apache, the configuration looks like:

```
Header set X-Frame-Options SAMEORIGIN
Header set X-Content-Type-Options nosniff
Header set X-XSS-Protection "1; mode=block"
Header set Content-Security-Policy "frame-ancestors 'self'"
```

Note: In case you are already setting a `Content-Security-Policy` header
elsewhere, you should modify it to include the `frame-ancestors` directive
instead of adding that last line.

## Building From Source

Matron is a modular webapp built with modern ES6 and uses a Node.js build system.
Ensure you have the latest LTS version of Node.js installed.

Using `pnpm` instead of `npm` is recommended. Please see the pnpm [install
guide](https://pnpm.io/installation#using-corepack) if you do not have it already.

1. Install or update `node.js` so that your `node` is at least the current recommended LTS.
1. Install `pnpm` if not present already.
1. Clone the repo: `git clone https://github.com/matronhq/matron-web.git`.
1. Switch to the matron-web directory: `cd matron-web`.
1. Install the prerequisites: `pnpm install`.
1. Configure the app by copying `config.sample.json` to `config.json` and
   modifying it. See the [configuration docs](docs/config.md) for details.
1. `pnpm dist` to build a tarball to deploy. Untaring this file will give
   a version-specific directory containing all the files that need to go on your
   web server.

Note that `pnpm dist` is not supported on Windows, so Windows users can run `pnpm build`,
which will build all the necessary files into the `webapp` directory. The version of Matron
will not appear in Settings without using the dist script. You can then mount the
`webapp` directory on your web server to actually serve up the app, which is
entirely static content.

## config.json

Matron supports a variety of settings to configure default servers, behaviour, themes, etc.
See the [configuration docs](docs/config.md) for more details.

## Labs Features

Some features of Matron may be enabled by flags in the `Labs` section of the settings.
Some of these features are described in [labs.md](docs/labs.md).

## Caching requirements

Matron requires the following URLs not to be cached, when/if you are serving Matron from your own webserver:

```
/config.*.json
/i18n
/home
/sites
/index.html
```

We also recommend that you force browsers to re-validate any cached copy of Matron on page load by configuring your
webserver to return `Cache-Control: no-cache` for `/`. This ensures the browser will fetch a new version of Matron on
the next page load after it's been deployed. Note that this is already configured for you in the nginx config of our
Dockerfile.

## Development

Please read through the following:

1. [Developer guide](./developer_guide.md)
2. [Code style](./code_style.md)
3. [Contribution guide](./CONTRIBUTING.md)

## Translations

To add a new translation, head to the [translating doc](docs/translating.md).

For a developer guide, see the [translating dev doc](docs/translating-dev.md).

## Extending Matron Web with Modules

Matron Web supports a module system that allows you to extend or modify functionality at runtime. Modules are loaded dynamically and provide a safe, predictable API for customization.

### What are modules?

Modules are extensions that can add or modify Matron Web's functionality. They are:

- Built using the [`@element-hq/element-web-module-api`](https://github.com/element-hq/element-modules/tree/main/packages/element-web-module-api)
- Loaded in Matron Web via [config.json](docs/config.md#modules)

## Copyright & License

This software is a fork of Element Web. The original copyright notices are preserved in individual source files.

This software is licensed under the GNU Affero General Public License version 3 (AGPL-3.0) or the GNU General Public License version 3 (GPL-3.0). See the LICENSE files in the repository root for full details.
