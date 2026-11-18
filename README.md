<p align="center">
  <img src="assets/banner.jpg" alt="Ultimate As-Built Generator" width="100%">
</p>

<h1 align="center">Ultimate As-Built Generator</h1>

<p align="center">
  A ready-to-deliver Word as-built document for your Nutanix environment — Prism Central and its clusters — in minutes.
</p>

<p align="center">
  <a href="https://github.com/Exe64/ultimate-ntnx-asbuilt/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/Exe64/ultimate-ntnx-asbuilt?label=release"></a>
  <a href="https://github.com/Exe64/ultimate-ntnx-asbuilt/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Exe64/ultimate-ntnx-asbuilt/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-informational">
  <a href="LICENSE"><img alt="License: GPL-3.0" src="https://img.shields.io/badge/license-GPL--3.0-blue"></a>
  <a href="https://ko-fi.com/juliendumur"><img alt="Ko-fi" src="https://img.shields.io/badge/Ko--fi-support-ff5e5b?logo=ko-fi&logoColor=white"></a>
</p>

<!-- SCREENSHOT: doc/screenshots/app.png — main page with detected clusters -->

---

## Why

Writing an as-built by hand means copying dozens of Prism screens into a Word document, with
every omission and typo that comes with it. Ultimate As-Built Generator queries the Prism Central
and Prism Element APIs and produces a structured document, styled to your own template and
illustrated with diagrams drawn from the actual configuration.

## Features

- **Single executable, nothing to install**: no database, no runtime, no admin rights.
- **Read-only**: a read-only Prism account is enough; nothing is changed on the environment.
- **Multi-cluster**: every cluster registered on Prism Central is detected and documented.
- **Automatic diagrams**: virtual network, physical cabling (from LLDP/CDP) and more, drawn from the collected data.
- **Your branding**: layout driven by an editable Word template.
- **Bilingual**: interface and document in English or French.
- **Secure by design**: credentials are never stored, the server listens locally only.

## Preview

<!-- SCREENSHOT: doc/screenshots/collect.png — Prism Central form + Prism Element credentials -->
<!-- SCREENSHOT: doc/screenshots/document.png — one or two pages of the generated .docx (contents, a table) -->
<!-- SCREENSHOT: doc/screenshots/diagram.png — a virtual network or cabling diagram -->

## Download

All builds are on the [**Releases**](https://github.com/Exe64/ultimate-ntnx-asbuilt/releases/latest) page.

| Platform | File | Notes |
|---|---|---|
| Windows 11 (app) | `ultimate-asbuilt-windows-x64-Setup.zip` | Own window, no console or browser |
| Windows (portable) | `ultimate-asbuilt-windows-x64.exe` | No install; a console stays open, closing it stops the tool |
| macOS Apple Silicon | `ultimate-asbuilt-macos-arm64` | |
| macOS Intel | `ultimate-asbuilt-macos-intel` | |
| Linux x64 | `ultimate-asbuilt-linux-x64` | |
| Linux ARM64 | `ultimate-asbuilt-linux-arm64` | |

> [!NOTE]
> Binaries are not signed.
> **Windows**: SmartScreen warns on first launch → *More info* → *Run anyway*.
> **Windows 11 Smart App Control** blocks unsigned apps with no way around it: with it on, neither
> the app nor the portable exe will start. Turning it off: *Windows Security* → *App & browser
> control* → *Smart App Control settings* → *Off* (on some Windows builds it cannot be turned back
> on without resetting Windows).
> **macOS**: right-click → *Open*, or `xattr -d com.apple.quarantine ultimate-asbuilt-macos-arm64`.

## Updates

At launch, the tool checks once whether a newer stable release is out, and says so in a band at
the top of the page:

- **Windows app**: *Update* downloads the new version, then restarts on it. It is greyed out while
  a collection or a generation is running; with a collection on screen, a second click confirms,
  since inputs not exported are lost on restart.
- **Portable executables**: a link to the release, to download it by hand.

Offline, or when GitHub does not answer within 5 s, nothing is shown. `NO_UPDATE_CHECK=1` turns
the check off (see [Advanced settings](#advanced-settings)).

> [!IMPORTANT]
> The Windows app updates itself from **v0.3.2** on. Coming from v0.3.1 or older (their update
> check cannot read the app's version), install v0.3.2 once by hand with its `Setup.zip`.
> If no banner shows up when one is expected, `%TEMP%\ultimate-asbuilt-update.log` says why.

## Usage

1. **Launch** the executable: the interface opens in your browser (or in its own window for the Windows app).
2. **Connect to Prism Central**: address and account (read-only is enough), then *Detect clusters*.
3. **Collect**: for each cluster, enter its Prism Element credentials, then *Collect*.
   A cluster left without a password is documented from Prism Central alone.
4. **Complete** what Prism cannot know (customer, site, switches), then *Generate .docx*.

## Security

- Passwords are **never stored nor written** to the document.
- The server listens on `127.0.0.1` only and requires a **random token** drawn at each launch.
- Collection uses read-only API calls exclusively.

## Custom template

Styling comes from a Word template. Download the default one from the interface, edit it in Word,
and upload it when generating.

The template must keep:

- the `{{corps}}` placeholder, where the content is inserted;
- the `AsBuiltTable` table style.

Available placeholders: `{{client}}`, `{{projet}}`, `{{prism_central}}`, `{{clusters}}`, `{{date}}`, `{{version}}`.

## Advanced settings

| Variable | Effect |
|---|---|
| `ASBUILT_TIMEOUT_S=180` | Per-call API timeout (default 60 s), for a slow or remote Prism |
| `DUMP=collect.json` | Saves the raw collected data, without credentials, for troubleshooting |
| `NO_UPDATE_CHECK=1` | No new-version check at launch: nothing is sent to GitHub |

The cabling diagram relies on what hosts see of their switches (LLDP/CDP). Without that data, it
falls back to the number of switches entered and says so in its caption.

## Development

```bash
npm install
npm start              # local server + interface
npm test               # model → .docx, and collection against a fake self-signed Prism
npm run build          # the five executables, in dist/
npm run build:desktop  # the desktop app (Electrobun, Windows only)
```

### Project layout

| Path | Role |
|---|---|
| `engine/asbuilt/` | Engine: model, sections, document outline, `.docx` export |
| `server/main.js` | Local HTTP server |
| `server/bundle.js` | Database-less collection |
| `server/prism/`, `server/apiCompat/`, `server/nutanixV4.js` | Prism API access |
| `web/` | Interface; `clean.js` strips what was not collected, `diagrams.js` draws the six diagrams |
| `desktop/` | Windows desktop app (Electrobun) |

### Releasing

Every push is tested by CI. To release, push a `v*` tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

CI builds the five executables and attaches them to the release; a Windows runner then adds the
app installer and replaces the Windows exe with one carrying the tool's icon (`--windows-icon`
does not work when cross-compiling). It also attaches the updater's files (`*-update.json`,
`*-checksum.json`, `*.tar.zst`, patches) under their built names: the app reads them from
`releases/latest/download`, so only stable (non pre-release) tags reach installed apps.

## Support

If this tool saves you time, you can support its development on [Ko-fi](https://ko-fi.com/juliendumur).

## License

[GPL-3.0](LICENSE) © Julien Dumur. You may use, modify and redistribute this software; any
redistributed version, modified or not, must stay under the same license with its source code.

## Disclaimer

Independent project, not affiliated with Nutanix, Inc. Nutanix, Prism and related names are
trademarks of Nutanix, Inc.
