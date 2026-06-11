# Project-First Host Model Handoff

## What We Discussed

We started from the multi-host / VM / SSH work that made machines visible in
the sidebar. That model is useful operationally:

```text
Host
  Project
    Workspace
```

It answers questions like which host is online, where a workspace is running,
and whether an SSH target is disconnected. But as the default durable product
model, it makes Orca feel like the user is switching between machine silos.

The direction we converged on is project-first:

```text
Project
  Host setup
    Workspace
```

In plain English: a host is a place where a project can run. The host should not
usually be the object that owns the user's project.

## Decision

Move Orca toward this durable model:

```text
Project -> ProjectHostSetup -> Workspace
```

Where:

- `Project` is the durable repo/project identity the user recognizes.
- `Host` is a local Mac, SSH target, remote runtime, VM, remote server, or
  future Orca-provisioned cloud VM.
- `ProjectHostSetup` means "this project is available on this host at this
  path, with this setup state and host-specific settings."
- `Workspace` is a branch/task/worktree running from one project setup on one
  host.

This model handles local-only projects, remote-only projects, Linux-only
projects, GPU-only projects, work-machine-only projects, and future cloud VMs
without changing the user's primary mental model.

## Superset Comparison

Superset is the closer reference for Orca's desired data model.

The relevant Superset shape is:

```text
Project + Host -> Workspace
```

Lessons for Orca:

- Project identity is durable.
- A host is where a project can be materialized.
- Workspace creation targets both a project and a host.
- The same project can be set up on multiple hosts.
- If the project is not available on a host, creation can block and offer setup.
- Project settings can include host-specific location and worktree settings.

That maps well to Orca because Orca already has projects/repos, worktrees,
agents, terminals, source control, and host-aware runtime routing.

## Cmux Comparison

Cmux is more session/workspace-first than project-first.

The relevant Cmux shape is closer to:

```text
Workspace/session -> local or remote execution context
```

Lessons for Orca:

- SSH should feel first class.
- Remote terminals, file views, browser panes, and localhost routing should
  follow the remote execution context.
- Reconnect and persistence behavior matter.
- Cmux is a useful reference for SSH/session polish, not for Orca's durable
  project/setup data model.

## UX Direction

### Sidebar

The default long-term sidebar should be project-first.

For a single-host project, avoid noisy host nesting:

```text
Orca
  feature-a
  feature-b
```

For a multi-host project, show host context only where it helps:

```text
Orca
  Local Mac
    feature-a
  openclaw 2
    fix-ssh-agent-status
```

Host-first grouping can remain as a filter or operational view. It is valuable
for seeing online/offline state and troubleshooting, but it should not be the
only durable organization model.

Disconnected host behavior should distinguish configured hosts from relevant
project hosts:

- Show a disconnected host when it has setup history or workspaces for the
  current project.
- Do not show a never-used SSH target in the project sidebar just because it is
  configured.
- Use clear disconnected wording/actions instead of only a gray status dot.

### Workspace Creation

Creating a workspace should ask:

1. Which project?
2. Which host should run it?
3. What branch/task/workspace name?

If the project is not set up on the selected host, Orca should offer:

- clone the project to that host
- import an existing folder on that host
- select a different host

The user should not need to understand compatibility repo ids.

### Project Setup

"Add project" and "make this project available on another host" are related but
different actions.

Important flows:

- import a local folder as a new project
- import an SSH folder as a new project
- set up an existing project on another host
- clone an existing project onto a selected host
- when adding a new host, optionally initialize one or more projects there
- later, provision an Orca cloud VM and materialize selected projects there

### Settings

Settings need explicit ownership:

| Setting type | Owner | Examples |
| --- | --- | --- |
| Client setting | desktop client | theme, local UI preferences |
| Host setting | machine/runtime | SSH connection, display name, health, server version |
| Project setting | durable project | project name, provider identity |
| Project-host setup setting | project on one host | checkout path, worktree base path, setup script |

A host dropdown or host table inside project settings is likely enough for
host-specific project settings, similar to existing Windows/WSL-specific
settings patterns.

## How Many Things Need To Change?

The short answer is: **12 major change surfaces** need to fit the new model.

Some are already partially implemented on this branch. The model is only
complete when all 12 speak the same project-first language.

## The 12 Change Surfaces

### 1. Shared Data Model

`Repo` currently mixes durable project identity with host-local checkout facts.

Needs:

- first-class `Project`
- first-class `Host`
- first-class `ProjectHostSetup`
- explicit workspace ownership by `projectId`, `hostId`, and
  `projectHostSetupId`
- repo-shaped compatibility projection while older APIs remain

Status: partially implemented.

### 2. Persistence And Migration

Existing users need a boring migration.

Needs:

- derive one project per reliable durable identity
- derive one host setup per existing repo checkout
- avoid merging same-name folders unless provider/setup identity is reliable
- preserve old ids or aliases where compatibility requires it
- backfill existing workspaces with project/setup ownership when safe

Status: partially implemented.

### 3. Runtime And Request Ownership

The UI can be project-first, but execution still happens on a host.

Needs:

- route terminals, agents, filesystem, browser, source control, hooks, and
  automations through the workspace's owning host
- avoid using the currently focused host as a hidden global default for
  workspace-owned operations
- scope cancellation and stale-response handling to the host/setup that owns the
  request

Status: partially implemented by multi-host groundwork; still needs an audit.

### 4. Workspace Creation

Creation must target a project and host, not just a repo id.

Needs:

- project picker
- run-on host picker
- unavailable-host reasons
- inline clone/import setup actions
- compatibility resolver from `{ projectId, hostId }` to current repo/setup
  internals while old APIs remain

Status: partially implemented. Ready setups and setup-target rows exist in the
composer; inline import exists; inline clone is wired for local, runtime, and
SSH hosts; provisioning remains.

### 5. Project Setup Flow

"Add repo" becomes a family of project/setup flows.

Needs:

- import existing folder on local host
- import existing folder over SSH
- clone project onto selected host
- set up an existing project on another host
- bulk setup when adding a new host
- future cloud provisioning hook

Status: existing-folder setup is partially implemented; clone-on-host is wired
for local/runtime/SSH from the composer; provisioning and bulk setup remain.

### 6. Sidebar Row Model

The sidebar should be built from projects, hosts, setups, and workspaces.

Needs:

- project-first grouping
- host labels/subgroups only when useful
- host filters and online/offline status retained
- clear disconnected-host behavior
- drag/reorder rules for projects, host sections, and workspaces

Status: partially implemented. Default all-host Projects view keeps projects
outermost; mixed-host cards show host context; disconnected-host polish remains.

### 7. Project Settings

Project settings need a global area plus host-specific setup sections.

Needs:

- project-global settings
- host-specific paths, worktree paths, setup scripts, and platform constraints
- host dropdown/table inside settings
- provider-neutral source-control settings

Status: in progress. Available-hosts and setup-specific navigation exist; full
ownership split remains.

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

Status: multi-host settings groundwork exists; needs alignment with
project-host setup settings.

### 9. Version And Capability Compatibility

New clients and old servers will coexist.

Needs:

- host capability probing
- fallback projection when project/setup APIs are missing
- disabled states with specific reasons
- structured errors for unsupported old-server actions
- old client / new server behavior that degrades safely

Status: runtime compatibility exists. Runtimes advertise
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

Status: partially addressed for host partitioning; needs a project/setup audit.

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

Status: partially implemented.

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

Status: model/API tests exist; full end-to-end UI, SSH, and version-skew
validation remain.

## Implementation Shape

Use an additive migration:

1. Keep existing `Repo` APIs alive while adding project/setup records.
2. Use conservative identity matching so only reliably linked checkouts merge
   into one project.
3. Teach creation flows to resolve `{ projectId, hostId }` into the current
   backend through a ready setup.
4. Add setup-on-host flows for local, SSH, runtime, and future cloud hosts.
5. Split settings into client, host, project, and project-host setup ownership.
6. Audit host-local caches and runtime routing.
7. Move visible default UX to project-first once behavior is real.
8. Preserve a host-first operational view/filter for troubleshooting.
9. Validate migration, creation, settings, sidebar, SSH, and version skew before
   calling the model complete.

## Current Branch Status

Already partially landed:

- shared `Project` and `ProjectHostSetup` types
- compatibility projection from existing `Repo[]`
- persisted compatibility fields for projects and project-host setups
- renderer hydration and fallback for older runtimes
- project-aware sidebar grouping in existing repo grouping paths
- default all-host Projects sidebar keeps projects outermost
- host context badges for mixed-host project groups
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
- inline import-existing-folder setup from the composer
- inline clone setup from the composer for not-yet-set-up local, runtime, and
  SSH hosts
- repo-backed setup method metadata for imported/cloned project-host setups
- project-host setup runtime capability advertisement, read fallback, and
  remote mutation gating for older runtime servers
- persistence merge that preserves independently persisted project/setup rows
  across load, repo updates, and repo reorders while refreshing repo-backed
  compatibility rows from repos
- first-class `projectHostSetup.update` mutation through local IPC, preload,
  runtime RPC, and CLI for setup-owned metadata
- first-class `projectHostSetup.delete` mutation through local IPC, preload,
  runtime RPC, and CLI

Still needed:

- finish SSH clone streamed-progress parity and provisioning flows
- first-class independent project-host setup creation/provisioning APIs beyond
  the current repo-backed import/clone compatibility paths
- bulk setup flows and setup for newly added hosts
- project settings split into global and host-specific ownership
- host settings/capability UI aligned with project setup
- complete cache/request ownership audit
- broader UI/CLI version-skew validation beyond the runtime capability guard
- full Electron and SSH end-to-end validation

## Final Product Position

Keep hosts visible, but do not make them the durable outermost object.

Projects should be the top-level user concept. Hosts, VMs, SSH targets, remote
servers, and future Orca cloud machines are places where a project can be set up
and where a workspace can run.
