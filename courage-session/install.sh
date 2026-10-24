#!/bin/sh
# Installs courage-session and claudec without Homebrew (Linux, or macOS), for your user only:
#   curl -fsSL https://raw.githubusercontent.com/DiversioTeam/homebrew-tap/main/courage-session/install.sh | sh
# Then run: courage-session setup
# Puts the commands in ~/.local/bin (COURAGE_SESSION_BIN_DIR) and the relay in ~/.local/share/courage-session.
set -eu

version="${COURAGE_SESSION_VERSION:-0.1.0}"
source="${COURAGE_SESSION_SOURCE:-https://raw.githubusercontent.com/DiversioTeam/homebrew-tap/courage-session-v$version/courage-session}"
bin_dir="${COURAGE_SESSION_BIN_DIR:-$HOME/.local/bin}"
share_dir="${COURAGE_SESSION_SHARE_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/courage-session}"

fail() { echo "courage-session install: $*" >&2; exit 1; }

node_path="$(command -v node || true)"
[ -n "$node_path" ] || fail "Node 20 or later is required (no node on PATH)."
major="$("$node_path" -p 'process.versions.node.split(".")[0]')"
[ "$major" -ge 20 ] || fail "Node 20 or later is required (found $("$node_path" --version))."

# A local directory (for testing) or the published files at this version's tag.
fetch() {
  case "$source" in
    /*) cp "$source/$1" "$2" ;;
    *) curl -fsSL "$source/$1" -o "$2" ;;
  esac
}

mkdir -p "$bin_dir" "$share_dir"
# Everything is downloaded and checked before anything installed is replaced, so a bad download leaves a working install.
fetch courage-session.mjs "$share_dir/courage-session.new.mjs"
fetch claudec "$bin_dir/claudec.new"
downloaded="$("$node_path" "$share_dir/courage-session.new.mjs" --version || true)"
if [ "$downloaded" != "$version" ]; then
  rm -f "$share_dir/courage-session.new.mjs" "$bin_dir/claudec.new"
  fail "downloaded version ${downloaded:-unknown}, expected $version; nothing was changed."
fi
mv "$share_dir/courage-session.new.mjs" "$share_dir/courage-session.mjs"
chmod 755 "$bin_dir/claudec.new"
mv "$bin_dir/claudec.new" "$bin_dir/claudec"

# The node found now, so a project's older default node cannot run the relay; plain node if that one goes away.
cat > "$bin_dir/courage-session.new" <<SH
#!/bin/sh
node="$node_path"
[ -x "\$node" ] || node=node
COURAGE_SESSION_LAUNCHER="$bin_dir/courage-session" exec "\$node" "$share_dir/courage-session.mjs" "\$@"
SH
chmod 755 "$bin_dir/courage-session.new"
mv "$bin_dir/courage-session.new" "$bin_dir/courage-session"

echo "Installed courage-session $version and claudec in $bin_dir."
case ":$PATH:" in
  *":$bin_dir:"*) ;;
  *) echo "Add $bin_dir to your PATH (for example in ~/.profile or ~/.zshrc): export PATH=\"$bin_dir:\$PATH\"" ;;
esac
echo "Next: courage-session setup"
