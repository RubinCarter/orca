type WslPreflightTarget = {
  distro?: string
}

type AgentCommand = {
  id: string
  cmd: string
}

type ExecCommandInWsl = (
  target: WslPreflightTarget,
  command: string
) => Promise<{ stdout: string; stderr: string }>

function uniqueAgentIds(ids: Iterable<string>): string[] {
  return [...new Set(ids)]
}

function buildWslCommandPresenceScript(commands: readonly string[]): string {
  const commandList = commands.map((cmd) => cmd.replace(/\r?\n/g, '')).join('\n')
  return `while IFS= read -r cmd; do
  found="$(command -v -- "$cmd" 2>/dev/null || true)"
  case "$found" in
    /*) printf '%s\\n' "$cmd" ;;
  esac
done <<'ORCA_AGENT_COMMANDS'
${commandList}
ORCA_AGENT_COMMANDS`
}

function parseInstalledCommands(stdout: string): Set<string> {
  return new Set(
    stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  )
}

export async function detectKnownAgentsOnWslPath(
  knownCommands: readonly AgentCommand[],
  wslTarget: WslPreflightTarget,
  execCommandInWsl: ExecCommandInWsl
): Promise<string[]> {
  if (knownCommands.length === 0) {
    return []
  }
  try {
    // Why: WSL process startup is the expensive part. Batch the catalog probe
    // so adding agents does not spawn one wsl.exe process per known command.
    const { stdout } = await execCommandInWsl(
      wslTarget,
      buildWslCommandPresenceScript(knownCommands.map(({ cmd }) => cmd))
    )
    const installedCommands = parseInstalledCommands(stdout)
    return uniqueAgentIds(
      knownCommands.filter(({ cmd }) => installedCommands.has(cmd)).map(({ id }) => id)
    )
  } catch {
    return []
  }
}

export const _internals = {
  buildWslCommandPresenceScript,
  parseInstalledCommands
}
