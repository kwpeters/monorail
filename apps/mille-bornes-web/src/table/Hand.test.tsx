import { NoneOption, SomeOption } from "@repo/depot/option";
import { Card } from "@repo/mille-bornes-core/card";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardFace } from "../text/cardFace.mjs";
import { Hand, type HandProps } from "./Hand.js";


function showHand(cards: ReadonlyArray<Card>, extras: Partial<HandProps> = {}) {
    const props: HandProps = {
        cards,
        selected: NoneOption.get(),
        playable: () => true,
        counter:  () => false,
        onPlay:   NoneOption.get(),
        onTap:    vi.fn(),
        hidden:   new Set(),
        ...extras,
    };
    return { ...render(<Hand {...props} />), props };
}


function cardButton(name: string): HTMLElement {
    return screen.getByRole("button", { name });
}


describe("Hand", () => {

    it("is labelled Your hand and anchored for animations", () => {
        showHand([Card.dist25]);
        const hand = screen.getByRole("region", { name: "Your hand" });
        expect(hand).toHaveAttribute("data-anim-anchor", "hand");
    });


    it("shows each card, in order, including duplicates", () => {
        const cards = [Card.dist25, Card.dist25, Card.roll, Card.accident, Card.drivingAce];
        showHand(cards);
        const hand = screen.getByRole("region", { name: "Your hand" });
        expect(within(hand).getAllByRole("listitem")).toHaveLength(5);
        expect([...hand.querySelectorAll("[data-card]")].map((c) => c.getAttribute("data-card")))
        .toEqual(cards);
    });


    it("shows an empty hand without cards", () => {
        showHand([]);
        expect(document.querySelectorAll("[data-card]")).toHaveLength(0);
    });


    it("keeps the place of a card still flying in, hidden, as its landing", () => {
        showHand([Card.dist25, Card.roll, Card.stop], { hidden: new Set([2]) });
        const items = [...document.querySelectorAll<HTMLElement>(".cards > li")];
        expect(items.map((li) => li.style.visibility)).toEqual(["", "", "hidden"]);
        expect(items[2]).not.toBeVisible();
        expect(items[0]).toBeVisible();
        // Not read out: only the two cards that have landed are buttons.
        expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
        expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
        const landings = document.querySelectorAll("[data-anim-anchor='hand-card']");
        expect(landings).toHaveLength(1);
        expect(landings[0]).toBe(items[2]);
    });


    it("shows the card and drops its landing once it is no longer hidden", () => {
        const { props, rerender } = showHand([Card.dist25, Card.stop], { hidden: new Set([1]) });
        rerender(<Hand {...props} hidden={new Set()} />);
        expect(cardButton("Stop")).toBeVisible();
        expect(document.querySelector("[data-anim-anchor='hand-card']")).toBeNull();
    });


    describe("the cards", () => {

        it("are buttons holding only phrasing content", () => {
            showHand([Card.dist75, Card.flatTire]);
            const buttons = within(screen.getByRole("list")).getAllByRole("button");
            expect(buttons).toHaveLength(2);
            for (const button of buttons) {
                expect(button.tagName).toBe("BUTTON");
                expect(button).toHaveAttribute("type", "button");
                expect(button.querySelector("div, p, ul, li, section, h2")).toBeNull();
                expect(button.querySelectorAll("[data-card]")).toHaveLength(1);
            }
            expect(cardButton("75 miles")).toBeInTheDocument();
            expect(cardButton("Flat Tire")).toBeInTheDocument();
        });


        it("marks the selected card pressed and the others not", () => {
            showHand([Card.dist25, Card.dist25], { selected: new SomeOption(1) });
            const [first, second] = screen.getAllByRole("button", { name: "25 miles" });
            expect(first).toHaveAttribute("aria-pressed", "false");
            expect(second).toHaveAttribute("aria-pressed", "true");
            expect(second).toHaveClass("selected");
        });


        it("dims a card with no play but keeps it tappable", () => {
            const { props } = showHand([Card.roll, Card.dist50], {
                playable: (c) => c !== Card.roll,
            });
            const roll = cardButton("Roll");
            expect(roll).toHaveAttribute("aria-disabled", "true");
            expect(roll).toHaveClass("dimmed");
            expect(roll).toBeEnabled();
            expect(cardButton("50 miles")).not.toHaveAttribute("aria-disabled");
            fireEvent.click(roll);
            expect(props.onTap).toHaveBeenCalledWith(Card.roll, 0);
        });


        it("makes the answer to a hazard glow, with a badge in words", () => {
            showHand([Card.dist25, Card.punctureProof], {
                counter: (c) => c === Card.punctureProof,
            });
            const answer = cardButton("Puncture Proof Blocks it!");
            expect(answer).toHaveClass("counter");
            expect(cardButton("25 miles")).not.toHaveClass("counter");
            expect(screen.getAllByText("Blocks it!")).toHaveLength(1);
        });


        it("reports a tap with the card and its position", () => {
            const { props } = showHand([Card.dist25, Card.stop]);
            fireEvent.click(cardButton("Stop"));
            expect(props.onTap).toHaveBeenCalledExactlyOnceWith(Card.stop, 1);
        });

    });


    describe("the buttons column", () => {

        it("is there, empty, while no card is picked up", () => {
            const { container } = showHand([Card.dist25]);
            const column = container.querySelector(".hand-actions");
            expect(column).toBeInTheDocument();
            expect(column).toBeEmptyDOMElement();
        });


        it("holds Play, then What's this?, once a card is picked up", () => {
            const { container } = showHand([Card.dist25], {
                selected: new SomeOption(0),
                onPlay:   new SomeOption(vi.fn()),
            });
            const column = container.querySelector<HTMLElement>(".hand-actions")!;
            expect(within(column).getAllByRole("button").map((b) => b.textContent))
            .toEqual(["Play", "❓What's this?"]);
            expect(container.querySelector(".cards")!.nextElementSibling).toBe(column);
        });

    });


    describe("the Play button", () => {

        it("is there only when the selected card has a play that needs no target", () => {
            const onPlay = vi.fn();
            const { rerender, props } = showHand([Card.dist25]);
            expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
            rerender(
                <Hand {...props} selected={new SomeOption(0)} onPlay={new SomeOption(onPlay)} />
            );
            fireEvent.click(screen.getByRole("button", { name: "Play" }));
            expect(onPlay).toHaveBeenCalledOnce();
        });

    });


    describe("the What's this? button", () => {

        it("is there only while a card is picked up, with or without Play", () => {
            const { rerender, props } = showHand([Card.dist25, Card.flatTire]);
            expect(screen.queryByRole("button", { name: "What's this?" })).not.toBeInTheDocument();
            rerender(<Hand {...props} selected={new SomeOption(1)} />);
            expect(screen.getByRole("button", { name: "What's this?" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
        });


        it("shows a question mark, hidden from assistive tech, and is named What's this?", () => {
            showHand([Card.flatTire], { selected: new SomeOption(0) });
            const whatsThis = screen.getByRole("button", { name: "What's this?" });
            expect(within(whatsThis).getByText("❓")).toHaveAttribute("aria-hidden", "true");
            expect(within(whatsThis).getByText("What's this?")).toHaveClass("visually-hidden");
        });


        it("explains the picked-up card without playing or tapping it", () => {
            const onPlay = vi.fn();
            const { props } = showHand([Card.dist25, Card.flatTire], {
                selected: new SomeOption(1),
                onPlay:   new SomeOption(onPlay)
            });
            fireEvent.click(screen.getByRole("button", { name: "What's this?" }));
            const help = screen.getByRole("dialog", { name: "Flat Tire" });
            expect(help).toHaveTextContent(cardFace(Card.flatTire).blurb);
            expect(onPlay).not.toHaveBeenCalled();
            expect(props.onTap).not.toHaveBeenCalled();
        });


        it("gets the focus back when the help closes with Escape or Close", () => {
            showHand([Card.flatTire], { selected: new SomeOption(0) });
            const whatsThis = screen.getByRole("button", { name: "What's this?" });
            for (const close of ["Escape", "Close"]) {
                whatsThis.focus();
                fireEvent.click(whatsThis);
                expect(screen.getByRole("dialog", { name: "Flat Tire" })).toBeInTheDocument();
                if (close === "Escape") {
                    fireEvent.keyDown(window, { key: "Escape" });
                }
                else {
                    fireEvent.click(screen.getByRole("button", { name: "Close" }));
                }
                expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
                expect(whatsThis).toHaveFocus();
            }
        });

    });


    describe("long press", () => {

        beforeEach(() => {
            vi.useFakeTimers();
        });


        afterEach(() => {
            vi.useRealTimers();
        });


        function press(el: HTMLElement, ms: number, release = true): void {
            fireEvent.pointerDown(el, { clientX: 10, clientY: 10 });
            act(() => {
                vi.advanceTimersByTime(ms);
            });
            if (release) {
                // A browser fires the click after the release.
                fireEvent.pointerUp(el, { clientX: 10, clientY: 10 });
                fireEvent.click(el);
            }
        }


        it("opens the card's help after 500 ms, without tapping the card", () => {
            const { props } = showHand([Card.flatTire]);
            press(cardButton("Flat Tire"), 500);
            const help = screen.getByRole("dialog", { name: "Flat Tire" });
            expect(help).toHaveTextContent(cardFace(Card.flatTire).blurb);
            expect(props.onTap).not.toHaveBeenCalled();
        });


        it("is a plain tap when released sooner", () => {
            const { props } = showHand([Card.flatTire]);
            press(cardButton("Flat Tire"), 300);
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(props.onTap).toHaveBeenCalledOnce();
        });


        it("is cancelled by moving more than 10 px", () => {
            showHand([Card.flatTire]);
            const card = cardButton("Flat Tire");
            fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
            fireEvent.pointerMove(card, { clientX: 25, clientY: 10 });
            act(() => {
                vi.advanceTimersByTime(600);
            });
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });


        it("survives a small wobble", () => {
            showHand([Card.flatTire]);
            const card = cardButton("Flat Tire");
            fireEvent.pointerDown(card, { clientX: 10, clientY: 10 });
            fireEvent.pointerMove(card, { clientX: 16, clientY: 15 });
            act(() => {
                vi.advanceTimersByTime(500);
            });
            expect(screen.getByRole("dialog")).toBeInTheDocument();
        });


        it("suppresses the context menu", () => {
            showHand([Card.flatTire]);
            expect(fireEvent.contextMenu(cardButton("Flat Tire"))).toBe(false);
        });


        it("returns focus to the card when the help closes", () => {
            showHand([Card.dist25, Card.flatTire]);
            press(cardButton("Flat Tire"), 500);
            fireEvent.click(screen.getByRole("button", { name: "Close" }));
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(cardButton("Flat Tire")).toHaveFocus();
        });


        it("does not eat the next tap when the release missed the card", () => {
            // With a mouse the release lands on the open dialog, so the card
            // never gets the click that follows a long press.
            const { props } = showHand([Card.flatTire]);
            press(cardButton("Flat Tire"), 500, false);
            fireEvent.click(screen.getByRole("button", { name: "Close" }));
            fireEvent.pointerDown(cardButton("Flat Tire"));
            fireEvent.pointerUp(cardButton("Flat Tire"));
            fireEvent.click(cardButton("Flat Tire"));
            expect(props.onTap).toHaveBeenCalledOnce();
        });


        it("does not eat a keystroke after the help closes", () => {
            // A key press clicks the button with no pointer events before it.
            const { props } = showHand([Card.flatTire]);
            press(cardButton("Flat Tire"), 500, false);
            fireEvent.click(screen.getByRole("button", { name: "Close" }));
            fireEvent.click(cardButton("Flat Tire"));
            expect(props.onTap).toHaveBeenCalledOnce();
        });


        it("leaves no timer behind when the hand goes away", () => {
            const { unmount } = showHand([Card.flatTire]);
            fireEvent.pointerDown(cardButton("Flat Tire"));
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        });

    });

});
