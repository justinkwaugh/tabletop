# 1894 scenarios

The dev harness lists these under **Scenarios**. Each is a three-player game in which the Belge and the PLM have floated and operated; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/1894`.

- **Share operations.** The CFOR, at F80, begins its first-round turn in the Shares step with three shares in the bank pool and three in its treasury. Redeem one share for F80 and the step offers a second (the set's first round allows two); reissue instead and its three shares go to the IPO for F300 with its par at F100. Skip goes on to track.
- **London.** The Belge's home is Calais, whose tile runs to London, and it owns London shipping. The strip offers **Buy ferry marker (F40)**; after buying, the company card shows the Ferry mark and routes may run to London. **Use privates** offers a free Belge station in A12, which does not use the turn's station placement.
- **City split.** Mechelen is a green #14 with the Belge's home and a PLM station in the brown phase. Upgrade it with #X16: both stations are set aside and the Belge must choose a city for its own at once.
- **City split return.** The split above is done. Click a Mechelen city for the Belge's station; the Belge continues its turn, cannot place another station in Mechelen, and when its turn ends the PLM's president chooses a city for the PLM's station, which may share the Belge's city.
- **Late companies.** A stock round in the brown phase. **Start** offers the Late French and Late Belgian; after choosing a price the map offers the untracked cities of the company's country, and clicking one starts the company with its home there.
- **Train upgrade.** The Belge buys trains holding a 2 after the 2s have sold out: the depot offers a 3 for F120 and the upgrade of its 2 for F80, which removes the 2 from the game.
