import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/app/shell.css'
import './styles/app/composition.css'
import './styles/app/sequencer.css'
import './styles/app/status.css'
import './styles/app/modules.css'
import './styles/app/palette.css'
import './styles/app/settings.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in document.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
