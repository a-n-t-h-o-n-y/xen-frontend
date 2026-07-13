import { useContext } from 'react'
import { ThemeContext, type ThemeContextValue } from './ThemeContext'

export const useTheme = (): ThemeContextValue => {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
