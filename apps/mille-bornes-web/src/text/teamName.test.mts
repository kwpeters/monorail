import { describe, expect, it } from "vitest";
import { idOf, team, viewForSeats } from "../testing/viewFixtures.mjs";
import { describeTeamName, nameOf, subjectOf, teamLabel } from "./teamName.mjs";


describe("teamName", () => {

    describe("nameOf", () => {

        it("returns the seat's name", () => {
            const view = viewForSeats(2);
            expect(nameOf(view, idOf(view, "Bob"))).toBe("Bob");
        });


        it("falls back to Someone for an id that has no seat", () => {
            const view = viewForSeats(2);
            const stranger = { ...view, seats: view.seats.filter((s) => s.name !== "Bob") };
            expect(nameOf(stranger, idOf(view, "Bob"))).toBe("Someone");
        });


        it("returns a name containing markup verbatim", () => {
            const view = viewForSeats(2, { names: ["Ann", "<b>Bob</b>"] });
            expect(nameOf(view, idOf(view, "<b>Bob</b>"))).toBe("<b>Bob</b>");
        });

    });


    describe("subjectOf", () => {

        it("says You for the viewer and the name for anyone else", () => {
            const view = viewForSeats(2);
            expect(subjectOf(view, idOf(view, "Ann"))).toBe("You");
            expect(subjectOf(view, idOf(view, "Bob"))).toBe("Bob");
        });

    });


    describe("teamLabel", () => {

        it("numbers teams from 1", () => {
            expect(teamLabel(team(0))).toBe("Team 1");
            expect(teamLabel(team(2))).toBe("Team 3");
        });

    });


    describe("describeTeamName", () => {

        it("shows the viewer as you on a team of one", () => {
            expect(describeTeamName(viewForSeats(3), team(0))).toBe("Team 1 (you)");
        });


        it("names another player on a team of one", () => {
            expect(describeTeamName(viewForSeats(3), team(2))).toBe("Team 3 (Cy)");
        });


        it("lists the viewer first on a team of two", () => {
            expect(describeTeamName(viewForSeats(4), team(0))).toBe("Team 1 (you + Cy)");
            const second = viewForSeats(4, { viewer: 1 });
            expect(describeTeamName(second, team(0))).toBe("Team 1 (you + Ann)");
        });


        it("joins the names of a team without the viewer", () => {
            expect(describeTeamName(viewForSeats(4), team(1))).toBe("Team 2 (Bob + Di)");
        });


        it("returns names containing markup verbatim", () => {
            const view = viewForSeats(2, { names: ["Ann", "<b>Bob</b>"] });
            expect(describeTeamName(view, team(1))).toBe("Team 2 (<b>Bob</b>)");
        });

    });

});
