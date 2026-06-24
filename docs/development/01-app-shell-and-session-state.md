# App Shell And Session State

## Goal

Reduce `src/App.tsx` to composition and presentation wiring, while making session
boot and project availability explicit in the UI.

## Why this is one chunk

The current `App.tsx` mixes:

- session boot;
- bridge event wiring;
- editor state ownership;
- key handling;
- keymap mutation;
- view-model derivation.

Those concerns do not need to be fully re-architected in one pass, but the first
useful cut is to separate app-shell control from session/project lifecycle. That
unblocks later work without requiring a full store migration immediately.

## In scope

- Introduce explicit frontend session/project states:
  - `idle`
  - `loading`
  - `ready`
  - `error`
- Replace fake initial project defaults with loading UI or disabled sections until
  a real project snapshot exists.
- Remove backend startup mutation from `useBridgeSession`:
  - stop executing `welcome` during boot;
  - replace it with local status text or a read-only backend status endpoint.
- Extract application controllers from `src/App.tsx` into focused hooks or modules:
  - `useProjectSession`
  - `useKeyboardController`
  - `useCommandController`
  - `useModulatorController`
- Keep section components presentation-oriented. They should receive props and
  callbacks, not own bridge lifecycle behavior.

## Out of scope

- Full reducer/store migration for every application concern.
- DTO/domain model separation.
- Typed bridge method map work.

## Current hotspots

- `src/App.tsx`
- `src/app/hooks/useBridgeSession.ts`
- `src/app/hooks/useCommandState.ts`
- `src/app/hooks/useLibraryPanelState.ts`
- `src/app/hooks/useModulatorPanelState.ts`

## Implementable plan

1. Add a minimal `SessionState` model near the app shell.
2. Move bridge boot orchestration into `useProjectSession`.
3. Return a state object from `useProjectSession`, not just loose setters and
   imperative helpers.
4. Gate project-dependent UI rendering on `projectState.status === 'ready'`.
5. Render a loading shell or disabled controls instead of default `4/4`, `12EDO`,
   transposition `2`, and base frequency `440`.
6. Remove the startup `welcome` command and replace it with a local info status such
   as `Connected` or `Project loaded`.
7. Leave `App.tsx` responsible for composition only:
   - hook assembly
   - section layout
   - passing props down

## Suggested file targets

- `src/App.tsx`
- `src/app/hooks/useProjectSession.ts` new
- `src/app/hooks/useKeyboardController.ts` new
- `src/app/hooks/useCommandController.ts` new or extracted from existing command
  state code
- `src/app/types/session.ts` new, if the state model needs a home

## Backend updates needed

- Optional backend addition: a read-only `session.status` or `session.welcome`
  response if the UI still wants startup text from native code.
- If no backend status endpoint is added, no backend change is required for the
  loading-state work itself.
- Backend should not expect `welcome` to be emitted as part of frontend boot.

## Compatibility stance

Breaking changes are fine. Do not preserve the current startup mutation behavior and
do not add compatibility shims for old app-shell assumptions.

