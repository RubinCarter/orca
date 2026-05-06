/* eslint-disable max-lines -- Why: persistence keeps schema defaults, migration,
load/save, and flush logic in one file so the full storage contract is reviewable
as a unit instead of being scattered across modules. */
import { app } from 'electron'
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  renameSync,
  unlinkSync,
  copyFileSync,
  statSync
} from 'fs'
import { writeFile, rename, mkdir, rm, copyFile } from 'fs/promises'
import { join, dirname } from 'path'
import { homedir } from 'os'
import type { PersistedState, Repo, WorktreeMeta, GlobalSettings } from '../shared/types'
import type { SshTarget } from '../shared/ssh-types'
import { isFolderRepo } from '../shared/repo-kind'
import { getGitUsername } from './git/repo'
import {
  getDefaultPersistedState,
  getDefaultNotificationSettings,
  getDefaultUIState,
  getDefaultRepoHookSettings,
  getDefaultWorkspaceSession
} from '../shared/constants'
import { parseWorkspaceSession } from '../shared/workspace-session-schema'

// Why: the data-file path must not be a module-level constant. Module-level
// code runs at import time — before configureDevUserDataPath() redirects the
// userData path in index.ts — so a constant would capture the default (non-dev)
// path, causing dev and production instances to share the same file and silently
// overwrite each other.
//
// It also must not be resolved lazily on every call, because app.setName('Orca')
// runs before the Store constructor and would change the resolved path from
// lowercase 'orca' to uppercase 'Orca'. On case-sensitive filesystems (Linux)
// this would look in the wrong directory and lose existing user data.
//
// Solution: index.ts calls initDataPath() right after configureDevUserDataPath()
// but before app.setName(), capturing the correct path at the right moment.
let _dataFile: string | null = null

export function initDataPath(): void {
  _dataFile = join(app.getPath('userData'), 'orca-data.json')
}

function getDataFile(): string {
  if (!_dataFile) {
    // Safety fallback — should not be hit in normal startup.
    _dataFile = join(app.getPath('userData'), 'orca-data.json')
  }
  return _dataFile
}

// Why (issue #1158): keep 5 rolling backups of orca-data.json so a corrupt or
// empty write (e.g., a hydration crash that serialized empty state over the
// user's tabs) leaves at least one earlier copy recoverable. Five snapshots
// at ≥1-hour spacing cover roughly the most recent work session without
// churning disk on every 300ms debounced tick.
const BACKUP_COUNT = 5
const BACKUP_MIN_INTERVAL_MS = 60 * 60 * 1000

function backupPath(dataFile: string, index: number): string {
  return `${dataFile}.bak.${index}`
}

function normalizeSortBy(sortBy: unknown): 'name' | 'smart' | 'recent' | 'repo' {
  if (sortBy === 'smart' || sortBy === 'recent' || sortBy === 'repo' || sortBy === 'name') {
    return sortBy
  }
  return getDefaultUIState().sortBy
}

// Why: old persisted targets predate configHost. Default to label-based lookup
// so imported SSH aliases keep resolving through ssh -G after upgrade.
function normalizeSshTarget(t: SshTarget): SshTarget {
  return { ...t, configHost: t.configHost ?? t.label ?? t.host }
}

export class Store {
  private state: PersistedState
  private writeTimer: ReturnType<typeof setTimeout> | null = null
  private pendingWrite: Promise<void> | null = null
  private writeGeneration = 0
  private gitUsernameCache = new Map<string, string>()

  constructor() {
    this.state = this.load()
  }

  // Why (issue #1158): debounced writes fire as often as every 300ms during
  // active use. Rotating a 5-slot ring on every tick would waste IO and
  // quickly replace every older backup with near-identical snapshots, which
  // defeats the point of having a rolling safety net. Gate rotation on a
  // minimum interval so the ring captures meaningfully different moments.
  //
  // Why (issue #1158): do not cache lastBackupAt in memory — a crash-loop
  // restart-storm would reset it to 0 on each launch and burn through the
  // 5-slot backup ring in minutes, overwriting pre-crash snapshots with
  // corrupted ones. The filesystem mtime of .bak.0 is the authoritative
  // source of truth and survives process boundaries. This also narrows the
  // concurrent-rotation window: once the first caller finishes
  // copyFile(dataFile, .bak.0), the updated mtime closes the gate for any
  // later caller. Concurrent rotations on the same .bak.* paths are further
  // prevented by (a) chaining writes through pendingWrite in scheduleSave
  // (only one writeToDiskAsync runs at a time) and (b) the early
  // writeGeneration check in writeToDiskAsync that aborts before rotation
  // when flush() has bumped the generation.
  private shouldRotateBackups(now: number, dataFile: string): boolean {
    try {
      const mtime = statSync(backupPath(dataFile, 0)).mtimeMs
      return now - mtime >= BACKUP_MIN_INTERVAL_MS
    } catch {
      // Any stat failure (ENOENT on first run, or rarer EACCES/EIO) is
      // treated as "rotate now" — a missed rotation is worse than an extra
      // best-effort one, and rotateBackupsAsync/Sync each tolerate missing
      // source files.
      return true
    }
  }

  // Why: rotate oldest → discarded, then .bak.i → .bak.i+1 by rename (cheap;
  // those files aren't visible to load()). The current data file is copied
  // to .bak.0 rather than renamed so dataFile never temporarily disappears —
  // a crash between rotation and the new write would otherwise leave load()
  // falling back to defaults even though .bak.0 held the latest good state.
  //
  // Why (issue #1158): rotation runs AFTER a successful write so .bak.0 always
  // represents the previous-known-good state on disk. If we rotated first and
  // the write then failed (ENOSPC, EIO), .bak.0 would be a fresh snapshot of
  // the same state we just failed to overwrite — not useful for recovery —
  // and the 1-hour interval gate would suppress the next rotation attempt.
  private async rotateBackupsAsync(dataFile: string): Promise<void> {
    if (!existsSync(dataFile)) {
      return
    }
    await rm(backupPath(dataFile, BACKUP_COUNT - 1)).catch((err: unknown) => {
      // Why: missing file is expected on first rotations; surface anything
      // else (EACCES, EBUSY) so silent backup-ring corruption is visible.
      if (err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[persistence] Failed to remove oldest backup:', err)
      }
    })
    for (let i = BACKUP_COUNT - 2; i >= 0; i--) {
      const src = backupPath(dataFile, i)
      const dst = backupPath(dataFile, i + 1)
      if (existsSync(src)) {
        await rename(src, dst).catch((err) => {
          console.error('[persistence] Failed to rotate backup', src, '→', dst, err)
        })
      }
    }
    await copyFile(dataFile, backupPath(dataFile, 0)).catch((err) => {
      console.error('[persistence] Failed to snapshot current file to .bak.0:', err)
    })
  }

  private rotateBackupsSync(dataFile: string): void {
    if (!existsSync(dataFile)) {
      return
    }
    try {
      unlinkSync(backupPath(dataFile, BACKUP_COUNT - 1))
    } catch (err) {
      // Why: missing file is expected on first rotations; any other error
      // (EACCES, EBUSY) is logged so silent backup-ring corruption is visible.
      // We still proceed with rotation — losing one backup slot is better
      // than skipping the write entirely.
      if (err && (err as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('[persistence] Failed to remove oldest backup:', err)
      }
    }
    for (let i = BACKUP_COUNT - 2; i >= 0; i--) {
      const src = backupPath(dataFile, i)
      const dst = backupPath(dataFile, i + 1)
      if (existsSync(src)) {
        try {
          renameSync(src, dst)
        } catch (err) {
          console.error('[persistence] Failed to rotate backup', src, '→', dst, err)
        }
      }
    }
    try {
      copyFileSync(dataFile, backupPath(dataFile, 0))
    } catch (err) {
      console.error('[persistence] Failed to snapshot current file to .bak.0:', err)
    }
  }

  // Why (issue #1158): parse + migrate + merge is shared between the primary
  // dataFile read and the .bak.* recovery path. Centralizing here keeps the
  // migration semantics identical regardless of which slot we recovered from
  // — a backup must produce the same shape of PersistedState as a fresh
  // dataFile, otherwise downstream code (settings, UI, workspace session)
  // would behave inconsistently after a recovery.
  private mergeParsedState(raw: string): PersistedState {
    const parsed = JSON.parse(raw) as PersistedState
    const defaults = getDefaultPersistedState(homedir())
    // Why: before the layout-aware 'auto' mode shipped (issue #903),
    // terminalMacOptionAsAlt defaulted to 'true' globally. That silently
    // broke Option-layer characters (@ on Turkish via Option+Q, @ on
    // German via Option+L, € on French via Option+E) for non-US users.
    // We can't distinguish a persisted 'true' that the user chose
    // explicitly from one they inherited from the old default — so on
    // first launch after upgrade, flip 'true' back to 'auto' and let
    // the renderer's keyboard-layout probe pick the right value per
    // layout. US users land on 'true' via detection (no change); non-US
    // users land on 'false' (correct). 'false'/'left'/'right' are
    // definitionally explicit choices (they never matched the old
    // default) so we carry those forward unchanged. The migrated flag
    // guards against re-running this on subsequent launches.
    const rawOptionAsAlt = parsed.settings?.terminalMacOptionAsAlt
    const alreadyMigrated = parsed.settings?.terminalMacOptionAsAltMigrated === true
    const migratedOptionAsAlt: 'auto' | 'true' | 'false' | 'left' | 'right' = alreadyMigrated
      ? (rawOptionAsAlt ?? 'auto')
      : rawOptionAsAlt === undefined || rawOptionAsAlt === 'true'
        ? 'auto'
        : rawOptionAsAlt
    return {
      ...defaults,
      ...parsed,
      settings: {
        ...defaults.settings,
        ...parsed.settings,
        terminalMacOptionAsAlt: migratedOptionAsAlt,
        terminalMacOptionAsAltMigrated: true,
        notifications: {
          ...getDefaultNotificationSettings(),
          ...parsed.settings?.notifications
        }
      },
      // Why: 'recent' used to mean the weighted smart sort. One-shot
      // migration moves it to 'smart'; the flag prevents re-firing after
      // a user intentionally selects the new last-activity 'recent' sort.
      ui: (() => {
        const sort = normalizeSortBy(parsed.ui?.sortBy)
        const migrate = !parsed.ui?._sortBySmartMigrated && sort === 'recent'
        return {
          ...defaults.ui,
          ...parsed.ui,
          sortBy: migrate ? ('smart' as const) : sort,
          _sortBySmartMigrated: true
        }
      })(),
      // Why: the workspace session is the most volatile persisted surface
      // (schema evolves per release, daemon session IDs embedded in it).
      // Zod-validate at the read boundary so a field-type flip from an
      // older build — or a truncated write from a crash — gets rejected
      // cleanly instead of poisoning Zustand state and crashing the
      // renderer on mount. On validation failure, fall back to defaults
      // and log; a corrupt session file shouldn't trap the user out.
      // Applies equally to backup files: a backup with corrupt
      // workspaceSession is still useful for repos/worktrees/settings.
      workspaceSession: (() => {
        if (parsed.workspaceSession === undefined) {
          return defaults.workspaceSession
        }
        const result = parseWorkspaceSession(parsed.workspaceSession)
        if (!result.ok) {
          console.error('[persistence] Corrupt workspace session, using defaults:', result.error)
          return defaults.workspaceSession
        }
        return { ...defaults.workspaceSession, ...result.value }
      })(),
      sshTargets: (parsed.sshTargets ?? []).map(normalizeSshTarget)
    }
  }

  private load(): PersistedState {
    const dataFile = getDataFile()
    // Try the primary file first.
    if (existsSync(dataFile)) {
      try {
        const raw = readFileSync(dataFile, 'utf-8')
        return this.mergeParsedState(raw)
      } catch (err) {
        // Why (issue #1158): a corrupt/empty primary write must not silently
        // wipe the user's repos/worktrees/session. Fall through to the
        // backup ring before giving up to defaults. Backups exist for
        // exactly this reason.
        console.error('[persistence] Failed to load primary state, trying backups:', err)
      }
    }
    // Iterate .bak.0 → .bak.4. .bak.0 is the most recent known-good state
    // (rotation runs AFTER successful writes — see rotateBackups* comment).
    for (let i = 0; i < BACKUP_COUNT; i++) {
      const path = backupPath(dataFile, i)
      if (!existsSync(path)) {
        continue
      }
      try {
        const raw = readFileSync(path, 'utf-8')
        const merged = this.mergeParsedState(raw)
        console.warn(`[persistence] Recovered state from backup slot ${i}: ${path}`)
        return merged
      } catch (err) {
        console.error(`[persistence] Backup slot ${i} unusable, trying next:`, err)
      }
    }
    console.error('[persistence] No usable state file or backup found, using defaults')
    return getDefaultPersistedState(homedir())
  }

  private scheduleSave(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      // Why (issue #1158): chain on the previous in-flight write rather than
      // overwriting the pendingWrite reference. Concurrent writeToDiskAsync
      // calls would otherwise race on the same tmp/dataFile/.bak.* paths —
      // e.g. one call's rotation could rename .bak.0 to .bak.1 while another
      // is mid-copyFile to .bak.0. Serializing via promise chain guarantees
      // at most one writeToDiskAsync runs at a time.
      const prev = this.pendingWrite ?? Promise.resolve()
      const next = prev
        .then(() => this.writeToDiskAsync())
        .catch((err) => {
          console.error('[persistence] Failed to write state:', err)
        })
        .finally(() => {
          // Why: only clear if no newer write has been chained on top.
          // Otherwise a later scheduleSave would lose its ordering link.
          if (this.pendingWrite === next) {
            this.pendingWrite = null
          }
        })
      this.pendingWrite = next
    }, 300)
  }

  /** Wait for any in-flight async disk write to complete. Used in tests. */
  async waitForPendingWrite(): Promise<void> {
    if (this.pendingWrite) {
      await this.pendingWrite
    }
  }

  // Why: async writes avoid blocking the main Electron thread on every
  // debounced save (every 300ms during active use).
  private async writeToDiskAsync(): Promise<void> {
    const gen = this.writeGeneration
    const dataFile = getDataFile()
    const dir = dirname(dataFile)
    await mkdir(dir, { recursive: true }).catch(() => {})
    const tmpFile = `${dataFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
    // Why: wrap write+rename in try/finally-on-error so any failure (ENOSPC,
    // ENFILE, EIO, permission) removes the tmp file rather than leaving a
    // multi-megabyte orphan behind. Successful rename consumes the tmp file.
    let renamed = false
    try {
      await writeFile(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8')
      // Why: if flush() ran while this async write was in-flight, it bumped
      // writeGeneration and already wrote the latest state synchronously.
      // Renaming this stale tmp file would overwrite the fresh data.
      if (this.writeGeneration !== gen) {
        return
      }
      await rename(tmpFile, dataFile)
      renamed = true
    } finally {
      if (!renamed) {
        await rm(tmpFile).catch(() => {})
      }
    }
    // Why (issue #1158): rotate AFTER the rename succeeds so .bak.0 always
    // represents the previous-known-good state on disk — exactly what
    // load() needs for recovery. Rotating first would mean a failed write
    // (ENOSPC, EIO) leaves .bak.0 as a fresh duplicate of the same state we
    // just failed to overwrite, and the 1-hour interval gate would suppress
    // the next rotation.
    //
    // Why: re-check writeGeneration BEFORE rotation. If flush() ran between
    // our successful rename and rotation start, our async rotation would
    // race with flush()'s sync rotation on the same .bak.* paths. flush()
    // bumps writeGeneration as a barrier; bailing out here keeps only the
    // sync rotation in flight. Combined with promise-chained scheduleSave,
    // at most one rotation runs at a time.
    if (this.writeGeneration !== gen) {
      return
    }
    const now = Date.now()
    if (this.shouldRotateBackups(now, dataFile)) {
      await this.rotateBackupsAsync(dataFile)
    }
  }

  // Why: synchronous variant kept only for flush() at shutdown, where the
  // process may exit before an async write completes.
  private writeToDiskSync(): void {
    const dataFile = getDataFile()
    const dir = dirname(dataFile)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const tmpFile = `${dataFile}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
    // Why: mirror the async path — on any failure between writeFileSync and
    // renameSync, remove the tmp file so crashes during shutdown don't leak
    // orphans into userData.
    let renamed = false
    try {
      writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8')
      renameSync(tmpFile, dataFile)
      renamed = true
    } finally {
      if (!renamed) {
        try {
          unlinkSync(tmpFile)
        } catch {
          // Best-effort cleanup; the write already failed, swallow secondary error.
        }
      }
    }
    // Why (issue #1158): rotate AFTER the rename succeeds so .bak.0 holds the
    // previous-known-good state — exactly what load() reads on recovery.
    // Rotating first would mean a failed write leaves .bak.0 as a duplicate
    // of the file we just failed to overwrite, and the 1-hour interval gate
    // would suppress the next rotation. Apply the same min-interval gate as
    // the async path so a restart-storm still only rotates once per hour.
    // Shutdown is the most important moment to take a snapshot — the next
    // launch could be the one that hits the hydration crash.
    const now = Date.now()
    if (this.shouldRotateBackups(now, dataFile)) {
      this.rotateBackupsSync(dataFile)
    }
  }

  // ── Repos ──────────────────────────────────────────────────────────

  getRepos(): Repo[] {
    return this.state.repos.map((repo) => this.hydrateRepo(repo))
  }

  getRepo(id: string): Repo | undefined {
    const repo = this.state.repos.find((r) => r.id === id)
    return repo ? this.hydrateRepo(repo) : undefined
  }

  addRepo(repo: Repo): void {
    this.state.repos.push(repo)
    this.scheduleSave()
  }

  removeRepo(id: string): void {
    this.state.repos = this.state.repos.filter((r) => r.id !== id)
    // Clean up worktree meta for this repo
    const prefix = `${id}::`
    for (const key of Object.keys(this.state.worktreeMeta)) {
      if (key.startsWith(prefix)) {
        delete this.state.worktreeMeta[key]
      }
    }
    this.scheduleSave()
  }

  updateRepo(
    id: string,
    updates: Partial<
      Pick<Repo, 'displayName' | 'badgeColor' | 'hookSettings' | 'worktreeBaseRef' | 'kind'>
    >
  ): Repo | null {
    const repo = this.state.repos.find((r) => r.id === id)
    if (!repo) {
      return null
    }
    Object.assign(repo, updates)
    this.scheduleSave()
    return this.hydrateRepo(repo)
  }

  private hydrateRepo(repo: Repo): Repo {
    const gitUsername = isFolderRepo(repo)
      ? ''
      : (this.gitUsernameCache.get(repo.path) ??
        (() => {
          const username = getGitUsername(repo.path)
          this.gitUsernameCache.set(repo.path, username)
          return username
        })())

    return {
      ...repo,
      kind: isFolderRepo(repo) ? 'folder' : 'git',
      gitUsername,
      hookSettings: {
        ...getDefaultRepoHookSettings(),
        ...repo.hookSettings,
        scripts: {
          ...getDefaultRepoHookSettings().scripts,
          ...repo.hookSettings?.scripts
        }
      }
    }
  }

  // ── Worktree Meta ──────────────────────────────────────────────────

  getWorktreeMeta(worktreeId: string): WorktreeMeta | undefined {
    return this.state.worktreeMeta[worktreeId]
  }

  getAllWorktreeMeta(): Record<string, WorktreeMeta> {
    return this.state.worktreeMeta
  }

  setWorktreeMeta(worktreeId: string, meta: Partial<WorktreeMeta>): WorktreeMeta {
    const existing = this.state.worktreeMeta[worktreeId] || getDefaultWorktreeMeta()
    const updated = { ...existing, ...meta }
    this.state.worktreeMeta[worktreeId] = updated
    this.scheduleSave()
    return updated
  }

  removeWorktreeMeta(worktreeId: string): void {
    delete this.state.worktreeMeta[worktreeId]
    this.scheduleSave()
  }

  // ── Settings ───────────────────────────────────────────────────────

  getSettings(): GlobalSettings {
    return this.state.settings
  }

  updateSettings(updates: Partial<GlobalSettings>): GlobalSettings {
    this.state.settings = {
      ...this.state.settings,
      ...updates,
      notifications: {
        ...this.state.settings.notifications,
        ...updates.notifications
      }
    }
    this.scheduleSave()
    return this.state.settings
  }

  // ── UI State ───────────────────────────────────────────────────────

  getUI(): PersistedState['ui'] {
    return {
      ...getDefaultUIState(),
      ...this.state.ui,
      sortBy: normalizeSortBy(this.state.ui?.sortBy)
    }
  }

  updateUI(updates: Partial<PersistedState['ui']>): void {
    this.state.ui = {
      ...this.state.ui,
      ...updates,
      sortBy: updates.sortBy
        ? normalizeSortBy(updates.sortBy)
        : normalizeSortBy(this.state.ui?.sortBy)
    }
    this.scheduleSave()
  }

  // ── GitHub Cache ──────────────────────────────────────────────────

  getGitHubCache(): PersistedState['githubCache'] {
    return this.state.githubCache
  }

  setGitHubCache(cache: PersistedState['githubCache']): void {
    this.state.githubCache = cache
    this.scheduleSave()
  }

  // ── Workspace Session ─────────────────────────────────────────────

  getWorkspaceSession(): PersistedState['workspaceSession'] {
    return this.state.workspaceSession ?? getDefaultWorkspaceSession()
  }

  setWorkspaceSession(session: PersistedState['workspaceSession']): void {
    this.state.workspaceSession = session
    this.scheduleSave()
  }

  // ── SSH Targets ────────────────────────────────────────────────────

  getSshTargets(): SshTarget[] {
    return (this.state.sshTargets ?? []).map(normalizeSshTarget)
  }

  getSshTarget(id: string): SshTarget | undefined {
    const target = this.state.sshTargets?.find((t) => t.id === id)
    return target ? normalizeSshTarget(target) : undefined
  }

  addSshTarget(target: SshTarget): void {
    this.state.sshTargets ??= []
    this.state.sshTargets.push(normalizeSshTarget(target))
    this.scheduleSave()
  }

  updateSshTarget(id: string, updates: Partial<Omit<SshTarget, 'id'>>): SshTarget | null {
    const target = this.state.sshTargets?.find((t) => t.id === id)
    if (!target) {
      return null
    }
    Object.assign(target, updates, normalizeSshTarget({ ...target, ...updates }))
    this.scheduleSave()
    return { ...target }
  }

  removeSshTarget(id: string): void {
    if (!this.state.sshTargets) {
      return
    }
    this.state.sshTargets = this.state.sshTargets.filter((t) => t.id !== id)
    this.scheduleSave()
  }

  // ── Flush (for shutdown) ───────────────────────────────────────────

  flush(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    // Why: bump writeGeneration so any in-flight async writeToDiskAsync skips
    // its rename, preventing a stale snapshot from overwriting this sync write.
    this.writeGeneration++
    this.pendingWrite = null
    try {
      this.writeToDiskSync()
    } catch (err) {
      console.error('[persistence] Failed to flush state:', err)
    }
  }
}

function getDefaultWorktreeMeta(): WorktreeMeta {
  return {
    displayName: '',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: Date.now(),
    lastActivityAt: 0
  }
}
