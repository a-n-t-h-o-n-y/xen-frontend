# Typed Bridge Client

## Goal

Turn bridge messaging into a typed request layer with explicit timeout and
cancellation boundaries.

## Why this is one chunk

`src/app/hooks/useBridgeSession.ts` currently accepts `name: string` and generic
payload objects, so the compiler cannot verify request/response pairs. The same area
also lacks timeout handling, which means startup and serialized commands can hang on
stuck native promises.

These concerns belong together because the request client is the natural place to
enforce both typing and lifecycle policy.

## In scope

- Add a `BridgeMethodMap` describing request and response payloads per method.
- Replace `sendBridgeRequest(name, payload)` with a typed API such as:

```ts
request<K extends BridgeMethod>(
  name: K,
  payload: BridgeMethodMap[K]['request'],
  options?: RequestOptions
): Promise<BridgeMethodMap[K]['response']>
```

- Add request timeout handling.
- Add cancellation boundaries using `AbortSignal` or an equivalent mechanism at the
  frontend boundary.
- Distinguish policy for:
  - startup/idempotent reads: user-visible retry is allowed;
  - mutating commands: no automatic retry.
- Centralize envelope validation in the bridge client instead of scattering it across
  session/controller code.

## Out of scope

- Mapping backend DTOs into frontend domain models.
- Reworking every consumer to use a global store.

## Current hotspots

- `src/app/hooks/useBridgeSession.ts`
- `src/bridge/juceBridge.ts`
- `src/app/domain/contracts.ts`

## Implementable plan

1. Define the bridge method union from the methods the frontend actually uses now.
2. Add request/response types for:
   - `session.hello`
   - `state.get`
   - `library.get`
   - `command.execute`
   - `keymap.get`
   - keymap mutation methods
3. Move envelope construction, request ID generation, timeout, and response matching
   into a dedicated client module.
4. Change `useBridgeSession` and other callers to consume typed responses instead of
   parsing a generic envelope directly.
5. Surface timeout failures distinctly from payload validation failures.
6. Ensure in-flight requests are ignored or aborted on unmount.

## Suggested file targets

- `src/app/bridge/BridgeClient.ts` new, or `src/bridge/BridgeClient.ts`
- `src/app/domain/contracts.ts`
- `src/app/hooks/useBridgeSession.ts`
- `src/bridge/juceBridge.ts`

## Backend updates needed

- No protocol redesign is strictly required if the existing envelope already supports
  the methods being typed.
- If the backend can support cancellation hints, add them deliberately. If not, the
  frontend should still enforce its own timeout and stale-response handling.
- If any currently used method has ambiguous payload shapes, backend and frontend
  should tighten that contract together rather than preserving loose payloads.

## Compatibility stance

Breaking changes are fine. Prefer replacing loose request helpers outright instead of
maintaining both typed and untyped bridge call paths.

