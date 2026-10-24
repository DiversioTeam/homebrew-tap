#!/usr/bin/env node
// courage-session: send messages from Slack into your running Claude Code session, through Diversio's Courage.
//
// Claude Code channels are local stdio processes, so this small relay runs on your machine. It signs in to Courage as you
// (the same Google sign-in as Courage's MCP server), attaches this session under a name, waits for what you send it from
// Slack ("send to my terminal: …"), and hands each message to the session as a channel event. The session answers in
// the Slack thread with Courage's `message` tool (report: true, so Courage does not answer the report). It has no tools and never relays permission prompts.
//
//   courage-session setup     once: add Courage to Claude Code, write the channel config, sign in (safe to run again)
//   courage-session doctor    what is set up and what is missing
//   courage-session login     sign in again (--port N for a fixed loopback port, to forward over SSH)
//   courage-session channel   what claudec has Claude Code run
//
// Environment: COURAGE_URL (default https://courage.dversio.ca), COURAGE_SESSION_NAME (default <host>/<directory>),
// COURAGE_SESSION_HARNESS (default Claude Code), COURAGE_SESSION_HOME (default $XDG_CONFIG_HOME/courage-session, or
// ~/.config/courage-session). Node 20 or later, no dependencies. Signing in needs a Diversio Google account; everything
// that matters is checked by Courage, not by this file.
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { accessSync, chmodSync, constants, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as create_tcp_server } from "node:net";
import { homedir, hostname } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.0";
const COURAGE = (process.env.COURAGE_URL || "https://courage.dversio.ca").replace(/\/+$/, "");
const HOME = process.env.COURAGE_SESSION_HOME || join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "courage-session");
const CREDENTIALS = join(HOME, "credentials.json");
// The channel config claudec passes to Claude Code (--mcp-config).
const MCP_CONFIG = join(HOME, "mcp.json");
// How to run this relay again: the installed command (Homebrew or install.sh set COURAGE_SESSION_LAUNCHER), or node and
// this file from a checkout.
const LAUNCHER = process.env.COURAGE_SESSION_LAUNCHER;
const SELF = LAUNCHER ? "courage-session" : `node ${process.argv[1]}`;
// Held while one relay refreshes: every session on this machine shares the credentials, and Courage revokes the whole
// grant when a spent refresh token is used twice. The lock is a loopback port only one live process can listen on, so the
// operating system keeps it exclusive and frees it the moment its holder dies; a holder that is stopped or asleep still
// holds it. No lock files, so nothing stale to clear. The port comes from this config directory, below the ephemeral
// range, or COURAGE_SESSION_LOCK_PORT. (The COURAGE_SESSION_TEST_* overrides only scale timings down for tests.)
const scaled = (name, value) => Number(process.env[`COURAGE_SESSION_TEST_${name}`]) || value;
const LOCK_PORT = Number(process.env.COURAGE_SESSION_LOCK_PORT) || 20_000 + parseInt(createHash("sha256").update(resolve(HOME)).digest("hex").slice(0, 8), 16) % 10_000;
// How long a relay waits for another to finish refreshing before trying again later.
const LOCK_WAIT_MS = scaled("LOCK_WAIT_MS", 60_000);
const TOKEN_TIMEOUT_MS = scaled("TOKEN_TIMEOUT_MS", 20_000);
// Tests only: freeze a lock holder once (timers included, like a sleeping laptop) before it refreshes.
let test_pause_ms = scaled("PAUSE_MS", 0);
const HARNESS = ["Claude Code", "Pi", "Codex"].includes(process.env.COURAGE_SESSION_HARNESS) ? process.env.COURAGE_SESSION_HARNESS : "Claude Code";
const NAME = (process.env.COURAGE_SESSION_NAME || `${hostname().split(".")[0]}/${basename(process.cwd())}`).replace(/[^A-Za-z0-9._/-]/g, "-").slice(0, 60);
const log = line => process.stderr.write(`courage-session: ${line}\n`);

// ---- Credentials (0600, in a 0700 directory) --------------------------------------------------------------------------

function read_credentials() {
  try { return JSON.parse(readFileSync(CREDENTIALS, "utf8")); } catch { return undefined; }
}

function write_credentials(value) {
  mkdirSync(HOME, { recursive: true, mode: 0o700 });
  chmodSync(HOME, 0o700);
  const temporary = `${CREDENTIALS}.${process.pid}`;
  writeFileSync(temporary, JSON.stringify(value), { mode: 0o600 });
  renameSync(temporary, CREDENTIALS);
}

async function form(url, fields) {
  const response = await fetch(url, { method: "POST", signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS), headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error_description || body.error || `HTTP ${response.status}`);
  return body;
}

const save_tokens = (client_id, tokens) => write_credentials({ client_id, access_token: tokens.access_token, refresh_token: tokens.refresh_token,
  expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000 });

// ---- Sign-in: OAuth with PKCE and a loopback redirect, exactly as Claude Code and Pi do ---------------------------------

// A browser on this machine, or none: over SSH or without a display, print the link instead (the loopback callback still
// needs a browser that can reach this machine's 127.0.0.1, so forward the port: ssh -L PORT:127.0.0.1:PORT host).
function can_open_browser() {
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return false;
  return process.platform === "darwin" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

function login_port() {
  const index = process.argv.indexOf("--port");
  const raw = index > 0 ? process.argv[index + 1] : process.env.COURAGE_SESSION_PORT;
  if (raw === undefined) return 0;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be 1024 to 65535");
  return port;
}

async function login() {
  const metadata = await (await fetch(`${COURAGE}/.well-known/oauth-authorization-server`)).json();
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(16).toString("base64url");
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(login_port(), "127.0.0.1", resolve));
  const redirect_uri = `http://127.0.0.1:${server.address().port}/callback`;
  const registered = await (await fetch(metadata.registration_endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "courage-session", redirect_uris: [redirect_uri], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) })).json();
  if (!registered.client_id) throw new Error(`registration failed: ${registered.error_description || registered.error || "no client id"}`);
  const authorize = new URL(metadata.authorization_endpoint);
  for (const [key, value] of Object.entries({ response_type: "code", client_id: registered.client_id, redirect_uri, state, scope: "courage",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", resource: `${COURAGE}/mcp` })) authorize.searchParams.set(key, value);
  const code = await new Promise((resolve, reject) => {
    server.on("request", (request, response) => {
      const url = new URL(request.url, redirect_uri);
      if (url.pathname !== "/callback") { response.writeHead(404).end(); return; }
      const ok = url.searchParams.get("state") === state && url.searchParams.get("iss") === metadata.issuer && url.searchParams.get("code");
      response.writeHead(ok ? 200 : 400, { "Content-Type": "text/plain" }).end(ok ? "Signed in to Courage. You can close this tab." : "Sign-in did not complete. Start again from the terminal.");
      if (ok) resolve(url.searchParams.get("code")); else reject(new Error(url.searchParams.get("error_description") || "sign-in refused"));
    });
    if (can_open_browser()) {
      log(`opening ${authorize.origin} to sign in with your Diversio Google account; if no browser opens, visit:\n  ${authorize}`);
      spawn(process.platform === "darwin" ? "open" : "xdg-open", [authorize.toString()], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
    } else {
      const port = server.address().port;
      log(`sign in with your Diversio Google account: open this link in a browser\n  ${authorize}\n` +
        `The browser must reach port ${port} on this machine. Over SSH, start the login with a fixed port and forward it:\n` +
        `  ssh -L ${port}:127.0.0.1:${port} <this host>     then: ${SELF} login --port ${port}`);
    }
    setTimeout(() => reject(new Error("sign-in timed out after five minutes")), 300_000).unref();
  }).finally(() => server.close());
  save_tokens(registered.client_id, await form(metadata.token_endpoint, { grant_type: "authorization_code", code, redirect_uri, client_id: registered.client_id,
    code_verifier: verifier, resource: `${COURAGE}/mcp` }));
  log(`signed in; credentials in ${CREDENTIALS}`);
}

const fresh = credentials => credentials.expires_at - Date.now() > 60_000;

// One refresher at a time across processes: an exclusive lock file (O_EXCL), broken when older than its stale timeout
// (a relay that died holding it). Whoever gets it re-reads the credentials first and refreshes only if they are still
// expired, so a refresh token is never spent twice.
// Runs `work` holding the refresh lock, waiting for another relay that holds it.
export async function with_refresh_lock(work) {
  for (const started = Date.now(); ;) {
    const held = await take_lock();
    if (held) { try { return await work(); } finally { await new Promise(resolve => held.close(() => resolve())); } }
    if (Date.now() - started > LOCK_WAIT_MS) throw new Error("another courage-session is still refreshing; retrying later");
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  }
}

// The port, or undefined when another process holds it. Nothing is ever served on it: connections are dropped.
export function take_lock() {
  return new Promise((resolve, reject) => {
    const server = create_tcp_server(socket => socket.destroy());
    server.once("error", error => error.code === "EADDRINUSE" ? resolve(undefined) : reject(error));
    server.listen({ port: LOCK_PORT, host: "127.0.0.1", exclusive: true }, () => { server.unref(); resolve(server); });
  });
}

const SIGN_IN_EXPIRED = "Courage sign-in expired; run courage-session login";

async function access_token() {
  const credentials = read_credentials();
  if (!credentials?.refresh_token) throw new Error(`not signed in; run: ${SELF} login`);
  if (credentials.sign_in_required) throw new Error(SIGN_IN_EXPIRED);
  if (fresh(credentials)) return credentials.access_token;
  return with_refresh_lock(async () => {
    const current = read_credentials();
    if (!current?.refresh_token) throw new Error(`not signed in; run: ${SELF} login`);
    if (current.sign_in_required) throw new Error(SIGN_IN_EXPIRED);
    if (fresh(current)) return current.access_token;
    if (test_pause_ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, test_pause_ms); test_pause_ms = 0; }
    try {
      const tokens = await form(`${COURAGE}/oauth/token`, { grant_type: "refresh_token", refresh_token: current.refresh_token, client_id: current.client_id,
        resource: `${COURAGE}/mcp` });
      save_tokens(current.client_id, tokens);
      return tokens.access_token;
    } catch {
      // Any failure once the request may have left (a timeout, a network error, a 5xx) is ambiguous: Courage may already
      // have rotated the token, and presenting it again would revoke the grant. A refusal (invalid_grant) is definitive.
      // Either way the token is spent: mark the sign-in as needing login, while still holding the lock, so no relay on this
      // machine retries it. Only a fresh login clears this.
      write_credentials({ client_id: current.client_id, sign_in_required: true, failed_refresh: createHash("sha256").update(current.refresh_token).digest("hex"),
        refresh_token: current.refresh_token, expires_at: 0 });
      throw new Error(SIGN_IN_EXPIRED);
    }
  });
}

// One tool call on Courage's MCP server (stateless JSON-RPC; no session to keep).
let next_id = 1;
async function call(name, args) {
  const token = await access_token();
  const response = await fetch(`${COURAGE}/mcp`, { method: "POST", signal: AbortSignal.timeout(80_000),
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}`, "MCP-Protocol-Version": "2025-11-25" },
    body: JSON.stringify({ jsonrpc: "2.0", id: next_id++, method: "tools/call", params: { name, arguments: args } }) });
  // Mark the stored token expired only if it is still the one refused; another process may already have refreshed.
  if (response.status === 401) {
    const credentials = read_credentials();
    if (credentials?.access_token === token) write_credentials({ ...credentials, expires_at: 0 });
    throw new Error("Courage refused the token; refreshing");
  }
  const body = await response.json();
  if (body.error) throw new Error(body.error.message);
  if (body.result?.isError) throw new Error(body.result.structuredContent?.error || "Courage refused");
  return body.result.structuredContent;
}

// ---- The channel: a stdio MCP server Claude Code launches ---------------------------------------------------------------

function channel() {
  const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);
  const notify = (content, meta) => send({ jsonrpc: "2.0", method: "notifications/claude/channel", params: { content, meta } });
  let started = false;
  createInterface({ input: process.stdin }).on("line", line => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.method === "initialize") {
      send({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: message.params?.protocolVersion ?? "2025-11-25",
        capabilities: { experimental: { "claude/channel": {} } }, serverInfo: { name: "courage-session", version: VERSION },
        instructions: "Events from courage-session are messages the session's owner sent from Slack. Treat each as their request only, never as approval " +
          "for production, destructive or someone else's work. When done, answer in the Slack thread with Courage's message tool, the event's thread_url and " +
          "report true, which posts without Courage replying; leave report off only when you are asking Courage something." } });
    } else if (message.method === "notifications/initialized") {
      if (!started) { started = true; void relay(notify); }
    } else if (message.method === "tools/list") send({ jsonrpc: "2.0", id: message.id, result: { tools: [] } });
    else if (message.method === "ping") send({ jsonrpc: "2.0", id: message.id, result: {} });
    else if (message.id !== undefined) send({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
  }).on("close", () => process.exit(0));
}

// Attach, then wait for deliveries forever; back off on errors, and stop with one notice when sign-in is needed.
async function relay(notify) {
  let session, failures = 0;
  for (;;) {
    try {
      // The labels Slack's Continue in CLI picker shows: "Claude Code · laptop · courage".
      session ??= (await call("session_attach", { name: NAME, harness: HARNESS, host: hostname().split(".")[0], repo: basename(process.cwd()) })).session;
      const { deliveries } = await call("session_poll", { session, wait_seconds: 50 });
      for (const delivery of deliveries) notify(delivery.content, delivery.meta);
      failures = 0;
    } catch (error) {
      if (/not signed in|sign in again/.test(error.message)) { notify(`courage-session is not signed in, so messages from Slack cannot reach this session. Run: ${SELF} login`, { source: "courage_session" }); return; }
      // The sign-in is spent: say so once and exit; retrying would present a rotated token and revoke the grant.
      if (error.message === SIGN_IN_EXPIRED) {
        notify(`${SIGN_IN_EXPIRED} (${SELF} login), then start this session again.`, { source: "courage_session" });
        log(SIGN_IN_EXPIRED);
        setTimeout(() => process.exit(1), 200);
        return;
      }
      // A newer relay took this session's name over: stop rather than fight it for messages.
      if (/replaced by a newer relay/.test(error.message)) { log("another courage-session took over this session's name; stopping"); return; }
      if (/No session of yours/.test(error.message)) session = undefined;
      failures++;
      log(`${error.message}; retrying`);
      await new Promise(resolve => setTimeout(resolve, Math.min(60_000, 1000 * 2 ** Math.min(failures, 6))));
    }
  }
}

// ---- Setup and doctor ---------------------------------------------------------------------------------------------------

const say = line => process.stdout.write(`${line}\n`);
const on_path = name => (process.env.PATH || "").split(delimiter).some(directory => {
  try { accessSync(join(directory, name), constants.X_OK); return true; } catch { return false; }
});
const claude = (...args) => spawnSync("claude", args, { encoding: "utf8", timeout: 60_000 });

// What claudec hands Claude Code: this relay as a stdio channel, run by the stable installed command when there is one.
function channel_config() {
  const server = LAUNCHER ? { type: "stdio", command: LAUNCHER, args: ["channel"] } : { type: "stdio", command: process.execPath, args: [resolve(process.argv[1]), "channel"] };
  if (process.env.COURAGE_URL) server.env = { COURAGE_URL: COURAGE };
  return `${JSON.stringify({ mcpServers: { "courage-session": server } }, null, 2)}\n`;
}

// The courage server in Claude Code: missing, added but not signed in, or connected (claude mcp get health-checks it).
function courage_server() {
  if (!on_path("claude")) return "no_claude";
  const result = claude("mcp", "get", "courage");
  if (result.status !== 0) return "missing";
  const output = `${result.stdout}${result.stderr}`;
  if (!output.includes(`${COURAGE}/mcp`)) return "other_url";
  return /Connected/.test(output) ? "connected" : "needs_sign_in";
}

function relay_sign_in() {
  const credentials = read_credentials();
  if (!credentials?.refresh_token) return "missing";
  return credentials.sign_in_required ? "expired" : "signed_in";
}

async function relay_token_works() {
  try {
    const response = await fetch(`${COURAGE}/mcp`, { method: "POST", signal: AbortSignal.timeout(20_000), headers: { "Content-Type": "application/json", Accept: "application/json",
      Authorization: `Bearer ${await access_token()}`, "MCP-Protocol-Version": "2025-11-25" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    const body = await response.json().catch(() => ({}));
    return response.ok && (body.result?.tools ?? []).some(tool => tool.name === "session_poll");
  } catch { return false; }
}

const node_ok = () => Number(process.versions.node.split(".")[0]) >= 20;
const START = "Start Claude Code with claudec instead of claude (same arguments), and confirm the development-channel prompt once.";
const COURAGE_SIGN_IN = "Run claude mcp login courage in a terminal, or in claudec type /mcp, pick courage and choose Authenticate (your Diversio Google account).";

async function setup() {
  if (!node_ok()) throw new Error(`Node ${process.versions.node} is too old; courage-session needs Node 20 or later.`);
  // Always at user scope, so every project has it: claude mcp get shows whichever scope wins in this folder (a project's
  // own .mcp.json or a local one), so the user-scope add is tried every time and "already exists" means done.
  if (!on_path("claude")) say("- Claude Code is not installed (no claude on PATH); install it, then run setup again.");
  else {
    const added = claude("mcp", "add", "--transport", "http", "--scope", "user", "courage", `${COURAGE}/mcp`);
    const output = `${added.stdout}${added.stderr}`.trim();
    if (added.status === 0) say(`- Added the courage MCP server to Claude Code (user scope, ${COURAGE}/mcp).`);
    else if (/already exists in user config/.test(output)) say("- Claude Code already has the courage MCP server (user scope).");
    else throw new Error(`claude mcp add failed: ${output}`);
  }
  const server = courage_server();
  if (server === "other_url") say(`- Here, a project or local server named courage points elsewhere and takes precedence; Courage is ${COURAGE}/mcp.`);
  const config = channel_config();
  let current;
  try { current = readFileSync(MCP_CONFIG, "utf8"); } catch {}
  if (current !== config) {
    mkdirSync(HOME, { recursive: true, mode: 0o700 });
    writeFileSync(MCP_CONFIG, config, { mode: 0o644 });
    say(`- ${current === undefined ? "Wrote" : "Updated"} ${MCP_CONFIG}.`);
  } else say(`- ${MCP_CONFIG} is up to date.`);
  if (relay_sign_in() === "signed_in" && await relay_token_works()) say("- The relay is signed in to Courage.");
  else { say("- Signing the relay in to Courage:"); await login(); }
  // Claude Code's own sign-in (its courage server) needs a real terminal; from a script, say how instead.
  let claude_signed_in = server === "connected";
  if (!claude_signed_in && server !== "no_claude" && server !== "other_url" && process.stdin.isTTY && process.stdout.isTTY) {
    say("- Signing Claude Code in to Courage:");
    claude_signed_in = spawnSync("claude", ["mcp", "login", "courage"], { stdio: "inherit" }).status === 0 && courage_server() === "connected";
  }
  say("");
  say(START);
  if (!claude_signed_in && server !== "no_claude") say(`Then sign Claude Code in to Courage too: ${COURAGE_SIGN_IN}`);
  say("Then, in Slack: @Courage send to my terminal: hello");
}

async function doctor() {
  const rows = [];
  const check = (ok, text, fix) => rows.push(`${ok ? "ok     " : "missing"}  ${text}${!ok && fix ? `\n         ${fix}` : ""}`);
  check(node_ok(), `Node ${process.versions.node} (20 or later)`, "Install Node 20 or later.");
  check(true, `courage-session ${VERSION}${LAUNCHER ? ` (${LAUNCHER})` : ` (${resolve(process.argv[1])})`}`);
  const server = courage_server();
  check(server !== "no_claude", "Claude Code (claude on PATH)", "Install Claude Code.");
  if (server !== "no_claude") {
    check(server !== "missing" && server !== "other_url", `courage MCP server in Claude Code (${COURAGE}/mcp)`, `Run: ${SELF} setup`);
    if (server === "connected" || server === "needs_sign_in") check(server === "connected", "Claude Code signed in to Courage", COURAGE_SIGN_IN);
  }
  let config;
  try { config = readFileSync(MCP_CONFIG, "utf8"); } catch {}
  check(config === channel_config(), `channel config ${MCP_CONFIG}`, `Run: ${SELF} setup`);
  const sign_in = relay_sign_in();
  check(sign_in === "signed_in" && await relay_token_works(), "relay signed in to Courage", sign_in === "missing" ? `Run: ${SELF} setup` : `Run: ${SELF} login`);
  check(on_path("claudec"), "claudec on PATH", "Reinstall courage-session (brew reinstall courage-session, or the install script).");
  for (const row of rows) say(row);
  return rows.every(row => row.startsWith("ok"));
}

// Run as a command (directly, or through a launcher and Homebrew's opt symlink); imported, it only defines the helpers
// above (tests).
const is_main = (() => { try { return realpathSync(process.argv[1] ?? "") === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
const command = process.argv[2];
const fail = error => { log(error.message); process.exit(1); };
if (!is_main) { /* imported */ }
else if (command === "login") login().catch(fail);
else if (command === "channel") channel();
else if (command === "setup") setup().catch(fail);
else if (command === "doctor") doctor().then(ok => process.exit(ok ? 0 : 1), fail);
else if (command === "--version" || command === "version") say(VERSION);
else { log("usage: courage-session setup | doctor | login [--port N] | channel | --version"); process.exit(2); }
