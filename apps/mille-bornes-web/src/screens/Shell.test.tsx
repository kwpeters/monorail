import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Shell } from "./Shell.js";


describe("Shell", () => {

    it("has the game title as the page heading in a banner landmark", () => {
        render(<Shell>content</Shell>);
        const header = screen.getByRole("banner");
        expect(within(header).getByRole("heading", { name: "Mille Bornes", level: 1 }))
        .toBeInTheDocument();
    });


    it("puts the children in the main landmark", () => {
        render(<Shell><p>hello</p></Shell>);
        expect(within(screen.getByRole("main")).getByText("hello")).toBeInTheDocument();
    });


    it("shows the right-side controls in the header", () => {
        render(<Shell controls={<button>Mute</button>}>content</Shell>);
        expect(within(screen.getByRole("banner")).getByRole("button", { name: "Mute" }))
        .toBeInTheDocument();
    });


    it("shows a banner between the header and the main content", () => {
        render(<Shell banner={<p>Reconnecting...</p>}>content</Shell>);
        expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
        expect(within(screen.getByRole("main")).queryByText("Reconnecting...")).toBeNull();
    });

});
