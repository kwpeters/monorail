import type { ReactElement, ReactNode } from "react";


/** What `Shell` shows around a screen. */
export interface ShellProps {
    /** Right-side controls of the top bar (for example the mute button). */
    controls?: ReactNode;

    /** A message shown between the top bar and the screen. */
    banner?:  ReactNode;
    children: ReactNode;
}


/**
 * The frame every screen shares: the top bar with the game title, a slot
 * for controls on its right, and the `main` landmark for the screen.
 * @param props - The controls, the banner and the screen
 * @returns The framed screen
 */
export function Shell(props: ShellProps): ReactElement {
    return (
        <div className="shell">
            <header className="shell-bar">
                <h1 className="shell-title truncate">Mille Bornes</h1>
                <div className="shell-controls">{props.controls}</div>
            </header>
            {props.banner}
            <main className="shell-main">{props.children}</main>
        </div>
    );
}
