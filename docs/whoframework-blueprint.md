# whoframeworkfivem — Framework Blueprint

> Research-driven design document for a lightweight, secure, future-proof FiveM framework.
> Based on analysis of ESX Legacy, QBCore, Qbox, ox_core, ND_Core, and community sentiment
> from CFX forums and developer discussions (2024–2026). Compiled 2026-06-12.

---

## 1. The opportunity

| Framework | Strength | Fatal flaw |
|---|---|---|
| ESX Legacy | Largest script ecosystem | 2017-era legacy debt, DB-heavy APIs, dated in-house UI |
| QBCore | Most popular 2021–2024, batteries included | Stalled maintenance, 15+ documented money-dupe exploits, no semver, shared-file merge pain |
| Qbox | Modern QB fork, ox stack, killer QB bridge | GPL-3.0 (murky for escrowed scripts), still carries QB API legacy |
| ox_core | Cleanest architecture (TS core, statebags, minimal) | No ESX/QB compatibility = adoption ceiling |
| ND_Core | Lightweight, Lua 5.4 native | Small ecosystem, one-maintainer bus factor |

**The winning formula nobody has fully shipped: ox_core-quality internals + Qbox-quality compatibility bridge + LGPL licensing + security-first API design.**

---

## 2. Non-negotiable design principles

1. **Minimal core.** Players, characters, accounts, groups, vehicles, persistence. Nothing else. No god-object — typed exports only.
2. **Server authority by API shape.** Clients send *intents*, never amounts or results. There is no client-callable "give money/item" event — the insecure path must be impossible to express, not merely discouraged.
3. **Build on the ox substrate, don't compete with it.** Hard-depend on `oxmysql` (prepared statements, pooling) and `ox_lib` (callbacks, UI, zones, cache). Every modern framework does; reinventing them is how ESX got its reputation.
4. **Compatibility bridge from day one.** ox_core proved clean-break = adoption ceiling; Qbox proved a `GetCoreObject()` shim that runs ~95% of QB scripts is the single biggest adoption lever. Ship `bridge/qb` and `bridge/esx` as optional resources.
5. **LGPL-3.0 license.** Lets paid/escrowed Marketplace scripts legally depend on the framework (GPL-3.0 ESX/QBCore is murky there). Adoption-friendly post-Jan-2026 Cfx Marketplace.
6. **Semantic versioning + documented stable API.** QBCore's lack of version discipline is its most-cited failure. Breaking changes only in majors, with migration notes.
7. **Modern platform features first-class.** OneSync required, Lua 5.4 (`lua54 'yes'`), `fx_version 'cerulean'`, statebag-driven replication, server-created entities (`CreateVehicleServerSetter`) for anything persistent.
8. **Lua + TypeScript parity.** Typed Lua annotations (Lua Language Server) and published npm type definitions so JS/TS resources are first-class consumers — ox_core's most-praised trait.

---

## 3. Core feature set (the essentials, per community consensus)

### In core (`who_core`)
- **Character lifecycle** — identity, **multicharacter built-in** (qbx_core's native multichar is repeatedly praised; bolt-on multichar resources are a known pain point)
- **Accounts/money** — cash, bank, extensible account types, shared/society accounts; every mutation server-authoritative with transaction logging
- **Groups** — unified model for jobs AND gangs (ox_core's approach), with grades, on/off duty, **multiple simultaneous group memberships** (Qbox's most-liked player-facing feature)
- **Permissions** — thin layer over native ACE/principals (Qbox deprecated in-core permissions for exactly this)
- **Player metadata** — flexible key-value store with statebag replication (QBCore's best-liked feature, done with server-written read-only statebags so executors can't forge it)
- **Vehicle ownership** — persistence, plates, keys at the data level; server-side entity creation
- **Death/respawn hooks + basic needs hooks** — events/hooks only, implementations stay modular
- **Server queue** — built-in (Qbox feature, frequently requested)
- **Hooks + structured logging** — exploit-audit trail for money/item mutations

### Delegated to the ox substrate
- Callbacks, notifications, progress bars, context menus, input dialogs, zones, points, cache → **ox_lib**
- Database → **oxmysql** (parameterized only; no raw string interpolation anywhere)
- Inventory → **pluggable interface with ox_inventory as the blessed default**

### Explicitly OUT of core (modular ecosystem resources)
Phone, housing, fuel, targeting, HUD, dispatch/MDT, weather, clothing, gameplay jobs.
Qbox's lesson: integrate best-in-class community resources rather than shipping inferior in-house versions. QBCore's 83-repo sprawl produces "copy-paste servers" and inconsistent quality.

---

## 4. Security model (the headline differentiator)

Exploit reality: Lua executors enumerate client events and replay `TriggerServerEvent` with arbitrary args. QBCore's documented holes (qb-inventory #461 client-side shop prices, lag-switch cash dupes) all share one root cause: the server trusted client-supplied amounts/results.

**Framework-level protections (all defaults, not opt-ins):**

1. **Intent-based transaction API.** Example: client calls `lib.callback('who:shop:buy', { shopId, slot })`. Server looks up the price from its own catalog, checks distance to the shop, checks balance, then mutates. Client never sends a price or amount.
2. **Validated event layer.** Core wrapper around net events with declarative schemas: type/range checks on every argument, automatic rejection + logging of malformed payloads.
3. **Rate limiting + replay prevention** built into the transactional API (per-player token buckets; server-issued one-time transaction tokens for offered trades).
4. **Source hygiene.** Server handlers that must never originate from clients are guarded automatically; `RegisterNetEvent` only where cross-context is intended.
5. **Secured statebags.** Money, job, and metadata replicated via server-written statebags (client-read-only) instead of scoped client events.
6. **Contextual validation helpers.** Distance-to-interaction, "did the server actually offer this" session checks, ACE checks on every command/callback.
7. **Hardened default server config.** Ship a recipe with `sv_filterRequestControl`, pure-mode convars, and anti-cheat-friendly settings.
8. **Parameterized SQL everywhere** (free with oxmysql; enforced by code review/lint).

---

## 5. Repository structure (proposed)

```
whoframeworkfivem/
├── who_core/                 # the framework core (TS server core or typed Lua 5.4)
│   ├── server/               # player/character/account/group/vehicle classes, persistence
│   ├── client/               # spawn flow, statebag consumers, minimal client surface
│   ├── shared/               # types, enums, config schema
│   └── fxmanifest.lua        # cerulean, lua54, deps: ox_lib, oxmysql
├── who_bridge_qb/            # optional: exports['qb-core']:GetCoreObject() shim
├── who_bridge_esx/           # optional: getSharedObject() shim
├── who_inventory_adapter/    # pluggable inventory interface (ox_inventory default impl)
├── docs/                     # docs site (API reference, guides, migration from QB/ESX)
├── examples/                 # reference resources showing the secure patterns
├── recipe/                   # txAdmin deployment recipe with hardened server.cfg
└── types/                    # npm package: @whoframework/types
```

---

## 6. Build roadmap

**Phase 1 — Core foundation (weeks 1–3)**
Player connection/queue, character creation + multicharacter, oxmysql persistence layer, statebag replication, accounts with server-authoritative mutations + audit log.

**Phase 2 — Groups, permissions, vehicles (weeks 3–5)**
Unified groups with grades and multi-membership, ACE permission layer, vehicle ownership/persistence with server-created entities, death/needs hooks.

**Phase 3 — Security layer + inventory interface (weeks 5–7)**
Validated event wrapper, rate limiting, intent-transaction API, secured statebags hardening pass, pluggable inventory adapter with ox_inventory implementation.

**Phase 4 — Bridges + DX (weeks 7–10)**
QB bridge (the adoption lever — target: common qb-* resources run unmodified), ESX bridge (best-effort), TypeScript definitions npm package, docs site, txAdmin recipe, example resources.

**Phase 5 — Hardening + launch**
Security review of every net-facing surface, load testing, semver 1.0.0, CFX forum release post.

---

## 7. Mistakes we are explicitly avoiding (lessons ledger)

| Failure | Who made it | Our countermeasure |
|---|---|---|
| Stalled maintenance / bus factor | QBCore, Overextended (2025 scare) | Open governance from day one, contributor docs, small surface area |
| Client-trusted money/item events | QBCore, old ESX scripts | Intent-based API; insecure path inexpressible |
| No semver, surprise breaking changes | QBCore | Strict semver, deprecation cycles |
| Editable shared files inside core | QBCore (shared/jobs.lua merge pain) | Runtime registration APIs + external config, never edit core |
| God-object shared core | ESX, QBCore | Typed exports only |
| In-house clones of better community resources | ESX (UI/inventory), QBCore (83 repos) | ox substrate + pluggable interfaces |
| Clean break, no compatibility | ox_core | QB/ESX bridges shipped as first-class resources |
| GPL licensing friction with paid scripts | ESX, QBCore | LGPL-3.0 |
| DB round-trips in hot paths | ESX | In-memory state + statebags, batched persistence |

---

## 8. Key sources

- Cfx server security docs: https://docs.fivem.net/docs/developers/server-security/
- State bags: https://docs.fivem.net/docs/scripting-manual/networking/state-bags/
- ox_core release thread: https://forum.cfx.re/t/ox-core-a-modern-fivem-framework/5276507
- Qbox FAQ / vs QBCore: https://docs.qbox.re/faq · https://qboxcore.com/qbox-vs-qbcore/
- qb-inventory client-trust exploit: https://github.com/qbcore-framework/qb-inventory/issues/461
- Anti event tampering (CFX): https://forum.cfx.re/t/anti-event-tampering-triggering/5344867
- ox_lib: https://github.com/overextended/ox_lib · oxmysql: https://github.com/overextended/oxmysql
- ESX core: https://github.com/esx-framework/esx_core · qb-core: https://github.com/qbcore-framework/qb-core · qbx_core: https://github.com/Qbox-project/qbx_core
