import { execFileSync } from 'node:child_process'
import { buildEncodedWslBashCommand } from './wsl-bash-command'

const WSL_SHELL_ENV_TIMEOUT_MS = 5000
const WSL_SHELL_ENV_CACHE_TTL_MS = 30_000

const ALLOWED_WSL_SHELL_ENV_KEYS = new Set([
  'PATH',
  'NVM_DIR',
  'NVM_BIN',
  'NVM_INC',
  'PNPM_HOME',
  'VOLTA_HOME',
  'ASDF_DIR',
  'ASDF_DATA_DIR',
  'FNM_DIR',
  'FNM_MULTISHELL_PATH',
  'BUN_INSTALL',
  'DENO_DIR',
  'DENO_INSTALL',
  'PYENV_ROOT',
  'RBENV_ROOT',
  'CARGO_HOME',
  'RUSTUP_HOME',
  'GOPATH',
  'GOROOT',
  'GOBIN'
])

const ALLOWED_WSL_SHELL_ENV_PREFIXES = ['NVM_', 'FNM_', 'ASDF_', 'PYENV_', 'RBENV_', 'MISE_']

type CachedWslShellEnv = {
  env: Record<string, string>
  expiresAt: number
}

const wslShellEnvCache = new Map<string, CachedWslShellEnv>()

function getWslDistroArgs(distro: string | null | undefined): string[] {
  const normalized = distro?.trim()
  return normalized ? ['-d', normalized] : []
}

function getWslShellEnvCacheKey(distro: string | null | undefined): string {
  return distro?.trim() || '<default>'
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function isAllowedWslShellEnvKey(key: string): boolean {
  return (
    ALLOWED_WSL_SHELL_ENV_KEYS.has(key) ||
    ALLOWED_WSL_SHELL_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))
  )
}

function parseNulSeparatedEnv(output: Buffer): Record<string, string> {
  const env: Record<string, string> = {}
  for (const entry of output.toString('utf8').split('\0')) {
    const separator = entry.indexOf('=')
    if (separator <= 0) {
      continue
    }
    const key = entry.slice(0, separator)
    if (!/^[A-Za-z_]\w*$/.test(key) || !isAllowedWslShellEnvKey(key)) {
      continue
    }
    env[key] = entry.slice(separator + 1)
  }
  return env
}

export function resolveWslUserShellEnv(distro?: string | null): Record<string, string> {
  const now = Date.now()
  const cacheKey = getWslShellEnvCacheKey(distro)
  const cached = wslShellEnvCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.env
  }

  try {
    // Why: WSL users commonly install agent CLIs through nvm/asdf/mise in
    // interactive shell startup files; plain `bash -lc` misses those PATH edits.
    const output = execFileSync(
      'wsl.exe',
      [
        ...getWslDistroArgs(distro),
        '--',
        'bash',
        '-lc',
        buildEncodedWslBashCommand("bash -lic 'env -0'")
      ],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: WSL_SHELL_ENV_TIMEOUT_MS,
        maxBuffer: 1024 * 1024
      }
    )
    const env = parseNulSeparatedEnv(Buffer.isBuffer(output) ? output : Buffer.from(output))
    wslShellEnvCache.set(cacheKey, {
      env,
      expiresAt: now + WSL_SHELL_ENV_CACHE_TTL_MS
    })
    return env
  } catch {
    const env: Record<string, string> = {}
    wslShellEnvCache.set(cacheKey, {
      env,
      expiresAt: now + WSL_SHELL_ENV_CACHE_TTL_MS
    })
    return env
  }
}

export function buildWslUserShellEnvExports(distro?: string | null): string {
  return Object.entries(resolveWslUserShellEnv(distro))
    .map(([key, value]) => `export ${key}=${shellQuote(value)}`)
    .join('\n')
}

export function buildWslUserShellCommand(
  distro: string | null | undefined,
  command: string
): string {
  const envExports = buildWslUserShellEnvExports(distro)
  return envExports ? `${envExports}\n${command}` : command
}

export const _internals = {
  getWslDistroArgs,
  parseNulSeparatedEnv,
  wslShellEnvCache
}
