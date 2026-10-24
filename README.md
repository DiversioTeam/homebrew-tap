# homebrew-tap

Homebrew tap for Diversio command-line tools.

## Install the tap

```bash
brew tap DiversioTeam/tap
```

## Install a formula

```bash
brew install local-ci
```

## courage-session

Send messages from Slack into your Claude Code session through Courage, Diversio's engineering agent. Signing in needs
a Diversio Google account.

```bash
brew install diversioteam/tap/courage-session
courage-session setup
```

Without Homebrew (Linux, or macOS without brew; needs Node 20 or later):

```bash
curl -fsSL https://raw.githubusercontent.com/DiversioTeam/homebrew-tap/main/courage-session/install.sh | sh
courage-session setup
```

See [courage-session/README.md](courage-session/README.md).

## Notes

- Formulae in this repo are updated by release automation from the source repositories.
- `local-ci` releases are published from `DiversioTeam/local-ci-runner`.
- `courage-session` is copied here from Diversio's Courage repository by its release script; the formula builds from a
  `courage-session-vX.Y.Z` tag of this repository.
