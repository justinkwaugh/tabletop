# 1894 scenarios

The dev harness lists these under **Scenarios**. Each is a three-player game in which the Belge and the PLM have floated and operated; loading one again starts it over. Regenerate them with `node scripts/build-scenarios.mjs` after building `@tabletop/1894`.

- **Share operations.** The CFOR, at ₣80, begins its first-round turn with three shares in the bank pool and three in its treasury. Redeem one share for ₣80 and the step offers a second (the set's first round allows two); reissue instead and its three shares go to the IPO for ₣300 with its par at ₣100. Skip goes on to track.
- **London.** The Belge's home is Calais, whose tile runs to London, and it owns London shipping. The strip offers **Buy ferry marker (₣40)**; after buying, the company card shows the Ferry mark and routes may run to London. **Use privates** offers a free Belge station in A12, which does not use the turn's station placement.
- **Share operations set aside.** The CFOR has used both track actions, with a PLM station set aside at Mechelen. The panel offers **Reissue / redeem** with skip, since the PLM returns its station on its own turn.
- **City split.** Mechelen is a green #14 with the Belge's home and a PLM station in phase 5+1. Upgrade it with #X16: both stations are set aside and the Belge must choose a city for its own at once.
- **City split return.** The split above is done. Click a Mechelen city for the Belge's station; the Belge continues its turn, cannot place another station in Mechelen, and when its turn ends the PLM's president chooses a city for the PLM's station, which may share the Belge's city. Either city may take a station, even one already holding one: the two then stand side by side and the game goes on.
- **Late companies.** A stock round in phase 5+1. **Start** offers the Late French and Late Belgian; after choosing a price the map offers the untracked cities of the company's country, and clicking one starts the company with its home there.
- **Train upgrade.** The Belge buys trains holding a 2 after the 2s have sold out: the depot offers a 3 for ₣120 and the upgrade of its 2 for ₣80, which removes the 2 from the game.

Each private company has its own positions. The Belge is the operating company unless an entry says otherwise, and **Use privates** opens a company's powers.

- **Private ligne de reims.** The Belge owns the Ligne de Reims à Charleville. Lay a yellow tile in Antwerpen through it: it costs ₣60 and leaves both ordinary track actions. That tile cannot be upgraded this round, and the power is gone for the rest of the game.
- **Private two powers.** The Belge owns the Ligne de Reims and London shipping. **Use privates** lists both and selects neither. Choosing the Ligne de Reims asks for a tile space, with the London shipping station still on offer; pressing that places the station in A12 for free.
- **Private antwerpen rotterdam.** The last stock round turns. Press **Pass** three times: the operating round's income row pays the Belge ₣10 for Antwerpen-Rotterdam, where a player would get ₣5, Player 3 ₣5 for the Ligne de Reims and the PLM ₣15 for London shipping.
- **Private gare de liege.** The Belge owns the Gare de Liège-Guillemins. Lay a yellow tile in Liège with no connection, as one of its track actions, and the panel asks **Place the Liège-Guillemins station for free?** Place puts the cheapest station there at no cost, as the turn's station placement; Decline leaves it. The tile cannot be upgraded this round.
- **Private gare de liege upgrade.** Liège already has a yellow tile. Upgrade it through the power, choosing a green tile, and the same question follows.
- **Private station antwerpen.** The same power as the Gare de Liège, for Antwerpen.
- **Private saint quentin green.** Saint-Quentin is green, with the LSQG marker as a small tag on its tile. Press **Pass** three times: Player 1's Saint-Quentin à Guise pays ₣70.
- **Private saint quentin brown.** Saint-Quentin is brown. Press **Pass** three times: it pays ₣100.
- **Private saint quentin closes.** Phase 7. No **Buy privates** is offered, though Player 1 still owns Saint-Quentin à Guise, as companies cannot buy it in phases 6 and 7. Buy a D: phase D closes it.
- **Privates close.** Phase 4 with the 5+1s gone. Buy a 6: phase 6 closes the Ligne de Reims, Antwerpen-Rotterdam and London shipping, and Saint-Quentin à Guise stays open.
- **Private london shipping bonus.** The Belge owns London shipping and has a ferry marker and a station in A12, and runs from Calais. **Run trains** adds Calais's 20 again for the route to London, and history reads "London shipping +₣20".
- **Private nord minor.** The Nord is the French company, and the auction has reached the Nord minor shareholding. Buy it: Player 3 holds two Nord shares, but the Nord has no president. Buy the Nord major shareholding: the buyer chooses a par, including ₣100, and becomes the Nord's president. The Belge major shareholding follows in the same way.
- **Private major shareholdings.** The auction is over and the stock round has its last turns. Press **Pass** three times: the income row pays the Nord major shareholding ₣40 and the Belge major ₣60. Each closes when its company operates.
