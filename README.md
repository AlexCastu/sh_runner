# Scripts Runner

A macOS menu bar application for running shell scripts. Built with Tauri v2, React, TypeScript, and TailwindCSS.

## Features

- **Menu Bar App**: Lives in the macOS menu bar (no Dock icon)
- **Script Scanner**: Automatically scans a folder for `.sh` scripts
- **One-Click Execution**: Run scripts with a single click
- **Execution Tracking**: Shows when scripts were last run
- **Native Notifications**: Get notified when scripts complete
- **Persistent State**: Remembers your scripts folder and execution history
- **Dark Mode**: Beautiful dark theme UI
- **Quit From Tray**: Right‑click the tray icon to quit safely
- **Force Stop**: Reset any script that gets stuck in “Running…”

## Keyboard Shortcuts

- **Cmd+F**: Focus search
- **Cmd+R**: Refresh scripts list
- **Cmd+1 … Cmd+9**: Run script #1 to #9
- **Esc**: Close open modal

## Requirements

- macOS 10.15+ (optimized for Apple Silicon)
- Node.js 18+
- pnpm (recommended) or npm
- Rust (latest stable)

## Quick Start

### 1. Install Dependencies

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli

# Install Node dependencies
cd scripts-runner
pnpm install
```

### 2. Development

```bash
pnpm tauri dev
```

This will:
- Start the Vite dev server
- Compile the Rust backend
- Launch the app with hot-reload enabled

### 3. Build for Production

```bash
# Build for Apple Silicon (M1/M2/M3)
pnpm tauri build --target aarch64-apple-darwin

# Build for Intel Macs
pnpm tauri build --target x86_64-apple-darwin

# Universal binary (both architectures)
pnpm tauri build --target universal-apple-darwin
```

The built app will be at:
- `.app`: `src-tauri/target/release/bundle/macos/Scripts Runner.app`
- `.dmg`: `src-tauri/target/release/bundle/dmg/Scripts Runner_1.0.0_aarch64.dmg`

### 4. Install

```bash
# Copy to Applications folder
cp -r "src-tauri/target/release/bundle/macos/Scripts Runner.app" /Applications/
```

## Usage

1. **Launch**: The app appears as an icon in the menu bar (no Dock icon)
2. **Click Icon**: Opens a popover showing your scripts
3. **Configure**: Click the gear icon to change the scripts folder (default: `~/scripts/`)
4. **Run Scripts**: Click the play button next to any script
5. **Cancel / Force Stop**:
  - **Cancel**: Stops the process gracefully
  - **Force Stop**: Clears a stuck “Running…” state when the process already died
6. **Quit App**:
  - Right‑click the tray icon → **Quit**
  - Or use the quit button in the app header
7. **Track Status**:
  - `○` = Never run
  - `✓` = Completed (shows time since last run)
  - Pulsing dot = Currently running

## Creating Test Scripts

Create a `~/scripts/` folder with some test scripts:

```bash
mkdir -p ~/scripts

# Simple test script
cat > ~/scripts/hello.sh << 'EOF'
#!/bin/bash
echo "Hello from Scripts Runner!"
sleep 2
echo "Done!"
EOF

# Date script
cat > ~/scripts/show-date.sh << 'EOF'
#!/bin/bash
echo "Current date: $(date)"
EOF

# Make them executable
chmod +x ~/scripts/*.sh
```

## Project Structure

```
scripts-runner/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── types/              # TypeScript types
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Tauri/Rust backend
│   ├── src/
│   │   ├── lib.rs          # Main Rust code
│   │   └── main.rs         # Entry point
│   ├── capabilities/       # Tauri v2 permissions
│   ├── icons/              # App icons
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Configuration

### Scripts Folder
- Default: `~/scripts/`
- Click the gear icon in the app to change
- Supports `~` for home directory expansion
- Only scans `.sh` files in the root of the folder

### Timeouts
- Each script can be cancelled manually at any time
- Default timeout is configurable in Settings
- Timeout is in seconds; `0` means no timeout

### Logs
- After a script finishes, you can open logs from the list item
- Logs include stdout, stderr, exit code, and duration

### Branding / Logo
- UI header uses: `src/assets/logo.svg`
- App icons live in: `src-tauri/icons/`
- To update the app icon, replace PNG/ICNS/ICO files in `src-tauri/icons/` and rebuild

### Permissions
The app requests the following permissions:
- **Shell**: Execute bash/sh scripts
- **Filesystem**: Read scripts from configured folder
- **Notifications**: Send completion notifications
- **Store**: Save settings and execution history
- **Process**: Allow app to exit from the UI and tray menu

## Troubleshooting

### App doesn't appear in menu bar
- Make sure no other instance is running
- Check Activity Monitor for "Scripts Runner" process
- Try rebuilding with `pnpm tauri build`

### App won't quit
- Right‑click the tray icon → **Quit**
- If unresponsive, use macOS **Force Quit** (Cmd+Opt+Esc)

### Script stuck on “Running…”
- Use **Force Stop** to clear the stuck state
- If the process is truly alive, use **Cancel** first

### Scripts fail to execute
- Ensure scripts have execute permission: `chmod +x script.sh`
- Check script has proper shebang: `#!/bin/bash`
- Scripts must be valid shell syntax

### Build fails on Apple Silicon
- Ensure Rust targets are installed:
  ```bash
  rustup target add aarch64-apple-darwin
  ```

### Signing/Notarization (Optional)
For distribution outside local use:
```bash
# Sign the app (requires Apple Developer ID)
codesign --force --deep --sign "Developer ID Application: Your Name" \
  "src-tauri/target/release/bundle/macos/Scripts Runner.app"

# Notarize with Apple
xcrun notarytool submit "path/to/dmg" --apple-id "email" --team-id "TEAM" --password "app-specific-password"
```

For local use, you can skip signing and allow the app in:
**System Preferences > Security & Privacy > General > "Open Anyway"**

## License

MIT
