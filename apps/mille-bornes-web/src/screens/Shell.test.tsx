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


    describe("hideBar", () => {

        it("leaves out the header and its controls, and keeps the main landmark", () => {
            render(<Shell hideBar controls={<button>Mute</button>}><p>table</p></Shell>);
            expect(screen.queryByRole("banner")).toBeNull();
            expect(screen.queryByRole("button", { name: "Mute" })).toBeNull();
            expect(within(screen.getByRole("main")).getByText("table")).toBeInTheDocument();
        });


        it("keeps the one h1 for the page, hidden from sight", () => {
            render(<Shell hideBar><h2>Table</h2></Shell>);
            const headings = screen.getAllByRole("heading", { level: 1 });
            expect(headings).toHaveLength(1);
            expect(headings[0]).toHaveTextContent("Mille Bornes");
            expect(headings[0]).toHaveClass("visually-hidden");
        });


        it("still shows the banner above the main content", () => {
            render(<Shell hideBar banner={<p>Reconnecting...</p>}>content</Shell>);
            expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
            expect(within(screen.getByRole("main")).queryByText("Reconnecting...")).toBeNull();
        });


        it("keeps the header when it is false", () => {
            render(<Shell hideBar={false}>content</Shell>);
            expect(screen.getByRole("banner")).toBeInTheDocument();
        });

    });

});
