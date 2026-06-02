import { beforeEach, describe, expect, it, vi } from 'vitest'

const execFileSyncMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
  execFileSync: execFileSyncMock
}))

function decodeEncodedWslBashCommand(command: string): string {
  const encoded = command.match(/^set -o pipefail; printf %s '([^']+)' \| base64 -d \| bash$/)?.[1]
  return encoded ? Buffer.from(encoded, 'base64').toString('utf8') : command
}

describe('WSL shell env capture', () => {
  beforeEach(async () => {
    execFileSyncMock.mockReset()
    const { _internals } = await import('./wsl-shell-env')
    _internals.wslShellEnvCache.clear()
  })

  it('captures safe interactive shell env for WSL command launches', async () => {
    execFileSyncMock.mockReturnValue(
      Buffer.from(
        [
          'PATH=/home/alice/.nvm/versions/node/v20.19.5/bin:/usr/bin',
          'NVM_DIR=/home/alice/.nvm',
          'OPENAI_API_KEY=secret',
          'MISE_SHELL=bash',
          ''
        ].join('\0')
      )
    )

    const { buildWslUserShellCommand } = await import('./wsl-shell-env')
    const command = buildWslUserShellCommand('Ubuntu', 'command -v codex')

    expect(command).toContain("export PATH='/home/alice/.nvm/versions/node/v20.19.5/bin:/usr/bin'")
    expect(command).toContain("export NVM_DIR='/home/alice/.nvm'")
    expect(command).toContain("export MISE_SHELL='bash'")
    expect(command).not.toContain('OPENAI_API_KEY')
    expect(command).toContain('command -v codex')

    const [, args] = execFileSyncMock.mock.calls[0] as [string, string[]]
    expect(args.slice(0, 5)).toEqual(['-d', 'Ubuntu', '--', 'bash', '-lc'])
    expect(decodeEncodedWslBashCommand(args[5])).toBe("bash -lic 'env -0'")
  })

  it('falls back to the original command when env capture fails', async () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('capture failed')
    })

    const { buildWslUserShellCommand } = await import('./wsl-shell-env')

    expect(buildWslUserShellCommand('Ubuntu', 'command -v codex')).toBe('command -v codex')
  })

  it('reuses a short-lived cache per distro', async () => {
    execFileSyncMock.mockReturnValue(Buffer.from('PATH=/home/alice/bin:/usr/bin\0'))

    const { buildWslUserShellCommand } = await import('./wsl-shell-env')
    buildWslUserShellCommand('Ubuntu', 'first')
    buildWslUserShellCommand('Ubuntu', 'second')

    expect(execFileSyncMock).toHaveBeenCalledTimes(1)
  })

  it('captures env from the default WSL distro when no distro is specified', async () => {
    execFileSyncMock.mockReturnValue(Buffer.from('PATH=/home/alice/.local/bin:/usr/bin\0'))

    const { buildWslUserShellCommand } = await import('./wsl-shell-env')
    const command = buildWslUserShellCommand(null, 'gh --version')

    expect(command).toContain("export PATH='/home/alice/.local/bin:/usr/bin'")
    expect(command).toContain('gh --version')
    const [, args] = execFileSyncMock.mock.calls[0] as [string, string[]]
    expect(args).toEqual(['--', 'bash', '-lc', expect.any(String)])
    expect(decodeEncodedWslBashCommand(args[3])).toBe("bash -lic 'env -0'")
  })
})
