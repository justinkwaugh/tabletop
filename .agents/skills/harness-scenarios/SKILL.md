---
name: harness-scenarios
description: Make a saved scenario for a title's dev harness from a description of the game state someone wants. Use when asked to create, record or change a harness scenario.
---

# Harness scenarios

A **recording** is a JSON file in `games/<slug>-ui/src/lib/dev/recordings/`: a seed, the config, the seats and the players' moves. The harness replays it through the title's rules and lists it under **Saved** in the Scenarios menu. The folder is git-ignored, so the work stays local.

You make one from a description by writing a move policy that plays a new game to the described state, recording the game it plays, and proving the recording replays to that state. To change an existing scenario, make a new one with the same id; it replaces the old file.

## 1. List the facts

Turn the description into **facts** the state must show (machine state, whose turn, board features, counts) before writing code. Done: each fact is checkable in game terms, and any you cannot express that way is put to the user.

## 2. Write the scenario

Create a throwaway spec in the recordings folder, `recordings/<id>.spec.ts`. The folder is ignored, so the spec stays local, and the title's Vitest config finds it. In it, build a `HarnessScenario` (from `@tabletop/frontend-components`) with an `id` of lowercase letters, digits and dashes, a `label` and a `description` of the state, its `playerCount` and `config`, and:

- `nextMove(state)`: a legal move for a player in `state.activePlayerIds`. Reuse the move policy in `games/<slug>-ui/src/lib/dev/harnessScenarios.ts` when the title has one. Otherwise find legality in the logic package, `games/<slug>/src`: each state handler's `validActionsForPlayer`, the action schemas, the existing tests that build actions.
- `isComplete(state)`: true exactly when every fact from step 1 holds.

Scenarios see the full game state, hidden information included. When a position needs a particular board, steer the moves that build it (castles, walls, pieces) rather than waiting for the default policy to produce it. Fix `seed` to choose a deal, and try several seeds when a deal is too unlikely to reach the position.

## 3. Record and verify

In the same spec, record and replay the scenario:

```ts
const recording = await recordHarnessScenario({ scenario, title: Definition })
writeFileSync(`${recordingsDir}/${scenario.id}.json`, `${JSON.stringify(recording, null, 4)}\n`)
const [replay] = recordedScenarios({ [`${scenario.id}.json`]: recording })
```

`Definition` comes from the logic package, `@tabletop/<slug>`. Then play `replay` with `playHarnessScenario`, wrapping its `isComplete` to keep the final hydrated state. Assert every fact from step 1 on that state. When the point of the scenario is an action someone wants to try, apply that action to a copy of the state and assert the engine accepts it. Run the spec with `pnpm exec vitest run <spec>` from `games/<slug>-ui`.

Done: the spec passes with an assertion for each fact, and `recordings/<id>.json` exists. A run that fails with "ended the game before reaching its state" or a move-limit error means the policy needs to aim more directly at the facts.

## 4. Clean up and report

Delete the spec. Tell the user the label, and describe the state the recording lands in, fact by fact. It appears under **Saved** the next time they open the Scenarios menu, provided the title's `vite.config.ts` installs `harnessScenarioFiles()` from `@tabletop/frontend-components/vite/harnessScenarioFiles`.
