# 1846

GMT second-printing setup and private distribution for 3–5 players, recurring
stock rounds and two operating rounds per set. Independents and majors construct,
run routes and settle earnings. Majors issue/redeem shares, place stations and buy
phase-I–IV bank trains. The first 3/5 or 4 purchase starts phase II and play
continues, with green construction and East–West revenue scoring.

Corporations can purchase player-owned privates and absorb independent railroads
throughout their operating turns. The seller approves an external offer; a shared
controller settles directly. Absorption transfers cash, the train and an extra
station unless the buyer already occupies the city. The train cannot run for its
buyer during that OR. Purchases, seller responses and automatic consequences
support History and Undo in the 18xx playground.

Steamboat, Meat Packing and Boomtown markers benefit their owning corporation.
Purchases offer immediate placement; Steamboat can move once per OR before routes.
Mail Contract adds $10 for every visited location on one train, including unpaid
3/5 stops. The playground exposes placement, skip, marker labels and scored routes.

MC/O&I can lay connected pairs of free yellow tiles; LSL grants a free green
upgrade. Little Miami must create a Cincinnati–Dayton connection using new track
on each changed tile. These are extra construction, available throughout the
owner's operation. C&WI places an extra free Chicago station, and TBC discounts
mountains, passes and tunnels. The playground stages private tile plans with a
board preview, Back and explicit confirmation.

Corporations can negotiate train purchases from other majors during train buying,
with seller consent for different presidents. Emergency depot purchases issue the
necessary treasury shares at the reduced price, then take only the shortfall from
the president's cash. These purchases commit atomically and show the exact funding
split in the playground. President funding is forbidden when corporate cash and
issuance can afford a cheaper available train.

Personal emergency sales first commit mandatory treasury issuance, then offer legal
stock blocks and depot purchases. Sales preserve the operating presidency, can
change other presidencies or close other corporations, and restrict cheaper train
choices after excess proceeds. The playground supports the full flow and Undo.

Bankruptcy liquidates the player, closes their privates/independents, and continues
with a successor or a receiver. Surviving players enter receiver routes; withholding
and affordable compulsory depot purchases happen automatically. Stock purchases,
including the virtual 10% exchange, can restore a president. The last surviving
player wins when all others go bankrupt. These flows support History and Undo.

Phase III adds 4/6 and 5 trains, the three-train limit, deferred retirement of 2s,
compulsory discards and resale of either face of returned certificates. Private
companies and remaining independents close; corporate Mail and placed revenue
markers survive. Higher offboard revenue applies. The playground exposes discards,
returned trains, current limits and phase/retirement results with History and Undo.

Brown construction includes the complete tile supply, three-slot Z cities and
four separate Chicago cities. The playground supports brown choices and rendering;
construction retains the one-upgrade limit and supports History and Undo.

Phase IV adds unlimited 6 and 7/8 trains, the two-train limit, immediate removal
of remaining 2s and deferred retirement of 3/5s and 4s. Revenue markers and
special station reservations expire; Mail and station placement rights survive.
Gray construction completes the tile supply. The playground exposes these trains,
upgrades and phase results with History and Undo.

Bank exhaustion finishes the current stock/two-OR sequence. The game ends
immediately when all companies close or one player remains solvent. Final
wealth counts personal cash and stock at final prices, plus surviving privately
owned companies at face value; treasury assets are excluded. The playground
shows the final set, ending reason, winners and totals, with History and Undo.

The two-player variant uses $600 starting cash, a $7,000 bank, north/south
corporation removals and public company purchases. The non-priority player must
make the first purchase. Two consecutive passes with at least two companies left
run two preliminary ORs, paying private income and operating purchased independent
railroads before purchases resume. A lone remaining company falls by $10 per pass
and is taken at zero net price; an independent's debt remains payable.

Two-player purchases continue into regular stock and operating rounds. Ownership
is limited to 70%; the certificate limit is 19, falling to 16 after a corporation
closes. Removed corporations' second stations block their printed cities on green
upgrades (Erie's is placed at setup). Four shared Phase IV certificates replace the
unlimited supply. Once new and returned bank trains are exhausted, trainless
corporations may finish without buying and cannot buy another corporation's last
train. Buying the last new Phase IV certificate schedules the next complete OR
pair as the final set; a bank break can finish the game sooner.

Physical-board artwork is not supplied.

Run `pnpm --filter @tabletop/1846 build` and
`pnpm --filter @tabletop/1846-ui build`, then open `/1846` in the 18xx playground.
Alternatively run `pnpm --filter @tabletop/1846-ui dev` on port 4193.
Run logic tests with `pnpm exec vitest run games/1846/src`.

Use the harness's Protected mode to inspect Player, spectator, and Host views.
For 3–5 players, ordinary hotseat conceals cards until explicitly opened, but retains canonical
state locally. Each selection reveals the next packet and blocks player Undo;
recorded history remains reversible. Projected Exploration is not yet supported.
No existing title or saved-state compatibility reader is changed.

See [the design note](../../research/18xx/1846-opening-design.md) for the family
survey and boundaries, and [the stock-round note](../../research/18xx/1846-stock-design.md)
for the second slice.

See [the construction design](../../research/18xx/1846-track-design.md) for this slice.

See [independent operations](../../research/18xx/1846-independent-operations-design.md) for the current slice.

See [corporate finance](../../research/18xx/1846-corporate-finance-design.md) for the latest slice.

See [major construction](../../research/18xx/1846-major-construction-design.md) for the latest slice.

See [major earnings](../../research/18xx/1846-major-earnings-design.md) for the latest slice.

See [first major train buying](../../research/18xx/1846-train-buying-design.md) for the current slice.

See [operating sequence](../../research/18xx/1846-operating-sequence-design.md) for the current slice.

See [recurring rounds and closure](../../research/18xx/1846-recurring-rounds-design.md) for the current slice.

See [phase-II train introduction](../../research/18xx/1846-phase-II-trains-design.md) for the current slice.

See [phase-II operations and acquisitions](../../research/18xx/1846-phase-II-operations-and-acquisitions-design.md) for these slices.

See [revenue private powers](../../research/18xx/1846-revenue-powers-design.md) for the latest slice.

See [private construction](../../research/18xx/1846-private-construction-design.md) for the latest slice.

See [train trading and cash-funded emergencies](../../research/18xx/1846-train-trading-design.md) for this slice.

See [personal emergency funding](../../research/18xx/1846-personal-emergency-funding-design.md) for this slice.

See [bankruptcy and receivership](../../research/18xx/1846-bankruptcy-receivership-design.md) for this slice.

See [Phase III trains and lifecycle](../../research/18xx/1846-phase-III-trains-design.md) for this slice.

See [brown construction](../../research/18xx/1846-brown-construction-design.md) for this slice.

See [Phase IV trains and construction](../../research/18xx/1846-phase-IV-design.md) for this slice.

See [endings and final valuation](../../research/18xx/1846-endings-design.md) for this slice.

See [the two-player opening design](../../research/18xx/1846-two-player-opening-design.md) for this slice.

See [two-player completion](../../research/18xx/1846-two-player-completion-design.md) for the remaining variant rules and verification.
