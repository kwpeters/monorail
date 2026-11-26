/** The vertical extent of a box on screen, as `getBoundingClientRect()` gives it. */
export interface VerticalSpan {
    readonly top:    number;
    readonly bottom: number;
}


/** The gap kept between a revealed target and the hand above it. */
const marginPx = 8;


/**
 * Works out how far to scroll down so that no target is under the hand,
 * which stays at the bottom of a short screen while the rest scrolls under
 * it.  The targets all sit above the hand in the page, so scrolling down
 * brings the lowest covered one out from under it, and the others with it.
 * A target counts as covered when it overlaps the hand, comes within the
 * margin of it, or is below it (off the screen, under where the hand is);
 * a hand of no height (no layout) covers nothing.
 * @param targets - Where the targets are now
 * @param hand - Where the hand is now
 * @returns The pixels to scroll down; 0 when nothing is covered
 */
export function scrollToUncover(
    targets: ReadonlyArray<VerticalSpan>,
    hand:    VerticalSpan
): number {
    if (hand.bottom <= hand.top) {
        return 0;
    }
    const covered = targets
    .filter((t) => t.bottom + marginPx > hand.top)
    .map((t) => t.bottom + marginPx - hand.top);
    return Math.max(0, ...covered);
}
