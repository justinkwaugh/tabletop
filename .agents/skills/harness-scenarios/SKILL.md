---
name: harness-scenarios
description: Make a scenario for a title's dev harness from a description of the game state someone wants. Use when asked to create, record or change a harness scenario.
---

# Harness scenarios

A **scenario** is a JSON file in `games/<slug>-ui/scenarios/`: a game, its state and its actions, as the harness stores any game, with a label and a description. The harness lists every file there in its Scenarios menu, and choosing one opens a copy of that game. The folder is committed, so a scenario is shared once it is.

You make one from a description by writing a move policy that plays a new game to the described state, writing the game it played as a scenario file, and proving that state shows every fact the description asks for. To change a scenario, make it again with the same id; the new file replaces the old one.

## 1. List the facts

Turn the description into **facts** the state must show (machine state, whose turn, board features, counts) before writing code. Where the description allows more than one reading in game terms, such as who counts as having bid or what "mid-game" means, tell the user the reading you chose and confirm it before building. Done: each fact is checkable in game terms, and the user has confirmed any reading you chose.

## 2. Write the policy

Create a throwaway spec in the title's UI package, for example `games/<slug>-ui/src/lib/dev/<id>.spec.ts`; the title's Vitest config finds it. In it, build a `HarnessScenario` (from `@tabletop/frontend-components`) with an `id` of lowercase letters, digits and dashes, a `label`, a `description` of the state, its `playerCount` and `config`, and:

- `nextMove(state)`: a legal move for a player in `state.activePlayerIds`. Reuse the move policy in `games/<slug>-ui/src/lib/dev/harnessScenarios.ts` when the title has one. Otherwise find legality in the logic package, `games/<slug>/src`: each state handler's `validActionsForPlayer`, the action schemas, the existing tests that build actions.
- `isComplete(state)`: true exactly when every fact from step 1 holds.

Scenarios see the full game state, hidden information included. When a position needs a particular board, steer the moves that build it (castles, walls, pieces) rather than waiting for the default policy to produce it. Fix `seed` to choose a deal, and try several seeds when a deal is too unlikely to reach the position. A title whose runtime declares `randomnessVersion: 1` takes `{ masterSeed }`, 32 hexadecimal digits; an older title takes `{ seed }`, a number.

## 3. Play, write and verify

In the same spec, play the policy and write the scenario file:

```ts
const played = playHarnessScenario({ scenario, title: Definition })
const file = scenarioFile({ label: scenario.label, description: scenario.description, ...played })
writeFileSync(`${scenariosDir}/${scenario.id}.json`, `${JSON.stringify(file)}\n`)
```

`Definition` comes from the logic package, `@tabletop/<slug>`. Keep the final hydrated state by wrapping `isComplete`, and assert every fact from step 1 on it. When the point of the scenario is an action someone wants to try, apply that action to a copy of the state and assert the engine accepts it. Run the spec with `pnpm exec vitest run <spec> --reporter=verbose` from `games/<slug>-ui`; the shared test setup hides `console.log` otherwise. In a fresh checkout, if Vitest cannot resolve `.svelte-kit/tsconfig.json`, run `pnpm exec svelte-kit sync` first.

Done: the spec passes with an assertion for each fact, `scenarios/<id>.json` exists, and the title's scenario-file test (such as `src/lib/dev/scenarioFiles.test.ts`) passes with it. A run that fails with "ended the game before reaching its state" or a move-limit error means the policy needs to aim more directly at the facts.

## 4. Clean up and report

Delete the spec. Tell the user the label, describe the state the scenario lands in, fact by fact, and that the file is ready to commit. It appears in the Scenarios menu the next time the dev page loads.
