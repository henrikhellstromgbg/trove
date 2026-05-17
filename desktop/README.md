# Trove desktop

Tauri 2 menu bar shell for Trove. Lives in the macOS menu bar, no dock icon. Wraps the Next.js app at `http://localhost:3000`.

## What it does

- Sits in the menu bar with a tray icon.
- Global hotkey `Ctrl+Shift+Space` toggles a 600x400 borderless window pointing at `localhost:3000`.
- Tray menu: open Trove, quit.
- Drag a file or a URL onto the open window and the contents are POSTed to `localhost:3000/api/capture` as `{type: "text", content: "..."}` or `{type: "url", content: "..."}`.

## Prerequisites

You need Rust and a working Xcode CLT install.

```
# Install Xcode command line tools, if not already present
xcode-select --install

# Install Rust via rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Reload the shell so cargo is on PATH
source "$HOME/.cargo/env"

rustc --version
cargo --version
```

Node and pnpm are already installed on this machine.

## First run

```
cd ~/Developer/trove/desktop
pnpm install
pnpm tauri dev
```

The first build takes a few minutes while Cargo compiles Tauri and its plugins.

Make sure the Next.js backend is running in another terminal:

```
cd ~/Developer/trove
pnpm dev
```

## Build an unsigned `.app` and `.dmg`

```
cd ~/Developer/trove/desktop
pnpm tauri build
```

Artifacts land in `src-tauri/target/release/bundle/`. The build is unsigned. macOS will warn the first time the app is opened. Right click the app and choose Open to bypass the warning during dev.

## Signing and notarization, later

Out of scope right now. When the Apple Developer Program account is active:

1. Add `signingIdentity` and `providerShortName` under `bundle.macOS` in `tauri.conf.json`.
2. Set `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` env vars and add `notarization` config.
3. Re-run `pnpm tauri build`.

See `https://v2.tauri.app/distribute/sign/macos/`.

## Layout

```
desktop/
├── package.json              Tauri CLI scripts
├── src/                      Static stub frontend (the real UI is localhost:3000)
│   └── index.html
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json       App config, tray, window, bundle
    ├── Info.plist            Sets LSUIElement so no dock icon
    ├── build.rs
    ├── capabilities/
    │   └── default.json
    ├── icons/                Placeholder dark squares, replace before release
    └── src/
        ├── main.rs
        └── lib.rs            Tray, hotkey, window toggle, capture POST
```

## Notes

- The icons are placeholder solid squares. Replace before shipping.
- macOS does not expose drop-on-tray events through Tauri. Drop a file on the open window instead.
- The hotkey is `Ctrl+Shift+Space`, not Cmd, since Cmd+Shift+Space is the macOS character viewer.
- `LSUIElement` in `Info.plist` plus `ActivationPolicy::Accessory` from Rust keeps the app out of the dock and Cmd+Tab.
