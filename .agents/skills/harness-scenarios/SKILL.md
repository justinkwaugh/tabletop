---
name: harness-scenarios
description: Record scenarios for a title's dev harness, including scenario requests made from its Scenarios menu. Use when asked to fulfil pending scenario requests, or to create or record a harness scenario.
---

# Harness scenarios

A **recording** is a JSON file in `games/<slug>-ui/src/lib/dev/recordings/`: a seed, the config, the seats and the players' moves. The harness replays it through the title's rules and lists it under **Saved** in the Scenarios menu. A **request** is `recordings/requests/<id>.json`: a label and a description, in words, of the game state someone wants. It is pending until `recordings/<id>.json` exists. Both folders are git-ignored; the work stays local.

You fulfil a request by writing a move policy that plays a new game to the described state, recording the game it plays, and proving the recording replays to that state. Work through these steps for each request, or for the scenario the user describes.

## 1. Read the request

Read every pending request in the title the user names, or in every `games/*-ui/src/lib/dev/recordings/requests/`. List the **facts** each description asks for (machine state, whose turn, board features, counts) before writing code. Done: each request has a list of checkable facts, and any fact you cannot express in game terms is put to the user.

## 2. Write the scenario

Create `recordings/requests/<id>.spec.ts`. The folder is ignored, so the spec stays local, and the title's Vitest config finds it. In it, build a `HarnessScenario` (from `@tabletop/frontend-components`) with the request's `id`, `label` and `description`, its `playerCount` and `config`, and:

- `nextMove(state)`: a legal move for a player in `state.activePlayerIds`. Reuse the move policy in `games/<slug>-ui/src/lib/dev/harnessScenarios.ts` when the title has one. Otherwise find legality in the logic package, `games/<slug>/src`: each state handler's `validActionsForPlayer`, the action schemas, the existing tests that build actions.
- `isComplete(state)`: true exactly when every fact from step 1 holds.

Scenarios see the full game state, hidden information included.

## 3. Record and verify

In the same spec, record and replay the scenario:

```ts
const recording = await recordHarnessScenario({ scenario, title: Definition })
writeFileSync(`${recordingsDir}/${scenario.id}.json`, `${JSON.stringify(recording, null, 4)}\n`)
const [replay] = recordedScenarios({ [`${scenario.id}.json`]: recording })
```

`Definition` comes from the logic package, `@tabletop/<slug>`. Then play `replay` with `playHarnessScenario`, wrapping its `isComplete` to keep the final hydrated state, as `games/lowenherz-ui/src/lib/dev/harnessScenarios.test.ts` does. Assert every fact from step 1 on that state. Run it with `pnpm exec vitest run <spec>` from `games/<slug>-ui`.

Done: the spec passes with an assertion for each fact, and `recordings/<id>.json` exists. A run that fails with "ended the game before reaching its state" or a move-limit error means the policy needs to aim more directly at the facts.

## 4. Clean up and report

Delete the spec and the request file. Tell the user the label, and describe the state the recording lands in, fact by fact. It appears under **Saved** the next time they open the Scenarios menu, provided the title's `vite.config.ts` installs `harnessScenarioFiles()` from `@tabletop/frontend-components/vite/harnessScenarioFiles`.
