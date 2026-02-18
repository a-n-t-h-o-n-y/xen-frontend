import { getNativeFunction } from '../vendor/juce/index.js'

type NativeFn = (requestJson: string) => Promise<unknown>
type ListenerToken = unknown

const BRIDGE_FN_NAME = 'xenBridgeRequest'
const BRIDGE_EVENT_ID = 'xenBridgeEvent'

type JuceHost = NonNullable<Window['__JUCE__']> & {
  backend: {
    addEventListener: (eventId: string, listener: (raw: unknown) => void) => ListenerToken
    removeEventListener: (token: ListenerToken) => void
  }
  initialisationData: {
    __juce__functions?: string[]
  }
}

function requireJuceHost(): JuceHost {
  const juce = window.__JUCE__
  if (!juce) {
    throw new Error(
      'JUCE bridge unavailable: window.__JUCE__ is missing. Load this app inside the JUCE WebView host with native integration enabled.'
    )
  }

  if (!juce.backend) {
    throw new Error('JUCE bridge unavailable: window.__JUCE__.backend is missing.')
  }

  if (!('initialisationData' in juce) || !juce.initialisationData) {
    throw new Error(
      'JUCE bridge unavailable: window.__JUCE__.initialisationData is missing.'
    )
  }

  if (typeof (juce.backend as { addEventListener?: unknown }).addEventListener !== 'function') {
    throw new Error(
      'JUCE bridge unavailable: window.__JUCE__.backend.addEventListener is missing.'
    )
  }

  if (
    typeof (juce.backend as { removeEventListener?: unknown }).removeEventListener !==
    'function'
  ) {
    throw new Error(
      'JUCE bridge unavailable: window.__JUCE__.backend.removeEventListener is missing.'
    )
  }

  return juce as JuceHost
}

export function getXenBridgeRequest(): NativeFn {
  const juce = requireJuceHost()
  const registered = juce.initialisationData.__juce__functions

  if (!Array.isArray(registered)) {
    throw new Error(
      'JUCE bridge contract mismatch: initialisationData.__juce__functions is missing or invalid.'
    )
  }

  if (!registered.includes(BRIDGE_FN_NAME)) {
    throw new Error(
      `JUCE bridge contract mismatch: native function '${BRIDGE_FN_NAME}' is not registered by host.`
    )
  }

  return getNativeFunction(BRIDGE_FN_NAME) as NativeFn
}

export function addXenBridgeListener(
  onEvent: (eventJson: string) => void
): ListenerToken {
  const juce = requireJuceHost()

  return juce.backend.addEventListener(BRIDGE_EVENT_ID, (raw: unknown) => {
    onEvent(String(raw))
  })
}

export function removeXenBridgeListener(token: ListenerToken): void {
  const juce = requireJuceHost()
  juce.backend.removeEventListener(token)
}
