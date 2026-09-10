import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { OfferAuction, cashOwnedBy, getCompany, type FinanceExampleState } from '@tabletop/18xx'
import { Definition, TheOldPrinceAuctionRules, theOldPrinceRole } from '@tabletop/the-old-prince'
import { example } from './stockTestUtils.js'
function opening(count = 3, seed = 5) {
    const { game, engine, state: initial } = example(Definition, 'opening', count, seed)
    let state = initial
    const history: GameAction[] = []
    return {
        game,
        engine,
        initial,
        history,
        get state() {
            return state
        },
        get model() {
            return new OfferAuction(state, TheOldPrinceAuctionRules)
        },
        action(type: string, fields: object = {}): GameAction {
            return {
                id: `${type}:${state.actionCount}`,
                gameId: game.id,
                source: ActionSource.User,
                type,
                playerId: state.activePlayerIds[0],
                ...fields
            }
        },
        act(type: string, fields: object = {}) {
            const result = engine.executeCanonicalAction({
                game,
                state,
                action: this.action(type, fields)
            })
            state = result.updatedState
            history.push(...result.processedActions)
            expect(
                Definition.runtime.hydrator
                    .hydrateState(JSON.parse(JSON.stringify(state)))
                    .dehydrate()
            ).toEqual(state)
            return result
        },
        offer() {
            this.act('OfferAuctionLot', { lotId: this.model.offerIds[0] })
        },
        force() {
            this.offer()
            this.act('PassAuction')
            return this.act('PassAuction')
        }
    }
}
it.each([3, 4])('sets up and completes TOP for %i players', (count) => {
    const run = opening(count),
        state = run.state
    expect(run.model.auction.piles.every((p) => p.lotIds.length === (count === 3 ? 5 : 4))).toBe(
        true
    )
    expect(state.phaseId).toBe('2H')
    const main = theOldPrinceRole(state, 'mainline'),
        short = theOldPrinceRole(state, 'shortline')
    expect(main).not.toBe(short)
    expect(state.companies.filter((c) => c.kind === 'major')).toHaveLength(8)
    expect(state.stations.filter((s) => s.companyId === 'PEIR')).toHaveLength(5)
    expect(state.certificates.filter((c) => c.companyId === 'PEIR')).toHaveLength(5)
    expect(
        state.certificates.filter(
            (c) => !c.retired && c.owner.kind === 'company' && c.owner.companyId === 'UB'
        )
    ).toHaveLength(2)
    expect(cashOwnedBy(state, { kind: 'company', companyId: main })).toBe(920)
    expect(cashOwnedBy(state, { kind: 'company', companyId: 'PEIR' })).toBe(200)
    expect(cashOwnedBy(state, { kind: 'player', playerId: state.players[0].playerId })).toBe(
        count === 3 ? 580 : 460
    )
    expect(opening(count).state.offerAuction).toEqual(state.offerAuction)
    expect(opening(count).state.companies).toEqual(state.companies)
    for (let i = 0; i < (count === 3 ? 15 : 16); i++) run.force()
    expect(run.state.machineState).toBe('StockRound')
    expect(run.state.stockRound.number).toBe(1)
    expect(run.model.auction.completed).toBe(true)
    expect(run.model.auction.awards).toHaveLength(count === 3 ? 15 : 16)
    expect(run.state.certificates.filter((c) => !c.retired && c.poolId === 'auction')).toEqual([])
    const cash = run.state.turnManager.turnOrder.map((playerId) =>
        cashOwnedBy(run.state, { kind: 'player', playerId })
    )
    expect(cash).toEqual([...cash].sort((a, b) => Number(a) - Number(b)))
    expect(getCompany(run.state, main).president).toBeDefined()
    expect(getCompany(run.state, short).president).toBeDefined()
    expect(getCompany(run.state, 'PEIR').president).toBeDefined()
    let replay: FinanceExampleState = run.initial
    for (const action of run.history)
        replay = run.engine.applyProcessedAction({ game: run.game, state: replay, action })
    expect(replay).toEqual(run.state)
    for (const action of [...run.history].reverse())
        replay = run.engine.undoProcessedAction({ state: replay, action })
    expect(replay).toEqual(run.initial)
})
it('allows the first bidder to re-enter after passing, then ends on a pass after a bid', () => {
    const run = opening(4)
    run.offer()
    const [first, second] = run.model.bidders
    run.act('PassAuction')
    expect(run.model.playerId).toBe(second)
    const lotId = run.model.auction.bidding!.lotId
    run.act('BidOnAuctionLot', { lotId, amount: run.model.minimumBid })
    expect(run.model.playerId).toBe(first)
    run.act('BidOnAuctionLot', { lotId, amount: run.model.minimumBid })
    run.act('PassAuction')
    expect(run.model.auction.awards[0].playerId).toBe(first)
    expect(run.model.auction.auctioneerId).toBe(first)
})
it('rejects another player’s offer, ineligible bidders, non-multiple bids and overdrafts', () => {
    const run = opening(4)
    const other = run.model.auction.piles.find((p) => p.playerId !== run.model.playerId)!
    expect(() => run.act('OfferAuctionLot', { lotId: other.lotIds[0] })).toThrow()
    run.offer()
    const lotId = run.model.auction.bidding!.lotId
    for (const fields of [
        { playerId: run.model.auction.auctioneerId, amount: run.model.minimumBid },
        { amount: run.model.minimumBid + 1 },
        { amount: 9995 },
        { amount: run.model.minimumBid - 5 }
    ])
        expect(() => run.act('BidOnAuctionLot', { lotId, ...fields })).toThrow()
})
it('uses the richest fallback, breaking ties clockwise from the current auctioneer', () => {
    const run = opening(4)
    run.force()
    run.offer()
    const receiver = run.model.forcedBuyerId,
        auctioneer = run.model.auction.auctioneerId
    const price = run.model.price(run.model.auction.bidding!.lotId)
    for (const account of run.state.cash)
        if (account.owner.kind === 'player')
            account.amount = account.owner.playerId === receiver ? 0 : price
    run.act('PassAuction')
    run.act('PassAuction')
    expect(run.model.auction.awards.at(-1)?.playerId).toBe(auctioneer)
})
it('pays player privates repeatedly until a forced purchase is affordable, excluding King’s Mail', () => {
    const run = opening(4)
    const earner = run.model.playerId
    const certificate = run.state.certificates.find((c) => c.id === 'MC:charter')!
    if (certificate.retired) throw Error('Missing private')
    certificate.owner = { kind: 'player', playerId: earner }
    delete certificate.poolId
    for (const pile of run.model.auction.piles)
        pile.lotIds = pile.lotIds.filter((id) => id !== 'MC')
    run.offer()
    const price = run.model.price(run.model.auction.bidding!.lotId)
    for (const account of run.state.cash) if (account.owner.kind === 'player') account.amount = 0
    run.act('PassAuction')
    const result = run.act('PassAuction')
    expect(result.processedActions.filter((a) => a.type === 'ResolveAuction')).toHaveLength(
        Math.ceil(price / 5) + 1
    )
    expect(run.model.auction.awards.at(-1)?.playerId).toBe(earner)
    expect(cashOwnedBy(run.state, { kind: 'company', companyId: 'PEIR' })).toBe(200)
})
it('preserves an unaffordable zero-income position and can undo the entire consequence', () => {
    const run = opening()
    run.offer()
    for (const account of run.state.cash) if (account.owner.kind === 'player') account.amount = 0
    run.act('PassAuction')
    const before = structuredClone(run.state)
    const result = run.act('PassAuction')
    expect(run.model.auction.stalled).toBe(true)
    expect(run.state.activePlayerIds).toEqual([])
    for (const player of run.state.players)
        expect(
            run.engine.getValidActionTypesForPlayer(run.game, run.state, player.playerId)
        ).toEqual([])
    let restored = result.updatedState
    for (const action of [...result.processedActions].reverse())
        restored = run.engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(before)
})
it('floats the assigned Shortline on one additional share and places its home without payment', () => {
    const run = opening()
    for (let i = 0; i < 15; i++) run.force()
    const short = theOldPrinceRole(run.state, 'shortline')
    expect(getCompany(run.state, short).floated).toBe(false)
    const playerId = run.state.activePlayerIds[0]
    const account = run.state.cash.find(
        (a) => a.owner.kind === 'player' && a.owner.playerId === playerId
    )!
    account.amount = 200
    const certificate = run.state.certificates.find(
        (c) => c.kind === 'share' && !c.retired && c.companyId === short && c.poolId === 'market'
    )!
    const result = run.act('BuyShares', {
        buyer: { kind: 'player', playerId },
        certificateId: certificate.id,
        expectedPrice: 86
    })
    expect(result.processedActions.some((a) => a.type === 'FloatCompany')).toBe(true)
    expect(getCompany(run.state, short).floated).toBe(true)
    expect(cashOwnedBy(run.state, { kind: 'company', companyId: short })).toBe(860)
    expect(run.state.stations.find((s) => s.id === `${short}:home`)?.status).toBe('placed')
    expect(run.state.certificates.filter((c) => c.companyId === 'PEIR' && !c.retired)).toHaveLength(
        5
    )
    run.act('FinishStockTurn')
    for (let turn = 0; turn < 3; turn++) run.act('FinishStockTurn')
    expect(run.state.machineState).toBe('LayingTrack')
    expect(run.state.trackStep?.companyId).toBe(theOldPrinceRole(run.state, 'mainline'))
})

it('can reach the zero-income stall through legal bids alone', () => {
    const run = Array.from({ length: 12 }, (_, index) => opening(3, index + 1)).find((run) =>
        run.model.auction.piles.every((pile) => pile.lotIds.some((id) => id.startsWith('PEIR:')))
    )!
    expect(run).toBeDefined()
    for (let turn = 0; turn < 3; turn++) {
        const lotId = run.model.offerIds.find((id) => id.startsWith('PEIR:'))!
        run.act('OfferAuctionLot', { lotId })
        run.act('BidOnAuctionLot', { lotId, amount: 580 })
        run.act('PassAuction')
    }
    expect(
        run.state.players.every(
            (p) => cashOwnedBy(run.state, { kind: 'player', playerId: p.playerId }) === 0
        )
    ).toBe(true)
    run.force()
    expect(run.model.auction.stalled).toBe(true)
})
it('assigns distinct roles without changing the seven company identities across seeds', () => {
    const mainlines = new Set<string>()
    for (const seed of [1, 7, 42, 1871, 1889, 10001]) {
        const run = opening(3, seed)
        mainlines.add(theOldPrinceRole(run.state, 'mainline'))
        expect(
            run.state.companies
                .filter((c) => c.kind === 'major' && c.id !== 'PEIR')
                .map((c) => c.id)
                .sort()
        ).toEqual(['A', 'C', 'Gt', 'MR', 'MS', 'S', 'So'])
        const numbers = run.state.certificates
            .filter((c) => c.kind === 'share')
            .filter((c) => c.companyId === 'PEIR')
            .map((c) => c.number)
        expect(new Set(numbers).size).toBe(5)
    }
    expect(mainlines.size).toBeGreaterThan(1)
})
