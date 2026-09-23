import { RotateCcw, TriangleAlert } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { useVmsStore } from '@/store/useVmsStore'

interface ErrorBoundaryProps {
  /** Names the panel in the fallback, e.g. "Gatekeeper console". */
  label: string
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Keeps a render error inside one panel instead of blanking the whole app, and
 * offers a retry, or a reset of the mock database when bad data is the cause.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[vms] ${this.props.label} crashed`, error, info.componentStack)
  }

  private retry = () => this.setState({ error: null })

  private resetData = () => {
    useVmsStore.getState().resetDemoData()
    this.retry()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div role="alert" className="mx-auto flex max-w-lg animate-fade-in flex-col items-center gap-3 rounded-lg border border-danger-border bg-surface px-6 py-10 text-center">
        <span className="flex size-10 items-center justify-center rounded-full border border-danger-border bg-danger-subtle text-danger">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <h2 className="text-headline-md">{this.props.label} ran into a problem</h2>
        <p className="text-body-md text-muted-foreground">
          The rest of the app still works. Try again, and if the problem persists, reset the mock database to its seeded state.
        </p>
        <pre className="max-w-full overflow-x-auto rounded-md bg-muted px-3 py-2 text-left font-mono text-mono-code whitespace-pre-wrap text-danger-strong">
          {error.message}
        </pre>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={this.resetData}>
            <RotateCcw /> Reset mock database
          </Button>
          <Button onClick={this.retry}>Try again</Button>
        </div>
      </div>
    )
  }
}
