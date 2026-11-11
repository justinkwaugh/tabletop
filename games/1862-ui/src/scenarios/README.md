# 1862 scenarios

The dev harness lists the JSON files in this folder under **Scenarios** (see [harness scenarios](../../../../docs/harness-scenarios.md)). Each is a seeded bot game played to a position, written by `games/1862/src/scenarios.build.spec.ts`. Regenerate them all, after a change to the State or an Action, with:

```bash
cd games/1862 && SCENARIOS=1 pnpm exec vitest run src/scenarios.build.spec.ts
```

- **First operating turn**: the first company to operate, laying its first track.
- **Merger**: a company at the start of its track step with a merger or acquisition partner on offer.
- **Phase d trains**: a company buying trains once phase D has begun.
- **Small station**: a company starting its track step that may place a small station, with a hex offering two lines.
- **London link**: a company with a director, laying track, that may build to London.
- **Stock round**: the third stock round or later, with five players.

A position the builder does not reach can still be added by hand: play to it in the harness, use **Save as scenario**, move the downloaded file here, and describe it above.
