# Domain Model Boundary

## Goal

Stop using transport DTOs as frontend domain models and break up `src/app/shared.ts`
into smaller modules with clear ownership.

## Why this is one chunk

These two problems are related:

- DTOs from `src/app/domain/contracts.ts` currently leak directly into UI code.
- `src/app/shared.ts` has become a mixed bucket of transport-adjacent types, music
  logic, modulation helpers, app constants, and view concerns.

Separating domain models from transport models is easier if the catch-all shared file
is split at the same time.

## In scope

- Treat `contracts.ts` as bridge DTOs only.
- Add frontend-owned domain models with UI-friendly naming and ownership.
- Map bridge DTOs to domain models at the ingress boundary.
- Map domain updates back to DTO-shaped payloads only where bridge requests require
  it.
- Split `src/app/shared.ts` into focused modules, for example:
  - `app/constants.ts`
  - `domain/music.ts`
  - `domain/modulation.ts`
  - `presentation/viewModels.ts`
  - `app/types.ts`

## Out of scope

- Full bridge-client typing work.
- Global store adoption.

## Current hotspots

- `src/app/domain/contracts.ts`
- `src/app/shared.ts`
- `src/app/domain/resources.ts`
- `src/App.tsx`
- section and hook modules importing snake_case DTO fields directly

## Implementable plan

1. Identify the DTO types that should stop leaking into the UI first:
   - project snapshot
   - library snapshot
   - keymap resource
2. Define frontend domain shapes with consistent naming and invariants.
3. Add mapper functions at bridge/session ingress points.
4. Update UI code to consume domain models instead of raw DTOs.
5. Split `shared.ts` by concern while updating imports as part of the same pass.
6. Keep parsing and schema validation near the bridge boundary, not inside section
   components.

## Suggested file targets

- `src/app/domain/contracts.ts`
- `src/app/domain/resources.ts`
- `src/app/shared.ts` split and eventually removed
- `src/app/domain/*` new mapper/model modules
- UI hooks and section components that currently consume DTO fields directly

## Backend updates needed

- None required if the backend DTO contract stays stable and only frontend mapping is
  introduced.
- If frontend-owned domain names expose poor DTO naming or missing structure,
  backend cleanup can happen later; the mapping layer is specifically there so the UI
  no longer depends on transport naming.

## Compatibility stance

Breaking changes are fine. The frontend does not need to preserve direct consumption
of snake_case transport objects once the mapping layer exists.

