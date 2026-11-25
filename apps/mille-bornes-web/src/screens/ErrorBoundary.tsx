import { Component, type ReactNode } from "react";


/** What `ErrorBoundary` needs. */
export interface ErrorBoundaryProps {
    children:  ReactNode;

    /**
     * While the fallback shows, a new value here (a new screen from the
     * server, say) renders the children again.  It never remounts them.
     */
    resetKey?: unknown;

    /** Reloads the page; default `window.location.reload()`. */
    reload?:   () => void;
}


interface ErrorBoundaryState {
    failed: boolean;
}


/**
 * Shows "Something went wrong" and a Reload button in place of children that
 * threw while rendering (for example a screen from a newer server that this
 * page does not know), instead of leaving a blank page.  Nothing is logged:
 * the error could carry what the page was showing.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {

    /**
     * Switches to the fallback.
     * @returns The failed state
     */
    public static getDerivedStateFromError(): ErrorBoundaryState {
        return { failed: true };
    }


    public override state: ErrorBoundaryState = { failed: false };


    /**
     * Tries the children again once the reset key changes.
     * @param previous - The props before this update
     */
    public override componentDidUpdate(previous: ErrorBoundaryProps): void {
        if (this.state.failed && previous.resetKey !== this.props.resetKey) {
            this.setState({ failed: false });
        }
    }


    /**
     * Renders the children, or the fallback after they threw.
     * @returns What to show
     */
    public override render(): ReactNode {
        if (!this.state.failed) {
            return this.props.children;
        }
        const reload = this.props.reload ?? ((): void => window.location.reload());
        return (
            <section className="screen" role="alert">
                <h2>Something went wrong</h2>
                <p>Reload the page to carry on.</p>
                <button type="button" className="button primary big" onClick={reload}>
                    Reload
                </button>
            </section>
        );
    }

}
