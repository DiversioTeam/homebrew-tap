class LocalCi < Formula
  desc "Shared local CI runner for repo-owned verification steps"
  homepage "https://github.com/DiversioTeam/local-ci-runner"
  version "0.4.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.4.0/local-ci_0.4.0_darwin_arm64.tar.gz"
      sha256 "2ed96d3bff4f7ce69bd2848e3ebc3aea3208ebf8ec00e02996380278a3e4109e"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.4.0/local-ci_0.4.0_darwin_amd64.tar.gz"
      sha256 "07a3fc74a5a37a250062c018446c14e56fe2a249f5a487706a34ddec88eee2d4"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.4.0/local-ci_0.4.0_linux_arm64.tar.gz"
      sha256 "d6c4aa875a7e6ecf8d143e8e0584dad77e2f4d2268534b2da964121cdfc4a85d"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.4.0/local-ci_0.4.0_linux_amd64.tar.gz"
      sha256 "7153e98830b592e95336af5b0f1193aa6abb0c64a42e5eedf02517b0813252db"
    end
  end

  def install
    bin.install "local-ci"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/local-ci version")
  end
end
