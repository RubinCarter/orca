# Design: Shell Integration via OSC 133

**Issue:** #1165 (to be retitled)
**Branch:** `brennanb2025/foreground-process-agent-exit` (to be renamed to match PR title)
**PR title:** `feat(terminal): OSC 133 shell integration for zsh + PowerShell (behind flag)`
**Author:** Brennan Benson
**Status:** Approved for implementation (trimmed scope, 2026-04-27)

## Problem

The renderer maintains an `agentStatusByPaneKey` map of live agent turns (Codex, Claude, Gemini, OpenCode, cursor-agent, etc.) that powers the agent dashboard. Agent CLIs fire hooks for state transitions, but **none of them fire a hook when the user Ctrl+Cs out of the agent back to the shell** — the SIGINT kills the agent too fast for it to emit anything. This leaves a stale dashboard row until its 30-minute TTL decays.

A previous iteration of this branch (`brennanb2025/foreground-process-agent-exit`) solved this by polling node-pty's `proc.process` on a 2s cadence. On POSIX this works — node-pty calls `tcgetpgrp` on the PTY master fd, which returns the process-group leader currently owning the terminal foreground (a kernel-maintained primitive for job control). When the agent dies and the shell reclaims the foreground, the poller fired a `pty:foreground-shell` IPC event and the renderer dropped the row. That implementation has now been removed from this branch; do not reintroduce it as the primary solution.

**This does not work on Windows.** ConPTY has no concept of foreground-process-group ownership; there is no `tcgetpgrp` equivalent, no kernel-maintained notion of "which process owns the terminal's input right now," and node-pty's Windows implementation of `proc.process` returns a static string set at spawn time. **Approximately 50% of our users are on Windows.** Shipping a Unix-only fix leaves half the user base on the 30-minute TTL indefinitely.

Every serious terminal emulator (VS Code, Windows Terminal, Warp, WezTerm, Tabby, Ghostty) has converged on the same cross-platform solution: **shell integration via OSC escape sequences**. The shell emits `OSC 133;A` (prompt start), `;B` (prompt end / command start), `;C` (command executed), `;D;<exit_code>` (command finished) out-of-band in the PTY byte stream. The terminal app parses these from the same data stream it is already rendering. No kernel primitive, no platform-specific PTY APIs — the shell *volunteers* the information.

This is a **cross-platform mechanism by construction**: OSC sequences are just bytes in the PTY stream, and every shell we care about has a prompt hook (`precmd`, `PROMPT_COMMAND`, `PSConsoleHostReadLine`, `fish_prompt`) that can emit them. The work is per-shell, not per-OS.

**Reference implementations (both checked out locally):**
- VS Code: `/Users/thebr/source/repos/public/vscode/src/vs/platform/terminal/common/xterm/shellIntegrationAddon.ts` — the canonical xterm.js addon for OSC 133/633 parsing. Ships injection scripts for bash, zsh, fish, PowerShell at `src/vs/workbench/contrib/terminal/common/scripts/`.
- Ghostty: `/Users/thebr/source/repos/public/ghostty/src/terminal/osc/parsers/semantic_prompt.zig` — the OSC 133 parser. Shell scripts at `/Users/thebr/source/repos/public/ghostty/src/shell-integration/` (one per shell: bash, zsh, fish, elvish, nushell).

## Scope

**In scope (this design):**
- Adopt OSC 133 as the primary shell-integration protocol (FinalTerm-pioneered, iTerm2-adopted, widely supported).
- Ship injection scripts for **zsh** and **PowerShell** only. Extend the existing shell-ready wrapper infrastructure (`src/main/providers/local-pty-shell-ready.ts`, `src/main/daemon/shell-ready.ts`) rather than building a parallel injection system.
- Parse OSC 133 sequences in the renderer (xterm.js v6 via `parser.registerOscHandler`). Parser lives on the renderer only (Option A).
- Keep `agent-foreground-poller.ts` + its IPC plumbing deleted. Replace it with a renderer-local handler that drops `agentStatusByPaneKey` entries on `OSC 133;D`.
- Gated behind the existing compile-time `AGENT_DASHBOARD_ENABLED` constant only. The runtime `experimentalAgentTracking` user toggle is a follow-up PR that lands before `AGENT_DASHBOARD_ENABLED` flips to `true` at release.
- Graceful fallback: users with broken/missing injection fall back to the existing 30-minute TTL + renderer decay-to-idle.
- **Windows feature parity** — PowerShell on Windows lights up the same way zsh does on macOS.

**Out of scope (explicit follow-up PRs):**
- bash, fish, cmd.exe, nushell, elvish injection.
- OSC 633 parsing (including `633;E` command-line capture).
- Parsing in the daemon's headless emulator (Option B — not chosen; renderer-only parsing is simpler and matches VS Code).
- Remote PTYs (SSH). Injection would need to happen on the remote side.
- Exit-code-aware UX (failed-command badges, re-run shortcuts), command navigation, telemetry counters, and diagnostic "shell integration inactive" UI. This design only uses `OSC 133;D` to *drop* a stale dashboard row.
- Consolidation of `local-pty-shell-ready.ts` + `daemon/shell-ready.ts`.
- Tri-state (auto / always-on) feature flag and graduation-to-default machinery.
- Agent-status hook replacement. We keep the existing per-agent hooks (Claude/Codex/Gemini/OpenCode/Cursor) for state entry; shell integration only solves the "agent exited, nobody said so" gap.

## Existing Architecture

### What already works in our favor

This codebase is further along than a greenfield OSC 133 project would be. The key existing surfaces:

| Component | File | What it gives us |
|-----------|------|------------------|
| Shell-ready wrapper (local) | `src/main/providers/local-pty-shell-ready.ts` | Injects a wrapper `.zshenv` / `.zshrc` / `.zlogin` (via `ZDOTDIR`) and `--rcfile` bash rcfile. Already emits `OSC 133;A` from `precmd` / `PROMPT_COMMAND` when `ORCA_SHELL_READY_MARKER=1`. |
| Shell-ready wrapper (daemon) | `src/main/daemon/shell-ready.ts` | Parallel implementation for the daemon-forked PTY path. |
| Shell-ready wrapper files (on disk) | `~/Library/Application Support/orca/shell-ready/zsh/{.zshenv,.zshrc,.zlogin,.zprofile}`, `.../bash/rcfile` | Regenerated from template at app launch by `ensureShellReadyWrappers()`. We already own the injection point. |
| Headless emulator (daemon) | `src/main/daemon/headless-emulator.ts`, `src/main/daemon/session.ts` | `@xterm/headless` instance that parses every byte the daemon receives. Already scans for `\x1b]777;orca-shell-ready\x07` to gate startup-command flush. |
| xterm.js in renderer | `src/renderer/src/components/terminal-pane/pty-connection.ts` (+ siblings) | Full xterm.js v6 with `parser.registerOscHandler` API. |
| Agent-status hook ingress | `src/main/index.ts` + `src/renderer/src/hooks/useIpcEvents.ts` | Native agent hooks already populate `agentStatusByPaneKey`; OSC 133 only supplies the missing "command ended" signal. |
| PTY-exit cleanup | `src/renderer/src/components/terminal-pane/pty-connection.ts` | Removes `agentStatusByPaneKey` only when the whole terminal PTY exits. The title-reversion path now clears cache timers only; do not restore title-based status removal. |

### What's missing

1. **Shell emission.** The wrappers emit only `OSC 133;A` today, and only when the one-shot ready flag is set. We need `OSC 133;C` (command start) and `OSC 133;D;<exit>` (command end) persistently across the pane's lifetime — not just at first prompt. (OSC 133 emission is a different signal from the existing one-shot shell-ready marker; both live in the same wrapper file for now but could be extracted later.)
2. **PowerShell wrapper.** Zero Windows coverage today; the shell-ready infrastructure currently `return`s early on `win32`. We need a PowerShell `$PROFILE` injection path.
3. **Parsing.** Nothing parses OSC 133 sub-sequences A/B/C/D. The daemon emulator scans for the `orca-shell-ready` string marker but not for general OSC 133.
4. **Renderer consumer.** There is no OSC 133 consumer yet. Add one in the terminal pane lifecycle/connection path and have `OSC 133;D` remove the matching pane's agent-status row. The old `pty:foreground-shell` IPC path has already been deleted.

### Cleanup already completed

Commit `6be091d3` removed the 2s-interval poller, the daemon `getForegroundProcess` RPC additions that existed only for that poller, and the `pty:foreground-shell` IPC + preload + renderer handler path.

The branch is now ready for the actual OSC 133 implementation. The next commits should add shell emission, renderer parsing, and targeted tests; they should not bring back main-process polling.

## Design

### 1. Protocol: OSC 133 only

We emit and parse the FinalTerm OSC 133 quartet:

| Sequence | Meaning | When the shell emits it |
|----------|---------|-------------------------|
| `OSC 133;A ST` | Prompt start | Top of `precmd` / `PROMPT_COMMAND` — the shell is about to print the prompt. |
| `OSC 133;B ST` | Prompt end / command input start | End of `precmd` — the user can type now. |
| `OSC 133;C ST` | Command executed | `preexec` — user hit Enter; command starts running now. |
| `OSC 133;D;<exit> ST` | Command finished | Next `precmd` fire — previous command's `$?` captured and embedded. |

Where `ST` is either `\x07` (BEL) or `\x1b\x5c` (ESC `\`). We emit BEL because it's shorter and VS Code / Ghostty / iTerm2 all accept it.

**Why 133 and not 633:** 133 is older, more widely adopted, and matches what tmux/iTerm2/Kitty/Ghostty already interoperate with. 633 is Microsoft-specific and adds nothing we need for drop-on-exit; revisit only when a follow-up feature needs `633;E` command-line capture.

### 2. Shell injection plan

We extend `local-pty-shell-ready.ts` and `daemon/shell-ready.ts` (consolidation deferred). Each shell gets a dedicated hook set that emits A/C/D on every prompt, not just the first.

#### 2a. zsh

Extend `~/.../shell-ready/zsh/.zshrc` to register precmd + preexec:

```zsh
# OSC 133 shell integration (on top of existing shell-ready logic)
__orca_osc133_precmd() {
  local exit_code=$?
  # Emit D for the previous command (if any), then A/B for the next prompt
  if [[ -n "${__orca_in_command:-}" ]]; then
    printf '\e]133;D;%s\a' "$exit_code"
    unset __orca_in_command
  fi
  printf '\e]133;A\a'
}
__orca_osc133_preexec() {
  printf '\e]133;C\a'
  __orca_in_command=1
}
# Prepend: any prior precmd clobbers $?, so we must read it first.
# Matches VS Code's shellIntegration-rc.zsh.
precmd_functions=(__orca_osc133_precmd $precmd_functions)
preexec_functions=(__orca_osc133_preexec $preexec_functions)
```

The existing `orca-shell-ready` marker (OSC 777) stays for the startup-command barrier — it's a different signal (one-shot startup vs. per-prompt lifecycle) and removing it would regress the "claude claude" double-echo fix.

`133;B` (prompt end) is omitted for zsh because zsh prompts are strings, not function-generated — emitting B would require wrapping `$PS1` with escape sequences, and neither VS Code nor Ghostty bother for zsh. The parser treats `B` as optional.

#### 2b. PowerShell (Windows)

This is the **new infrastructure** — there is no PowerShell path in the current wrapper system.

**On-disk path:** `${app.getPath('userData')}/shell-ready/pwsh/orca-shell-integration.ps1` (mirrors the existing zsh/bash wrapper root; both `local-pty-shell-ready.ts` and `daemon/shell-ready.ts` write their own copy until consolidation). LF line endings are fine — PowerShell parses LF-terminated scripts correctly and we do not sign them.

**Script content:**

```powershell
# OSC 133 shell integration for PowerShell
# Authoritative reference: VS Code's shellIntegration.ps1.

# Why source $PROFILE here (not from the -Command line): users commonly rebind
# $function:prompt from $PROFILE (oh-my-posh, starship, posh-git). If we
# captured $function:prompt BEFORE $PROFILE ran, our wrapper would call the
# stock prompt, not the user's customized one. Loading $PROFILE first and
# capturing after means we wrap what the user actually sees.
if (Test-Path $PROFILE) {
    # Swallow errors so a broken $PROFILE does not disable the drop signal.
    # The user still sees the error via PowerShell's default handling.
    try { . $PROFILE } catch { Write-Error $_ }
}

$Global:__OrcaInCommand = $false
$Global:__OrcaOriginalPrompt = $function:prompt
function Global:prompt {
    # Capture FIRST — any other expression clobbers $? and may reset $LASTEXITCODE.
    $lastExit = $LASTEXITCODE
    $lastOk = $?
    $exitCode = if ($null -ne $lastExit) { $lastExit } elseif ($lastOk) { 0 } else { 1 }
    if ($Global:__OrcaInCommand) {
        [Console]::Write("`e]133;D;$exitCode`a")
        $Global:__OrcaInCommand = $false
    }
    [Console]::Write("`e]133;A`a")
    $result = & $Global:__OrcaOriginalPrompt
    [Console]::Write("`e]133;B`a")
    $result
}

# Hook command execution via PSReadLine.
# Known limitation: this overwrites any user-bound Enter handler. A future PR
# should `Get-PSReadLineKeyHandler -Key Enter` first and skip registration (or
# chain) if the user has already customized Enter. Shipping the overwrite now
# because (a) the default AcceptLine binding is what 99% of users have, and
# (b) missing OSC 133;C only degrades the shell-integration feature to "D-only"
# in that session — the drop signal still fires from the prompt wrapper.
if (Get-Module PSReadLine) {
    Set-PSReadLineKeyHandler -Key Enter -ScriptBlock {
        [Console]::Write("`e]133;C`a")
        $Global:__OrcaInCommand = $true
        [Microsoft.PowerShell.PSConsoleReadLine]::AcceptLine()
    }
}
```

**Launch invocation:** `pwsh.exe -NoLogo -NoProfile -NoExit -Command ". '<abs-path-to-orca-shell-integration.ps1>'"`. `-NoProfile` prevents PowerShell from auto-loading `$PROFILE` at startup; the integration script loads it explicitly, in the correct order. Absolute path to the `.ps1` is resolved once in `getWrappedShellLaunchConfig` (see §2c Launch wiring) and embedded directly into the `-Command` string — no `$env:ORCA_SHELL_INTEGRATION` indirection needed.

#### 2c. Launch wiring

Both `src/main/providers/local-pty-shell-ready.ts:199` and `src/main/daemon/shell-ready.ts:161` already have a `getWrappedShellLaunchConfig(shellPath, options)` function that returns `{ args, env, supportsReadyMarker }`. Today it handles `zsh` and `bash` and falls through to `{ args: null, env: {}, supportsReadyMarker: false }` for everything else — meaning PowerShell currently launches with no wrapping. The same function gains a new branch in both files:

```ts
const pwshNames = new Set(['pwsh', 'pwsh.exe', 'powershell', 'powershell.exe'])
if (pwshNames.has(shellName)) {
  ensureShellReadyWrappers()  // extend this helper to also write the .ps1 on win32
  const scriptPath = `${getShellReadyWrapperRoot()}/pwsh/orca-shell-integration.ps1`
  return {
    args: ['-NoLogo', '-NoProfile', '-NoExit', '-Command', `. '${scriptPath.replace(/'/g, "''")}'`],
    env: {
      // No ORCA_SHELL_READY_MARKER — the existing OSC 777 barrier is POSIX-only
      // today; PowerShell startup-command panes are a separate follow-up.
    },
    supportsReadyMarker: false
  }
}
```

The existing `if (process.platform === 'win32') return` early-return in both files' `ensureShellReadyWrappers` is replaced with a conditional that still skips writing the zsh/bash wrappers on win32 but does write the `.ps1`.

Both the local and daemon shell-ready files need this same edit — another instance of the ~80% duplication called out in §Cleanups (still deferred). The duplicated edit is intentional this PR; consolidation is a follow-up.

Note: **PSReadLine is present by default in Windows PowerShell 5.1+ and PowerShell 7+**, which covers the overwhelming majority of Windows users. If PSReadLine is disabled/missing (some enterprise Windows environments do this), the drop signal does not fire — pane falls back to 30-min TTL. Acceptable for initial ship; document in release notes.

### 3. Parser: xterm.js in renderer only (Option A)

xterm.js v6 exposes `terminal.parser.registerOscHandler(oscCode, handler)`. Register a handler for code `133` at pane-creation time. Daemon-backed panes work transparently because the daemon already forwards all PTY bytes to the renderer's xterm.js. Option B (parsing in the daemon's `HeadlessEmulator`) is not chosen — renderer-only matches VS Code and requires zero daemon changes.

Implementation sketch:

```ts
// src/renderer/src/components/terminal-pane/shell-integration.ts
export function attachShellIntegration(
  terminal: Terminal,
  options: { onCommandFinished: (exitCode: number | null) => void }
): { dispose: () => void } {
  const disposables: Array<() => void> = []

  disposables.push(
    terminal.parser.registerOscHandler(133, (data) => {
      // data is the Pt portion, e.g. "A", "B", "C", "D;0", "D;130"
      const [sub, ...rest] = data.split(';')
      switch (sub) {
        case 'A':  // prompt start — parsed + consumed, no behavior wired
        case 'B':  // prompt end — parsed + consumed, no behavior wired
        case 'C':  // command executed — parsed + consumed, no behavior wired
          break
        case 'D': {
          // Command finished. Emit regardless of prior C (shells that
          // missed a preexec still fire precmd). §5 gates the drop on
          // agentStatusByPaneKey having a live entry, so spurious D fires
          // on non-agent commands are no-ops.
          const exitCode = rest[0] ? parseInt(rest[0], 10) : null
          options.onCommandFinished(Number.isNaN(exitCode as number) ? null : exitCode)
          break
        }
      }
      return true  // consume the sequence; don't let xterm render the escape
    })
  )

  return { dispose: () => disposables.forEach((d) => d()) }
}
```

`onCommandFinished` calls `removeAgentStatus(paneKey)` via the existing store action. Drop-on-exit is the ONLY OSC 133 consumer wired here — A/B/C are parsed and consumed (so they don't render) but drive no behavior.

### 4. Event flow

```
User Ctrl+Cs out of codex in a pane
    │
    ▼
Shell regains foreground, runs precmd
    │
    ▼
Wrapper script emits: \e]133;D;130\a (SIGINT → exit 130) then \e]133;A\a
    │
    ▼
Bytes travel through PTY → provider (local or daemon adapter) → renderer
    │
    ▼
xterm.js parser fires registered OSC 133 handler with "D;130"
    │
    ▼
attachShellIntegration → options.onCommandFinished(130)
    │
    ▼
If paneKey has a live agentStatus entry: dispatch removeAgentStatus(paneKey)
    │
    ▼
Dashboard row drops. Latency: ~50-150ms (OSC roundtrip + parser + React render)
```

Compare to the polling approach: 2s interval, 2 ticks to detect transition = 2-4s in the best case, relies on POSIX kernel primitive.

### 5. State: what we track, when it fires

We fire `removeAgentStatus` when **both** conditions hold at the moment `OSC 133;D` arrives:

1. The pane currently has a live `agentStatusByPaneKey` entry (otherwise there's nothing to drop).
2. That entry's `state` is one of `working | blocked | waiting` (not already `done`).

The gate check lives in the renderer call site that invokes `attachShellIntegration` (alongside the existing OSC handlers at `src/renderer/src/components/terminal-pane/pty-connection.ts`); it reads `useAppStore.getState().agentStatusByPaneKey[paneKey]` synchronously inside `onCommandFinished`.

Pure "D → drop" is fine for this PR. A third gate (requiring a recent `C` after the agent hook fired) was considered to prevent spurious drops on incidental shell commands between agent turns, but in practice the agent hook re-fires and re-populates immediately. Revisit only if user testing surfaces spurious drops.

### 6. Fallback and feature detection

If the shell does not emit OSC 133 (user has a broken `.zshrc`, unsupported shell, SSH remote without our injection, etc.), the existing 30-minute TTL + renderer decay-to-idle continues to handle the case. No new fallback path is required; this PR *removes* the tcgetpgrp polling path entirely.

Detection UI (a "shell integration inactive" banner) is a follow-up PR.

## Migration from the old poller commit

This phase is complete as of commit `6be091d3`. Keep the section as an audit checklist when reviewing future commits on this branch; no item here should be reintroduced by the OSC 133 implementation.

### Completed deletion checklist

`getForegroundProcess` has non-poller callers already on `main` (`agent-ready-wait.ts`, `codex-session-restart.ts`, `new-workspace.ts`, plus the underlying `pty:getForegroundProcess` IPC handler and its tests), so this PR only removes the poller-specific additions and leaves the shared RPC surface intact.

**A. Delete (poller-specific)**
- `src/main/agent-foreground-poller.ts` + `src/main/agent-foreground-poller.test.ts`
- `src/main/index.ts` — remove the `agent-foreground-poller` import, the module-scoped `agentForegroundPoller` const, the `.stop()` call in the `closed` handler, and the `registerPaneKeyTeardownListener(...agentForegroundPoller.untrackPane...)` registration only. Leave the pre-existing `stopCursorSpinner` teardown registration intact.
- `src/preload/index.ts` — remove the `onForegroundShell` subscription binding (keep the `getForegroundProcess` invoke)
- `src/preload/index.d.ts` + `src/preload/api-types.d.ts` — remove the `onForegroundShell` typed surface (keep `getForegroundProcess`)
- `src/renderer/src/hooks/useIpcEvents.ts` — remove the `window.api.pty.onForegroundShell(...)` subscription
- `src/renderer/src/hooks/useIpcEvents.test.ts` — remove the `onForegroundShell` regression block
- The `pty:foreground-shell` IPC channel itself (main-side `webContents.send('pty:foreground-shell', ...)` and any preload `ipcRenderer.on('pty:foreground-shell', ...)`)
- Daemon surfaces this branch ADDED for the poller: new `SubprocessHandle.getForegroundProcess` method, new `Session.getForegroundProcess` method, the `daemon-server.ts` switch case that routes this RPC, the `GetForegroundProcessRequest`/`Result` types in `src/main/daemon/types.ts`, and the `pty-subprocess.ts` `getForegroundProcess` implementation (≈lines 160-175). For `DaemonPtyAdapter.getForegroundProcess`: **revert the method body to the pre-branch stub (`return null`); do NOT remove the method** — the `PtyProvider` interface member is kept per §B. Diff against `main` to confirm; delete only branch-added entries.

**B. Keep (shared RPC surface used by non-poller callers)**
- `src/main/providers/types.ts` — `PtyProvider.getForegroundProcess(id)` interface method
- `src/main/providers/local-pty-provider.ts` and `src/main/providers/ssh-pty-provider.ts` — concrete impls
- `src/main/ipc/pty.ts` — `pty:getForegroundProcess` handler registration + `removeHandler`
- `src/main/ipc/pty.test.ts` — handler tests
- `src/preload/index.ts` — `pty:getForegroundProcess` invoke binding
- `src/relay/pty-handler.ts` + `src/relay/pty-shell-utils.ts` (`getForegroundProcessName`) — used by the SSH path

**C. Verification**

```
rg -n "getForegroundProcess|pty:foreground-shell|onForegroundShell|agent-foreground-poller" src tests
```

This command should return hits only in the shared-RPC surface listed in section (B) and this design doc. Any code hit for `pty:foreground-shell`, `onForegroundShell`, or `agent-foreground-poller` means deletion regressed.

## Remote PTYs (SSH): known gap

The relay-backed panes (SSH remotes) send PTY data through a different path — the relay daemon on the remote host spawns node-pty and streams bytes back. Two aspects to address:

1. **Parser:** Works automatically. The renderer's xterm.js receives SSH-backed bytes identically to local bytes; the OSC handler fires the same way.
2. **Injection:** Broken by default. The relay does not currently inject our shell-ready wrappers on the remote. SSH panes run the user's unmodified `.bashrc` / `.zshrc` on the remote host.

Fixing injection for remote panes is a follow-up project, not a blocker for this design. SSH users fall back to the 30-min TTL (same as today for them — the current poller also doesn't work for SSH, because the remote PTY's foreground-process info isn't surfaced through the relay). Document in release notes.

## Rollout

### Flag: compile-time only in this PR

Shell integration ships behind the existing compile-time `AGENT_DASHBOARD_ENABLED` constant (`src/shared/constants.ts:20`). No runtime user toggle in this PR.

**Why only compile-time here:**

- `AGENT_DASHBOARD_ENABLED` already gates the entire agent-status stack — hooks, store writes, dashboard UI, sidebar sort inputs. Shell integration is just another branch inside that same gate.
- Currently hardcoded `false` on this branch after the poller cleanup. Implementation work can temporarily flip it locally while dogfooding, but commits intended for merge should leave it `false` until the runtime-toggle PR is ready.
- Avoids coupling this PR's scope to a user-facing settings UI change. Ship the mechanism first, add the toggle second.

### Follow-up PR: runtime toggle

A separate PR lands before `AGENT_DASHBOARD_ENABLED` flips to `true`. It adds:

- `experimentalAgentTracking: boolean` (default `false`) on `GlobalSettings`, persisted.
- A `SearchableSetting` block in `ExperimentalPane.tsx` below the daemon toggle, rendered only when `AGENT_DASHBOARD_ENABLED === true`.
- Idiomatic composition: `AGENT_DASHBOARD_ENABLED && s.settings.experimentalAgentTracking` on every existing agent-status read site.

That PR is where the toggle's read semantics (main-at-spawn for injection, renderer-at-creation for parser, new-panes-only for mid-session toggle) get specified and wired. Out of scope here.

### Ordering

1. Current committed state: poller deleted, title-reversion status removal disabled, design doc added, compile-time flag remains `false`.
2. Next commits on this branch: add OSC 133 shell emission + renderer parser behind `AGENT_DASHBOARD_ENABLED`, keeping the flag `false` for merge.
3. Follow-up PR: runtime toggle lands, compile-time flag still `false`.
4. Release-ready: compile-time flag flips to `true`, toggle becomes user-visible (default off).
5. Graduation: after a clean release cycle, both gates are removed in a cleanup PR and the feature is permanent.

## Testing

### Required this PR

- **Renderer OSC 133 parser unit test:** feed synthetic OSC sequences into a mock xterm.js parser, assert `onCommandFinished` fires with the right exit code. Cover A, B, C, D, and malformed payloads.
- **zsh wrapper golden-file test:** verify the generated `.zshrc` string content.
- **PowerShell wrapper golden-file test:** verify the generated `orca-shell-integration.ps1` string content.

### Follow-ups (not in CI this round)

- Per-shell subprocess integration tests (spawn real zsh/pwsh, assert A/B/C/D appear on stdout).
- Electron e2e coverage (open pane, run `sleep 5`, Ctrl+C, assert row drops within 1s).

### Manual test matrix

| Shell | OS | Agent CLI | Expected |
|-------|----|-----------|----------|
| zsh | macOS | codex | Row drops <1s after Ctrl+C |
| zsh | macOS | claude | Same |
| zsh | macOS | gemini | Same |
| PowerShell | Windows | codex | Same |
| PowerShell | Windows | claude (via node) | Same |
| zsh | macOS, user has custom `.zshrc` with their own `precmd_functions` | codex | Row drops, user's precmd still runs |
| PowerShell | Windows, PSReadLine disabled | codex | No drop (documented gap); 30-min TTL fires |
| SSH remote zsh | via relay | codex | No drop (documented gap); 30-min TTL fires |

## Risks

1. **Shell-wrapper edge cases.** Every shell has a long tail of user configs that break injection: custom `ZDOTDIR`, antigen/zinit/zplug, oh-my-posh, starship, PowerShell `$PROFILE` hooks. The existing shell-ready wrapper has already fought battles here (see the `fix-zdotdir-recursion` PR). Same class of problem; same mitigation (defensive scripting, graceful fallback to TTL).
2. **Timing of exit-code capture.** `$?` in zsh and `$LASTEXITCODE` / `$?` in PowerShell must be captured **before** any other command runs. Our `__orca_osc133_precmd` must be the first thing in the function — ordering matters. Test explicitly.
3. **Interaction with `scanForShellReady` and startup-command flush.** The existing scanner at `local-pty-shell-ready.ts:35` consumes the first `OSC 133;A` from the data stream before xterm.js sees it, but only when `ORCA_SHELL_READY_MARKER=1` (startup-command panes). After this PR, the wrapper emits `OSC 133;A` on every prompt, not just the first. Two things to verify and specify:

    **A. Who consumes which bytes.** The daemon wrapper emits `OSC 777;orca-shell-ready` instead of `OSC 133;A` (see `daemon/shell-ready.ts:84-89`). The local wrapper historically emitted `OSC 133;A` for the barrier (`local-pty-shell-ready.ts:168`). To keep the signals cleanly separated, **the local wrapper switches to `OSC 777;orca-shell-ready` for the barrier** (matching the daemon) when injecting the new per-prompt OSC 133 emission. `scanForShellReady` switches to scanning for `OSC 777` as well. After this change: the barrier scanner and the OSC 133 parser never touch the same bytes. The "claude claude" double-echo fix continues to work because the OSC 777 barrier preserves its current semantics; xterm.js parser ignores OSC 777 (no registered handler) and passes it through unconsumed — which is fine because it's an OSC escape, not printable content.

    **B. Regression test.** Add one test (inside the renderer parser unit test file) that feeds a mixed byte sequence — `OSC 777;orca-shell-ready\x07` followed by `OSC 133;A\x07` followed by shell output — into the scanner, asserts only the OSC 777 is consumed by the barrier, and confirms xterm.js parser then sees the OSC 133;A plus the shell output unchanged.
4. **PTY byte ordering.** Node-pty batches writes. An OSC 133 sequence could theoretically straddle a chunk boundary. xterm.js's parser handles this — it buffers incomplete escape sequences. Verified by the fact that VS Code uses the same parser. No action required.
5. **User hijacks our precmd.** Mitigate by appending our function inside `.zshrc`. If a user reassigns `precmd_functions=()` after our line, we lose the signal and fall back to the 30-min TTL. A follow-up PR may add a diagnostic banner when `A` is never observed.
6. **PowerShell injection overriding user profile.** Our `-Command ". '$env:ORCA_SHELL_INTEGRATION'; . $PROFILE"` invocation assumes the user's `$PROFILE` is well-behaved. Some users set `$PROFILE` to exit if non-interactive. Test against Microsoft's default profile template and document override behavior.
7. **PowerShell `-NoProfile` ordering.** `-NoProfile -NoExit -Command '... $PROFILE'` invocation means our integration loads *before* the user's `$PROFILE`. If the user's `$PROFILE` throws during load, the user sees the error but our integration still works. If the user relies on `$PROFILE` running before interactive-shell startup (rare), behavior differs from a plain pwsh launch. Document in release notes; no code change needed.

## Cleanups (opportunistic)

Deferred to follow-up PR. Consolidation of `local-pty-shell-ready.ts` + `daemon/shell-ready.ts` is explicitly out of scope here.

## Migration timeline

Rough estimate for a solo engineer on this codebase:

| Phase | Scope | Days |
|-------|-------|------|
| 1 | Delete poller + IPC plumbing (net-negative diff first) | Done (`6be091d3`) |
| 2 | Renderer OSC 133 parser, gated inside the existing `AGENT_DASHBOARD_ENABLED` branches | 1-2 |
| 3 | zsh wrapper extension + golden-file test | 1-2 |
| 4 | PowerShell wrapper + golden-file test + Windows smoke test | 2-3 |
| 5 | Dogfood hardening (Orca team on their own shells) | 1-2 |

**Working estimate: 1–2 weeks wall-clock to ship behind the compile-time flag.** The runtime user toggle is a separate follow-up PR (see §Rollout).

Target is 1–2 weeks for both zsh + PowerShell. No zsh-only fallback — PowerShell ships with this PR.

## Appendix: reference points in the two local repos

### VS Code (`/Users/thebr/source/repos/public/vscode`)

- `src/vs/platform/terminal/common/xterm/shellIntegrationAddon.ts` — the xterm.js addon. Read the `FinalTermOscPt` enum for the authoritative sequence list. The parser wiring (`_handleFinalTermSequence`) is a direct model for ours.
- `src/vs/workbench/contrib/terminal/common/scripts/shellIntegration.ps1` — PowerShell injection. Note the `Set-PSReadLineKeyHandler` patterns for Enter/Chord handling — the "simpler" version in this design may need to grow to match.
- `src/vs/workbench/contrib/terminal/common/scripts/shellIntegration-rc.zsh` — zsh injection. Notable for the `_vsc_in_command` state tracking.
- `src/vs/workbench/contrib/terminal/test/browser/xterm/shellIntegrationAddon.test.ts` — test patterns we can model our unit tests on.

### Ghostty (`/Users/thebr/source/repos/public/ghostty`)

- `src/terminal/osc/parsers/semantic_prompt.zig` — the OSC 133 parser. A good reference for *just the parse logic*.
- `src/shell-integration/zsh/.zshenv` and `src/shell-integration/zsh/ghostty-integration` — zsh injection. Uses the same `ZDOTDIR` trick we already use for shell-ready wrappers.

### Relevant files in this repo

- `src/main/providers/local-pty-shell-ready.ts` — where zsh wrappers are emitted today; extend here.
- `src/main/daemon/shell-ready.ts` — daemon-side parallel implementation; extend here (consolidation deferred).
- `src/renderer/src/components/terminal-pane/pty-connection.ts` / `use-terminal-pane-lifecycle.ts` — attach the renderer-local OSC 133 handler near existing xterm parser wiring.
- `src/renderer/src/components/terminal-pane/pty-connection.ts:240` — title reversion now clears cache timers only; keep agent-status removal tied to explicit hooks, PTY exit, and OSC 133 command-finished marks.
- `src/main/index.ts` — agent hooks still feed `agentStatus:set`; do not add a new poller or `pty:foreground-shell` IPC path here.
