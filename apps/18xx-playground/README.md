# 18xx Playground

Standalone development host for shared 18xx tiles, maps, and playable title prototypes.
This app composes `@tabletop/18xx-ui`, TOP, and Shikoku 1889. Shared libraries must
not depend on game packages, including through development dependencies or tests.
Title definitions remain in their game packages; the app supplies them to the
reusable viewer through its public interface.

## Regular title harness vs scenario playground

For the regular TOP development harness (create/load games, debug and options):

```sh
pnpm --filter @tabletop/the-old-prince-ui dev
```

That runs `games/the-old-prince-ui` on port 4189 using the shared `Harness`.

For the separate scenario playground (title and position selectors, including
the finished TOP game):

```sh
pnpm --filter @tabletop/18xx-playground dev:scenarios
```

That runs this app on port 4188 and opens `/table`. If it is already running,
visit `http://localhost:4188/table` instead of starting another server.

## Scenarios

Prepared positions such as Stock round, Track construction, or Bankruptcy exist only
in this app, under `src/scenarios`. The shared libraries and the game packages know
nothing about them: a title's production definition always performs its real opening.

`ScenarioInitializer` extends the shared initializer. For the opening position it
defers to the production opening unchanged; for any other position it builds the
initial state from this app's title fixtures. `definitions.ts` wraps each title's
production definition with that initializer, and `withScenarioUi` does the same for
a UI definition. Tests obtain scenario games through `example()` in
`src/demo/stockTestUtils.ts`.

Scenario-based tests belong here as well, because shared libraries and game packages
cannot depend on this app.

## Tile gallery

Build the workspace dependencies, then start the gallery:

```sh
pnpm exec turbo run build --filter=@tabletop/18xx-playground^...
pnpm --filter @tabletop/18xx-playground dev
```

The server uses port 4188. `/` shows the tile library; `/specimens` shows rotations,
preprinted tiles, and replacement examples. `/maps` shows both complete maps with
selection/inspection and prepared tile, token, and route overlays. The existing
`ScalingWrapper` provides fit, focus, pan, zoom, and full screen. `src/demo` composes title definitions
and inspection fixtures. The renderer and viewer component live in
[`libs/18xx-ui`](../../libs/18xx-ui/README.md).

```sh
pnpm --filter @tabletop/18xx-playground check
pnpm --filter @tabletop/18xx-playground test
pnpm --filter @tabletop/18xx-playground build
```

Unit tests exercise the public renderer with complete title catalogs. Browser
tests verify browsing, inventory counts, mobile layout, and the specimen sheet.
The production build writes a static app to `build`.

`/table` loads each title's `UiDefinition` and canonical runtime, with player panels,
actions, map, market, tile manifest, spreadsheet and grouped history.
It uses Game Sessions and local harness services. Games are persisted locally and
restored on revisit. The position selector includes focused scenarios and real
opening auctions; TOP also has a finished-game fixture for forward/backward history.

TOP supports 3–4 players and standard Shikoku 1889 supports 2–6. Stock and operating
Actions run through the canonical engine, including complete-game replay and Undo.
See [complete-game verification](../../research/18xx/complete-game-verification.md)
and [client autorouting](../../research/18xx/autorouter-design.md). These are still
development interfaces; physical-board artwork and mobile polish remain deferred.

Versioned local examples preserve older saved positions while keeping current
examples reusable on reload.
