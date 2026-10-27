class CourageSession < Formula
  desc "Send Slack messages into your Claude Code session via Diversio's Courage"
  homepage "https://github.com/DiversioTeam/homebrew-tap/tree/main/courage-session"
  url "https://github.com/DiversioTeam/homebrew-tap.git", tag: "courage-session-v0.1.2", using: :git
  license "MIT"
  # No depends_on "node": Homebrew's node would be linked into its bin and take over the node people manage with pnpm.
  # The launcher runs the person's own node instead, and says how to get one if it is missing or too old.
  def install
    libexec.install "courage-session/courage-session.mjs"
    (bin/"courage-session").write <<~SH
      #!/bin/sh
      node="$(command -v node || true)"
      if [ -z "$node" ] && [ -n "${PNPM_HOME:-}" ]; then
        for candidate in "$PNPM_HOME/node" "$PNPM_HOME/bin/node"; do [ -x "$candidate" ] && node="$candidate" && break; done
      fi
      major="$([ -n "$node" ] && "$node" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
      case "$major" in ''|*[!0-9]*) major=0 ;; esac
      if [ "$major" -lt 20 ]; then
        echo "courage-session needs Node 20+; install it with pnpm env use --global 20" >&2
        exit 1
      fi
      COURAGE_SESSION_LAUNCHER="#{HOMEBREW_PREFIX}/bin/courage-session" exec "$node" "#{opt_libexec}/courage-session.mjs" "$@"
    SH
    bin.install "courage-session/claudec"
  end

  def caveats
    <<~EOS
      Set up once (adds Courage to Claude Code and signs in with your Diversio Google account):
        courage-session setup
      Then start Claude Code with claudec instead of claude.
    EOS
  end

  test do
    # The test sandbox's PATH may not reach the person's node: then the launcher's own message is the expected answer.
    output = shell_output("#{bin}/courage-session --version 2>&1; true")
    assert_match(/\A(#{Regexp.escape(version.to_s)}|courage-session needs Node 20\+)/, output)
    assert_match "courage-session setup", shell_output("#{bin}/claudec 2>&1", 1)
  end
end
