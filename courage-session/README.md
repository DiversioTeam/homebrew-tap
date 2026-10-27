# courage-session

Send messages from Slack straight into a Claude Code session running on your machine, through Courage, Diversio's
engineering agent. In Slack, `@Courage send to my terminal: run the tests` (or "transfer this to my CLI") reaches the
session, and the session answers in the Slack thread.

Signing in needs a Diversio Google account. Everything that decides who can do what (the sign-in, who may send to a
session, what Courage will do) is checked by Courage's server; nothing in these files is secret.

## Install

macOS or Linux with Homebrew:

```sh
brew install diversioteam/tap/courage-session
```

It runs on your own Node 20 or later (the one you manage with pnpm: `pnpm env use --global 20`); Homebrew installs no
Node for it. 0.1.0 and the original 0.1.1 did (0.1.1_1 and later don't): if `which node` shows `/opt/homebrew/bin/node`,
`brew unlink node` (or `brew uninstall node` if nothing else needs it) gives pnpm's back.

Without Homebrew (needs Node 20 or later and curl; installs to `~/.local/bin`):

```sh
curl -fsSL https://raw.githubusercontent.com/DiversioTeam/homebrew-tap/main/courage-session/install.sh | sh
```

## Set up, once

```sh
courage-session setup
```

It adds Courage's MCP server to Claude Code, writes the channel config, and signs the relay in (a browser opens). It is
safe to run again. `courage-session doctor` shows what is set up and what is missing.

Then start Claude Code with `claudec` instead of `claude` (same arguments). In it, sign in to Courage once with `/mcp`,
`courage`, Authenticate.

## Over SSH or without a display

The sign-in prints a link instead of opening a browser. Your browser must reach the login's port on the remote
machine, so pick a port and forward it:

```sh
ssh -L 8765:127.0.0.1:8765 your-host
courage-session login --port 8765
```

## Files

- `courage-session.mjs`: the relay. No dependencies. Credentials are kept in
  `$XDG_CONFIG_HOME/courage-session` (default `~/.config/courage-session`), readable only by you.
- `claudec`: starts Claude Code with the relay as a channel.
- `install.sh`: the installer for systems without Homebrew.
