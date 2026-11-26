import { NoneOption, SomeOption } from "@repo/depot/option";
import { Card } from "@repo/mille-bornes-core/card";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { idOf, viewForSeats, withZone } from "../testing/viewFixtures.mjs";
import {
    blockedZone, rollingZone, speedLimitedZone, withCoupFourre, withSafety
} from "../testing/zoneFixtures.mjs";
import { TeamRow, type TeamRowProps } from "./TeamRow.js";


function setup(view: PlayerView, team = 0, extras: Partial<TeamRowProps> = {}) {
    const props: TeamRowProps = {
        view,
        team:       view.teams[team]!,
        onTurn:     NoneOption.get(),
        robots:     NoneOption.get(),
        connected:  NoneOption.get(),
        onPlayHere: NoneOption.get(),
        ...extras,
    };
    return render(<TeamRow {...props} />);
}


function statusTexts(): string[] {
    return within(screen.getByRole("list", { name: "Status" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent);
}


describe("TeamRow", () => {

    describe("the team name and miles", () => {

        it("names the team with its members, the viewer first", () => {
            setup(viewForSeats(4, { viewer: 1 }), 0);
            expect(screen.getByRole("heading", { level: 2 }))
            .toHaveTextContent("Team 1 (you + Ann)");
        });


        it("shows the miles and the trip distance (700)", () => {
            setup(withZone(viewForSeats(2), 0, rollingZone([Card.dist100, Card.dist25])));
            expect(screen.getByText("125")).toBeInTheDocument();
            expect(screen.getByText("of 700")).toBeInTheDocument();
        });


        it("shows the trip distance of the 4-seat variant (1,000)", () => {
            setup(viewForSeats(4));
            expect(screen.getByText("0")).toBeInTheDocument();
            expect(screen.getByText("of 1,000")).toBeInTheDocument();
        });


        it("has a progress bar named for the team", () => {
            setup(withZone(viewForSeats(2), 1, rollingZone([Card.dist200, Card.dist100])), 1);
            const bar = screen.getByRole("progressbar", { name: "Team 2 miles" });
            expect(bar).toHaveAttribute("aria-valuenow", "300");
            expect(bar).toHaveAttribute("aria-valuemin", "0");
            expect(bar).toHaveAttribute("aria-valuemax", "700");
        });

    });


    describe("the status chips", () => {

        it("says Needs a Roll for a fresh team", () => {
            setup(viewForSeats(2));
            expect(statusTexts()).toEqual(["Needs a Roll"]);
        });


        it("says Rolling for a team that can move", () => {
            setup(withZone(viewForSeats(2), 0, rollingZone()));
            expect(statusTexts()).toEqual(["Rolling"]);
        });


        it("names the hazard that blocks the team", () => {
            setup(withZone(viewForSeats(2), 0, blockedZone(Card.flatTire)));
            expect(statusTexts()).toEqual(["Flat Tire"]);
        });


        it("shows a speed limit next to the status", () => {
            setup(withZone(viewForSeats(2), 0, speedLimitedZone()));
            expect(statusTexts()).toEqual(["Rolling", "Speed Limit: 50 max"]);
        });


        it("lists each safety by name", () => {
            const zone = withSafety(withSafety(rollingZone(), Card.rightOfWay), Card.extraTank);
            setup(withZone(viewForSeats(2), 0, zone));
            expect(statusTexts()).toEqual(["Rolling", "Right of Way", "Extra Tank"]);
        });


        it("counts the Coup Fourres", () => {
            const zone = withCoupFourre(
                withCoupFourre(rollingZone(), Card.drivingAce),
                Card.punctureProof
            );
            setup(withZone(viewForSeats(2), 0, zone));
            expect(statusTexts()).toContain("Coup Fourre ×2");
            expect(statusTexts()).toContain("Driving Ace");
        });


        it("shows no Coup Fourre chip for ordinary safeties", () => {
            setup(withZone(viewForSeats(2), 0, withSafety(rollingZone(), Card.drivingAce)));
            expect(screen.queryByText(/coup fourre/iu)).not.toBeInTheDocument();
        });

    });


    describe("the players", () => {

        it("shows a chip for each member of the team", () => {
            const view = viewForSeats(4);
            setup(view, 1);
            const chips = within(screen.getByRole("list", { name: "Players" }))
            .getAllByRole("listitem");
            expect(chips.map((c) => c.textContent)).toEqual(["Bob", "Di"]);
        });


        it("marks the player on turn with a dot, and aria-current", () => {
            const view = viewForSeats(4);
            setup(view, 0, { onTurn: new SomeOption(idOf(view, "Ann")) });
            const ann = screen.getByText("Ann").closest("li")!;
            const cy = screen.getByText("Cy").closest("li")!;
            expect(ann).toHaveAttribute("aria-current", "true");
            expect(ann).toHaveClass("on-turn");
            expect(ann).toHaveTextContent("●");
            expect(cy).not.toHaveAttribute("aria-current");
            expect(cy).not.toHaveTextContent("●");
        });


        it("highlights the lane of the team on turn", () => {
            const view = viewForSeats(4);
            const { container } = setup(view, 0, { onTurn: new SomeOption(idOf(view, "Ann")) });
            expect(container.firstElementChild).toHaveClass("active");
            expect(container.firstElementChild).toHaveAttribute("aria-current", "true");
        });


        it("does not highlight a lane when nobody on the team is on turn", () => {
            const view = viewForSeats(4);
            const { container } = setup(view, 1, { onTurn: new SomeOption(idOf(view, "Ann")) });
            expect(container.firstElementChild).not.toHaveClass("active");
            expect(container.firstElementChild).not.toHaveAttribute("aria-current");
        });

    });


    describe("organizer-only markers", () => {

        const view = viewForSeats(4);
        const cy = idOf(view, "Cy");
        const ann = idOf(view, "Ann");


        it("marks robots, with a hidden text for assistive tech, only when told", () => {
            setup(view, 0, { robots: new SomeOption([cy]) });
            const chip = screen.getByText("Cy").closest("li")!;
            expect(within(chip).getByText("Robot")).toHaveClass("visually-hidden");
            expect(within(chip).getByText("\u{1F916}")).toHaveAttribute("aria-hidden", "true");
            expect(within(screen.getByText("Ann").closest("li")!).queryByText("Robot"))
            .not.toBeInTheDocument();
        });


        it("marks players missing from the connected list", () => {
            const connected: ReadonlyArray<PlayerId> = [ann];
            setup(view, 0, { connected: new SomeOption(connected) });
            expect(within(screen.getByText("Cy").closest("li")!).getByText(/disconnected/u))
            .toBeInTheDocument();
            expect(within(screen.getByText("Ann").closest("li")!).queryByText(/disconnected/u))
            .not.toBeInTheDocument();
        });


        it("renders nothing for either when the lists are not known", () => {
            setup(view, 0);
            expect(screen.queryByText("Robot")).not.toBeInTheDocument();
            expect(screen.queryByText("\u{1F916}")).not.toBeInTheDocument();
            expect(screen.queryByText(/disconnected/u)).not.toBeInTheDocument();
        });

    });


    describe("as a target", () => {

        it("has a Play on button when an attack can land on it", () => {
            const onPlayHere = vi.fn();
            const { container } = setup(viewForSeats(3), 1, {
                onPlayHere: new SomeOption(onPlayHere),
            });
            expect(container.firstElementChild).toHaveClass("targeted");
            fireEvent.click(screen.getByRole("button", { name: "Play on Team 2" }));
            expect(onPlayHere).toHaveBeenCalledOnce();
        });


        it("has no button otherwise", () => {
            const { container } = setup(viewForSeats(3), 1);
            expect(container.firstElementChild).not.toHaveClass("targeted");
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });

    });


    describe("anchors", () => {

        it("anchors the lane by its team index", () => {
            const { container } = setup(viewForSeats(3), 2);
            expect(container.firstElementChild).toHaveAttribute("data-anim-anchor", "team-2");
        });

    });

});
