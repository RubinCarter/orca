# Project-First Host Model Conversation

## Purpose

This document captures the VM / SSH / remote-server discussion so far and turns
it into a concrete change inventory.

The product question was:

```text
Should Orca organize work by machine first, or by project first?
```

The current answer is:

```text
Project -> ProjectHostSetup -> Workspace
```

Hosts still matter. They are where code runs. But they should usually be
represented as places where a project is available, not as isolated silos that
own the user's projects.

## TL;DR

The durable model should be project-first.

```text
Project
  Host setup
    Workspace
```

There are **12 major change surfaces** needed to fully fit this model.

If we count smaller implementation tasks inside those surfaces, it is closer to
**35-45 concrete changes**, but the clean planning answer is 12 major areas.

Some of the work is already partially implemented on this branch. The model is
not complete until data model, persistence, creation, setup, settings, sidebar,
runtime routing, cache ownership, CLI/API, version skew, SSH behavior, and
Electron validation all agree on the same project-first language.

## Current Model

The current multi-host direction makes hosts highly visible:

```text
Local Mac
  Orca
    feature-a

openclaw 2
  Orca
    fix-ssh-agent-status
```

That is useful for operational awareness. It helps answer:

- which hosts exist
- which hosts are online or disconnected
- where workspaces are running
- which SSH/remote machine might be causing a problem

The weakness is that it makes the machine feel like the outermost product
concept. Users can end up feeling like they are switching into separate machine
silos, even when they are really working on the same project.

## Desired Model

Projects/repos remain the outermost durable concept:

```text
Orca
  Local Mac
    feature-a
  openclaw 2
    fix-ssh-agent-status
```

In plain English:

```text
I am working on Project A.
Where should this workspace run?
```

not:

```text
I am inside Machine B.
Which copy of Project A is here?
```

## Core Concepts

### Project

A `Project` is the durable repo/project identity the user recognizes.

Examples:

- Orca
- a Linux-only CUDA repo
- a work repo available only on a company host
- a personal repo available both locally and on an SSH server

### Host

A `Host` is a place where code can run.

Examples:

- local Mac
- SSH target
- remote server
- user-managed VM
- remote Orca runtime
- future Orca-provisioned cloud VM

For now, "VM" is a loose product term. A VM can be modeled as a host with extra
capabilities, provisioning metadata, and eventually billing metadata.

### ProjectHostSetup

A `ProjectHostSetup` means:

```text
this project is available on this host at this path with this setup state
```

Host-local facts belong here:

- checkout path
- worktree base path
- setup status
- clone/import/provision method
- setup scripts
- host-specific project settings
- platform or capability constraints

### Workspace

A `Workspace` is a branch/task/worktree running from one project setup on one
host.

It should eventually know:

- `projectId`
- `hostId`
- `projectHostSetupId`
- host-local worktree path

## Important Product Decisions

### Host-First Is Still Useful

Host-first grouping should not disappear completely. It is a useful operational
view/filter for troubleshooting, host health, and remote machine management.

The important distinction is that host-first should be a view mode or filter,
not the only durable organization model.

### Focused Host Mode Is A Filter

Focused host mode is not a separate durable model.

Selecting "Local Mac" or another host as a filter can satisfy the same use case.
If there is only one host and no meaningful host choice, the host UI should be
reduced or hidden.

### Configured SSH Target Is Not Project Availability

A configured SSH target should not automatically appear under every project.

Recommended sidebar behavior:

- show a disconnected host when it has relevant project setup history or
  workspaces
- do not show a never-used SSH target in a project sidebar just because it is
  configured
- keep SSH connection management in host/settings surfaces
- use clear disconnected labels/actions instead of relying only on a gray dot

### A Remote-Only Project Is Normal

Some projects only exist on one machine. That is fine.

Examples:

- a Linux-only project
- a GPU-heavy project
- a work project only available on a work machine
- a repo checked out only on an SSH server

The UI should not imply that every project can or should run everywhere.

## Workspace Creation Direction

Creating a workspace should eventually ask:

1. Which project?
2. Which host should run it?
3. What branch/task/workspace name?

If the project is not available on the selected host, Orca should offer:

- clone project to that host
- import an existing folder on that host
- select a different host

The user should not need to understand old `repoId` compatibility records.

## Project Setup Direction

"Add project" and "make this project available on another host" are related but
different actions.

Important flows:

- import a local folder as a new project
- import an SSH folder as a new project
- set up an existing project on another host
- clone an existing project onto a selected host
- when adding a new host, optionally initialize one or more projects there
- later, provision an Orca cloud VM and materialize selected projects there

## Settings Direction

Settings need explicit ownership.

| Setting type | Owner | Examples |
| --- | --- | --- |
| Client setting | desktop client | theme, local UI preferences |
| Host setting | machine/runtime | SSH connection, display name, health, server version |
| Project setting | durable project | project name, provider identity |
| Project-host setup setting | project on one host | checkout path, worktree base path, setup script |

A host dropdown or host table inside project settings is probably sufficient for
host-specific project settings, similar to existing Windows/WSL-specific
settings patterns.

## Version Skew Direction

Remote servers may not match the desktop client version.

Needed behavior:

- new client + old server should degrade explicitly
- project/setup reads can fall back to compatibility projections where possible
- setup/create actions should be blocked before mutation if the server lacks
  the required capability
- old client + new server should keep working through compatibility APIs where
  possible

The user-facing reasons should be concrete:

- host is offline
- server version does not support project-host setup
- project is not set up on this host
- selected host does not support required platform/capability
- required runtime/agent is unavailable

## Reference Comparison

### Superset

Superset is the closer reference for Orca's desired data model.

Its conceptual model is effectively:

```text
Project + Host -> Workspace
```

Specific lessons for Orca:

- project identity is durable
- a host is where the project can be materialized
- workspace creation targets both project and host
- a project can be set up on multiple hosts
- if a project is not available on a host, the UI can block and offer setup
- project settings can contain host-specific path/worktree settings

This maps well to Orca because Orca already has durable repos/projects,
worktrees, agents, terminals, source control, and host-aware runtimes.

### Cmux

Cmux is more session/workspace-first.

Its conceptual model is closer to:

```text
Workspace/session -> local or remote execution context
```

Specific lessons for Orca:

- SSH should feel first class
- remote terminals, file views, browser panes, and localhost routing should
  follow the remote execution context
- reconnect and persistence behavior matter
- remote execution should not feel bolted on

Cmux is useful for SSH/session polish. It is less useful as the core durable
data model reference because it does not appear to center "this project is
available on these hosts" as the main object.

## What Needs To Change

There are **12 major change surfaces**.

### 1. Shared Data Model

Current `Repo` mixes durable project identity with host-local checkout details.
The new model needs first-class project/setup concepts.

Needed:

- `Project`
- `Host`
- `ProjectHostSetup`
- explicit workspace ownership by `projectId`, `hostId`, and
  `projectHostSetupId`
- compatibility projection from old repo-shaped records

### 2. Persistence And Migration

Existing users need a boring migration.

Needed:

- derive one project per reliable durable identity
- derive one setup per existing repo checkout
- avoid merging same-name folders unless provider/setup identity is reliable
- preserve old ids or aliases where compatibility requires it
- backfill existing workspaces with project/setup ownership when safe

### 3. Runtime And Request Ownership

The UI can be project-first, but execution still happens on a host.

Needed:

- route terminals, agents, filesystem, browser, source control, hooks, and
  automations through the workspace's owning host
- avoid using the currently focused host as a hidden global default for
  workspace-owned operations
- scope cancellation and stale-response handling to the host/setup that owns the
  request

### 4. Workspace Creation

Creation must target a project and host, not only a repo id.

Needed:

- project picker
- run-on host picker
- unavailable-host reasons
- inline clone/import setup actions
- compatibility resolver from `{ projectId, hostId }` to current repo/setup
  internals while old APIs remain

### 5. Project Setup Flow

"Add repo" becomes a family of project/setup flows.

Needed:

- import existing folder on local host
- import existing folder over SSH
- clone project onto selected host
- set up an existing project on another host
- bulk setup when adding a new host
- future cloud provisioning hook

### 6. Sidebar Row Model

The sidebar should be built from projects, hosts, setups, and workspaces rather
than repo-only grouping.

Needed:

- project-first grouping
- host labels/subgroups only when useful
- host filters and online/offline status retained
- clear disconnected-host behavior
- drag/reorder rules for projects, host sections, and workspaces

### 7. Project Settings

Project settings need a global area plus host-specific setup sections.

Needed:

- project-global settings
- host-specific paths, worktree paths, setup scripts, and platform constraints
- host dropdown/table inside settings
- provider-neutral source-control settings

### 8. Host Settings

Host settings should describe the machine/runtime, not duplicate every project
setting.

Needed:

- connection details
- display name
- health/status
- server version and protocol compatibility
- platform/capabilities
- host-wide defaults and overrides

### 9. Version And Capability Compatibility

New clients and old servers will coexist.

Needed:

- host capability probing
- fallback projection when project/setup APIs are missing
- disabled states with specific reasons
- structured errors for unsupported old-server actions
- old client / new server behavior that degrades safely

### 10. Caches And Local State

Some caches are project-global; many are host/setup-local.

Needed:

- classify caches as project, host, setup, or workspace scoped
- include host/setup ids in cache keys for refs, git status, filesystem state,
  capabilities, terminals, browser sessions, and remote results
- prevent a response from one host from overwriting another host's state for the
  same project

### 11. CLI And API

External commands should speak project-first language.

Needed:

- `orca project list`
- `orca project setups`
- `orca project setup-existing-folder --project <id> --host <id> --path <path>`
- `orca worktree create --project <id> --host <id> ...`
- `orca worktree create --project-host-setup <id> ...`
- compatibility aliases for old repo/worktree commands
- structured availability errors

### 12. Tests And Verification

This crosses storage, routing, UI, SSH, and compatibility.

Needed:

- migration tests
- selector/sidebar grouping tests
- create-workspace tests
- setup-on-host tests
- settings ownership tests
- SSH end-to-end validation
- version mismatch tests
- Electron validation for sidebar, creation, and settings

## Current Branch Status

Already partially landed:

- shared `Project` and `ProjectHostSetup` types
- compatibility projection from existing `Repo[]`
- persisted compatibility fields for projects and project-host setups
- renderer hydration and fallback for older runtimes
- project-aware sidebar grouping in existing repo grouping paths
- default all-host Projects sidebar keeps projects outermost while preserving
  host-section operational views for explicit host filters
- first-pass host context badges for mixed-host project groups
- project-host-aware workspace creation target resolver
- optional workspace metadata for `projectId`, `hostId`, and
  `projectHostSetupId`
- discovery-time backfill for missing workspace ownership fields
- setup-existing-folder API plumbing through local IPC/preload/runtime paths
- project settings existing-folder setup form for known local, SSH, and active
  runtime hosts
- CLI commands for listing projects/setups and creating worktrees by
  project/setup
- composer `Run on` selector when a project has multiple ready setups
- setup-target `Run on` rows for known hosts where the selected project is not
  set up yet
- inline `Run on` import-existing-folder setup
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

- first-class independent project-host setup creation/provisioning APIs beyond
  the current repo-backed import/clone compatibility paths
- bulk setup flows and setup for hosts that are not already known to the client
- SSH streamed clone progress parity
- full project settings split into global and host-specific ownership
- host settings/capability UI aligned with project setup
- complete cache/request ownership audit
- broader UI/CLI version-skew validation beyond the runtime capability guard
- full Electron and SSH end-to-end validation

## Change Count

Short answer:

```text
12 major change surfaces
```

More practical engineering answer:

```text
About 35-45 concrete implementation tasks
```

The reason for the difference is that each major surface has several necessary
subtasks. For example, "workspace creation" includes resolver changes, UI
changes, setup actions, unavailable-host reasons, runtime routing, persistence,
tests, and version-skew handling.

The largest remaining areas are:

1. independent `ProjectHostSetup` creation/provisioning APIs
2. project-first creation/setup UI completion
3. project and host settings ownership split
4. cache/request ownership audit
5. broader version-skew validation
6. SSH parity and validation
7. full Electron validation of sidebar, creation, and settings

## Final Position

Keep hosts visible, but do not make them the durable outermost object.

The long-term model should be project-first because it matches how users think
about repo/worktree/task work. Hosts, SSH machines, VMs, remote servers, and
future Orca cloud compute become first-class places where a project can run.
