import { NoneOption, Option } from "@repo/depot/option";
import {
    createContext, useCallback, useContext, useState, type ReactElement, type ReactNode
} from "react";
import { createPortal } from "react-dom";


/** What `Shell` shows around a screen. */
export interface ShellProps {
    /** Right-side controls of the top bar (for example the mute button). */
    controls?: ReactNode;

    /** A message shown between the top bar and the screen. */
    banner?:  ReactNode;
    children: ReactNode;
}


// Where `ShellControls` puts its children: the empty element at the end of
// the header's controls, once the shell has mounted it.  None outside a shell.
const ControlsSlot = createContext<Option<HTMLElement>>(NoneOption.get());


/**
 * The frame every screen shares: the top bar with the game title, a slot
 * for controls on its right, and the `main` landmark for the screen.  Any
 * screen can put controls in that slot with `ShellControls`.
 * @param props - The controls, the banner and the screen
 * @returns The framed screen
 */
export function Shell(props: ShellProps): ReactElement {
    const [slot, setSlot] = useState<Option<HTMLElement>>(NoneOption.get());
    // Stable, so React calls it only on mount and unmount.
    const slotRef = useCallback((el: HTMLElement | null): void => {
        setSlot(Option.fromNullable(el));
    }, []);

    return (
        <div className="shell">
            <header className="shell-bar">
                <h1 className="shell-title truncate">Mille Bornes</h1>
                <div className="shell-controls">
                    {props.controls}
                    <span ref={slotRef} className="shell-slot" />
                </div>
            </header>
            {props.banner}
            <main className="shell-main">
                <ControlsSlot.Provider value={slot}>{props.children}</ControlsSlot.Provider>
            </main>
        </div>
    );
}


/** What `ShellControls` shows. */
export interface ShellControlsProps {
    children: ReactNode;
}


/**
 * Shows its children in the shell's header, on the right, while it is
 * rendered; the screen that renders it still owns them (their state, their
 * handlers) because they are a portal.  Outside a shell, or in the first
 * moment before the shell's slot exists, they show in place.
 * @param props - The controls
 * @returns The controls, in the header when there is one
 */
export function ShellControls(props: ShellControlsProps): ReactElement {
    const slot = useContext(ControlsSlot);
    return slot.match(
        (el) => createPortal(props.children, el),
        () => <>{props.children}</>
    );
}
