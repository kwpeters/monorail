import type { ReactElement, ReactNode } from "react";


/** What `Shell` shows around a screen. */
export interface ShellProps {
    /** Right-side controls of the top bar (for example the mute button). */
    controls?: ReactNode;

    /** A message shown between the top bar and the screen. */
    banner?:  ReactNode;

    /**
     * Leaves out the top bar, for a screen that needs its height and has its
     * own controls (the game table).  The page keeps its `h1`, hidden from
     * sight, and the safe area at the top.
     */
    hideBar?: boolean;
    children: ReactNode;
}


/**
 * The frame every screen shares: the top bar with the game title and the
 * controls on its right, and the `main` landmark for the screen.
 * @param props - The controls, the banner, whether to hide the bar, and the
 * screen
 * @returns The framed screen
 */
export function Shell(props: ShellProps): ReactElement {
    return (
        <div className={props.hideBar === true ? "shell no-bar" : "shell"}>
            {props.hideBar === true ?
                <h1 className="visually-hidden">Mille Bornes</h1> :
                <header className="shell-bar">
                    <h1 className="shell-title truncate">Mille Bornes</h1>
                    <div className="shell-controls">{props.controls}</div>
                </header>}
            {props.banner}
            <main className="shell-main">{props.children}</main>
        </div>
    );
}
