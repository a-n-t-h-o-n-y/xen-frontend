import { useContext } from 'react'
import { PreferencesContext, type PreferencesContextValue } from './PreferencesContext'

export const usePreferences = (): PreferencesContextValue => {
  const value = useContext(PreferencesContext)
  if (!value) throw new Error('usePreferences must be used within PreferencesProvider')
  return value
}
