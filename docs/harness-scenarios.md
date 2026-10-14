# Harness scenarios

A game's dev harness can open prepared positions. Put JSON files in a `src/scenarios/` folder of the game's UI package; when the folder holds any, the harness shows a **Scenarios** menu beside **Games**, one entry per file, named for the file (`artillery-pair-narrow.json` is "Artillery pair narrow").

Each file holds one object:

```json
{ "game": { ... }, "state": { ... }, "actions": [ ... ] }
```

- `game` is a started `Game`; its `id` is the local game the scenario becomes, so loading the scenario again replaces that game and starts it over. The harness opens it as a local hotseat game of the harness user, who becomes its owner and every player's user.
- `state` is the game's canonical state, validated by the title when the scenario is loaded.
- `actions` are the actions that led to the state, oldest first. A position built by hand has none, and then its `actionCount` and `actionChecksum` are `0` and its turn and round records start at action `0`.

Dates may be written as ISO strings. The harness finds the files with Vite's `import.meta.glob('/src/scenarios/*.json')`, from the UI package's root; it lists new files after a reload. The folder sits under `src` because SvelteKit's dev server serves files only from there and a few other folders.

A bug report posted to Discord attaches the reported game as a scenario file, `bug-report-<gameId>.json`, holding the whole game: every player's hidden information and all its actions. Drop it into the game's `src/scenarios` to open the game as it was reported and step through its history. Files over Discord's 10 MB upload limit are left off, and the post says so.

Napoleon's Triumph builds its scenarios with the logic package's test helpers: `games/napoleons-triumph-ui/scripts/build-scenarios.mjs`.
