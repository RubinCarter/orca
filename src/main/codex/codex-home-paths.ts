import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { app } from 'electron'

const CODEX_SYSTEM_RESOURCE_ENTRIES = [
  'skills',
  'plugins',
  'plugin-state',
  'profile-v2',
  'themes',
  'prompts'
] as const

export function getSystemCodexHomePath(): string {
  return join(homedir(), '.codex')
}

export function getOrcaManagedCodexHomePath(): string {
  const managedHomePath = join(app.getPath('userData'), 'codex-runtime-home', 'home')
  mkdirSync(managedHomePath, { recursive: true })
  return managedHomePath
}

export function syncSystemCodexResourcesIntoManagedHome(): void {
  const systemHomePath = getSystemCodexHomePath()
  const managedHomePath = getOrcaManagedCodexHomePath()
  for (const entryName of CODEX_SYSTEM_RESOURCE_ENTRIES) {
    linkSystemCodexResource(systemHomePath, managedHomePath, entryName)
  }
}

function linkSystemCodexResource(
  systemHomePath: string,
  managedHomePath: string,
  entryName: string
): void {
  const sourcePath = join(systemHomePath, entryName)
  const targetPath = join(managedHomePath, entryName)
  if (!existsSync(sourcePath)) {
    removeCopiedResourceIfOwned(targetPath, managedHomePath, entryName, sourcePath)
    return
  }

  if (targetAlreadyPointsToSource(targetPath, sourcePath)) {
    clearCopiedResourceMarker(managedHomePath, entryName)
    return
  }
  const shouldRefreshFallbackCopy = targetIsOwnedFallbackCopy(
    targetPath,
    managedHomePath,
    entryName,
    sourcePath
  )
  if (existsSync(targetPath) && !shouldRefreshFallbackCopy) {
    return
  }
  if (shouldRefreshFallbackCopy) {
    rmSync(targetPath, { recursive: true, force: true })
  }

  try {
    const sourceStat = lstatSync(sourcePath)
    symlinkSync(
      sourcePath,
      targetPath,
      sourceStat.isDirectory() && process.platform === 'win32' ? 'junction' : undefined
    )
    clearCopiedResourceMarker(managedHomePath, entryName)
  } catch (error) {
    try {
      rmSync(targetPath, { recursive: true, force: true })
      // Why: Windows can reject file symlinks outside developer mode. Copy is
      // a fallback for launch-time resources; mark ownership so later syncs can
      // refresh the copy without touching user-created runtime resources.
      cpSync(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: true })
      markCopiedResource(managedHomePath, entryName, sourcePath)
    } catch {
      console.warn('[codex-home] Failed to link system Codex resource:', entryName, error)
    }
  }
}

function targetAlreadyPointsToSource(targetPath: string, sourcePath: string): boolean {
  try {
    return lstatSync(targetPath).isSymbolicLink() && readlinkSync(targetPath) === sourcePath
  } catch {
    return false
  }
}

function getResourceCopyMarkerPath(managedHomePath: string, entryName: string): string {
  return join(managedHomePath, '.orca-resource-copies', `${entryName}.json`)
}

function markCopiedResource(managedHomePath: string, entryName: string, sourcePath: string): void {
  const markerPath = getResourceCopyMarkerPath(managedHomePath, entryName)
  mkdirSync(dirname(markerPath), { recursive: true })
  writeFileSync(markerPath, `${JSON.stringify({ sourcePath }, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600
  })
}

function readCopiedResourceSourcePath(managedHomePath: string, entryName: string): string | null {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(getResourceCopyMarkerPath(managedHomePath, entryName), 'utf-8')
    )
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    const sourcePath = 'sourcePath' in parsed ? parsed.sourcePath : null
    return typeof sourcePath === 'string' ? sourcePath : null
  } catch {
    return null
  }
}

function clearCopiedResourceMarker(managedHomePath: string, entryName: string): void {
  rmSync(getResourceCopyMarkerPath(managedHomePath, entryName), { force: true })
}

function targetIsOwnedFallbackCopy(
  targetPath: string,
  managedHomePath: string,
  entryName: string,
  sourcePath: string
): boolean {
  if (readCopiedResourceSourcePath(managedHomePath, entryName) !== sourcePath) {
    return false
  }
  try {
    return existsSync(targetPath) && !lstatSync(targetPath).isSymbolicLink()
  } catch {
    return false
  }
}

function removeCopiedResourceIfOwned(
  targetPath: string,
  managedHomePath: string,
  entryName: string,
  sourcePath: string
): void {
  if (!targetIsOwnedFallbackCopy(targetPath, managedHomePath, entryName, sourcePath)) {
    return
  }
  rmSync(targetPath, { recursive: true, force: true })
  clearCopiedResourceMarker(managedHomePath, entryName)
}
