import type { ReactElement } from "react";
import { useCountdown } from "../table/useCountdown.js";
import { describeRaceResult, raceWinner } from "../text/describeEvent.mjs";
import type { PlayingData } from "./GameScreen.js";
import { ScoreSheet } from "./ScoreSheet.js";


/** What `RaceSummary` needs. */
export interface RaceSummaryProps {
    /** A Playing screen whose phase is `RaceOver`. */
    screen: PlayingData;
}


/**
 * What the table shows between races: how the race ended, the score sheet
 * for every team, and the seconds until the server deals the next race.  The
 * countdown is not a live region (the top bar announces the end of the
 * race), and it is absent when the server sent no `NextRace` timer.  It says
 * nothing about who is a robot.
 * @param props - The Playing screen
 * @returns The summary, or nothing when the race is not over
 */
export function RaceSummary(props: RaceSummaryProps): ReactElement | null {
    const { screen } = props;
    const { view } = screen;
    const seconds = useCountdown(screen, "NextRace");
    const { phase } = view;
    if (phase.kind !== "RaceOver") {
        return null;
    }
    const { result } = phase;
    return (
        <>
            <h2>Race over</h2>
            <p className="race-outcome">{describeRaceResult(result, view.me.team)}</p>
            <ScoreSheet
                view={view}
                result={result}
                winner={raceWinner(result)}
                winnerLabel="Race winner"
                caption="Points for each team in this race"
            />
            {seconds.match(
                (n) => <p className="countdown" role="timer">{`Next race in ${n} s`}</p>,
                () => null
            )}
        </>
    );
}
