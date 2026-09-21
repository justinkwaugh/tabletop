import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { Definition, Shikoku1889AuctionRules } from '@tabletop/shikoku-1889'
import {
    ReserveBidAuction,
    cashOwnedBy,
    EighteenXXStateValidator,
    type EighteenXXState
} from '@tabletop/18xx'
import { example } from './stockTestUtils.js'
function opening(count = 3) {
    const { game, engine, state: initial } = example(Definition, 'opening', count)
    let state = initial
    const history: GameAction[] = []
    return {
        game,
        engine,
        initial,
        get state() {
            return state
        },
        get model() {
            return new ReserveBidAuction(state, Shikoku1889AuctionRules)
        },
        history,
        action(type: string, fields: object = {}): GameAction {
            return {
                id: `action:${state.actionCount}`,
                gameId: game.id,
                source: ActionSource.User,
                playerId: state.activePlayerIds[0],
                type,
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
            expect(EighteenXXStateValidator.Check(state)).toBe(true)
            expect(
                Definition.runtime.hydrator
                    .hydrateState(JSON.parse(JSON.stringify(state)))
                    .dehydrate()
            ).toEqual(state)
            return result
        },
        buy() {
            const lotId = this.model.auction.remainingLotIds[0]
            return this.act('BuyAuctionLot', { lotId, expectedPrice: this.model.price(lotId) })
        }
    }
}
it.each([2, 3, 4, 5, 6])('creates the standard %i-player opening', (count) => {
    const run = opening(count)
    const state = run.state
    expect(state.companies.filter((c) => c.kind === 'private')).toHaveLength(
        count === 2 ? 5 : count === 3 ? 6 : 7
    )
    const majors = state.companies.filter((c) => c.kind === 'major')
    expect(majors).toHaveLength(7)
    expect(majors.every((c) => !c.started && !c.floated && !c.president)).toBe(true)
    expect(
        state.certificates
            .filter((c) => c.kind === 'share')
            .every((c) => !c.retired && c.owner.kind === 'bank' && c.poolId === 'initial-offering')
    ).toBe(true)
    expect(
        state.cash.reduce(
            (total, account) => total + (typeof account.amount === 'number' ? account.amount : 0),
            0
        )
    ).toBe(7000)
    for (const player of state.players)
        expect(cashOwnedBy(state, { kind: 'player', playerId: player.playerId })).toBe(
            count <= 4 ? 420 : 390
        )
    expect(state.stations.every((s) => s.status === 'available')).toBe(true)
    expect(run.state.activePlayerIds).toEqual([run.model.playerId])
    expect(opening(count).initial.openingAuction).toEqual(run.initial.openingAuction)
    expect(opening(count).initial.turnManager.turnOrder).toEqual(run.initial.turnManager.turnOrder)
})
it('reserves every standing bid and releases only the replaced lot commitment', () => {
    const run = opening()
    const player = run.model.playerId
    run.act('ReserveBid', { lotId: 'MF', amount: 200 })
    run.act('PassAuction')
    run.act('PassAuction')
    run.act('ReserveBid', { lotId: 'ER', amount: 200 })
    run.act('PassAuction')
    run.act('PassAuction')
    expect(run.model.availableCash(player)).toBe(20)
    expect(run.model.availableCash(player, 'MF')).toBe(220)
    expect(run.model.canBid(player, 'MF', 220)).toBe(true)
    expect(run.model.canBid(player, 'MF', 221)).toBe(false)
    run.act('ReserveBid', { lotId: 'MF', amount: 219 })
    run.act('PassAuction')
    run.act('PassAuction')
    expect(run.model.canPurchase(player, 'TE')).toBe(false)
    expect(run.model.availableCash(player)).toBe(1)
})
it('rejects wrong actors, insufficient bids, higher-lot purchases, stale prices and user resolution', () => {
    const run = opening()
    const illegal = [
        run.action('PassAuction', {
            playerId: run.state.players.find((p) => p.playerId !== run.model.playerId)!.playerId
        }),
        run.action('ReserveBid', { lotId: 'TE', amount: 25 }),
        run.action('ReserveBid', { lotId: 'MF', amount: 34 }),
        run.action('ReserveBid', { lotId: 'MF', amount: 421 }),
        run.action('ReserveBid', { lotId: 'MF', amount: 35.5 }),
        run.action('BuyAuctionLot', { lotId: 'MF', expectedPrice: 30 }),
        run.action('BuyAuctionLot', { lotId: 'TE', expectedPrice: 19 }),
        run.action('ResolveAuction'),
        run.action('RaiseAuctionBid', { lotId: 'MF', amount: 35 })
    ]
    for (const action of illegal)
        expect(() =>
            run.engine.executeCanonicalAction({ game: run.game, state: run.state, action })
        ).toThrow()
    expect(run.model.canBid(run.model.playerId, 'MF', 36)).toBe(true)
})
it('cascades reserved awards and preserves the next outer turn through completion', () => {
    const run = opening()
    const first = run.model.playerId
    for (const [lotId, amount] of [
        ['MF', 35],
        ['ER', 45],
        ['SRR', 55],
        ['DR', 65],
        ['PR', 85]
    ] as const)
        run.act('ReserveBid', { lotId, amount })
    const buyer = run.model.playerId
    const order = run.state.turnManager.turnOrder
    const next = order[(order.indexOf(buyer) + 1) % order.length]
    const result = run.buy()
    expect(result.processedActions.map((a) => a.type)).toEqual([
        'BuyAuctionLot',
        ...Array(6).fill('ResolveAuction')
    ])
    expect(run.state.machineState).toBe('StockRound')
    expect(run.state.openingAuction?.awards).toHaveLength(6)
    expect(run.state.openingAuction?.awards.find((a) => a.lotId === 'MF')?.playerId).toBe(first)
    expect(run.state.turnManager.turnOrder[0]).toBe(next)
    expect(run.state.stockRound.number).toBe(1)
    expect(run.state.activePlayerIds).toContain(next)
    expect(run.model.commitments()).toEqual([])
})
it('starts restricted bidding clockwise from the highest bidder, releases passes, and resumes the saved outer turn', () => {
    const run = opening(4)
    const order = [...run.state.turnManager.turnOrder]
    run.act('ReserveBid', { lotId: 'MF', amount: 35 })
    run.act('ReserveBid', { lotId: 'MF', amount: 40 })
    run.act('ReserveBid', { lotId: 'MF', amount: 45 })
    run.act('PassAuction')
    run.act('ReserveBid', { lotId: 'MF', amount: 50 })
    const before = run.buy()
    expect(run.state.machineState).toBe('AuctionBidding')
    expect(run.model.playerId).toBe(order[1])
    expect(run.model.auction.nextPlayerId).toBe(order[2])
    const alternative = structuredClone(run.state)
    delete alternative.openingAuction!.bidding
    alternative.openingAuction!.reservations = [
        { lotId: 'MF', playerId: order[0], amount: 50 },
        { lotId: 'MF', playerId: order[1], amount: 45 },
        { lotId: 'MF', playerId: order[2], amount: 40 }
    ]
    const lowFirst = new ReserveBidAuction(alternative, {
        ...Shikoku1889AuctionRules,
        bidOrder: 'lowest-bid-first'
    })
    lowFirst.resolve('alternate')
    expect(lowFirst.playerId).toBe(order[2])
    run.act('RaiseAuctionBid', { lotId: 'MF', amount: 56 })
    expect(run.model.playerId).toBe(order[2])
    expect(run.model.availableCash(order[1])).toBe(344)
    run.act('PassAuction')
    expect(run.model.availableCash(order[2])).toBe(420)
    expect(run.model.playerId).toBe(order[0])
    run.act('PassAuction')
    expect(run.state.machineState).toBe('WaterfallAuction')
    expect(run.model.playerId).toBe(order[2])
    expect(run.model.auction.awards.at(-1)).toEqual({ lotId: 'MF', playerId: order[1], price: 56 })
    expect(before.processedActions).toHaveLength(2)
})
it('discounts the first lot to a free award, then pays private income on later all-pass cycles', () => {
    const run = opening()
    const first = run.model.playerId
    for (let cycle = 1; cycle <= 4; cycle++) {
        for (let i = 0; i < 3; i++) run.act('PassAuction')
        expect(run.model.auction.discount).toBe(cycle * 5)
    }
    expect(run.model.auction.awards).toEqual([{ lotId: 'TE', playerId: first, price: 0 }])
    const next = run.model.playerId
    for (let i = 0; i < 3; i++) run.act('PassAuction')
    expect(run.model.playerId).toBe(next)
    expect(cashOwnedBy(run.state, { kind: 'player', playerId: first })).toBe(425)
    expect(run.model.auction.awards).toHaveLength(1)
})
it('replays and undoes user actions and automatic cascades exactly without serializing rule dependencies', () => {
    const run = opening()
    run.act('ReserveBid', { lotId: 'MF', amount: 35 })
    run.act('ReserveBid', { lotId: 'MF', amount: 40 })
    run.buy()
    run.act('PassAuction')
    for (let i = 0; i < 3; i++) run.act('PassAuction')
    while (run.state.machineState !== 'StockRound') run.buy()
    let replay: EighteenXXState = run.initial
    for (const action of run.history) {
        expect(Object.keys(action)).not.toContain('rules')
        replay = run.engine.applyProcessedAction({ game: run.game, state: replay, action })
    }
    expect(replay).toEqual(run.state)
    for (const action of [...run.history].reverse())
        replay = run.engine.undoProcessedAction({ state: replay, action })
    expect(replay).toEqual(run.initial)
})
it('starts and floats a company from the real first stock round, placing its home for free', () => {
    const run = opening()
    while (run.state.machineState !== 'StockRound') run.buy()
    const playerId = run.state.turnManager.turnOrder[0]
    const marketSpace = run.state.stockMarket.spaces.find(
        (s) => s.color === 'pink' && s.price === 65
    )!
    const buyer = { kind: 'player', playerId } as const
    run.act('StartCompany', {
        playerId,
        buyer,
        companyId: 'AR',
        marketSpaceId: marketSpace.id,
        expectedPrice: 130
    })
    expect(run.state.activePlayerIds).not.toContain(playerId)
    for (let i = 0; i < 3; i++) {
        const acting = run.state.activePlayerIds[0]
        const certificate = run.state.certificates.find(
            (c) =>
                c.kind === 'share' &&
                c.companyId === 'AR' &&
                !c.president &&
                !c.retired &&
                c.poolId === 'initial-offering'
        )!
        run.act('BuyShares', {
            buyer: { kind: 'player', playerId: acting },
            certificateId: certificate.id,
            expectedPrice: 65
        })
        if (i < 2 && run.state.activePlayerIds.includes(acting)) run.act('FinishStockTurn')
    }
    expect(run.state.companies.find((c) => c.id === 'AR')?.floated).toBe(true)
    expect(cashOwnedBy(run.state, { kind: 'company', companyId: 'AR' })).toBe(650)
    for (let i = 0; i < 4 && run.state.machineState === 'StockRound'; i++)
        run.act('FinishStockTurn')
    expect(run.state.privatePowerWindow).toBeDefined()
    run.act('ContinueOperatingRound', { companyId: run.state.privatePowerWindow!.companyId })
    expect(run.state.machineState).toBe('LayingTrack')
    expect(run.state.stations.find((s) => s.id === 'AR:home')?.status).toBe('placed')
    expect(cashOwnedBy(run.state, { kind: 'company', companyId: 'AR' })).toBe(650)
})
it('restores the complete discount and free-award cascade with Undo', () => {
    const run = opening(2)
    for (let i = 0; i < 7; i++) run.act('PassAuction')
    const before = run.state
    const result = run.act('PassAuction')
    expect(run.model.auction.awards[0]?.price).toBe(0)
    let restored = result.updatedState
    for (const action of [...result.processedActions].reverse())
        restored = run.engine.undoProcessedAction({ state: restored, action })
    expect(restored).toEqual(before)
})
