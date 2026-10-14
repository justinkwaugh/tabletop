---
name: add-harness-scenario
description: Add a harness scenario, a prepared position a game's dev harness opens from its Scenarios menu. Use when asked to set up a scenario in a game's harness, or to file a position saved with Save as scenario.
---

# Add a harness scenario

A scenario is a JSON file in the game UI package's `src/scenarios/`. `docs/harness-scenarios.md` holds the file format, the harness behaviour and the shared helpers; read it first.

Each scenario exists to show some behaviour. Write each one down as a **claim**: what the player does in the position and what should then happen ("fire one battery, then Vandamme may still attack across the same approach"). Claims drive every step below.

## Steps

1. **List the claims.** One scenario per situation the user named; split a situation that needs two different positions. Done when every claim names the action to take and the result to see.
2. **Build the position.**
   - A file saved with **Save as scenario**: move it into `src/scenarios/`, renamed `<slug>.json` for what it shows. Its history comes with it.
   - A position set up in code goes in the title's generator, `games/<title>-ui/scripts/build-scenarios.mjs`; create one modelled on Napoleon's Triumph's if the title has none. Arrange the position with the title's logic test helpers, placing only the pieces the claims need and setting any limits or records they depend on (an approach already bombarded, guns that fired last round), and write it with `startingPositionFile`. Build the logic package, then run the generator.

   Done when the file is in `src/scenarios/`.
3. **Check every claim against the engine.** In a throwaway spec, load the file into the title's test game and play each claim through real actions, printing what happens. A claim that fails is a finding: correct the claim, or the position, until each one is observed. Delete the throwaway spec. Done when every claim was played and seen to hold.
4. **Keep the files valid.** The title's UI package needs a spec that reads every file in `src/scenarios/` and checks it against the title's state validator (Napoleon's Triumph: `src/lib/model/scenarioFiles.spec.ts`); add one if it is missing. Done when that spec passes with the new file.
5. **Describe it.** Add the scenario to `src/scenarios/README.md`: its menu name, what is set up, and its claims as what to try and what should happen. Done when every claim from step 1 is in the entry.
6. **Open it in the harness.** Reload the title's harness, open the scenario from the Scenarios menu and screenshot it. Done when the screenshot shows the position the claims describe.
