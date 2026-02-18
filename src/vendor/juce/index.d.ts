export type NativeFunction = (...args: unknown[]) => Promise<unknown>

export function getNativeFunction(name: string): NativeFunction
export function getSliderState(name: string): unknown
export function getToggleState(name: string): unknown
export function getComboBoxState(name: string): unknown
export function getBackendResourceAddress(path: string): string
export class ControlParameterIndexUpdater {
  constructor(controlParameterIndexAnnotation: string)
  handleMouseMove(event: MouseEvent): void
}

declare global {
  interface Window {
    __JUCE__?: {
      backend?: {
        addEventListener: (
          eventId: string,
          listener: (payload: unknown) => void
        ) => unknown
        removeEventListener: (token: unknown) => void
        emitEvent: (eventId: string, payload: unknown) => void
      }
      initialisationData?: {
        __juce__functions?: string[]
      }
    }
  }
}

