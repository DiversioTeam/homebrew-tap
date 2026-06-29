class LocalCi < Formula
  desc "Shared local CI runner for repo-owned verification steps"
  homepage "https://github.com/DiversioTeam/local-ci-runner"
  version "0.1.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.1.0/local-ci_0.1.0_darwin_arm64.tar.gz"
      sha256 "b648d8a9127eacd0b7c7aa3141b084f939a7ea52cc02cac09d11480397fc41e0"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.1.0/local-ci_0.1.0_darwin_amd64.tar.gz"
      sha256 "94be004478b798b532c968425f6eef3651a14e8f2a7df751ddc2430a42fdbc51"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.1.0/local-ci_0.1.0_linux_arm64.tar.gz"
      sha256 "d95112b1c8bc3bb52fd8c709e0e610a02e74eba758820f97730970888a9df481"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.1.0/local-ci_0.1.0_linux_amd64.tar.gz"
      sha256 "177c8a7b61f0f6fc1401229e294994d9fb9a8a119ba71f899aa25a36b8223696"
    end
  end

  def install
    bin.install "local-ci"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/local-ci version")
  end
end
