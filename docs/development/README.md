# Development Workstreams

This directory turns the current review findings into implementation-sized chunks.
Each document is intended to be independently actionable. The chunks are scoped to
work that can reasonably land in one focused pass, even when multiple findings are
grouped together.

These docs assume:

- breaking changes are acceptable;
- no backwards-compatibility layer is required;
- frontend and backend can move together when a chunk needs contract changes.

## Workstreams

- [01-app-shell-and-session-state.md](./01-app-shell-and-session-state.md)
  Split application control responsibilities out of `src/App.tsx`, add explicit
  session/project loading states, and remove startup mutation behavior.
- [02-typed-bridge-client.md](./02-typed-bridge-client.md)
  Replace stringly-typed bridge requests with a typed client and add timeout and
  cancellation boundaries.
- [03-keymap-controller-and-settings-a11y.md](./03-keymap-controller-and-settings-a11y.md)
  Move keymap mutation logic out of `src/App.tsx` and finish the settings dialog
  interaction model.
- [04-domain-model-boundary.md](./04-domain-model-boundary.md)
  Separate transport DTOs from frontend domain models and split `src/app/shared.ts`
  by responsibility.
- [05-modulator-state-and-command-shape.md](./05-modulator-state-and-command-shape.md)
  Collapse duplicated modulator state and move command composition behind a structured
  boundary.

## Excluded

- CI setup is intentionally excluded from this plan.

