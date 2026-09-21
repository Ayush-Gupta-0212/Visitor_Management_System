/**
 * Route-level error boundary.
 *
 * A render error inside one screen unmounts the whole React tree by default,
 * which for a front-desk kiosk means a blank monitor with a queue of visitors in
 * front of it. Wrapping each route keeps the shell, the navigation and the other
 * screens alive, and offers a way back.
 *
 * Note that the raw error is logged for the developer but never shown to the
 * user - stack traces are not useful to a security guard and can leak internals.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from '@/shared/ui/primitives';

interface Props {
  children: ReactNode;
  /** Changing this value resets the boundary - we pass the route path. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // In a real deployment this is where the report would go to Sentry et al.
    console.error('Unhandled render error', error, info.componentStack);
  }

  componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="flex flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="text-xl font-bold text-ink">This screen stopped responding</h1>
        <p className="max-w-md text-sm text-muted">
          The rest of the app is still working. You can retry this screen, or use the navigation
          above to go somewhere else.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => this.setState({ error: null })}>
            Retry this screen
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload the app
          </Button>
        </div>
      </div>
    );
  }
}
