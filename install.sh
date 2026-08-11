#!/usr/bin/env bash
# claude-remote runner installer (macOS/Linux)
#
#   curl -fsSL https://raw.githubusercontent.com/nimapdevyash/claude-remote/main/install.sh | bash
#
# Detects your OS/shell, checks for Node.js, fetches the runner CLI, and
# puts a `claude-remote-runner` command on your PATH. It does not touch
# anything outside ~/.claude-remote and (if needed) ~/.local/bin.
set -euo pipefail

REPO_URL="${CLAUDE_REMOTE_REPO_URL:-https://github.com/nimapdevyash/claude-remote.git}"
ARCHIVE_URL="${CLAUDE_REMOTE_ARCHIVE_URL:-https://github.com/nimapdevyash/claude-remote/archive/refs/heads/main.tar.gz}"
INSTALL_DIR="${CLAUDE_REMOTE_INSTALL_DIR:-$HOME/.claude-remote}"
APP_DIR="$INSTALL_DIR/app"
BIN_NAME="claude-remote-runner"

info()  { printf '\033[36m==>\033[0m %s\n' "$1"; }
warn()  { printf '\033[33m!!\033[0m %s\n' "$1"; }
fail()  { printf '\033[31mError:\033[0m %s\n' "$1" >&2; exit 1; }

os_name() {
  case "$(uname -s)" in
    Darwin) echo "macOS" ;;
    Linux)  echo "Linux" ;;
    *)      echo "unknown" ;;
  esac
}

check_node() {
  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js 18+ is required but wasn't found.
  macOS:  brew install node
  Linux:  use your package manager, or https://github.com/nvm-sh/nvm
Then re-run this installer."
  fi
  local major
  major="$(node -e 'console.log(process.versions.node.split(".")[0])')"
  if [ "$major" -lt 18 ]; then
    fail "Node.js 18+ is required (found $(node -v)). Please upgrade and re-run this installer."
  fi
}

fetch_app() {
  mkdir -p "$INSTALL_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    info "Updating existing install in $APP_DIR"
    git -C "$APP_DIR" fetch --depth=1 origin main
    git -C "$APP_DIR" reset --hard origin/main
  elif command -v git >/dev/null 2>&1; then
    info "Cloning claude-remote into $APP_DIR"
    rm -rf "$APP_DIR"
    git clone --depth=1 "$REPO_URL" "$APP_DIR"
  else
    info "git not found — downloading a source archive instead"
    rm -rf "$APP_DIR"
    mkdir -p "$APP_DIR"
    curl -fsSL "$ARCHIVE_URL" | tar -xz -C "$APP_DIR" --strip-components=1
  fi
}

install_runner_deps() {
  info "Installing runner dependencies"
  (cd "$APP_DIR/runner" && npm install --omit=dev --no-audit --no-fund --silent)
}

pick_bin_dir() {
  for candidate in "$HOME/.local/bin" "/usr/local/bin"; do
    mkdir -p "$candidate" 2>/dev/null || continue
    if [ -w "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  echo "$HOME/.local/bin"
}

write_wrapper() {
  local bin_dir="$1"
  local wrapper="$bin_dir/$BIN_NAME"
  mkdir -p "$bin_dir"
  cat > "$wrapper" <<EOF
#!/usr/bin/env bash
exec node "$APP_DIR/runner/src/index.js" "\$@"
EOF
  chmod +x "$wrapper"
  echo "$wrapper"
}

path_hint() {
  local bin_dir="$1"
  case ":$PATH:" in
    *":$bin_dir:"*) return 0 ;;
    *) return 1 ;;
  esac
}

main() {
  info "Detected OS: $(os_name)"
  check_node
  fetch_app
  install_runner_deps

  local bin_dir wrapper
  bin_dir="$(pick_bin_dir)"
  wrapper="$(write_wrapper "$bin_dir")"

  echo
  info "Installed: $wrapper"

  if ! path_hint "$bin_dir"; then
    warn "$bin_dir is not on your PATH yet. Add this to your shell profile (~/.zshrc, ~/.bashrc, etc.):"
    echo
    echo "    export PATH=\"$bin_dir:\$PATH\""
    echo
    echo "Then open a new terminal, or run it directly for now:"
    echo
    echo "    $wrapper"
  else
    echo
    info "Run it with: $BIN_NAME"
  fi

  echo
  info "First run will walk you through server URL, folder, name, and sign-in."
}

main "$@"
