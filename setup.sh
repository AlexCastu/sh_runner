#!/bin/bash

# Scripts Runner - Setup Script
# This script helps set up the development environment

set -e

echo "🚀 Scripts Runner Setup"
echo "========================"
echo ""

# Check for required tools
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 is not installed"
        return 1
    else
        echo "✓ $1 found: $($1 --version 2>/dev/null | head -1)"
        return 0
    fi
}

echo "Checking requirements..."
echo ""

# Check Node.js
if ! check_command "node"; then
    echo "  Install Node.js: https://nodejs.org/"
    exit 1
fi

# Check pnpm (or npm)
if ! check_command "pnpm"; then
    echo "  pnpm not found, checking npm..."
    if ! check_command "npm"; then
        echo "  Install pnpm: npm install -g pnpm"
        exit 1
    fi
    PKG_MANAGER="npm"
else
    PKG_MANAGER="pnpm"
fi

# Check Rust
if ! check_command "rustc"; then
    echo "  Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check Cargo
if ! check_command "cargo"; then
    echo "  Cargo not found, please reinstall Rust"
    exit 1
fi

echo ""
echo "All requirements satisfied!"
echo ""

# Install Tauri CLI if needed
if ! cargo install --list | grep -q "tauri-cli"; then
    echo "Installing Tauri CLI..."
    cargo install tauri-cli
fi

# Install Node dependencies
echo ""
echo "Installing Node dependencies..."
$PKG_MANAGER install

# Add Rust targets for macOS if needed
echo ""
echo "Ensuring Rust targets are available..."
rustup target add aarch64-apple-darwin 2>/dev/null || true
rustup target add x86_64-apple-darwin 2>/dev/null || true

# Create default scripts folder
SCRIPTS_DIR="$HOME/scripts"
if [ ! -d "$SCRIPTS_DIR" ]; then
    echo ""
    echo "Creating default scripts folder at $SCRIPTS_DIR..."
    mkdir -p "$SCRIPTS_DIR"

    # Create a sample script
    cat > "$SCRIPTS_DIR/hello.sh" << 'SCRIPT'
#!/bin/bash
echo "👋 Hello from Scripts Runner!"
echo "Current time: $(date)"
sleep 1
echo "✓ Script completed successfully!"
SCRIPT
    chmod +x "$SCRIPTS_DIR/hello.sh"

    cat > "$SCRIPTS_DIR/system-info.sh" << 'SCRIPT'
#!/bin/bash
echo "🖥️  System Information"
echo "===================="
echo "Hostname: $(hostname)"
echo "OS: $(sw_vers -productName) $(sw_vers -productVersion)"
echo "Architecture: $(uname -m)"
echo "Memory: $(system_profiler SPHardwareDataType | grep "Memory:" | awk '{print $2, $3}')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4 " available"}')"
SCRIPT
    chmod +x "$SCRIPTS_DIR/system-info.sh"

    echo "✓ Created sample scripts in $SCRIPTS_DIR"
fi

echo ""
echo "======================================"
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  $PKG_MANAGER tauri dev"
echo ""
echo "To build for production:"
echo "  $PKG_MANAGER tauri build --target aarch64-apple-darwin"
echo ""
echo "======================================"
