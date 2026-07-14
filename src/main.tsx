import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'
import { ThemeProvider } from './app/theme/ThemeProvider'
import { initializeTheme } from './app/theme/theme'
import { PreferencesProvider } from './app/preferences/PreferencesProvider'

initializeTheme()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in document.')
}

createRoot(rootElement).render(
  <StrictMode>
    <PreferencesProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </PreferencesProvider>
  </StrictMode>,
)
