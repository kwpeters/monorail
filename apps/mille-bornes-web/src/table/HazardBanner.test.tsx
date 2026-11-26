import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import type { PlayingData } from "../screens/GameScreen.js";
import { flatTireWindow, viewOf } from "../testing/engineBatches.mjs";
import { playingScreen } from "../testing/viewFixtures.mjs";
import { HazardBanner } from "./HazardBanner.js";


const alert = "Flat Tire! Play it now.";


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


    it("shows the hazard, the alert and a countdown to the target team", () => {
        render(<HazardBanner alert={alert} screen={windowFor("Bob")} />);
        expect(screen.getByRole("region", { name: "Flat Tire!" })).toHaveTextContent(alert);
        expect(countdown()).toHaveTextContent("5 seconds left");
    });


    it("counts down once a second and stops at zero", () => {
        render(<HazardBanner alert={alert} screen={windowFor("Bob", 2500)} />);
        expect(countdown()).toHaveTextContent("3 seconds left");
        tick(500);
        expect(countdown()).toHaveTextContent("2 seconds left");
        tick(1000);
        expect(countdown()).toHaveTextContent("1 second left");
        tick(5000);
        expect(countdown()).toHaveTextContent("0 seconds left");
        // No interval is left running once it has reached zero.
        expect(vi.getTimerCount()).toBe(0);
    });


    it("starts no clock for a timer that has already run out", () => {
        render(<HazardBanner alert={alert} screen={windowFor("Bob", 0)} />);
        expect(countdown()).toHaveTextContent("0 seconds left");
        expect(vi.getTimerCount()).toBe(0);
    });


    it("does not announce every tick", () => {
        render(<HazardBanner alert={alert} screen={windowFor("Bob")} />);
        expect(countdown()).not.toHaveAttribute("aria-live", "polite");
        expect(countdown()).not.toHaveAttribute("aria-live", "assertive");
        expect(countdown().closest("[aria-live='polite'], [aria-live='assertive']")).toBeNull();
    });


    it("starts again from a new screen's time, as after a reconnect", () => {
        const { rerender } = render(<HazardBanner alert={alert} screen={windowFor("Bob", 5000)} />);
        tick(1000);
        expect(countdown()).toHaveTextContent("4 seconds left");
        rerender(<HazardBanner alert={alert} screen={windowFor("Bob", 2000)} />);
        expect(countdown()).toHaveTextContent("2 seconds left");
        tick(1000);
        expect(countdown()).toHaveTextContent("1 second left");
    });


    it("keeps counting when the same screen renders again", () => {
        const data = windowFor("Bob", 5000);
        const { rerender } = render(<HazardBanner alert={alert} screen={data} />);
        tick(2000);
        rerender(<HazardBanner alert={alert} screen={data} />);
        expect(countdown()).toHaveTextContent("3 seconds left");
    });


    it("is the same for every member of the team, whatever they hold", () => {
        const { container: bob } = render(<HazardBanner alert={alert} screen={windowFor("Bob")} />);
        const { container: di } = render(<HazardBanner alert={alert} screen={windowFor("Di")} />);
        expect(bob.innerHTML).not.toBe("");
        expect(di.innerHTML.replace(/:r\w+:/gu, "id")).toBe(bob.innerHTML.replace(/:r\w+:/gu, "id"));
    });


    it("shows nothing at all to the other teams", () => {
        for (const name of ["Ann", "Cy"]) {
            const { container, unmount } = render(
                <HazardBanner alert={alert} screen={windowFor(name)} />
            );
            expect(container).toBeEmptyDOMElement();
            unmount();
        }
        expect(vi.getTimerCount()).toBe(0);
    });


    it("shows the banner without a countdown when the server sends no timer", () => {
        render(<HazardBanner alert={alert} screen={{ ...windowFor("Bob"), timer: null }} />);
        expect(screen.getByRole("region", { name: "Flat Tire!" })).toBeInTheDocument();
        expect(screen.queryByRole("timer")).not.toBeInTheDocument();
    });


    describe("scrolling to its top", () => {

        // The page may be scrolled down (a pick-up on a short screen scrolls
        // it), and the banner and its countdown are at the top.
        function scrolls(): MockInstance<typeof window.scrollTo> {
            return vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
        }


        afterEach(() => {
            vi.restoreAllMocks();
        });


        it("scrolls to the top, once, when the banner shows", () => {
            const scrollTo = scrolls();
            const data = windowFor("Bob");
            const { rerender } = render(<HazardBanner alert={alert} screen={data} />);
            expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);
            // A tick, a new alert and a new screen of the same window do not
            // scroll the page back up under the player's finger.
            tick(2000);
            rerender(<HazardBanner alert="Please wait." screen={data} />);
            rerender(<HazardBanner alert="Please wait." screen={windowFor("Bob", 3000)} />);
            expect(scrollTo).toHaveBeenCalledOnce();
        });


        it("scrolls when the window opens on a table that was showing none", () => {
            const scrollTo = scrolls();
            const quiet = windowFor("Ann");
            const { rerender } = render(<HazardBanner alert={alert} screen={quiet} />);
            expect(scrollTo).not.toHaveBeenCalled();
            rerender(<HazardBanner alert={alert} screen={windowFor("Bob")} />);
            expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);
        });


        it("does not scroll for a team that sees no banner", () => {
            const scrollTo = scrolls();
            render(<HazardBanner alert={alert} screen={windowFor("Cy")} />);
            expect(scrollTo).not.toHaveBeenCalled();
        });

    });


    it("stops its clock when it goes away", () => {
        const { unmount } = render(<HazardBanner alert={alert} screen={windowFor("Bob")} />);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

});
