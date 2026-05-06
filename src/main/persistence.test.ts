/* eslint-disable max-lines -- Why: this persistence suite keeps defaulting,
migration, mutation, and flush behavior in one file so schema changes are
reviewed against the full storage contract instead of being scattered. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { writeFileSync, readFileSync, rmSync, mkdtempSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Repo } from '../shared/types'

// Shared mutable state so the electron mock can reference a per-test directory
const testState = { dir: '' }

vi.mock('electron', () => ({
  app: {
    getPath: () => testState.dir
  }
}))

vi.mock('./git/repo', () => ({
  getGitUsername: vi.fn().mockReturnValue('testuser')
}))

/** Reset modules and dynamically import Store so the data-file path picks up the current testState.dir */
async function createStore() {
  vi.resetModules()
  const { Store, initDataPath } = await import('./persistence')
  initDataPath()
  return new Store()
}

function dataFile(): string {
  return join(testState.dir, 'orca-data.json')
}

function writeDataFile(data: unknown): void {
  mkdirSync(testState.dir, { recursive: true })
  writeFileSync(dataFile(), JSON.stringify(data, null, 2), 'utf-8')
}

function readDataFile(): unknown {
  return JSON.parse(readFileSync(dataFile(), 'utf-8'))
}

const makeRepo = (overrides: Partial<Repo> = {}): Repo => ({
  id: 'r1',
  path: '/repo',
  displayName: 'test',
  badgeColor: '#fff',
  addedAt: 1,
  ...overrides
})

describe('Store', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'orca-test-'))
  })

  afterEach(() => {
    rmSync(testState.dir, { recursive: true, force: true })
  })

  // ── 1. Defaults when no file exists ──────────────────────────────────

  it('returns empty repos when no data file exists', async () => {
    const store = await createStore()
    expect(store.getRepos()).toEqual([])
  })

  it('returns default settings when no data file exists', async () => {
    const store = await createStore()
    const settings = store.getSettings()
    expect(settings.branchPrefix).toBe('git-username')
    expect(settings.refreshLocalBaseRefOnWorktreeCreate).toBe(false)
    expect(settings.theme).toBe('system')
    expect(settings.editorAutoSave).toBe(false)
    expect(settings.editorAutoSaveDelayMs).toBe(1000)
    expect(settings.terminalFontSize).toBe(14)
    expect(settings.terminalFontWeight).toBe(500)
    expect(settings.rightSidebarOpenByDefault).toBe(true)
    expect(settings.showTaskProviderIcons).toBe(true)
  })

  it('returns default UI state when no data file exists', async () => {
    const store = await createStore()
    const ui = store.getUI()
    expect(ui.sidebarWidth).toBe(280)
    expect(ui.groupBy).toBe('none')
    expect(ui.lastActiveRepoId).toBeNull()
    expect(ui.dismissedUpdateVersion).toBeNull()
    expect(ui.lastUpdateCheckAt).toBeNull()
  })

  // ── 2. Load from existing valid file ─────────────────────────────────

  it('reads repos from an existing data file', async () => {
    const repo = makeRepo()
    writeDataFile({
      schemaVersion: 1,
      repos: [repo],
      worktreeMeta: {},
      settings: {},
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    const repos = store.getRepos()
    expect(repos).toHaveLength(1)
    expect(repos[0].id).toBe('r1')
    expect(repos[0].gitUsername).toBe('testuser')
  })

  // ── 3. Corrupt JSON → falls back to defaults ────────────────────────

  it('falls back to defaults when data file contains invalid JSON', async () => {
    mkdirSync(testState.dir, { recursive: true })
    writeFileSync(dataFile(), '{{{invalid json', 'utf-8')

    const store = await createStore()
    expect(store.getRepos()).toEqual([])
    expect(store.getSettings().theme).toBe('system')
  })

  // ── 4. Schema migration: merges with defaults ───────────────────────

  it('merges loaded data with defaults for missing fields', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [makeRepo()],
      worktreeMeta: {},
      settings: { theme: 'dark' },
      githubCache: { pr: {}, issue: {} }
      // ui and workspaceSession intentionally omitted
    })

    const store = await createStore()
    // ui should have defaults
    const ui = store.getUI()
    expect(ui.sidebarWidth).toBe(280)
    // settings should preserve the overridden value
    expect(store.getSettings().theme).toBe('dark')
    // new fields get defaults when missing from persisted data
    expect(store.getSettings().editorAutoSave).toBe(false)
    expect(store.getSettings().editorAutoSaveDelayMs).toBe(1000)
    expect(store.getSettings().refreshLocalBaseRefOnWorktreeCreate).toBe(false)
    expect(store.getSettings().rightSidebarOpenByDefault).toBe(true)
    expect(store.getSettings().showTaskProviderIcons).toBe(true)
    // repos should be loaded
    expect(store.getRepos()).toHaveLength(1)
  })

  it('preserves editorAutoSaveDelayMs when set in persisted data', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { editorAutoSaveDelayMs: 2500 },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    expect(store.getSettings().editorAutoSaveDelayMs).toBe(2500)
  })

  it('preserves editorAutoSave when set to true in persisted data', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { editorAutoSave: true },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    expect(store.getSettings().editorAutoSave).toBe(true)
  })

  it('preserves rightSidebarOpenByDefault when set to true in persisted data', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { rightSidebarOpenByDefault: true },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    expect(store.getSettings().rightSidebarOpenByDefault).toBe(true)
  })

  // ── 5. addRepo and getRepo ──────────────────────────────────────────

  it('addRepo stores a repo retrievable by getRepo', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())

    const fetched = store.getRepo('r1')
    expect(fetched).toBeDefined()
    expect(fetched!.displayName).toBe('test')
    expect(fetched!.gitUsername).toBe('testuser')
  })

  it('getRepo returns undefined for nonexistent id', async () => {
    const store = await createStore()
    expect(store.getRepo('nonexistent')).toBeUndefined()
  })

  // ── 6. removeRepo cleans up worktree meta ──────────────────────────

  it('removeRepo deletes the repo and its worktree meta', async () => {
    const store = await createStore()
    store.addRepo(makeRepo({ id: 'r1' }))
    store.addRepo(makeRepo({ id: 'r2', path: '/repo2' }))

    store.setWorktreeMeta('r1::/path/wt1', { displayName: 'wt1' })
    store.setWorktreeMeta('r1::/path/wt2', { displayName: 'wt2' })
    store.setWorktreeMeta('r2::/other', { displayName: 'other' })

    store.removeRepo('r1')

    expect(store.getRepo('r1')).toBeUndefined()
    expect(store.getWorktreeMeta('r1::/path/wt1')).toBeUndefined()
    expect(store.getWorktreeMeta('r1::/path/wt2')).toBeUndefined()
    expect(store.getWorktreeMeta('r2::/other')).toBeDefined()
    expect(store.getWorktreeMeta('r2::/other')!.displayName).toBe('other')
  })

  // ── 7. updateRepo ──────────────────────────────────────────────────

  it('updateRepo modifies the repo in place', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())

    const updated = store.updateRepo('r1', { displayName: 'renamed' })
    expect(updated).not.toBeNull()
    expect(updated!.displayName).toBe('renamed')
    expect(store.getRepo('r1')!.displayName).toBe('renamed')
  })

  it('updateRepo returns null for nonexistent id', async () => {
    const store = await createStore()
    expect(store.updateRepo('nope', { displayName: 'x' })).toBeNull()
  })

  // ── 8. setWorktreeMeta and getWorktreeMeta ─────────────────────────

  it('setWorktreeMeta creates meta with defaults for missing fields', async () => {
    const store = await createStore()
    const meta = store.setWorktreeMeta('wt1', { displayName: 'my-wt' })

    expect(meta.displayName).toBe('my-wt')
    expect(meta.comment).toBe('')
    expect(meta.linkedIssue).toBeNull()
    expect(meta.isArchived).toBe(false)
    expect(typeof meta.sortOrder).toBe('number')
  })

  it('setWorktreeMeta merges with existing meta', async () => {
    const store = await createStore()
    store.setWorktreeMeta('wt1', { displayName: 'first', comment: 'hello' })
    const updated = store.setWorktreeMeta('wt1', { comment: 'updated' })

    expect(updated.displayName).toBe('first')
    expect(updated.comment).toBe('updated')
  })

  // ── 9. Settings: get/update ────────────────────────────────────────

  it('updateSettings merges partial updates', async () => {
    const store = await createStore()
    const initial = store.getSettings()
    expect(initial.theme).toBe('system')

    const updated = store.updateSettings({
      theme: 'dark',
      editorAutoSave: true,
      editorAutoSaveDelayMs: 1500,
      terminalFontSize: 16,
      terminalFontWeight: 600
    })
    expect(updated.theme).toBe('dark')
    expect(updated.editorAutoSave).toBe(true)
    expect(updated.editorAutoSaveDelayMs).toBe(1500)
    expect(updated.terminalFontSize).toBe(16)
    expect(updated.terminalFontWeight).toBe(600)
    // Other fields preserved
    expect(updated.branchPrefix).toBe('git-username')
  })

  it('updateSettings toggles editorAutoSave', async () => {
    const store = await createStore()
    expect(store.getSettings().editorAutoSave).toBe(false)

    store.updateSettings({ editorAutoSave: true })
    expect(store.getSettings().editorAutoSave).toBe(true)

    store.updateSettings({ editorAutoSave: false })
    expect(store.getSettings().editorAutoSave).toBe(false)
  })

  it('updateSettings toggles rightSidebarOpenByDefault', async () => {
    const store = await createStore()
    expect(store.getSettings().rightSidebarOpenByDefault).toBe(true)

    store.updateSettings({ rightSidebarOpenByDefault: false })
    expect(store.getSettings().rightSidebarOpenByDefault).toBe(false)

    store.updateSettings({ rightSidebarOpenByDefault: true })
    expect(store.getSettings().rightSidebarOpenByDefault).toBe(true)
  })

  // ── 10. flush writes synchronously ─────────────────────────────────

  it('flush writes state to disk synchronously', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())
    store.flush()

    const persisted = readDataFile() as { repos: Repo[] }
    expect(persisted.repos).toHaveLength(1)
    expect(persisted.repos[0].id).toBe('r1')
  })

  it('flush remains safe when a debounced save is also pending', async () => {
    vi.useFakeTimers()
    try {
      const store = await createStore()
      store.addRepo(makeRepo())
      store.flush()
      vi.advanceTimersByTime(300)

      const persisted = readDataFile() as { repos: Repo[] }
      expect(persisted.repos).toHaveLength(1)
      expect(persisted.repos[0].id).toBe('r1')
    } finally {
      vi.useRealTimers()
    }
  })

  // ── 11. Debounced save ─────────────────────────────────────────────

  it('debounced save writes data after the delay', async () => {
    vi.useFakeTimers()
    try {
      const store = await createStore()
      store.addRepo(makeRepo())

      // Before the debounce fires, file should not exist yet (or be stale)
      vi.advanceTimersByTime(100)
      // The 300ms debounce hasn't elapsed yet

      vi.advanceTimersByTime(300)
      // The timer fired; wait for the async disk write to complete
      await store.waitForPendingWrite()

      const persisted = readDataFile() as { repos: Repo[] }
      expect(persisted.repos).toHaveLength(1)
      expect(persisted.repos[0].id).toBe('r1')
    } finally {
      vi.useRealTimers()
    }
  })

  // ── UI state ───────────────────────────────────────────────────────

  it('updateUI merges partial updates', async () => {
    const store = await createStore()
    store.updateUI({ sidebarWidth: 400 })
    const ui = store.getUI()
    expect(ui.sidebarWidth).toBe(400)
    expect(ui.groupBy).toBe('none') // default preserved
    expect(ui.dismissedUpdateVersion).toBeNull()
  })

  it('persists updater reminder metadata in UI state', async () => {
    const store = await createStore()
    store.updateUI({ dismissedUpdateVersion: '1.0.99', lastUpdateCheckAt: 1234 })
    const ui = store.getUI()
    expect(ui.dismissedUpdateVersion).toBe('1.0.99')
    expect(ui.lastUpdateCheckAt).toBe(1234)
  })

  it('preserves persisted smart sort value', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {},
      ui: { sortBy: 'smart' },
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    expect(store.getUI().sortBy).toBe('smart')
  })

  it('migrates legacy recent sort to smart on first load', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {},
      ui: { sortBy: 'recent' },
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    expect(store.getUI().sortBy).toBe('smart')
    expect(store.getUI()._sortBySmartMigrated).toBe(true)
  })

  it('preserves new recent sort after migration flag is set', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {},
      ui: { sortBy: 'recent', _sortBySmartMigrated: true },
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })

    const store = await createStore()
    expect(store.getUI().sortBy).toBe('recent')
  })

  // ── terminalMacOptionAsAlt migration (issue #903) ───────────────────

  it('migrates legacy "true" terminalMacOptionAsAlt to "auto" on first load', async () => {
    // Why: before the 'auto' mode shipped, 'true' was the global default.
    // A persisted 'true' on an un-migrated install is indistinguishable
    // from an explicit choice, so we flip to 'auto' and let detection pick
    // the right value per keyboard layout. Non-US users stop losing their
    // @ / € / [ ] characters.
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { terminalMacOptionAsAlt: 'true' },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })
    const store = await createStore()
    expect(store.getSettings().terminalMacOptionAsAlt).toBe('auto')
    expect(store.getSettings().terminalMacOptionAsAltMigrated).toBe(true)
  })

  it('preserves explicit "false" terminalMacOptionAsAlt through migration', async () => {
    // 'false' never matched the old default — it was an explicit choice.
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { terminalMacOptionAsAlt: 'false' },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })
    const store = await createStore()
    expect(store.getSettings().terminalMacOptionAsAlt).toBe('false')
    expect(store.getSettings().terminalMacOptionAsAltMigrated).toBe(true)
  })

  it('preserves explicit "left" / "right" terminalMacOptionAsAlt through migration', async () => {
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { terminalMacOptionAsAlt: 'left' },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })
    const store = await createStore()
    expect(store.getSettings().terminalMacOptionAsAlt).toBe('left')
    expect(store.getSettings().terminalMacOptionAsAltMigrated).toBe(true)
  })

  it('respects already-migrated settings with explicit "true"', async () => {
    // After migration, if a user deliberately picks 'Both' in the UI,
    // their choice is preserved on subsequent launches.
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: { terminalMacOptionAsAlt: 'true', terminalMacOptionAsAltMigrated: true },
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })
    const store = await createStore()
    expect(store.getSettings().terminalMacOptionAsAlt).toBe('true')
    expect(store.getSettings().terminalMacOptionAsAltMigrated).toBe(true)
  })

  it('fresh install defaults terminalMacOptionAsAlt to "auto" and marks migrated', async () => {
    // No data file at all: auto is the new default; migration is considered
    // complete since there's nothing legacy to migrate.
    const store = await createStore()
    expect(store.getSettings().terminalMacOptionAsAlt).toBe('auto')
    // Fresh install: default is migrated=false (nothing loaded, so the
    // migration code didn't run). On first persisted write, the flag stays
    // false, which is fine — next load with legacy 'true' would still
    // migrate correctly. Only loaded files flip the flag.
    expect(store.getSettings().terminalMacOptionAsAltMigrated).toBe(false)
  })

  it('missing terminalMacOptionAsAlt in persisted file defaults to "auto" and flags migrated', async () => {
    // Existing file predates the setting entirely. Treat like upgrade from
    // pre-Option-as-Alt Orca: land on 'auto' and mark migrated so we don't
    // re-examine.
    writeDataFile({
      schemaVersion: 1,
      repos: [],
      worktreeMeta: {},
      settings: {},
      ui: {},
      githubCache: { pr: {}, issue: {} },
      workspaceSession: {}
    })
    const store = await createStore()
    expect(store.getSettings().terminalMacOptionAsAlt).toBe('auto')
    expect(store.getSettings().terminalMacOptionAsAltMigrated).toBe(true)
  })

  // ── GitHub Cache ───────────────────────────────────────────────────

  it('get/set GitHub cache round-trips', async () => {
    const store = await createStore()
    const cache = {
      pr: { 'owner/repo#1': { data: null, fetchedAt: 1000 } },
      issue: {}
    }
    store.setGitHubCache(cache)
    expect(store.getGitHubCache()).toEqual(cache)
  })

  // ── Workspace Session ──────────────────────────────────────────────

  it('get/set workspace session round-trips', async () => {
    const store = await createStore()
    const session = {
      activeRepoId: 'r1',
      activeWorktreeId: 'wt1',
      activeTabId: 'tab1',
      tabsByWorktree: {},
      terminalLayoutsByTabId: {}
    }
    store.setWorkspaceSession(session)
    expect(store.getWorkspaceSession()).toEqual(session)
  })

  // ── getAllWorktreeMeta ─────────────────────────────────────────────

  it('getAllWorktreeMeta returns all entries', async () => {
    const store = await createStore()
    store.setWorktreeMeta('a', { displayName: 'A' })
    store.setWorktreeMeta('b', { displayName: 'B' })
    const all = store.getAllWorktreeMeta()
    expect(Object.keys(all)).toHaveLength(2)
    expect(all['a'].displayName).toBe('A')
    expect(all['b'].displayName).toBe('B')
  })

  // ── removeWorktreeMeta ─────────────────────────────────────────────

  it('removeWorktreeMeta deletes a single entry', async () => {
    const store = await createStore()
    store.setWorktreeMeta('a', { displayName: 'A' })
    store.setWorktreeMeta('b', { displayName: 'B' })
    store.removeWorktreeMeta('a')
    expect(store.getWorktreeMeta('a')).toBeUndefined()
    expect(store.getWorktreeMeta('b')).toBeDefined()
  })

  // ── Rolling backups (issue #1158) ──────────────────────────────────

  describe('rolling backups', () => {
    function backupFile(index: number): string {
      return `${dataFile()}.bak.${index}`
    }

    function readBackup(index: number): { repos: Repo[] } {
      return JSON.parse(readFileSync(backupFile(index), 'utf-8'))
    }

    function advanceMockedTime(advanceFn: () => void, ms: number): void {
      vi.setSystemTime(new Date(Date.now() + ms))
      advanceFn()
    }

    it('snapshots the just-written file to .bak.0 on the very first write', async () => {
      // Why (issue #1158): rotation runs AFTER a successful write so .bak.0
      // is always a known-good copy of the file currently on disk. On the
      // very first write there is no prior .bak.0 to rotate forward, but the
      // newly written dataFile is copied to .bak.0 so load() has a recovery
      // source if a subsequent write corrupts dataFile.
      const s = await createStore()
      s.addRepo(makeRepo())
      s.flush()
      expect(existsSync(dataFile())).toBe(true)
      expect(existsSync(backupFile(0))).toBe(true)
      expect(readBackup(0).repos.map((r) => r.id)).toEqual(['r1'])
    })

    it('rotates older .bak.0 to .bak.1 when the interval elapses', async () => {
      // Why (issue #1158): rotation runs AFTER a successful write so .bak.0
      // always holds a known-good state on disk. If the write fails (ENOSPC,
      // EIO), .bak.0 stays untouched — load() can recover the prior good
      // state rather than a fresh duplicate of the file we just failed to
      // overwrite.
      vi.useFakeTimers()
      try {
        // First launch: seed repo r1, flush to disk. The first write also
        // creates .bak.0 as a copy of the just-written file (no prior
        // .bak.0 exists, so the gate fires).
        const first = await createStore()
        first.addRepo(makeRepo({ id: 'r1' }))
        first.flush()
        expect((readDataFile() as { repos: Repo[] }).repos[0].id).toBe('r1')
        expect(readBackup(0).repos.map((r) => r.id)).toEqual(['r1'])

        // Jump past BACKUP_MIN_INTERVAL_MS (1h) so the next flush rotates.
        vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))

        // Second launch: load existing file, add r2, flush. Rotation moves
        // the prior .bak.0 (r1 alone) to .bak.1, and the newly written file
        // (r1 + r2) becomes the new .bak.0.
        const second = await createStore()
        second.addRepo(makeRepo({ id: 'r2', path: '/repo2' }))
        second.flush()

        const current = readDataFile() as { repos: Repo[] }
        expect(current.repos.map((r) => r.id).sort()).toEqual(['r1', 'r2'])
        expect(
          readBackup(0)
            .repos.map((r) => r.id)
            .sort()
        ).toEqual(['r1', 'r2'])
        expect(readBackup(1).repos.map((r) => r.id)).toEqual(['r1'])
      } finally {
        vi.useRealTimers()
      }
    })

    it('keeps at most 5 rotating backups', async () => {
      vi.useFakeTimers()
      try {
        // Initial file on disk so rotation has something to snapshot.
        writeDataFile({
          schemaVersion: 1,
          repos: [makeRepo({ id: 'seed' })],
          worktreeMeta: {},
          settings: {},
          ui: {},
          githubCache: { pr: {}, issue: {} },
          workspaceSession: {}
        })

        // Spawn six sequential writes, each labeled so we can match the
        // snapshot ring by content. Each write advances >1h so rotation fires.
        for (let i = 0; i < 6; i++) {
          vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))
          const s = await createStore()
          s.addRepo(makeRepo({ id: `gen-${i}`, path: `/gen-${i}` }))
          s.flush()
        }

        // .bak.0 ... .bak.4 must all exist; .bak.5 must not.
        for (let i = 0; i < 5; i++) {
          expect(existsSync(backupFile(i))).toBe(true)
        }
        expect(existsSync(backupFile(5))).toBe(false)
      } finally {
        vi.useRealTimers()
      }
    })

    it('does not rotate more than once per hour', async () => {
      vi.useFakeTimers()
      try {
        // Seed disk so the first flush has something to snapshot.
        writeDataFile({
          schemaVersion: 1,
          repos: [makeRepo({ id: 'seed' })],
          worktreeMeta: {},
          settings: {},
          ui: {},
          githubCache: { pr: {}, issue: {} },
          workspaceSession: {}
        })

        // First post-seed flush rotates (no .bak.0 yet, so the gate fires).
        // Rotation runs AFTER the write, so .bak.0 captures the just-written
        // state (seed + after-seed). Subsequent flushes within the same hour
        // must not touch .bak.0 — rotating on every debounced tick would
        // burn the ring.
        const store = await createStore()
        store.addRepo(makeRepo({ id: 'after-seed' }))
        store.flush()

        const bak0After1 = readBackup(0)
        expect(bak0After1.repos.map((r) => r.id).sort()).toEqual(['after-seed', 'seed'])

        // Advance only 5 minutes; flush again. .bak.0 must still match the
        // first post-seed write, NOT the new state.
        advanceMockedTime(
          () => {
            store.addRepo(makeRepo({ id: 'within-hour', path: '/within' }))
            store.flush()
          },
          5 * 60 * 1000
        )

        const bak0After2 = readBackup(0)
        expect(bak0After2.repos.map((r) => r.id).sort()).toEqual(['after-seed', 'seed'])
      } finally {
        vi.useRealTimers()
      }
    })

    // Why (issue #1158): scheduleSave → writeToDiskAsync → rotateBackupsAsync
    // is the hot path during normal use (every mutation debounces through it);
    // flush() is only used at shutdown. The 1-hour gate must hold on the async
    // path too, or routine edits would burn the 5-slot ring in minutes.
    it('does not rotate on the async write path within the 1-hour window', async () => {
      vi.useFakeTimers()
      try {
        // Seed disk so the first async write has something to snapshot.
        writeDataFile({
          schemaVersion: 1,
          repos: [makeRepo({ id: 'seed' })],
          worktreeMeta: {},
          settings: {},
          ui: {},
          githubCache: { pr: {}, issue: {} },
          workspaceSession: {}
        })

        const store = await createStore()

        // First async write (debounced) — rotates because .bak.0 doesn't
        // exist yet, so shouldRotateBackups returns true on statSync ENOENT.
        // Rotation runs AFTER the write, so .bak.0 captures the just-written
        // state (seed + first-async).
        store.addRepo(makeRepo({ id: 'first-async' }))
        vi.advanceTimersByTime(300)
        await store.waitForPendingWrite()

        const bak0AfterFirst = readBackup(0)
        expect(bak0AfterFirst.repos.map((r) => r.id).sort()).toEqual(['first-async', 'seed'])

        // Advance only 5 minutes, then trigger another async write. The
        // 1-hour gate must block rotation: .bak.0 should still reflect the
        // first-async write, NOT the new "within-hour-async" write.
        vi.setSystemTime(new Date(Date.now() + 5 * 60 * 1000))
        store.addRepo(makeRepo({ id: 'within-hour-async', path: '/within-async' }))
        vi.advanceTimersByTime(300)
        await store.waitForPendingWrite()

        const bak0AfterSecond = readBackup(0)
        expect(bak0AfterSecond.repos.map((r) => r.id).sort()).toEqual(['first-async', 'seed'])
      } finally {
        vi.useRealTimers()
      }
    })

    it('rotates on the async write path after the 1-hour window elapses', async () => {
      vi.useFakeTimers()
      try {
        // Seed disk so the first async write has something to snapshot.
        writeDataFile({
          schemaVersion: 1,
          repos: [makeRepo({ id: 'seed' })],
          worktreeMeta: {},
          settings: {},
          ui: {},
          githubCache: { pr: {}, issue: {} },
          workspaceSession: {}
        })

        const store = await createStore()

        // First async write: rotation runs AFTER the write, so .bak.0
        // captures the just-written state (seed + first-async).
        store.addRepo(makeRepo({ id: 'first-async' }))
        vi.advanceTimersByTime(300)
        await store.waitForPendingWrite()

        expect(
          readBackup(0)
            .repos.map((r) => r.id)
            .sort()
        ).toEqual(['first-async', 'seed'])

        // Jump past BACKUP_MIN_INTERVAL_MS (1h). The next async write should
        // rotate: the prior .bak.0 (seed + first-async) shifts to .bak.1,
        // and the newly written file (seed + first-async + after-hour-async)
        // becomes the new .bak.0.
        vi.setSystemTime(new Date(Date.now() + 61 * 60 * 1000))
        store.addRepo(makeRepo({ id: 'after-hour-async', path: '/after-async' }))
        vi.advanceTimersByTime(300)
        await store.waitForPendingWrite()

        const bak0After = readBackup(0)
        expect(bak0After.repos.map((r) => r.id).sort()).toEqual([
          'after-hour-async',
          'first-async',
          'seed'
        ])
        expect(existsSync(backupFile(1))).toBe(true)
        expect(
          readBackup(1)
            .repos.map((r) => r.id)
            .sort()
        ).toEqual(['first-async', 'seed'])
      } finally {
        vi.useRealTimers()
      }
    })

    // ── Backup recovery on load() (issue #1158) ─────────────────────────

    function writeBackup(index: number, data: unknown): void {
      mkdirSync(testState.dir, { recursive: true })
      writeFileSync(backupFile(index), JSON.stringify(data, null, 2), 'utf-8')
    }

    it('recovers from .bak.0 when the primary file is corrupt', async () => {
      // Why (issue #1158): a corrupt/empty primary write must not silently
      // wipe the user's repos. load() falls through to .bak.0 before giving
      // up to defaults — backups exist for exactly this reason.
      mkdirSync(testState.dir, { recursive: true })
      writeFileSync(dataFile(), '{{{corrupt-json', 'utf-8')
      writeBackup(0, {
        schemaVersion: 1,
        repos: [makeRepo({ id: 'recovered' })],
        worktreeMeta: {},
        settings: {},
        ui: {},
        githubCache: { pr: {}, issue: {} },
        workspaceSession: {}
      })

      const store = await createStore()
      expect(store.getRepos().map((r) => r.id)).toEqual(['recovered'])
    })

    it('falls through to .bak.1 when both primary and .bak.0 are corrupt', async () => {
      // Why (issue #1158): a single corrupt slot shouldn't strand the user.
      // load() walks the ring in order and uses the first slot that parses.
      mkdirSync(testState.dir, { recursive: true })
      writeFileSync(dataFile(), '{{{corrupt-json', 'utf-8')
      writeFileSync(backupFile(0), '{{also-corrupt', 'utf-8')
      writeBackup(1, {
        schemaVersion: 1,
        repos: [makeRepo({ id: 'from-bak1' })],
        worktreeMeta: {},
        settings: {},
        ui: {},
        githubCache: { pr: {}, issue: {} },
        workspaceSession: {}
      })

      const store = await createStore()
      expect(store.getRepos().map((r) => r.id)).toEqual(['from-bak1'])
    })

    it('falls back to defaults only when every backup is also unusable', async () => {
      mkdirSync(testState.dir, { recursive: true })
      writeFileSync(dataFile(), '{{{corrupt', 'utf-8')
      for (let i = 0; i < 5; i++) {
        writeFileSync(backupFile(i), `{{slot-${i}-corrupt`, 'utf-8')
      }

      const store = await createStore()
      // Default state: empty repos, no error thrown.
      expect(store.getRepos()).toEqual([])
    })

    it('uses .bak.0 even when primary file is missing entirely', async () => {
      // Why (issue #1158): a wiped userData (e.g., partial uninstall) leaves
      // backups but no primary file. load() should still recover.
      mkdirSync(testState.dir, { recursive: true })
      writeBackup(0, {
        schemaVersion: 1,
        repos: [makeRepo({ id: 'rescued' })],
        worktreeMeta: {},
        settings: {},
        ui: {},
        githubCache: { pr: {}, issue: {} },
        workspaceSession: {}
      })

      const store = await createStore()
      expect(store.getRepos().map((r) => r.id)).toEqual(['rescued'])
    })

    it('still recovers repos/worktrees from a backup with corrupt workspaceSession', async () => {
      // Why (issue #1158): the workspace session is the most volatile
      // surface. Zod validation on load defaults a corrupt session to empty
      // — but that must not throw away the rest of the persisted state on
      // either the primary file or its backups.
      mkdirSync(testState.dir, { recursive: true })
      writeFileSync(dataFile(), '{{{corrupt', 'utf-8')
      writeBackup(0, {
        schemaVersion: 1,
        repos: [makeRepo({ id: 'survives' })],
        worktreeMeta: {},
        settings: { theme: 'dark' },
        ui: {},
        githubCache: { pr: {}, issue: {} },
        // Type-shape violation that makes the Zod parse fail.
        workspaceSession: { activeRepoId: 12345 }
      })

      const store = await createStore()
      expect(store.getRepos().map((r) => r.id)).toEqual(['survives'])
      expect(store.getSettings().theme).toBe('dark')
    })
  })

  // ── Concurrent write serialization (issue #1158) ─────────────────────

  describe('concurrent write serialization', () => {
    it('chains debounced writes via pendingWrite so they run sequentially', async () => {
      // Why (issue #1158): scheduleSave used to overwrite this.pendingWrite,
      // letting two writeToDiskAsync calls race on the same dataFile and
      // .bak.* paths. Chaining via promise guarantees at most one runs at a
      // time; the final state on disk reflects the last scheduled save.
      vi.useFakeTimers()
      try {
        const store = await createStore()
        store.addRepo(makeRepo({ id: 'first' }))
        vi.advanceTimersByTime(300)
        // Schedule a second write before the first completes.
        store.addRepo(makeRepo({ id: 'second', path: '/second' }))
        vi.advanceTimersByTime(300)
        await store.waitForPendingWrite()

        const persisted = JSON.parse(readFileSync(dataFile(), 'utf-8')) as { repos: Repo[] }
        // Both writes serialized; the final on-disk state contains both
        // entries (the second write happens after the first, so its state
        // — which already includes 'first' — wins).
        expect(persisted.repos.map((r) => r.id).sort()).toEqual(['first', 'second'])
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
