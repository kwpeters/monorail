import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionBanner, lostAfterMs } from "./ConnectionBanner.js";


afterEach(() => {
    vi.useRealTimers();
});


describe("ConnectionBanner", () => {

    it("keeps an empty status region mounted while connecting or live", () => {
        const view = render(<ConnectionBanner status="Connecting" />);
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
        view.rerender(<ConnectionBanner status="Live" />);
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });


    it("puts the text into the same region while reconnecting and empties it on recovery", () => {
        const view = render(<ConnectionBanner status="Live" />);
        const region = screen.getByRole("status");

        view.rerender(<ConnectionBanner status="Reconnecting" />);
        expect(screen.getByRole("status")).toBe(region);
        expect(region).toHaveTextContent("Reconnecting...");

        view.rerender(<ConnectionBanner status="Live" />);
        expect(screen.getByRole("status")).toBe(region);
        expect(region).toBeEmptyDOMElement();
    });


    it("says the connection was lost once reconnecting lasts 10 seconds", () => {
        vi.useFakeTimers();
        const view = render(<ConnectionBanner status="Reconnecting" />);
        act(() => void vi.advanceTimersByTime(lostAfterMs - 1));
        expect(screen.getByRole("status")).toHaveTextContent("Reconnecting...");

        act(() => void vi.advanceTimersByTime(1));
        expect(screen.getByRole("status")).toHaveTextContent("Lost connection, trying again");

        view.rerender(<ConnectionBanner status="Live" />);
        expect(screen.getByRole("status")).toBeEmptyDOMElement();
    });

});
