import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary.js";


function Thrower(props: { fail: boolean }): string {
    if (props.fail) {
        throw new Error("a screen this page does not know");
    }
    return "All good";
}


describe("ErrorBoundary", () => {

    // React reports a caught render error on the console, and jsdom as an
    // uncaught error event; both are expected here.
    const quiet = (e: ErrorEvent): void => e.preventDefault();


    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        window.addEventListener("error", quiet);
    });


    afterEach(() => {
        window.removeEventListener("error", quiet);
        vi.restoreAllMocks();
    });


    it("shows its children when they render", () => {
        render(<ErrorBoundary><Thrower fail={false} /></ErrorBoundary>);
        expect(screen.getByText("All good")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });


    it("shows Something went wrong and a Reload button when a child throws", () => {
        render(<ErrorBoundary><Thrower fail={true} /></ErrorBoundary>);
        expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
        expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    });


    it("reloads the page when Reload is tapped", async () => {
        const reload = vi.fn<() => void>();
        render(<ErrorBoundary reload={reload}><Thrower fail={true} /></ErrorBoundary>);
        await userEvent.setup().click(screen.getByRole("button", { name: "Reload" }));
        expect(reload).toHaveBeenCalledOnce();
    });


    it("tries again when the reset key changes, and not before", () => {
        const { rerender } = render(
            <ErrorBoundary resetKey={1}><Thrower fail={true} /></ErrorBoundary>
        );
        rerender(<ErrorBoundary resetKey={1}><Thrower fail={false} /></ErrorBoundary>);
        expect(screen.getByRole("alert")).toBeInTheDocument();
        rerender(<ErrorBoundary resetKey={2}><Thrower fail={false} /></ErrorBoundary>);
        expect(screen.getByText("All good")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

});
