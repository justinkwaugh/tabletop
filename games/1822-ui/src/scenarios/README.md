# 1822 scenarios

The dev harness lists the JSON files in this folder under **Scenarios** (see [harness scenarios](../../../../docs/harness-scenarios.md)). Each is a seeded bot game played to a position, written by `games/1822/src/scenarios.build.spec.ts`. Regenerate them all, after a change to the State or an Action, with:

```bash
cd games/1822 && SCENARIOS=1 pnpm exec vitest run src/scenarios.build.spec.ts
```

- **First stock round**: the bidding boxes filled, before any bid.
- **First stock round of 1822 plus**: the 1822+ expansion's opening, each private box with its own stack and three private companies removed.
- **Large regional scenario**, **Medium regional scenario**, **Small regional scenario**, **Medium game scenario**, **Short game scenario**, **Mini game scenario**: the opening of each scenario of §6.2.1, with its overlays, removed companies, trains and money.
- **Humber bridge to lay**: a minor company with a station in Grimsby holding P21 as its track step begins, in a game with all 21 private companies. A prepared position, not a played one.
- **Tax haven with money**: a stock turn of the tax haven's owner under the variant, the haven holding a share and money to buy another. A prepared position, not a played one.
- **Bids under way**: a stock turn with bids on several lots, some of them outbid.
- **Concession to convert**: a player holding a concession, able to start its major company.
- **Minors with L trains**: a minor company in phase 1 running its L-train from its station to a small station.
- **L train at one station**: a minor company whose L-train runs at its station alone, on no track.
- **Minors first turn**: a minor company as its first turn begins, able to buy an L-train.
- **Metropolitan home**: the Metropolitan Railway as its first turn begins, choosing the London station its home stands beside.
- **Major laying track**: a major company about to lay track in phase 3 or later.
- **Private to acquire**: a company as its turn begins, able to take a private company from its director.
- **Minor to acquire**: a major company that has bought its trains, able to acquire a minor company.
- **Offer for a minor**: a major company's offer for a minor company another player directs, waiting on that director's answer.
- **Loan to repay**: a stock turn of a player with a loan and cash to pay towards it.
- **Permanent train dividend**: a company whose run includes a permanent train's revenue, to be paid, split or kept apart from the rest.
- **Request for a private**: a company's request for a private company another player holds, waiting on that player's answer.
- **Track beside London**: a request to lay a yellow tile in a hex beside London, waiting on the holder of the adjoining company.
- **Mail contract run**: a company with a mail contract about to run two trains, which may redraw its routes for more mail income.
- **Pullman to attach**: a company running with a Pullman on one of its trains.
- **Loan for a train**: a director who must borrow to buy their company a train.
- **Directors certificate for sale**: a stock turn from phase 5, a director's certificate bought outright.
- **E train running**: a company running an E-train.

A position the builder does not reach can still be added by hand: play to it in the harness, use **Save as scenario**, move the downloaded file here, and describe it above.
