import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  copyFileSync,
  renameSync,
  unlinkSync
} from 'fs'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import { grantDirAcl, isPermissionError } from '../win32-utils'

// Why: single source of truth for the agent-hooks directory name so
// `getAgentHooksDir` (the dir where the endpoint file + managed scripts
// live) and `createManagedCommandMatcher` (which sweeps stale entries by
// matching this substring) cannot drift apart. Renaming the dir means
// updating exactly one place.
const AGENT_HOOKS_DIR_NAME = 'agent-hooks'

// Why: every read or write of a path under this directory should go through
// this helper (or an adjacent helper that does) so the writer (server.ts,
// which writes the endpoint file) and the matcher's sweep needle
// (`agent-hooks/<scriptName>` in `createManagedCommandMatcher`) cannot drift
// apart. Renaming the dir is a one-line change here.
export function getAgentHooksDir(userDataPath: string): string {
  return join(userDataPath, AGENT_HOOKS_DIR_NAME)
}

// Why: the endpoint file lives under userData so each Orca install (dev vs.
// packaged) has its own path and the two cannot clobber each other. Using a
// per-platform extension (`.env` on POSIX, `.cmd` on Windows) lets the hook
// scripts source the file with their platform-native syntax (`.` on POSIX,
// `call` on Windows); the OpenCode plugin's regex accepts both shapes so no
// platform detection is needed inside the plugin source either.
// Lives in installer-utils so both the hook server (which writes the file)
// and the managed-script generators (which source it from the script) share
// one source of truth for the filename convention.
export function getEndpointFileName(): string {
  return process.platform === 'win32' ? 'endpoint.cmd' : 'endpoint.env'
}

// Why: single accessor for the endpoint file path. Composing it from
// `getAgentHooksDir` + `getEndpointFileName` keeps the writer (server.ts)
// and any future reader on the same path convention.
export function getEndpointFilePath(userDataPath: string): string {
  return join(getAgentHooksDir(userDataPath), getEndpointFileName())
}

// Why: single accessor for a managed-script path. Routes every agent's
// hook-service through one helper so a rename of the dir or layout is a
// one-line change here instead of four parallel edits.
export function getManagedScriptPathForAgent(userDataPath: string, scriptFileName: string): string {
  return join(getAgentHooksDir(userDataPath), scriptFileName)
}

export type HookCommandConfig = {
  type: 'command'
  command: string
  timeout?: number
  [key: string]: unknown
}

export type HookDefinition = {
  matcher?: string
  hooks?: HookCommandConfig[]
  [key: string]: unknown
}

export type HooksConfig = {
  hooks?: Record<string, HookDefinition[]>
  [key: string]: unknown
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readHooksJson(configPath: string): HooksConfig | null {
  if (!existsSync(configPath)) {
    return {}
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8'))
    return isPlainObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Why: callers in install/remove need to match not just the exact current
// managed command, but also stale entries pointing at old script paths — e.g.
// from a previous dev build with a different Electron userData dir, or a
// parallel dev/prod install. Matching by the managed script's file name
// (under any `agent-hooks/` directory) lets a fresh install sweep those
// without touching unrelated user-authored hooks.
//
// NOTE: the directory segment comes from `AGENT_HOOKS_DIR_NAME` so a rename
// cannot desync the matcher from `getAgentHooksDir`. If the directory is
// ever renamed, this matcher also needs to recognize the old name during a
// transition window so a fresh install can still sweep pre-rename entries
// out of the user's hook config.
export function createManagedCommandMatcher(
  scriptFileName: string
): (command: string | undefined) => boolean {
  const needle = `${AGENT_HOOKS_DIR_NAME}/${scriptFileName}`
  return (command) => {
    if (!command) {
      return false
    }
    return command.replaceAll('\\', '/').includes(needle)
  }
}

export function removeManagedCommands(
  definitions: HookDefinition[],
  isManagedCommand: (command: string | undefined) => boolean
): HookDefinition[] {
  return definitions.flatMap((definition) => {
    if (!Array.isArray(definition.hooks)) {
      return [definition]
    }

    const filteredHooks = definition.hooks.filter((hook) => !isManagedCommand(hook.command))
    if (filteredHooks.length === 0) {
      return []
    }

    return [{ ...definition, hooks: filteredHooks }]
  })
}

export function writeManagedScript(scriptPath: string, content: string): void {
  mkdirSync(dirname(scriptPath), { recursive: true })
  writeScriptWithAclRetry(scriptPath, content)
  if (process.platform !== 'win32') {
    chmodSync(scriptPath, 0o755)
  }
}

// Why: on Windows, Chromium's renderer initialization can reset the DACL on
// the userData directory (Protected DACL without OI+CI propagation), leaving
// child directories like agent-hooks with an empty DACL. Grant an explicit
// directory ACL on EPERM and retry once.
function writeScriptWithAclRetry(scriptPath: string, content: string): void {
  try {
    writeFileSync(scriptPath, content, 'utf-8')
  } catch (error) {
    if (isPermissionError(error) && process.platform === 'win32') {
      try {
        grantDirAcl(dirname(scriptPath))
        writeFileSync(scriptPath, content, 'utf-8')
        return
      } catch {
        // icacls failure is not actionable; re-throw the original EPERM
      }
    }
    throw error
  }
}

export function writeHooksJson(configPath: string, config: HooksConfig): void {
  const dir = dirname(configPath)
  mkdirSync(dir, { recursive: true })

  // Why: write to a temp file then rename so a crash or disk-full mid-write
  // leaves the original untouched. This is the only safe way to update a
  // config file the user may have hand-edited.
  //
  // Why randomUUID: Date.now() alone collides when two install() calls fire in
  // the same millisecond targeting the same dir (e.g. a future caller that
  // installs multiple agents sharing a config dir, or rapid reinstalls from
  // the settings UI). A collision would corrupt one of the two writes. The
  // UUID suffix makes the tmp path unique per call.
  const tmpPath = join(dir, `.${Date.now()}-${randomUUID()}.tmp`)
  const serialized = `${JSON.stringify(config, null, 2)}\n`

  // Why: skip the write (and therefore the .bak rotation) when the on-disk
  // content is already identical. Without this, every install() rewrites the
  // file and rolls the backup forward, which can silently destroy the last
  // recoverable copy if install() is called repeatedly (e.g. on app start).
  if (existsSync(configPath)) {
    try {
      if (readFileSync(configPath, 'utf-8') === serialized) {
        return
      }
    } catch {
      // Fall through to the normal write path — a read error here is not
      // worth failing the install for; the atomic write below will either
      // succeed or throw loudly.
    }
  }

  try {
    writeFileSync(tmpPath, serialized, 'utf-8')
    // Why: single rolling backup — one file, no accumulation in ~/.claude.
    // Protects against a merge-logic bug producing bad JSON; the original is
    // always recoverable from <configPath>.bak until the next write.
    if (existsSync(configPath)) {
      copyFileSync(configPath, `${configPath}.bak`)
    }
    renameSync(tmpPath, configPath)
  } finally {
    // Clean up temp file if rename failed.
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // best effort
      }
    }
  }
}
