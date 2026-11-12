# Projected run during construction

While the operating company's president lays track or places a station, the table
shows the run the company would make on the map as displayed, re-solved for every
previewed tile, rotation or station. It answers "what does this lay do to my run"
before the lay is confirmed. Presentation only: no Action, State field or rule
changes, and nothing persisted. It replaced an earlier idea of drawing the company's
last run as a faded overlay; a stored last run cannot follow an upgrade that renumbers
tile paths, and re-solving shows the effect of a preview directly.

## Evidence and variation

Surveyed the routes-and-revenue, station, train and sequencing traits in
`/workspace/research/18xx-2026-09-08/data/title-traits.json` (131 profiles).

- Route legality and revenue vary widely (distance metrics: all-stops 79,
  unlimited-distance 56, node-type allowances 31, hex edges 10; revenue modifiers:
  phase stop values 116, asset-dependent 86, destination/direction 54). The
  projection owns none of this: it asks the title's existing autorouter and
  `RouteEvaluation`, so any title the run step can solve can be projected.
- Running permissions are mostly "owned runnable train" (98); gauge (13) and
  special permissions (11) also go through `RouteRules.canRunTrain`, which the
  projection's train list already uses.
- Train acquisition follows the run in the ordinary operating sequence, and
  retirement mostly rusts immediately on purchase (120) or obsoletes (30). A
  projection therefore counts the trains owned now; trains bought or rusted later in
  the turn are an intentional limit, stated in the visual contract.
- Fleet constraints are mostly independent runs (121); shared allowances (26) and
  connected route sets (5) are again the router's concern.
- Station placement is connected stations (126) with special/replacement stations
  (52/25). The projection reads whatever station state the map displays, so a
  previewed station, a lay that moves stations, or a title's staged private lays
  feed it without title code.
- Step order differs: TOP, 1889, 1830, 1832 and 1817 lay track in `LayingTrack`
  then place stations in `PlacingStation`; 1846 builds both inside `LayingTrack`
  with a local Track/Stations switch and draws its own station panel. Both shapes
  are covered by keying on the machine state and the operating step's company.
- Destructive map changes (tile downgrade 6, track removal 3, station loss 2) need
  nothing extra: the projection is recomputed from the displayed map, not carried
  from an earlier run.

## Design

Shared in `@tabletop/18xx-ui`:

- `ProjectedRunModule` (session) builds the router request from the dehydrated state
  with the map module's displayed tile inventory and station state and a
  `routeStep` for the operating company, gated to a viewer who can construct for
  it. It keeps the latest solved run across previews and the company's own actions,
  forgets it when the operating company changes, and exposes map overlays that are
  drawn only while every path exists on the displayed map.
- `LatestRouteSolver` runs one worker for the table's lifetime, keeps one request in
  flight and replaces waiting requests with the newest. Failures clear the
  projection.
- `GameTable` drives the solver from the title's required `createRouteWorker`, and
  shows the projection as ordinary route overlays when no committed or edited routes
  are shown. `ProjectedRun` renders the run-step style table; `OperatingActions`
  places it under the track and station prompts, and titles with their own
  construction panels place it themselves (1846's station mode).

Title-owned: only the worker factory and where a custom construction panel puts the
table. No title rule hooks were needed.

Considered for later: a switch to turn the projection off (on by default for now);
counting a train the company is about to buy; projections for private-company
operators that run without a company turn; small-screen placement of the table.

## Verification

- Unit: request gating (constructing viewer only, not in History View, not without
  trains), previewed tiles and stations in the request, keeping and forgetting the
  solved run, failure clearing it, overlays dropped when their track leaves the map;
  solver ordering, worker reuse, failure and replacement.
- Playground: TOP construction projects $30 and an upgrade of Charlottetown $40;
  1889, 1830 and 1832 previews re-solve without errors; 1830's station step shows
  the projection; 1846's track step shows it. 1846's station mode with a
  train-owning company was not reachable from the prepared positions.
