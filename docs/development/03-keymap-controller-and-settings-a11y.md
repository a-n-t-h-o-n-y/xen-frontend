# Keymap Controller And Settings Accessibility

## Goal

Move shortcut mutation logic out of `src/App.tsx` and finish the settings dialog so
it behaves like a real modal rather than only looking like one.

## Why this is one chunk

These are both part of the same feature surface: shortcut configuration. The current
code has request/mutation logic in `App.tsx`, while the settings overlay has modal
markup without complete focus management.

Grouping them keeps one implementation pass centered on the keymap/settings surface.

## In scope

- Extract keymap load and mutation behavior into a dedicated controller:
  - `useKeymapController`
  - or `useKeymapSettingsController`
- Remove `refreshKeymap`, `mutateKeymap`, and related error/busy state ownership from
  `src/App.tsx`.
- Keep `SettingsOverlay` presentation-first:
  - receives data
  - receives callbacks
  - does not own bridge mutation rules
- Add modal focus behavior:
  - trap focus while open;
  - restore focus to the launching control on close;
  - preserve keyboard escape behavior;
  - avoid losing focus during shortcut capture.
- Keep conflict detection scoped to one context, matching the existing contract docs.

## Out of scope

- Replacing the keymap backend schema.
- Reworking the broader command system.

## Current hotspots

- `src/App.tsx`
- `src/app/sections/SettingsOverlay.tsx`
- `src/app/domain/keymap.ts`
- `docs/frontend_keymap_contract.md`

## Implementable plan

1. Create a keymap controller hook that owns:
   - current resource
   - loading/busy/error state
   - refresh
   - set override
   - disable
   - restore
   - reset
2. Pass that state into `SettingsOverlay`.
3. Add a focus-trap utility or a local hook for the settings dialog.
4. Record the opener element before the dialog opens and restore focus on close.
5. Keep shortcut capture isolated so the modal trap does not swallow the actual
   captured key event.
6. Leave `App.tsx` with only:
   - `settingsOpen`
   - controller wiring
   - launch/close callbacks

## Suggested file targets

- `src/app/hooks/useKeymapController.ts` new
- `src/App.tsx`
- `src/app/sections/SettingsOverlay.tsx`
- `src/app/hooks/useFocusTrap.ts` new, if useful

## Backend updates needed

- None required for the controller extraction itself.
- If current backend keymap mutation errors are too coarse for good UI messaging,
  tighten the error payloads rather than adding frontend heuristics.

## Compatibility stance

Breaking changes are fine. Do not keep the current `App.tsx` mutation path alive once
the controller is introduced.

