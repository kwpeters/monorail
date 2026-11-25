import { Card } from "@repo/mille-bornes-core/card";
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { cardFace } from "../text/cardFace.mjs";
import { CardHelp } from "./CardHelp.js";


function showHelp() {
    const onClose = vi.fn();
    render(<CardHelp card={Card.roll} onClose={onClose} />);
    return { onClose, dialog: screen.getByRole("dialog", { name: "Roll" }) };
}


describe("CardHelp", () => {

    it("opens as a modal dialog with the card's name and its one sentence", () => {
        const { dialog } = showHelp();
        expect(dialog).toHaveAttribute("open");
        expect(dialog).toHaveTextContent(cardFace(Card.roll).blurb);
    });


    it("closes with its Close button", async () => {
        const { onClose, dialog } = showHelp();
        await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));
        expect(dialog).not.toHaveAttribute("open");
        expect(onClose).toHaveBeenCalledOnce();
    });


    it("closes with Escape", async () => {
        const { onClose } = showHelp();
        await userEvent.setup().keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledOnce();
    });


    it("closes when the backdrop is tapped", () => {
        const { onClose, dialog } = showHelp();
        fireEvent.pointerDown(dialog);
        fireEvent.click(dialog);
        expect(onClose).toHaveBeenCalledOnce();
    });


    it("stays open for a tap inside it, or a release that started elsewhere", () => {
        const { onClose, dialog } = showHelp();
        fireEvent.click(screen.getByText(cardFace(Card.roll).blurb));
        // The release of the long press that opened it.
        fireEvent.click(dialog);
        expect(onClose).not.toHaveBeenCalled();
        expect(dialog).toHaveAttribute("open");
    });

});
