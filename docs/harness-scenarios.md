# Harness Scenarios

The **Scenarios** menu in a title's dev harness jumps to a game state worth testing, instead of playing there by hand. It offers three kinds of scenario:

- **Saved:** a recording of a game someone played to an interesting moment, made with **Save this game as a scenario…**. It replays to the same board every time.
- **Requested:** a description in words of a game state someone wants, made with **Request a new scenario…**. It is listed under **Requested** until someone records it.
- **Coded:** scenarios the title supplies in code, which play a fresh game forward with a move policy until a target state.

Saved and requested scenarios need one line of setup and no title-specific code. Coded scenarios are optional.

## Turn it on

Add the plugin to the title's `games/<slug>-ui/vite.config.ts`:

```ts
import { harnessScenarioFiles } from '@tabletop/frontend-components/vite/harnessScenarioFiles'

// …
plugins: [sveltekit(), harnessScenarioFiles()],
```

Restart the dev harness (`pnpm run dev` in `games/<slug>-ui`). The Scenarios menu now offers saving, requesting, and a delete button on each saved scenario and request.

What to know:

- **Files are local.** Recordings are JSON files in `src/lib/dev/recordings/`, and requests are in its `requests/` subfolder. The folder holds a `.gitignore` of its own, so nothing in it is committed. To share a scenario, copy its JSON file into the same folder of another checkout.
- **Any title works.** A recording holds the game's reproduction seed (or a legacy title's numeric seed), its config, its seats and the players' moves. The harness replays the moves through the title's own rules, so hidden information and system actions come out as they did originally.
- **Replays can go stale.** If a later rules change makes a recorded move illegal, choosing the scenario fails, and the message names the move. Delete the recording and save a new one.
- **Dev only.** The plugin runs only under `vite dev`, and none of this reaches a published UI Artifact.

To keep recordings elsewhere, pass `harnessScenarioFiles({ dir: 'path/from/package/root' })`.

## Fulfil a request

File the request from the menu. Then ask an AI coding assistant in the repo to fulfil the pending scenario requests. It follows [`.agents/skills/harness-scenarios/SKILL.md`](../.agents/skills/harness-scenarios/SKILL.md), which `AGENTS.md` points to. The guide works step by step, so a person can follow it too. The result is a recording, which appears under **Saved** the next time the menu opens.

Fulfilling a request means writing a move policy that reaches the described state. A title that already has coded scenarios makes this much easier, because their policy can be reused.

## Add coded scenarios

Write `games/<slug>-ui/src/lib/dev/harnessScenarios.ts` exporting a `HarnessScenario[]` (from `@tabletop/frontend-components`), and pass it to the harness in `src/routes/+page.svelte`:

```svelte
<Harness {definition} scenarios={myScenarios} />
```

Each scenario has an `id`, a `label`, a `description`, a `playerCount` and an optional `config`. Two functions drive it, and both receive the hydrated state:

- `nextMove(state, progress)` returns a legal move for a player in `state.activePlayerIds`, as `{ type, playerId, ...fields }`. The runner adds the action's id, game, source and time.
- `isComplete(state, progress)` is true once the target state is reached.

`progress.movesPlayed` counts the moves made so far. A scenario may also fix `seed` and `seats` to deal the same game every time.

Writing the policy:

- **Ask the engine what is legal** rather than re-deriving the rules: the state handlers' `validActionsForPlayer`, and the legality helpers the logic package exports.
- **Stop before the end.** A scenario whose game ends before `isComplete` is true fails with "ended the game before reaching its state".
- **Read anything.** Scenarios see the full game state, hidden information included.

Test each scenario through the real runner in a spec, with the logic package's `Definition` and no browser:

```ts
const played = await playHarnessScenario({ scenario, title: Definition })
```

`recordHarnessScenario` does the same and returns a recording, for writing into the recordings folder. Santiago's [`harnessScenarios.ts`](../games/santiago-ui/src/lib/dev/harnessScenarios.ts) and [`+page.svelte`](../games/santiago-ui/src/routes/+page.svelte) are a working example.
