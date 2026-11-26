# Mille Bornes Rules Used by This Project

Source: the owner's rulebook (Winning Moves / Hasbro, 1992 and 2008 editions), supplied as `MBrules.pdf`.
Page numbers below are the booklet's printed page numbers.

Vocabulary: this project calls one contest to complete the trip distance a **race** (the rulebook says "hand" or "deal").
"Hand" means only the cards a player holds.

This file is the authority for game rules.
Where it disagrees with `design.md` or the implementation plans, this file wins.

## Confirmed by the rulebook

- **Deck.**
  112 cards minus 6 reference cards leaves 106 playing cards (p. 2, 6).
- **Turn.**
  Draw one card, then play one card or discard one card.
  A player always holds 6 cards at the end of a turn (p. 6, 10).
- **Draw pile exhausted.**
  The race continues: players "play out or discard in turn the remaining cards in their hands" without drawing.
  A trip completed after the draw pile is exhausted earns the Delayed Action bonus.
  The race ends when a team completes the trip or when all cards have been played (p. 12).
- **Extra turn.**
  Playing a Safety card, normally or as a Coup Fourré, always earns an immediate extra draw and play.
  A player may chain several Safety cards (p. 9, 12, 14).
- **Hazards.**
  Played only on an opponent's Battle Pile, on top of a Roll card.
  A hazard may never be played directly on another hazard (p. 2, 6).
  Exception: against a team showing Right of Way, a calamity may be played on top of a remedy card (p. 12).
  Speed Limit goes on the Speed Pile and may be played even when the opponent has no Roll showing or has a hazard showing (p. 9, 18).
- **Resuming.**
  After Stop, play Roll.
  After a calamity, play its remedy and then Roll.
  Right of Way removes the need for Roll (p. 10, 12).
  A team must have Roll (or Right of Way) showing before playing any distance card (p. 10, 12).
- **Safety cards.**
  A Safety card "prevents any further attack and cancels the attack in progress" (p. 11).
  Right of Way blocks Stop and Speed Limit, lets a team drive without a Roll, and lets it ignore a Speed Limit (p. 12).
  Extra Tank blocks Out of Gas, Puncture Proof blocks Flat Tire, and Driving Ace blocks Accident (p. 12).
- **Distance.**
  A trip is exact: a card that would take the total past the trip distance cannot be played.
  At most two 200-mile cards per team per race (p. 12).
  While a Speed Limit is showing, only 25- and 50-mile cards may be played (p. 10).
- **Coup Fourré.**
  When an opponent plays a hazard and you hold the matching Safety card, you may play it immediately, on or off your turn, before anyone draws (p. 13).
  The hazard goes to the discard pile, and the situation before the hazard is restored.
  This game gives the target team 8 seconds to play it (the Coup Fourré window),
  unless the matching Safety card is already on any team's drive pile:
  nobody can hold it then, so there is no window and the hazard lands at once.
  You then draw one card (5 back to 6) and, because you played a Safety card, draw again and take an extra turn.
  Players between you and the attacker lose their turns (p. 14).
- **Winning the game.**
  Points carry across races.
  The first team to reach 5,000 wins; if both exceed 5,000 in the same race, the higher total wins (p. 14-15).
  The score is totaled after every race "whether or not a trip was completed" (p. 14).
- **Scoring.**
  - 1 point per mile traveled.
  - 100 per Safety card played.
  - 300 extra if one team plays all four Safety cards.
  - 300 per Coup Fourré, in addition to the 100 for the Safety card (p. 14, 18).
  - Trip completed: 400.
  - Delayed Action: 300.
  - Safe Trip (trip completed with no 200-mile cards): 300.
  - Shutout (trip completed before opponents play any distance card): 500.
  - The printed rulebook has Safe Trip 500 and Shutout 300; this project reverses them by the owner's decision (see "Decisions made by this project").
- **Score sheet (p. 19).**
  One column per team.
  Rows: brought forward, milestones, safeties, coup-fourrés, trip completed, delayed action, safe trip, shutout, extension, total for deal; then the combined total.
- **Seating and order.**
  Partners sit opposite each other, so turns alternate between teams.
  Six players are three partnerships of two (A and D, B and E, C and F) (p. 4, 18).

## Corrections to earlier assumptions

These came from the rulebook and replace what `design.md` and the first plan draft said.

- A Safety card played while its matching hazard is active cancels the hazard, so the team is rolling again immediately (the Roll beneath is exposed again).
  The earlier draft required a new Roll.
- The trip distance is not always 1,000 miles (see "Player counts, trip distance, and Extension").

## Decisions made by this project beyond the rulebook

- **Discarding.**
  The rulebook says to discard when you cannot make a play (p. 8), but hints C and D (p. 17) tell players to discard useless cards early and to hold Safety cards for a Coup Fourré.
  This project lets a player discard any one card instead of playing.
- **Early end when nobody can play.**
  Once the draw pile is empty,
  the race ends at once if no player holds a card that can be played in any way except a Discard
  (nobody can drive, play a remedy or a safety, or attack).
  Every team is then stuck, for example stopped with no remedy in any hand or short of the exact trip distance,
  so the rest of the race would be players discarding until their hands are empty.
  A discard changes nothing that affects scoring,
  so the race ends as if the cards had run out and scores exactly as it would have:
  the team with the most miles wins (or it is a tie).
  With cards still in the draw pile the race goes on,
  because drawing changes what players hold.
- **No stacked Speed Limits.**
  The rulebook allows a Speed Limit on a team that already has one (hint H, p. 18).
  By the owner's decision this project refuses it, because a second Speed Limit has no effect.
- **Safe Trip and Shutout values.**
  Safe Trip is 300 and Shutout is 500.
  The printed rulebook has them the other way around.
  By the owner's decision the harder bonus, Shutout, is worth more.
- **Playing a useless card is refused.**
  For example a Roll while already rolling, or a remedy with nothing to cure.
  The player gets a plain explanation and can discard instead.
- **Game lengths** (chosen by the organizer).
  - Quick: one race; the first team to complete the trip wins, or the team with the most miles if the cards run out.
    If teams tie on miles, another race is dealt.
  - Short: races until a team reaches 2,000 points.
  - Full: races until a team reaches 5,000 points, as in the rulebook.
  - In Short and Full, if teams tie for the highest total at or above the goal, another race is dealt.
- **First player.**
  Seat 0 plays first in race 1; the first player advances one seat each race.
- **End-of-race scoreboard.**
  After every race all players see the score sheet for every team: the total brought forward, miles, safeties, coup-fourrés, trip completed, delayed action, safe trip, shutout, the total for the race, and the combined total.

## Player counts, trip distance, and Extension

The rulebook varies the game by the number of players (p. 2, 16-18).
The owner decided to follow it fully, including Extension.

- 2 players (2 teams of 1): 700-mile trip, Extension allowed.
  The deck drops to 101 cards: remove one each of Stop, Accident, Out of Gas, Flat Tire, and Speed Limit.
- 3 players (3 teams of 1): 700-mile trip, Extension allowed, the same 101-card deck.
- 4 players (2 teams of 2): 1,000-mile trip, no Extension, full 106-card deck.
- 6 players (3 teams of 2): 700-mile trip, Extension allowed, full 106-card deck.

The rulebook has no 5-player game and no 2-teams-of-3 game, so this project does not offer them.
A game needs exactly 2, 3, 4, or 6 seats, counting robots.
The team structure follows from the seat count, so the organizer no longer chooses it.
Turn order is seat order, and a seat's team is its position in that order modulo the number of teams
(for example, with 4 seats in order A, B, C, D the teams are A and C against B and D).
The organizer arranges teams by swapping seats.

### How exact trips work with Extension (p. 16)

In a 700-mile game the trip is exactly 700 miles for every team until someone calls Extension.
A team at 650 miles therefore cannot play a 100 or a 75 (it would pass 700); only a 25 or a 50 fits.
This is the same exact-total rule as the 1,000-mile game, where a team at 950 can play only a 25 or a 50.

When a team reaches exactly 700 it must decide at that moment.
Only the first team to reach 700 gets the choice, and the decision belongs to the player whose card reached 700.

- **Do not call Extension.**
  The trip is complete at 700 and the race ends: the team scores the 400 trip bonus and any other bonuses.
- **Call Extension.**
  The race continues as a 1,000-mile race for every team, so every team's limit is now 1,000.
  - If the caller reaches 1,000 first, the caller scores the 400 trip bonus plus a 200 Extension bonus.
  - If anyone else reaches 1,000 first, or the cards run out first, the caller scores no trip bonus,
    and **every other team** scores the 200 Extension bonus (the owner's reading of "his opponent or opponents", chosen to raise the stakes).
    The team that completes the trip also keeps its 400 trip bonus.
- If the player does not answer in time, the server counts that as not calling Extension.

Example in a 2-player game: Ann has 650 and holds a 100 and a 50.
She cannot play the 100.
She plays the 50 and reaches exactly 700, then chooses: stop and win the race with the trip bonus, or call Extension and race on to 1,000 with the risk that Bob gets there first and also collects 200.

## Open decisions

None.
