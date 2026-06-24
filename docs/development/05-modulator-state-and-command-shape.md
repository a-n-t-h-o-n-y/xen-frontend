# Modulator State And Command Shape

## Goal

Collapse duplicated modulator state into one source of truth and stop assembling
backend command strings directly inside UI/controller code.

## Why this is one chunk

The current modulator surface has two tightly connected problems:

- active modulator data is copied into separate local state fields, then synchronized
  back into `modulatorInstances`;
- backend command strings are assembled near UI interaction code.

That duplication makes the modulator panel brittle, and the command-string coupling
makes it hard to evolve the feature cleanly.

## In scope

- Keep one canonical modulator state structure.
- Derive active modulator data from `modulatorInstances[activeModulatorTab]` instead of
  duplicating it into separate hook state values.
- Replace synchronization flags and tab-switch microstate where possible with derived
  reads and focused update actions.
- Introduce command builders or a structured command adapter for modulator actions.
- Keep panel components presentation-oriented and drive mutations through focused
  action helpers.

## Out of scope

- Replacing the entire backend modulation API in the same pass.
- A full application-wide reducer/store.

## Current hotspots

- `src/App.tsx`
- `src/app/hooks/useModulatorPanelState.ts`
- `src/app/sections/bottom/ModulatorsPanel.tsx`
- modulation helpers in `src/app/shared.ts`

## Implementable plan

1. Refactor `useModulatorPanelState` so the hook stores:
   - `modulatorInstances`
   - `activeModulatorTab`
   - ephemeral drag/menu state only
2. Remove per-field duplicated state such as:
   - `waveAType`
   - `waveBType`
   - `waveAPulseWidth`
   - `waveBPulseWidth`
   - `waveLerp`
   - `lfoAFrequency`
   - `lfoAPhaseOffset`
   - `lfoBFrequency`
   - `lfoBPhaseOffset`
   - `targetControls`
3. Replace them with:
   - derived `activeModulator`
   - focused update helpers like `updateActiveModulator(partial)` or more explicit
     field actions
4. Move modulation command assembly into a dedicated module:
   - command builders if the backend still expects text commands;
   - structured request builders if the backend grows typed endpoints.
5. Update the modulator panel to consume derived active state and explicit actions.

## Suggested file targets

- `src/app/hooks/useModulatorPanelState.ts`
- `src/app/sections/bottom/ModulatorsPanel.tsx`
- `src/app/domain/modulatorCommands.ts` new
- modulation helpers currently living in `src/app/shared.ts`

## Backend updates needed

- If the backend can accept structured modulation requests, that is the preferred end
  state and should replace ad hoc command-string composition.
- If the backend remains command-text based for now, no immediate protocol change is
  required, but the command-builder boundary should still be introduced so the UI no
  longer assembles strings inline.

## Compatibility stance

Breaking changes are fine. Do not preserve the duplicated active-modulator state model
or inline command-string assembly once this workstream starts.

