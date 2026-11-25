import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";


describe("App", () => {

    it("renders the game title as a heading", () => {
        render(<App />);
        expect(screen.getByRole("heading", { name: "Mille Bornes" })).toBeInTheDocument();
    });


    it("shows the loading text", () => {
        render(<App />);
        expect(screen.getByText("Loading")).toBeInTheDocument();
    });

});
