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


    it("shows nothing to anyone else", () => {
        const { container } = render(<ExtensionOffer screen={offerFor("Bob")} onDecide={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

});
