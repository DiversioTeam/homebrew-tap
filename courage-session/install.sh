#!/bin/sh
# Installs courage-session and claudec without Homebrew (Linux, or macOS), for your user only:
#   curl -fsSL https://raw.githubusercontent.com/DiversioTeam/homebrew-tap/main/courage-session/install.sh | sh
# Then run: courage-session setup
# Puts the commands in ~/.local/bin (COURAGE_SESSION_BIN_DIR) and the relay in ~/.local/share/courage-session.
set -eu

version="${COURAGE_SESSION_VERSION:-0.1.1}"
source="${COURAGE_SESSION_SOURCE:-https://raw.githubusercontent.com/DiversioTeam/homebrew-tap/courage-session-v$version/courage-session}"
bin_dir="${COURAGE_SESSION_BIN_DIR:-$HOME/.local/bin}"
share_dir="${COURAGE_SESSION_SHARE_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/courage-session}"
# The published files' SHA-256, written in by the release script. An unpublished copy installs only from a local directory.
relay_sha256="866333af9da771b4eadbc10f80cedc6c2a4c24cafb38eb51626e3318d7fd1d98"
claudec_sha256="f9019f3c062cd5f18efd0dd927ff3ed0ff0aabf9f514cf091a66f4bd3ba91b81"

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

case "$relay_sha256:$source" in
  unpublished:/*) ;;
  unpublished:*) fail "this copy of install.sh was not published; use the one from the homebrew-tap repository." ;;
esac
sha256() { "$node_path" -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(process.argv[1])).digest("hex"))' "$1"; }

mkdir -p "$bin_dir" "$share_dir"
# Everything is downloaded and checked before anything installed is replaced, so a bad download leaves a working install.
fetch courage-session.mjs "$share_dir/courage-session.new.mjs"
fetch claudec "$bin_dir/claudec.new"
discard() { rm -f "$share_dir/courage-session.new.mjs" "$bin_dir/claudec.new"; fail "$1; nothing was changed."; }
if [ "$relay_sha256" != "unpublished" ]; then
  [ "$(sha256 "$share_dir/courage-session.new.mjs")" = "$relay_sha256" ] || discard "the downloaded relay does not match its published checksum"
  [ "$(sha256 "$bin_dir/claudec.new")" = "$claudec_sha256" ] || discard "the downloaded claudec does not match its published checksum"
fi
sh -n "$bin_dir/claudec.new" || discard "the downloaded claudec is not a valid shell script"
downloaded="$("$node_path" "$share_dir/courage-session.new.mjs" --version || true)"
[ "$downloaded" = "$version" ] || discard "downloaded version ${downloaded:-unknown}, expected $version"
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
