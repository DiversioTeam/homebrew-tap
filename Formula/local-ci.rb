class LocalCi < Formula
  desc "Shared local CI runner for repo-owned verification steps"
  homepage "https://github.com/DiversioTeam/local-ci-runner"
  version "0.5.1"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.1/local-ci_0.5.1_darwin_arm64.tar.gz"
      sha256 "e8d569afeb5518b4763989c9bdf51f8a79730d6723c151968e55ad68027a3867"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.1/local-ci_0.5.1_darwin_amd64.tar.gz"
      sha256 "7c2a269b5ae7f3ec544baf43f49f891fc7fc346b8a5f30d36d895bc549c75acd"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.1/local-ci_0.5.1_linux_arm64.tar.gz"
      sha256 "d7ca8eb9021d23e04650863b2e4100588006e33094e79230ef4c4a35fc575784"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.1/local-ci_0.5.1_linux_amd64.tar.gz"
      sha256 "4664460b5c50c98b012fc4c5ca1d2e89ef2748809e012e59517b2f48ef13e3ee"
    end
  end

  def install
    bin.install "local-ci"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/local-ci version")
  end
end
