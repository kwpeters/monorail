import { NoneOption, SomeOption } from "@repo/depot/option";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pendingViewForSeats } from "../testing/pendingFixtures.mjs";
import { TeamList } from "./TeamList.js";


describe("TeamList", () => {

    it("groups seats by team and marks the player's own seat", () => {
        const { view } = pendingViewForSeats([{ name: "Ann" }, { name: "Bob" }], { viewer: 1 });
        render(<TeamList seats={view.seats} showKinds={false} hint={NoneOption.get()} />);
        expect(within(screen.getByRole("region", { name: "Team 1" })).getByText("Ann"))
        .toBeInTheDocument();
        const team2 = screen.getByRole("region", { name: "Team 2" });
        expect(within(team2).getByText("(you)")).toBeInTheDocument();
    });


    it("shows one Players list and the hint when seats have no team", () => {
        const { view } = pendingViewForSeats([{ name: "Ann" }]);
        render(<TeamList seats={view.seats} showKinds={false} hint={new SomeOption("Hi")} />);
        const players = screen.getByRole("region", { name: "Players" });
        expect(within(players).getByText("Ann")).toBeInTheDocument();
        expect(screen.getByText("Hi")).toBeInTheDocument();
    });


    it("shows the robot marker only when asked to show kinds", () => {
        const { view } = pendingViewForSeats([{ name: "Ann" }, { name: "Cy", kind: "Robot" }]);
        const { rerender } = render(
            <TeamList seats={view.seats} showKinds={false} hint={NoneOption.get()} />
        );
        expect(screen.queryByText("Robot")).not.toBeInTheDocument();
        rerender(<TeamList seats={view.seats} showKinds={true} hint={NoneOption.get()} />);
        expect(screen.getByText("Robot")).toBeInTheDocument();
    });

});
