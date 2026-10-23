# Dicke Kartoffeln

`@tabletop/dicke-kartoffeln` is the deterministic logic package for Dicke Kartoffeln by Doris Matthäus and Frank Nestel (Abacus Spiele, 1991), a potato-farming game for 2–6 players. Its companion Game Client package is `@tabletop/dicke-kartoffeln-ui`.

## Rules source

The German rulebook and message cards govern; the implementation is in English. Where the English translation differs from the German cards, the German wins (the potato blight card cuts Amalie-Bio by 3, not 1). Rule data lives in `src/components/`: the yield chart and varieties, both potato-market boards with their printed starting rows, the twenty message cards, and the costs.

## Play

A farming year follows the twelve rounds of the year overview. The rounds in which farmers decide (taking compost, ploughing, sowing, fertilizing, spraying, offering potatoes, using compost) are simultaneous: every farmer with a decision seals a plan, and the last plan opens them all (`RevealPlans`). The other rounds are System Actions. Sealed plans are hidden from other players through the registered visibility projection, and the message deck is shuffled from protected randomness.

Choices the rulebook leaves open are recorded in [rules interpretations](docs/rules-interpretations.md), each backed by a test.
