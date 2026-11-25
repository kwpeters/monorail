import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";


// "@testing-library/jest-dom/vitest" cannot be used here: it imports "vitest"
// from the hoisted copy of jest-dom, where npm cannot hoist vitest (see
// jestDomMatchers.d.mts for the matching type declarations).
expect.extend(matchers);


// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
    cleanup();
});


// jsdom has no layout, so it does not scroll; its own `scrollTo` only
// reports that it is not implemented.
window.scrollTo = (): void => undefined;


// jsdom has no modal dialogs: `showModal()` and `close()` are missing.  This
// stand-in does what a browser does that the tests rely on: `showModal()`
// opens the dialog and remembers the focused element, Escape closes it, and
// closing fires `close` and returns focus to the element that opened it.  A
// browser closes the dialog as the default action of Escape, after every
// keydown listener has run; the listener is on `window` so that listeners
// registered earlier (on `window`) still see the dialog open.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
    const restoreFocus = new WeakMap<HTMLDialogElement, Element | null>();
    const escapeHandlers = new WeakMap<HTMLDialogElement, (e: KeyboardEvent) => void>();

    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
        restoreFocus.set(this, document.activeElement);
        this.setAttribute("open", "");
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                this.close();
            }
        };
        escapeHandlers.set(this, onKeyDown);
        window.addEventListener("keydown", onKeyDown);
    };

    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
        if (!this.hasAttribute("open")) {
            return;
        }
        this.removeAttribute("open");
        window.removeEventListener("keydown", escapeHandlers.get(this)!);
        this.dispatchEvent(new Event("close"));
        const trigger = restoreFocus.get(this);
        if (trigger instanceof HTMLElement) {
            trigger.focus();
        }
    };
}
