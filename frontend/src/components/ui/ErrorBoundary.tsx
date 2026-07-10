import { Component, type PropsWithChildren, type ReactNode } from 'react'

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<PropsWithChildren<{ fallback?: ReactNode }>, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Something went wrong loading this component.
        </div>
      )
    }
    return this.props.children
  }
}
