# Revenue lead marker

1832's Miami scores $0 on the game's first run there before phase 5 (§8.4). The table had shown
this as a "Miami $0" fact beside the phase and depot. The user found that too minor for that
line and asked for it to be shown on Miami instead. The shared map gains one marker art,
`revenueLead`.

## Surveyed

- The map views and marker art of every implemented title: TOP, Shikoku 1889, 1830, 1817, 1832
  and 1846.
- The family's `stopRevenue` route hook, which only 1832 sets (for Miami).
- The domain study's "Route revenue modifiers" trait (phase-dependent stop value, destination
  and directional bonuses, resource income, fees, subsidies). This is a category list, not a
  survey of every title's printed map.

## Variations

- **Value replaced by state.** Miami's printed 20/30/50 is replaced by 0 until an event: its
  first run, or phase 5, whichever comes first.
- **Value added beside the printed one.** 1846's east–west bonuses use `revenueBadge`, a
  badge under the revenue. Port and Cotton tokens use `token` art in a clear corner.
- **No other temporary replacement.** No other implemented title replaces a printed stop value
  for part of the game.

## Shared behaviour and title-owned choices

- **Shared.** `{ revenueLead: { amount, caption } }` draws the amount as one more staged value,
  in front of the printed ones, so it uses their layout. It is boxed in the style's paper colour,
  with the caption on one line just above its box. Other marks treat the caption as an obstacle.
  It applies only to staged revenue.
- **Title-owned.** When the marker is present (1832 adds `miami-first-run` from map state while
  `miamiFirstRun(state)` holds), the amount, the caption text ("1ST RUN") and the marker's name
  (the caption's tooltip).

## Support now and later

- **Now.** One or more leads in front of staged values.
- **Considered, not built:**
    - a lead on a fixed revenue circle;
    - a struck-through printed value;
    - a caption anywhere other than above the box. Below the row ran off Miami's hex.

## Examples that verify the decision

- In the 1832 harness, "Price protection" (phase 2, Miami not yet run) shows a white 0 box with
  "1ST RUN" above it, in front of 20 | 30 | 50.
- "Excess trains" (phase 5) shows only the printed values.
- Other titles' maps are unchanged, since none sets the art.
