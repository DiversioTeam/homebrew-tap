class CourageSession < Formula
  desc "Send Slack messages into your Claude Code session via Diversio's Courage"
  homepage "https://github.com/DiversioTeam/homebrew-tap/tree/main/courage-session"
  url "https://github.com/DiversioTeam/homebrew-tap.git", tag: "courage-session-v0.1.1", revision: "daf4850f2038c3a936e66805633a687c9b8aeb34", using: :git
  license "MIT"

  depends_on "node"

  def install
    libexec.install "courage-session/courage-session.mjs"
    (bin/"courage-session").write <<~SH
      #!/bin/sh
      COURAGE_SESSION_LAUNCHER="#{HOMEBREW_PREFIX}/bin/courage-session" exec "#{formula_opt_bin("node")}/node" "#{opt_libexec}/courage-session.mjs" "$@"
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
    assert_equal version.to_s, shell_output("#{bin}/courage-session --version").strip
    assert_match "courage-session setup", shell_output("#{bin}/claudec 2>&1", 1)
  end
end
