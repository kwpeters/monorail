import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayingData } from "../screens/GameScreen.js";
import { flatTireWindow, viewOf } from "../testing/engineBatches.mjs";
import { playingScreen } from "../testing/viewFixtures.mjs";
import { HazardBanner } from "./HazardBanner.js";


function windowFor(name: string, remainingMs = 5000): PlayingData {
    return playingScreen(viewOf(flatTireWindow, name), {
        timer: { kind: "HazardWindow", remainingMs },
    });
}


function tick(ms: number): void {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}


function countdown(): HTMLElement {
    return screen.getByRole("timer");
}


describe("HazardBanner", () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });


    afterEach(() => {
        vi.useRealTimers();
    });


    it("shows the hazard and a countdown to the target team", () => {
        render(<HazardBanner screen={windowFor("Bob")} />);
        expect(screen.getByRole("region", { name: "Flat Tire!" })).toBeInTheDocument();
        expect(countdown()).toHaveTextContent("5 seconds left");
    });


    it("counts down once a second and stops at zero", () => {
        render(<HazardBanner screen={windowFor("Bob", 2500)} />);
        expect(countdown()).toHaveTextContent("3 seconds left");
        tick(500);
        expect(countdown()).toHaveTextContent("2 seconds left");
        tick(1000);
        expect(countdown()).toHaveTextContent("1 second left");
        tick(5000);
        expect(countdown()).toHaveTextContent("0 seconds left");
    });


    it("does not announce every tick", () => {
        render(<HazardBanner screen={windowFor("Bob")} />);
        expect(countdown()).not.toHaveAttribute("aria-live", "polite");
        expect(countdown()).not.toHaveAttribute("aria-live", "assertive");
        expect(countdown().closest("[aria-live='polite'], [aria-live='assertive']")).toBeNull();
    });


    it("starts again from a new screen's time, as after a reconnect", () => {
        const { rerender } = render(<HazardBanner screen={windowFor("Bob", 5000)} />);
        tick(1000);
        expect(countdown()).toHaveTextContent("4 seconds left");
        rerender(<HazardBanner screen={windowFor("Bob", 2000)} />);
        expect(countdown()).toHaveTextContent("2 seconds left");
        tick(1000);
        expect(countdown()).toHaveTextContent("1 second left");
    });


    it("keeps counting when the same screen renders again", () => {
        const data = windowFor("Bob", 5000);
        const { rerender } = render(<HazardBanner screen={data} />);
        tick(2000);
        rerender(<HazardBanner screen={data} />);
        expect(countdown()).toHaveTextContent("3 seconds left");
    });


    it("is the same for every member of the team, whatever they hold", () => {
        const { container: bob } = render(<HazardBanner screen={windowFor("Bob")} />);
        const { container: di } = render(<HazardBanner screen={windowFor("Di")} />);
        expect(bob.innerHTML).not.toBe("");
        expect(di.innerHTML.replace(/:r\w+:/gu, "id")).toBe(bob.innerHTML.replace(/:r\w+:/gu, "id"));
    });


    it("shows nothing at all to the other teams", () => {
        for (const name of ["Ann", "Cy"]) {
            const { container, unmount } = render(<HazardBanner screen={windowFor(name)} />);
            expect(container).toBeEmptyDOMElement();
            unmount();
        }
        expect(vi.getTimerCount()).toBe(0);
    });


    it("shows the banner without a countdown when the server sends no timer", () => {
        render(<HazardBanner screen={{ ...windowFor("Bob"), timer: null }} />);
        expect(screen.getByRole("region", { name: "Flat Tire!" })).toBeInTheDocument();
        expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    });


    it("stops its clock when it goes away", () => {
        const { unmount } = render(<HazardBanner screen={windowFor("Bob")} />);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

});
