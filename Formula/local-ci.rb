class LocalCi < Formula
  desc "Shared local CI runner for repo-owned verification steps"
  homepage "https://github.com/DiversioTeam/local-ci-runner"
  version "0.3.0"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.3.0/local-ci_0.3.0_darwin_arm64.tar.gz"
      sha256 "cf7ecd5c5587e4fee3d411d65e2fe71956cdf81499d5db54074db4e5285c0e51"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.3.0/local-ci_0.3.0_darwin_amd64.tar.gz"
      sha256 "b98b00c64e099f333131f04317faeea6c97f3ebfca3c1feae212fc3b5d977596"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.3.0/local-ci_0.3.0_linux_arm64.tar.gz"
      sha256 "f336e67d41e3998c88b1bc2bc6ad5e5a2030d7864c0f2ba94431b967f1f77004"
    else
      url "https://github.com/DiversioTeam/local-ci-runner/releases/download/v0.3.0/local-ci_0.3.0_linux_amd64.tar.gz"
      sha256 "afa8a26ef10d878db181fede6ac6def1820c47a5e469a24b878fda7b8a27d76e"
    end
  end

  def install
    bin.install "local-ci"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/local-ci version")
  end
end
