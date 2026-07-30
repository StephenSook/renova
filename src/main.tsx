import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The demo-cache capture harness. Dev builds only, so the dynamic import is
// dead code in production and the capture path cannot ship.
if (import.meta.env.DEV) void import('./demo/capture')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
