# Harness Scenarios

The **Scenarios** menu in a title's dev harness opens a game at a state worth testing, instead of playing there by hand. A scenario is a file in the title's `scenarios/` folder holding a game, its state and its actions, as the harness stores any game, with a label and a description. Choosing one opens a copy of that game, with its full history, so undo and history navigation work as in a game you played.

Scenario files are committed, so the team shares them. There are two ways to make one:

- **Save a game.** Play to an interesting moment, then choose **Save this game as a scenario…** and give it a label and a description. The file is written into `scenarios/`, ready to commit. The label names the file, so saving under an existing scenario's label replaces that scenario.
- **Describe a game.** Ask an AI coding assistant in the repo for the state you want, for example "a Löwenherz game where one player holds two Renegades and it's their turn to choose an action". It follows [`.agents/skills/harness-scenarios/SKILL.md`](../.agents/skills/harness-scenarios/SKILL.md), which `AGENTS.md` points to: it writes a move policy that plays a game to that state, writes the scenario file, and proves the state shows everything you described. A person can follow the guide too.

## Set up a title

In the title's dev page, `games/<slug>-ui/src/routes/+page.svelte`, pass the folder's files to the harness:

```svelte
<Harness
    {definition}
    scenarios={import.meta.glob('../../scenarios/*.json', { eager: true, import: 'default' })}
/>
```

To save games from the menu, add the plugin to `games/<slug>-ui/vite.config.ts`, because a browser cannot write into the repo itself:

```ts
import { harnessScenarioFiles } from '@tabletop/frontend-components/vite/harnessScenarioFiles'

// …
plugins: [sveltekit(), harnessScenarioFiles()],
```

It runs only under `vite dev`, writes into `scenarios/`, and does nothing else. Without it, the menu still lists and opens scenarios, and saving reports that the plugin is missing. None of this reaches a published UI Artifact.

Add a test that loads every scenario file, such as Santiago's [`scenarioFiles.test.ts`](../games/santiago-ui/src/lib/dev/scenarioFiles.test.ts). A rules or state change that leaves a scenario unloadable then fails the tests rather than the menu; make that scenario again, or delete it.

## Move policies

Making a scenario from a description needs a move policy: a `HarnessScenario` whose `nextMove(state)` returns a legal move and whose `isComplete(state)` says when the state is reached. `playHarnessScenario({ scenario, title: Definition })` plays it against the title's logic, without a browser, and `scenarioFile(...)` turns the result into a scenario file.

A title can keep reusable policies in `src/lib/dev/harnessScenarios.ts`, as [Santiago's](../games/santiago-ui/src/lib/dev/harnessScenarios.ts) does. Assistants reuse them, which makes new scenarios much quicker to make, and they remake a scenario from scratch after a change to the game. When writing one:

- **Ask the engine what is legal** rather than re-deriving the rules: the state handlers' `validActionsForPlayer`, and the legality helpers the logic package exports.
- **Stop before the end.** A scenario whose game ends before `isComplete` is true fails with "ended the game before reaching its state".
- **Read anything.** Policies see the full game state, hidden information included.
