# Stellar Horizons II scenarios

The dev harness lists these under **Scenarios**. Each opens as a hotseat game of _These are the Voyages_ at a prepared position, in one player's phase; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/stellar-horizons-2`.

In the harness's hotseat game the phases' branches are played one at a time, so a later faction sees what the earlier ones committed; in a hosted game commitments show only once everyone has finished exploring.

## Three factions at one anomaly

Three players in the exploration phase of the first decade. The Stellar Chart, a science anomaly, lies at Vega, where it needs 7 exploration: its printed 4 plus one per player. Each faction has two ships there, strong enough together: the Starfarers' Orion (+6, a research ship) and Kepler (+3), the Givers' Darwin (+5) and Mendel (+2), the Praetorians' Odyssey (+6) and Audax (+3). Vega keeps its exploration marker, so every ship could explore it instead. Initiative order is Starfarers, Givers, Praetorians, and the phase opens with the Starfarers. The position is prepared: in play an anomaly is found at the end of a decade and first resolved in the next.

- **Choosing ships.** On the Starfarers' card, Orion alone shows 6 / 7 in orange and Commit ships stays disabled; adding Kepler shows 9 / 7 in green and enables it. Commit ships records the attempt: the card names Orion and Kepler as committed, both leave the list of ships that can explore, and history shows the attempt.
- **Rivals.** Done exploring hands the phase to the Givers, whose card says the Starfarers have committed ships here and resolve before them; Darwin and Mendel make exactly 7 / 7, so both are needed. The Praetorians, last in initiative, see both rivals resolving before them.
- **Resolution.** When the Praetorians finish exploring, the attempts resolve in initiative order before the surveys: the Starfarers take the Stellar Chart, so their console shows the tile and the standings read 1/4; the Givers' and Praetorians' attempts fail, their ships' actions spent for nothing; the anomaly leaves Vega; and history records one Resolve anomaly step per attempt.
- **Passing.** A faction that explores Vega with its ships, or ends the phase without committing, leaves the anomaly to the next faction in initiative order that committed enough; if nobody commits, the Stellar Chart stays at Vega for the next decade.
