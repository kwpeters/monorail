import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayingData } from "../screens/GameScreen.js";
import { extensionOffer, viewOf } from "../testing/engineBatches.mjs";
import { playingScreen } from "../testing/viewFixtures.mjs";
import { extensionRisk } from "../text/phaseHint.mjs";
import { ExtensionOffer } from "./ExtensionOffer.js";


function offerFor(name: string): PlayingData {
    return playingScreen(viewOf(extensionOffer, name), {
        timer: { kind: "ExtensionOffer", remainingMs: 30000 },
    });
}


describe("ExtensionOffer", () => {

    afterEach(() => {
        vi.useRealTimers();
    });


    it("asks the decider, with the risk in one sentence and a countdown", () => {
        vi.useFakeTimers();
        render(<ExtensionOffer screen={offerFor("Ann")} onDecide={vi.fn()} />);
        const panel = screen.getByRole("region", { name: "Stop here, or race on to 1,000?" });
        expect(panel).toHaveTextContent(extensionRisk);
        expect(screen.getByRole("timer")).toHaveTextContent("30 seconds left");
        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(screen.getByRole("timer")).toHaveTextContent("29 seconds left");
    });


    it("calls Extension or stops", () => {
        const onDecide = vi.fn();
        render(<ExtensionOffer screen={offerFor("Ann")} onDecide={onDecide} />);
        fireEvent.click(screen.getByRole("button", { name: "Call Extension" }));
        fireEvent.click(screen.getByRole("button", { name: "Stop here" }));
        expect(onDecide.mock.calls).toEqual([
            [{ type: "CallExtension" }],
            [{ type: "DeclineExtension" }],
        ]);
    });


    it("scrolls itself into view once, when it appears to the decider", () => {
        const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
        try {
            const { rerender } = render(
                <ExtensionOffer screen={offerFor("Ann")} onDecide={vi.fn()} />
            );
            const panel = screen.getByRole("region", { name: "Stop here, or race on to 1,000?" });
            expect(scroll).toHaveBeenCalledExactlyOnceWith({
                block:    "nearest",
                behavior: "instant"
            });
            expect(scroll.mock.contexts[0]).toBe(panel);
            // A later screen of the same offer does not scroll again.
            rerender(<ExtensionOffer screen={offerFor("Ann")} onDecide={vi.fn()} />);
            expect(scroll).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(document.body);
        }
        finally {
            scroll.mockRestore();
        }
    });


    it("scrolls nothing for anyone else", () => {
        const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
        try {
            render(<ExtensionOffer screen={offerFor("Bob")} onDecide={vi.fn()} />);
            expect(scroll).not.toHaveBeenCalled();
        }
        finally {
            scroll.mockRestore();
        }
    });


    it("shows nothing to anyone else", () => {
        const { container } = render(<ExtensionOffer screen={offerFor("Bob")} onDecide={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

});
