# Rules interpretations

Choices made where the rulebook is silent, where table talk would decide, or where online play needs a firm rule. Tests in `src/model/rules.spec.ts` and `src/definition/*.spec.ts` cover them.

## Turn structure

- **Simultaneous, sealed rounds.** Each deciding round is played at the same time by every farmer. A plan stays hidden until the last farmer seals theirs, so nobody reacts to another farmer's sowing or offers. A farmer with nothing to decide (no worms to compost, no ploughed field, no harvest, an empty compost pile 2) is skipped.
- **No spraying without news.** With messages switched off there are no pests, so the spraying round is skipped.

## Money

- **Credit is automatic.** A payment a farmer cannot cover is borrowed in bills of 500 marks, as the bank always gives credit.
- **End of the year.** Every bill that cash covers is redeemed. Each remaining bill costs 100 marks of interest, borrowed in turn if necessary.
- **Seed** is bought at its variety's Norm price.
- **Watering** after a drought message costs 100 marks for each sown field.

## Fields

- **Sunflowers** grow by one on a living field that received neither fertilizer nor poison this year and carries no skull, up to three. Fertilizer or poison removes them all; a skull holds them where they are. A field without worms is dead and has no sunflowers.
- **Organic** means three sunflowers. Only an organic field may sell Bio potatoes, and message effects on its harvest use its Bio column.
- **A skull** doubles the fertilizer a field needs: two sacks, two worms lost.
- **A dead field** (no worms) yields nothing, even with a good-weather bonus.

## Compost

- Worms on compost pile 2 that are not spread are sold to the bank at 60 marks each. Selling them to another farmer, a negotiation, is not offered.

## Market

- The offered sacks become the new demand, and the number of rows the demand marker moves sets the price change (0, 1, 2–3, 4+ rows → 0, 1, 2, 3 steps), down when demand rises and up when it falls. A market nobody offers to falls to the lowest demand row.

## Messages

- The die is rolled from protected randomness. A ministry contest drawn in the first or the last year is set aside for the next card, as the card says. Its prize goes to the best seller of the following year; tied farmers share it, rounded down.

## Scoring

- Tied farmers share the better place in each ranking. A negative ecology result earns no ecology points. The optional strict-ecology rule subtracts the land's starting value of 55. Equal winning points share the win; the rules name no tiebreak.
