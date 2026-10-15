# Harness scenarios

A game's dev harness can open prepared positions. Put JSON files in a `src/scenarios/` folder of the game's UI package. The harness's purple **Scenarios** menu, after **Games** and **+**, lists one entry per file, named for the file (`artillery-pair-narrow.json` is "Artillery pair narrow"). The menu is always there.

## Saving a position

**Save as scenario**, the menu's first item, downloads the open game as a scenario file named for the game, with every action that led to it, so Undo and the history work after loading it. Move the file into `src/scenarios/`, renamed for what it shows; reload the harness and it is listed. The save is a fork of the game at its last action (`createGameFork`), so it gets a new game id and every action and patch is rewritten to it.

## Opening any file

**Load from file…**, the next item, opens a scenario file from anywhere on the device, with the same checks as the folder's files: a saved game someone sent, or a file not worth keeping in the repository. A file that is not a scenario the game can open is reported above the table, and nothing changes.

## Bug reports

A bug report posted to Discord attaches the reported game as a scenario file, `bug-report-<gameId>.json`, holding the whole game: every player's hidden information and all its actions. Open it with **Load from file…** to see the game as it was reported and step through its history; it is a real game with real names, so it stays out of the repository. Files over Discord's 10 MB upload limit are left off, and the post says so.

## Building a position by hand

A position set up in code, with no actions behind it, goes through `startingPositionFile` from `@tabletop/common/testing`. Given a slug, a name, a started game and the arranged state, it returns the file's name, `<slug>.json`, and its contents: the game and the state get the id `scenario-<slug>`, the action count and checksum start afresh, and every record of where groups of actions began (the turn manager, and any round or phase manager the title keeps, recognised by their `series` of action groups) keeps only the group in progress, restarted at action `0`. Napoleon's Triumph's `games/napoleons-triumph-ui/scripts/build-scenarios.mjs` is a worked example.

## The file

Each file holds one object:

```json
{ "game": { ... }, "state": { ... }, "actions": [ ... ] }
```

- `game` is a started `Game`. Its `id` is the local game the scenario becomes, so loading the scenario again replaces that game and starts it over. The harness opens it as a local hotseat game of the harness user, who becomes its owner and every player's user.
- `state` is the game's canonical state, validated by the title when the scenario is loaded. Its `gameId` must be the game's `id`; the harness refuses a file where they differ.
- `actions` are the actions that led to the state, oldest first, each with the game's `id`.

Dates may be written as ISO strings.

## How the harness finds the files

`gameScenarios()` in the shared library calls Vite's `import.meta.glob('/src/scenarios/*.json')`, which reads from the game's UI package root. It is a plain module rather than part of the harness component, because Vite's Svelte plugin keeps a component's file list stale when files are added; from the module, the list follows the folder on the next page load. The lookup sits inside a function so that game bundles, which reach the module through the library, keep none of it. The folder is under `src` because SvelteKit's dev server serves files only from there and a few other folders.
