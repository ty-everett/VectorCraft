import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { acquisitionContext, installGlobalDiagnostics, signal } from './lib/telemetry'
import './styles.css'

installGlobalDiagnostics()
signal('app.opened', 'game', acquisitionContext())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
)
