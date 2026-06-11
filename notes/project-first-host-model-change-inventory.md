# Project-First Host Model Discussion And Change Inventory

## Purpose

This note summarizes the VM / SSH / remote-host discussion so far and turns it
into an implementation inventory.

The core question was whether Orca should treat machines as the outermost unit:

```text
Host
  Project
    Workspace
```

or whether machines should be places where a project can run:

```text
Project
  Host setup
    Workspace
```

The current product direction is the second model.

## Short Answer

The durable model should be:

```text
Project -> ProjectHostSetup -> Workspace
```

Where:

- `Project` is the durable repo/project identity the user recognizes.
- `Host` is a local Mac, SSH target, remote runtime, VM, remote server, or
  future Orca cloud VM.
- `ProjectHostSetup` means "this project is available on this host at this
  path, with this setup state and host-specific settings."
- `Workspace` is a branch/task/worktree running from one setup on one host.

The short implementation count is: **12 major things need to change**.

Some of those are already partially implemented on this branch, but the full
end-to-end model is not done until creation, setup, settings, sidebar, routing,
compatibility, CLI, and validation all speak the same project-first language.

## Discussion So Far

### Why Host-First Is Not Enough

The host-first sidebar work is still useful. It makes it easy to see:

- which hosts exist
- which hosts are online or disconnected
- where workspaces are currently running
- which SSH or remote machine might be causing a problem

But as the default mental model, host-first can make Orca feel like the user is
switching into separate machine silos. That is not the best fit for how users
usually think about repo/worktree/task work. Users usually think "I am working
on Orca" first, then "I want this workspace to run locally or on a VM."

### Desired Mental Model

Projects/repos remain the outermost concept. Hosts are compute locations for a
project.

For a simple local-only user, Orca should still feel mostly unchanged:

```text
Orca
  feature-a
  feature-b
```

For a project that spans multiple hosts, host context should appear only where
it helps:

```text
Orca
  Local Mac
    feature-a
  openclaw 2
    fix-ssh-agent-status
```

A project can also exist only on a remote host:

```text
Linux-only Project
  GPU VM
    cuda-build-fix
```

That should be treated as normal, not as a degraded state.

### VMs, SSH, Remote Servers, And Cloud

For product/model purposes, VM is a loose term. A VM can be:

- an SSH machine
- a remote server
- a future Orca-provisioned cloud host
- a user-managed local or remote machine

The important abstraction is `Host`. Cloud VM support can later add provisioning
and billing metadata to the host/setup flow without changing the workspace
model.

### Focused Host Mode

Focused host mode is not a separate durable model. It is effectively a filter or
operational view. Selecting "Local Mac" can satisfy the same need when the user
wants to focus on local work.

Recommendation:

- keep host focus/filtering as a view affordance
- do not make it the primary data model
- hide or reduce host UI when there is only one host and no useful host choice

### Sidebar Behavior

Host visibility is still important, but the sidebar should avoid unnecessary
noise.

Suggested behavior:

- Single-host project: show the project and workspaces without a host subgroup.
- Multi-host project: show host labels or host subgroups.
- Disconnected host with existing workspaces/setup history: show it with a clear
  disconnected state and actionable wording.
- Never-connected SSH target with no project setup/workspaces: do not show it in
  the project sidebar just because it exists in connection settings.
- Host-first grouping can remain as an alternate operational view/filter.

This distinction matters because a configured SSH target is not the same as a
project being available on that host.

### Workspace Creation

Creating a workspace should eventually ask:

1. Which project?
2. Which host should run it?
3. What branch/task/workspace name?

If the project is not set up on the selected host, Orca should offer:

- clone project to that host
- import an existing folder on that host
- select a different host

The user should not have to understand repo compatibility records or old
`repoId` routing.

### Project Setup

"Add project" and "make this project available on another host" are different
actions.

Important flows:

- import a local folder as a new project
- import an SSH folder as a new project
- set up an existing project on another host
- clone an existing project onto a selected host
- when adding a new host, optionally initialize one or more projects there
- later, provision an Orca cloud VM and materialize selected projects there

### Settings

Settings need explicit ownership:

- Client settings belong to the desktop client.
- Host settings belong to a machine/runtime.
- Project settings belong to the durable project.
- Project-host setup settings belong to that project on that host.

A host dropdown or host table inside project settings is probably enough for
host-specific project settings, similar to existing Windows/WSL-specific
settings patterns.

Examples:

- app theme: client setting
- SSH connection details: host setting
- project display name/provider identity: project setting
- checkout path on `openclaw 2`: project-host setup setting
- worktree base path on local Mac: project-host setup setting

### Version Skew

Remote servers may not always match the desktop client version.

The model needs capability checks so a new client can talk to an old server
without pretending unsupported features exist. UI should disable setup/create
actions with specific reasons such as:

- host is offline
- server version does not support project-host setup APIs
- project is not set up on this host
- selected host does not support required platform/capability
- required agent/runtime is unavailable

Old client / new server should continue to work through repo/worktree
compatibility APIs where possible.

## Reference Comparison

### Superset

Superset is the closer reference for Orca's desired data model.

Its model is effectively:

```text
Project + Host -> Workspace
```

Specific lessons for Orca:

- Project identity is durable.
- A host is where the project can be materialized.
- Workspace creation targets both project and host.
- A project can be set up on multiple hosts.
- If a project is not available on a host, the UI can block and offer setup.
- Project settings can contain host-specific path/worktree settings.

This maps well to Orca because Orca already has durable repos/projects,
worktrees, agents, terminals, source control, and host-aware runtimes.

### Cmux

Cmux is more session/workspace-first.

Its model is closer to:

```text
Workspace/session -> local or remote execution context
```

Specific lessons for Orca:

- SSH should feel first class.
- Remote terminals, file views, browser panes, and localhost routing should
  follow the remote execution context.
- Reconnect and persistence behavior matter.
- Cmux is useful for SSH/session polish, but it is not the best reference for
  Orca's durable project/setup data model.

## What Needs To Change

There are **12 major change surfaces**.

### 1. Shared Data Model

Current `Repo` mixes durable project identity with host-local checkout details.
The new model needs first-class project/setup concepts.

Needs:

- `Project`
- `Host`
- `ProjectHostSetup`
- explicit workspace ownership by `projectId`, `hostId`, and
  `projectHostSetupId`
- compatibility projection from old repo-shaped records

Current branch status: partially implemented.

### 2. Persistence And Migration

Existing users need a boring migration.

Needs:

- derive one project per reliable durable identity
- derive one setup per existing repo checkout
- avoid merging same-name folders unless provider identity is reliable
- preserve old ids or aliases where compatibility requires it
- backfill existing workspaces with project/setup ownership when safe

Current branch status: partially implemented.

### 3. Runtime And Request Ownership

The UI can be project-first, but execution still happens on a host.

Needs:

- route terminals, agents, filesystem, browser, source control, hooks, and
  automations through the workspace's owning host
- avoid using the currently focused host as a hidden global default for
  workspace-owned operations
- scope cancellation and stale-response handling to the host/setup that owns the
  request

Current branch status: partially implemented by multi-host groundwork; still
needs a project/setup audit.

### 4. Workspace Creation

Creation must target a project and host, not only a repo id.

Needs:

- project picker
- run-on host picker
- unavailable-host reasons
- inline clone/import setup actions
- compatibility resolver from `{ projectId, hostId }` to current repo/setup
  internals while old APIs remain

Current branch status: partially implemented. Ready project-host setups can be
selected from the composer `Run on` menu, and known hosts that still need setup
now appear as setup-target rows instead of being invisible. The composer can
import an existing folder for those hosts and can clone onto local, runtime, and
SSH hosts, then switch to the new ready setup. Provisioning actions are still
missing.

### 5. Project Setup Flow

"Add repo" becomes a family of project/setup flows.

Needs:

- import existing folder on local host
- import existing folder over SSH
- clone project onto selected host
- set up an existing project on another host
- bulk setup when adding a new host
- future cloud provisioning hook

Current branch status: existing-folder setup is partially implemented through
API/CLI plumbing and a project settings import form for known local, SSH, and
active runtime hosts. Composer clone setup is implemented for local/runtime
hosts by composing the existing clone APIs with existing-folder setup; SSH clone
uses the relay git provider, propagates abort to the relay request, cleans up
only fresh clone targets, and then links the cloned path. Provisioning, bulk
setup, and streamed SSH clone progress are not complete.

### 6. Sidebar Row Model

The sidebar should be built from projects, hosts, setups, and workspaces rather
than repo-only grouping.

Needs:

- project-first grouping
- host labels/subgroups only when useful
- host filters and online/offline status retained
- clear disconnected-host behavior
- drag/reorder rules for projects, host sections, and workspaces

Current branch status: project grouping exists for durable project/setup
identity, and the default all-host Projects view now keeps project grouping
outermost. Host headers remain for explicit host visibility filters and
operational grouping modes. Mixed-host project groups now show first-pass host
context badges on workspace cards, while single-host project groups omit them.
Electron validation and disconnected-host polish remain.

### 7. Project Settings

Project settings need a global area plus host-specific setup sections.

Needs:

- project-global settings
- host-specific paths, worktree paths, setup scripts, and platform constraints
- host dropdown/table inside settings
- provider-neutral source-control settings

Current branch status: in progress. Project settings now include an
available-hosts table, navigation between setup-specific settings panes, and an
existing-folder import form. The full ownership split is not complete.

### 8. Host Settings

Host settings should describe the machine/runtime, not duplicate every project
setting.

Needs:

- connection details
- display name
- health/status
- server version and protocol compatibility
- platform/capabilities
- host-wide defaults and overrides

Current branch status: multi-host settings groundwork exists; needs to align
with project-host setup settings.

### 9. Version And Capability Compatibility

New clients and old servers will coexist.

Needs:

- host capability probing
- fallback projection when project/setup APIs are missing
- disabled states with specific reasons
- structured errors for unsupported old-server actions
- old client / new server behavior that degrades safely

Current branch status: runtime compatibility exists. Runtimes now advertise
`project-host-setup.v1`; renderer reads fall back to repo-derived projection
when the capability is missing, and remote setup/clone mutations are blocked
before contacting older servers. Broader UI/CLI version-skew validation remains.

### 10. Caches And Local State

Some caches are project-global; many are host/setup-local.

Needs:

- classify caches as project, host, setup, or workspace scoped
- include host/setup ids in cache keys for refs, git status, filesystem state,
  capabilities, terminals, browser sessions, and remote results
- prevent a response from one host from overwriting another host's state for the
  same project

Current branch status: partially addressed for host partitioning; needs a
project/setup ownership audit.

### 11. CLI And API

External commands should speak project-first language.

Needs:

- `orca project list`
- `orca project setups`
- `orca project setup-existing-folder --project <id> --host <id> --path <path>`
- `orca worktree create --project <id> --host <id> ...`
- `orca worktree create --project-host-setup <id> ...`
- compatibility aliases for old repo/worktree commands
- structured availability errors

Current branch status: partially implemented.

### 12. Tests And Verification

This crosses storage, routing, UI, SSH, and compatibility.

Needs:

- migration tests
- selector/sidebar grouping tests
- create-workspace tests
- setup-on-host tests
- settings ownership tests
- SSH end-to-end validation
- version mismatch tests
- Electron validation for sidebar, creation, and settings

Current branch status: model/API tests exist; full end-to-end UI, SSH, and
version-skew validation remains.

## Implementation Status On This Branch

Already partially landed:

- shared `Project` and `ProjectHostSetup` types
- compatibility projection from existing `Repo[]`
- persisted compatibility fields for projects and project-host setups
- renderer hydration and fallback for older runtimes
- project-aware sidebar grouping in existing repo grouping paths
- default all-host Projects sidebar keeps projects outermost while preserving
  host-section operational views for explicit host filters
- first-pass host context badges for mixed-host project groups, without adding
  badge noise to single-host project groups
- project-host-aware workspace creation target resolver
- optional workspace metadata for `projectId`, `hostId`, and
  `projectHostSetupId`
- discovery-time backfill for missing workspace `projectId`, `hostId`, and
  `projectHostSetupId` on existing git and folder workspaces
- setup-existing-folder API plumbing through local IPC/preload/runtime paths
- project settings existing-folder setup form for known local, SSH, and active
  runtime hosts
- CLI commands for listing projects/setups and creating worktrees by
  project/setup
- composer `Run on` selector when a project has multiple ready setups
- setup-target `Run on` rows for known hosts where the selected project is not
  set up yet
- inline `Run on` import-existing-folder setup for known hosts where the
  selected project is not set up yet
- inline `Run on` clone setup for not-yet-set-up local, runtime, and SSH hosts
- repo-backed setup method metadata so imported/cloned setup methods survive
  compatibility projection and persistence sync
- project-host setup runtime capability advertisement, read fallback, and
  remote mutation gating for older runtime servers
- persistence merge that preserves independently persisted project/setup rows
  across load, repo updates, and repo reorders while refreshing repo-backed
  compatibility rows from repos
- first-class `projectHostSetup.update` mutation through local IPC, preload,
  runtime RPC, and CLI for setup-owned metadata
- first-class `projectHostSetup.delete` mutation through local IPC, preload,
  runtime RPC, and CLI

Not complete yet:

- SSH clone streamed-progress parity and provisioning flows
- first-class independent project-host setup creation/provisioning APIs beyond
  the current repo-backed import/clone compatibility paths
- bulk setup flows and setup for hosts that are not already known to the client
- project settings split into global and host-specific ownership
- host settings/capability UI aligned with project setup
- complete cache/request ownership audit
- broader UI/CLI version-skew validation beyond the runtime capability guard
- full Electron and SSH end-to-end validation

## Recommended Implementation Shape

Implement this as an additive migration.

1. Keep existing `Repo` APIs alive while adding project/setup records.
2. Use conservative identity matching so only reliably linked checkouts merge
   into one project.
3. Teach creation flows to resolve `{ projectId, hostId }` into the current
   backend through a ready setup.
4. Add setup-on-host flows for local and SSH.
5. Split settings into client, host, project, and project-host setup ownership.
6. Audit host-local caches and runtime routing.
7. Move visible default UX to project-first once behavior is real.
8. Preserve a host-first operational view/filter for troubleshooting.
9. Validate migration, creation, settings, sidebar, SSH, and version skew before
   calling the model complete.

## Final Position

Keep hosts visible, but do not make them the durable outermost object.

The durable model should be project-first because it better matches how users
think about repo/worktree/task work, while still supporting SSH machines, VMs,
remote servers, and future cloud compute as first-class places where a project
can run.
