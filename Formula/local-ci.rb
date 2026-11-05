class LocalCi < Formula
  desc "Shared local CI runner for repo-owned verification steps"
  homepage "https://github.com/DiversioTeam/local-ci-runner"
  version "0.5.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.0/local-ci_0.5.0_darwin_arm64.tar.gz"
      sha256 "e1c8707fbfd1e1b0905930232324d257414ed241dfea65697797dbd8696da388"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.0/local-ci_0.5.0_darwin_amd64.tar.gz"
      sha256 "1b90482dce567598bb52e974cf323dc8c04c2b4ba77f763f2b8570f15d5c75a2"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.0/local-ci_0.5.0_linux_arm64.tar.gz"
      sha256 "faf5fdfe512d6651488e80c168b7a15ec649b9e45e7128bb8eac75c483c58102"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.5.0/local-ci_0.5.0_linux_amd64.tar.gz"
      sha256 "e6b3fccc8625dbc19fd5c98d2ca2903cf4c7581050792b5803597053a5d6be87"
    end
  end

  def install
    bin.install "local-ci"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/local-ci version")
  end
end
