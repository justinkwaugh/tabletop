# 1849 scenarios

The dev harness lists the JSON files in this folder under **Scenarios** (see [harness scenarios](../../../../docs/harness-scenarios.md)). Each is a seeded bot game played to a position, written by `games/1849/src/scenarios.build.spec.ts`. Regenerate them all, after a change to the State or an Action, with:

```bash
cd games/1849 && SCENARIOS=1 pnpm exec vitest run src/scenarios.build.spec.ts
```

- **First stock round**: the privates sold, before any corporation has started.
- **Garibaldi start**: a stock round in which the Garibaldi is the next corporation, choosing its home.
- **First operating turn**: the first corporation to operate, laying its first track.
- **Green track**: a corporation laying track in phase 8.
- **End of turn finance**: a corporation that has bought its trains, able to sell or redeem certificates.
- **Insolvency**: a president whose corporation cannot buy a train, choosing a loan or leaving the game.
- **After earthquake**: a corporation laying track after the Messina earthquake.
- **Blue zone**: a corporation laying track in phase 16, with five players.

A position the builder does not reach can still be added by hand: play to it in the harness, use **Save as scenario**, move the downloaded file here, and describe it above.
