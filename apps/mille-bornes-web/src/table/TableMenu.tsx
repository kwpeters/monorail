import { Option } from "@repo/depot/option";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import type { AudioEngine } from "../sound/audioEngine.mjs";
import { MuteButton } from "../sound/MuteButton.js";


/** What `TableMenu` needs. */
export interface TableMenuProps {
    engine:    AudioEngine;

    /** Opens the End game question; there is one only for the organizer. */
    onEndGame: Option<() => void>;

    /**
     * True while a hazard is in flight against the player's team.  When it
     * becomes true the menu closes, so the answering card needs one tap.
     */
    hazard:    boolean;
}


// How long a tap that closed the menu still swallows its click: a tap makes
// its click at once, so a click later than this belongs to another tap.
const swallowMs = 400;


// Makes the click that follows the tap which closed the menu do nothing: it
// stops in the capture phase, before any button under the finger (a card,
// Play, Discard, a lane) sees it.  It ends with that click, with a scroll or
// another press (neither makes the click), or after `swallowMs`.
function swallowNextClick(): void {
    const end = (): void => {
        window.clearTimeout(timer);
        document.removeEventListener("click", swallow, true);
        document.removeEventListener("pointerdown", end, true);
        document.removeEventListener("pointercancel", end, true);
    };
    const swallow = (e: Event): void => {
        e.stopPropagation();
        e.preventDefault();
        end();
    };
    const timer = window.setTimeout(end, swallowMs);
    document.addEventListener("click", swallow, true);
    document.addEventListener("pointerdown", end, true);
    document.addEventListener("pointercancel", end, true);
}


/**
 * The game table's menu: a 44 by 44 button that opens a short list over the
 * table (it moves nothing) with Mute or Unmute sounds and, for the organizer,
 * End game.  Enter, Space or the Down arrow opens it with the first item
 * focused (a tap leaves the focus on the button); the arrow keys, Home and
 * End move in it.  Escape (wherever the focus is), a tap elsewhere or choosing
 * End game closes it, and Escape and End game give the focus back to the
 * button.  A tap elsewhere only closes it: what was under the finger does
 * not get that tap.  A hazard against the player's team closes it too.
 * Muting leaves it open, so the item's changed words show what the tap did.
 * Place it in a positioned box: it sits at that box's top right.
 * @param props - The audio engine and the End game action, if any
 * @returns The button and, while open, the list
 */
export function TableMenu(props: TableMenuProps): ReactElement {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);
    // Only a keyboard open enters the list; a tap leaves the focus (and no
    // focus ring on an item) where it was.
    const enter = useRef(false);
    const buttonId = useId();
    const menuId = useId();

    const items = (): HTMLElement[] => [
        ...(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])
    ];

    const close = (refocus: boolean): void => {
        setOpen(false);
        if (refocus) {
            button.current?.focus();
        }
    };

    useEffect(() => {
        if (open && enter.current) {
            items()[0]?.focus();
        }
    }, [open]);

    // A hazard against the player's team is the moment to answer it, not to
    // have a menu open over it.
    useEffect(() => {
        if (props.hazard) {
            setOpen(false);
        }
    }, [props.hazard]);

    // A tap anywhere else closes it (and does nothing else); pointerdown,
    // because a tap on plain page content makes no click on iOS.  Escape
    // closes it from wherever the focus is.
    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const away = (e: PointerEvent): void => {
            if (!(e.target instanceof Node && root.current?.contains(e.target) === true)) {
                setOpen(false);
                swallowNextClick();
            }
        };
        const escape = (e: globalThis.KeyboardEvent): void => {
            if (e.key === "Escape") {
                close(true);
            }
        };
        document.addEventListener("pointerdown", away);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", away);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    const onKeyDown = (e: KeyboardEvent): void => {
        if (!open) {
            if (e.key === "ArrowDown" && e.target === button.current) {
                e.preventDefault();
                enter.current = true;
                setOpen(true);
            }
            return;
        }
        const all = items();
        const at = all.findIndex((el) => el === document.activeElement);
        const last = all.length - 1;
        const to = ((): number => {
            switch (e.key) {
                case "ArrowDown":
                    return at < last ? at + 1 : 0;
                case "ArrowUp":
                    return at > 0 ? at - 1 : last;
                case "Home":
                    return 0;
                case "End":
                    return last;
                default:
                    return -1;
            }
        })();
        if (to >= 0) {
            e.preventDefault();
            all[to]?.focus();
        }
    };

    return (
        <div
            ref={root}
            className="table-menu"
            onKeyDown={onKeyDown}
            // Tab to something else leaves the menu behind.
            onBlur={(e) => {
                if (e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) {
                    setOpen(false);
                }
            }}
        >
            <button
                ref={button}
                id={buttonId}
                type="button"
                className="button menu-button"
                aria-label="Menu"
                title="Menu"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                // A click from Enter or Space has no pointer: `detail` is 0.
                onClick={(e) => {
                    enter.current = e.detail === 0;
                    setOpen(!open);
                }}
            >
                <span aria-hidden="true">{"☰"}</span>
            </button>
            {open ?
                <div id={menuId} role="menu" aria-labelledby={buttonId} className="menu-list">
                    <MuteButton engine={props.engine} variant="menuitem" />
                    {props.onEndGame.match(
                        (endGame) => (
                            <button
                                type="button"
                                role="menuitem"
                                tabIndex={-1}
                                className="menu-item danger"
                                onClick={() => {
                                    close(true);
                                    endGame();
                                }}
                            >
                                End game
                            </button>
                        ),
                        () => null
                    )}
                </div> :
                null}
        </div>
    );
}
