class LocalCi < Formula
  desc "Shared local CI runner for repo-owned verification steps"
  homepage "https://github.com/DiversioTeam/local-ci-runner"
  version "0.2.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.2.0/local-ci_0.2.0_darwin_arm64.tar.gz"
      sha256 "42ca8d9630e056997c85e5a4bc05eb91dfc8aa5084eea962a3d7dc88b91a1daf"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.2.0/local-ci_0.2.0_darwin_amd64.tar.gz"
      sha256 "9381d8d9b4f230e0d0ce5938af061bd1eb45f82d3babfedb833cab4721ad3290"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.2.0/local-ci_0.2.0_linux_arm64.tar.gz"
      sha256 "99ee3071eaccc97134774c9c0de28c170e813659c6f38037747b53282d0e9285"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.2.0/local-ci_0.2.0_linux_amd64.tar.gz"
      sha256 "d679e2f1530c14cb773fce25fd7a9fdd09976d385c8962b3f5c5d8df52b5f067"
    end
  end

  def install
    bin.install "local-ci"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/local-ci version")
  end
end
