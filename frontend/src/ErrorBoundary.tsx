import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from './lib/telemetry'

interface State { failed: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, 'react', { componentStack: info.componentStack })
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <main className="fatal-error">
          <img src="/vectorcraft-mark.svg" alt="" />
          <h1>VectorCraft hit a rough edge.</h1>
          <p>A privacy-bounded crash report was sent. Your discoveries are still stored on this device.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload VectorCraft</button>
        </main>
      )
    }
    return this.props.children
  }
}
