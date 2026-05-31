# schedule-generator combined plan

This document combines the narrative concept and concrete implementation plan
for `schedule-generator` v1.

The purpose of this app is to accept structured daily schedule input, compute
a valid schedule, and output an HTML page containing a D3 diagram of the
result.

## 1) Deliverables

- New app at `apps/schedule-generator`.
- CLI that reads JSON input and writes HTML output.
- Validation pipeline with structured errors.
- Scheduler that either:
  - returns a valid schedule with objective metrics, or
  - returns unsat with one most likely top blocking cause.
- D3 renderer producing a swim-lane timeline:
  - appointments,
  - car trajectories,
  - occupant labels on each transit segment.

## 2) v1 scope and fixed decisions

- Input is JSON from CLI argument.
- Single local day only, from 5:00 AM to 12:00 midnight.
- All times and travel durations are 5-minute increments.
- Car capacity is unbounded.
- Cars include required `startLocation`.
- Every person must be at `endLocation` by midnight.
- Driver required only while a car is in use (moving or carrying riders).
- Travel matrix is symmetric, but the user provides each pair once
  (no duplicated `A -> B` and `B -> A` burden).
- If appointments overlap in one location, render them in side-by-side sub-lane
  columns while preserving vertical time placement.

## 3) Input

- People collection:
  - `name` (unique)
  - `canDrive` (boolean)
  - `startLocation`
  - `endLocation`
- Cars collection:
  - `name` (unique)
  - `startLocation`
- Appointments collection:
  - `name`
  - `startTime`
  - `endTime`
  - `startTimeFlexibility` (`strict` or `flexible`)
  - `endTimeFlexibility` (`strict` or `flexible`)
  - `location`
  - `attendees` (list of person names)
- Locations are derived from all person start/end locations and all
  appointment locations (unique set).
- Travel times are provided as a symmetric matrix input by unique unordered
  location pairs.

## 4) App structure in monorepo

Create files:

- `apps/schedule-generator/package.json`
- `apps/schedule-generator/tsconfig.json`
- `apps/schedule-generator/tsconfig.src.json`
- `apps/schedule-generator/eslint.config.ts`
- `apps/schedule-generator/jasmine.json`
- `apps/schedule-generator/src/index.cts`
- `apps/schedule-generator/src/main.mts`
- `apps/schedule-generator/src/contracts.mts`
- `apps/schedule-generator/src/parseInput.mts`
- `apps/schedule-generator/src/validateInput.mts`
- `apps/schedule-generator/src/normalizeInput.mts`
- `apps/schedule-generator/src/schedulerTypes.mts`
- `apps/schedule-generator/src/scheduler.mts`
- `apps/schedule-generator/src/unsatAnalysis.mts`
- `apps/schedule-generator/src/diagramModel.mts`
- `apps/schedule-generator/src/renderHtml.mts`
- `apps/schedule-generator/src/main.test.mts`
- `apps/schedule-generator/src/validateInput.test.mts`
- `apps/schedule-generator/src/scheduler.test.mts`
- `apps/schedule-generator/src/renderHtml.test.mts`

Follow the same script pattern used by existing apps (`build`, `test`,
`lint`, `type-check`, `depcheck`).

## 5) CLI contract

Command:

```text
schedule-generator --input ./day.json --output ./schedule.html [--pretty] [--explain]
```

Arguments:

- `--input` (required): path to source JSON.
- `--output` (required): path to generated HTML.
- `--pretty` (optional): pretty-print embedded JSON blocks in HTML.
- `--explain` (optional): include objective/constraint diagnostics in output.

Exit codes:

- `0`: success.
- `2`: validation failure.
- `3`: unsat (no valid schedule).
- `1`: unexpected runtime failure.

Stdout/stderr behavior:

- Success: write short summary to stdout (appointments, trips, total adjustment,
  total travel).
- Validation errors and unsat cause: write structured human-readable message to
  stderr.

## 6) JSON data contract (v1)

Top-level shape:

```json
{
  "people": [
    {
      "name": "Alex",
      "canDrive": true,
      "startLocation": "Home",
      "endLocation": "Home"
    }
  ],
  "cars": [
    {
      "name": "Car-1",
      "startLocation": "Home"
    }
  ],
  "appointments": [
    {
      "name": "Dentist",
      "startTime": "09:00",
      "endTime": "10:00",
      "startTimeFlexibility": "strict",
      "endTimeFlexibility": "flexible",
      "location": "Downtown",
      "attendees": ["Alex"]
    }
  ],
  "travelTimes": [
    {
      "locationA": "Home",
      "locationB": "Downtown",
      "minutes": 25
    }
  ]
}
```

Rules:

- `startTime`/`endTime` format: `HH:mm`, 24-hour clock.
- Time domain in v1: `05:00` to `24:00` (inclusive endpoint for day end).
- `minutes` must be positive and divisible by `5`.
- `travelTimes` is undirected input:
  - exactly one record for each unordered location pair `{A,B}` where `A != B`.
  - no self-pairs.
- Normalization expands each undirected pair into directed lookups in memory.

## 7) Validation specification

Validation phases:

1. Shape/schema validation (Zod).
2. Cross-reference validation (names, attendees, location existence).
3. Temporal validation (format, increments, bounds, start < end).
4. Matrix completeness validation.
5. Pre-solver conflict validation.

Suggested validation error codes:

- `VAL_DUP_PERSON_NAME`
- `VAL_DUP_CAR_NAME`
- `VAL_BAD_TIME_FORMAT`
- `VAL_TIME_INCREMENT`
- `VAL_TIME_ORDER`
- `VAL_TIME_OUT_OF_RANGE`
- `VAL_UNKNOWN_ATTENDEE`
- `VAL_UNKNOWN_LOCATION`
- `VAL_BAD_TRAVEL_INCREMENT`
- `VAL_DUP_TRAVEL_PAIR`
- `VAL_MISSING_TRAVEL_PAIR`
- `VAL_STRICT_OVERLAP_UNRESOLVABLE`

Return type for validation:

```ts
type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ReadonlyArray<ValidationIssue> };
```

## 8) Core normalized model

Use 5-minute ticks for the solver:

- `tick = 0` maps to `05:00`.
- `tick = 228` maps to `24:00`.
- `minutes = tick * 5 + 300`.

Core types:

```ts
type Tick = number;
type PersonId = string;
type CarId = string;
type LocationId = string;

interface NormalizedAppointment {
  id: string;
  name: string;
  locationId: LocationId;
  attendeeIds: ReadonlyArray<PersonId>;
  requestedStartTick: Tick;
  requestedEndTick: Tick;
  startFlexible: boolean;
  endFlexible: boolean;
}

interface TravelLookup {
  getTicks(from: LocationId, to: LocationId): Tick;
}
```

## 9) Solver interface and behavior

Define interface:

```ts
interface SolverRequest {
  people: ReadonlyArray<PersonState0>;
  cars: ReadonlyArray<CarState0>;
  appointments: ReadonlyArray<NormalizedAppointment>;
  travel: TravelLookup;
}

interface SolverResult {
  ok: boolean;
  schedule?: FinalSchedule;
  unsat?: UnsatSummary;
}
```

Algorithm approach for v1:

- Use deterministic branch-and-bound with forward checking.
- Appointment ordering heuristic:
  - first by least flexibility,
  - then by earliest requested start,
  - then by higher attendee count.
- For each appointment, attempt candidate windows in order:
  - requested bounds,
  - earlier arrival/later departure buffering,
  - if allowed, minimal flexible boundary shifts.
- Route assignment at each decision:
  - enumerate feasible car movement options,
  - ensure at least one driver while car in use,
  - enforce person/car non-overlap in time.
- Branch objective (lexicographic):
  - `obj1 = totalAppointmentAdjustmentMinutes`,
  - `obj2 = totalTravelMinutes`.
- Prune any partial branch whose lower bound dominates current incumbent.

Unsat analysis:

- Track most recent failing constraint families during search.
- Return one top likely cause using a ranking:
  - strict temporal overlap,
  - missing feasible transport path,
  - insufficient simultaneous driver coverage,
  - day-end return infeasibility.

## 10) Output data model for renderer

`diagramModel` should be solver-agnostic and explicit:

```ts
interface DiagramModel {
  timeStartTick: Tick;
  timeEndTick: Tick;
  lanes: ReadonlyArray<LocationLane>;
  appointmentBlocks: ReadonlyArray<AppointmentBlock>;
  carPaths: ReadonlyArray<CarPath>;
  legend: ReadonlyArray<CarLegendItem>;
}
```

Appointment overlap layout per location:

- Run interval partitioning to assign `columnIndex` and `columnCount` per block.
- Keep `y` fully determined by time, while `x` offsets by column.

Lane ordering:

- For each location, compute average travel minutes to all other locations.
- Sort ascending by average, tie-break by location name.

## 11) HTML + D3 rendering spec

- Single self-contained HTML file output.
- Embed serialized `DiagramModel` JSON into the page.
- Render with D3:
  - fixed left margin for time axis,
  - top-to-bottom linear y scale for ticks,
  - equal-width location lanes,
  - appointment rectangles and labels,
  - colored polyline per car,
  - legend showing color -> car name,
  - transit segment label with occupants at segment start.
- Ensure readable defaults for overlapping labels and narrow viewports.

## 12) Testing plan

Unit test targets:

- Validation:
  - duplicate names,
  - unknown attendees,
  - malformed time,
  - non-5-minute increments,
  - missing matrix pairs,
  - strict overlap failures.
- Solver:
  - happy path with one car and two appointments,
  - requires flexible start shift,
  - requires flexible end shift,
  - unsat due to no driver,
  - unsat due to impossible day-end return.
- Renderer/model:
  - lane ordering correctness,
  - overlap column assignment,
  - monotonic car path time progression.

Integration tests:

- CLI success writes HTML and exits `0`.
- CLI validation failure exits `2`.
- CLI unsat case exits `3` with top-cause text.

## 13) Implementation phases

Phase 1: scaffold app and CLI shell

- Create app files and scripts.
- Parse CLI flags and read/write files.

Phase 2: contracts + validation + normalization

- Implement Zod schemas and issue codes.
- Implement matrix expansion and tick conversion utilities.

Phase 3: solver core

- Implement branch-and-bound scheduler and objective tracking.
- Implement unsat top-cause summarization.

Phase 4: diagram model + D3 HTML

- Build layout model (lanes, overlap columns, car paths).
- Render self-contained HTML.

Phase 5: tests + polish

- Add unit/integration coverage.
- Improve explain output and diagnostics.

## 14) Future-compatible extension hooks

- Car capacity support:
  - add `capacity` to `cars`,
  - enforce passenger count constraints during movement.
- Alternate input adapters:
  - keep core `SolverRequest` independent from source,
  - add adapter layer for Google Calendar REST ingestion.
