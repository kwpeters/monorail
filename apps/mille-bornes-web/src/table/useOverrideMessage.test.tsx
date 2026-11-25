import { NoneOption, SomeOption } from "@repo/depot/option";
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type TopBarMessage } from "../text/phaseHint.mjs";
import { TopBar } from "./TopBar.js";
import { useOverrideMessage } from "./useOverrideMessage.js";


beforeEach(() => {
    vi.useFakeTimers();
});


afterEach(() => {
    vi.useRealTimers();
});


describe("useOverrideMessage", () => {

    it("starts with no override", () => {
        const { result } = renderHook(() => useOverrideMessage());
        expect(result.current.override).toEqual(NoneOption.get());
    });


    it("shows an override and clears it after the timeout", () => {
        const { result } = renderHook(() => useOverrideMessage());
        act(() => result.current.setOverride("Not that card.", "Alert", 3000));
        expect(result.current.override)
        .toEqual(new SomeOption({ text: "Not that card.", tone: "Alert" }));
        act(() => {
            vi.advanceTimersByTime(2999);
        });
        expect(result.current.override.isSome).toBe(true);
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current.override).toEqual(NoneOption.get());
    });


    it("defaults to the Info tone and a few seconds", () => {
        const { result } = renderHook(() => useOverrideMessage());
        act(() => result.current.setOverride("Hello"));
        expect(result.current.override).toEqual(new SomeOption({ text: "Hello", tone: "Info" }));
        act(() => {
            vi.advanceTimersByTime(10000);
        });
        expect(result.current.override.isNone).toBe(true);
    });


    it("restarts the timeout when a new override replaces the old one", () => {
        const { result } = renderHook(() => useOverrideMessage());
        act(() => result.current.setOverride("One", "Info", 1000));
        act(() => {
            vi.advanceTimersByTime(800);
        });
        act(() => result.current.setOverride("Two", "Info", 1000));
        act(() => {
            vi.advanceTimersByTime(800);
        });
        expect(result.current.override).toEqual(new SomeOption({ text: "Two", tone: "Info" }));
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current.override.isNone).toBe(true);
    });


    it("clears its timer when unmounted", () => {
        const { result, unmount } = renderHook(() => useOverrideMessage());
        act(() => result.current.setOverride("One", "Info", 1000));
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });


    it("shows in a top bar over the base message and reverts", () => {
        function Harness() {
            const { override, setOverride } = useOverrideMessage();
            const base: TopBarMessage = { text: "Your turn", tone: "MyTurn" };
            const shown = override.defaultValue(base);
            return (
                <>
                    <TopBar text={shown.text} tone={shown.tone} />
                    <button
                        type="button"
                        onClick={() => setOverride("Cannot do that", "Alert", 2000)}
                    >
                        go
                    </button>
                </>
            );
        }
        render(<Harness />);
        expect(screen.getByText("Your turn")).toBeInTheDocument();
        act(() => screen.getByRole("button", { name: "go" }).click());
        expect(screen.getByText("Cannot do that")).toHaveClass("tone-red");
        act(() => {
            vi.advanceTimersByTime(2000);
        });
        expect(screen.getByText("Your turn")).toBeInTheDocument();
    });

});
