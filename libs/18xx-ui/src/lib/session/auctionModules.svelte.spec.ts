import { describe, expect, it } from 'vitest'
import type { AuctionAward } from '@tabletop/18xx'
import { minimalPlayState } from '@tabletop/18xx/testing'
import { OfferAuctionModule } from './offerAuctionModule.svelte.js'
import { WaterfallAuctionModule } from './waterfallAuctionModule.svelte.js'
import { testSession } from './moduleTestSession.js'

function offers(valid: string[], availability = {}) {
    const harness = testSession(
        minimalPlayState(),
        { offerAuctionRules: undefined },
        valid,
        availability
    )
    return { ...harness, module: new OfferAuctionModule(harness.session) }
}
function waterfall(valid: string[], availability = {}) {
    const harness = testSession(
        minimalPlayState(),
        { auctionRules: undefined },
        valid,
        availability
    )
    return { ...harness, module: new WaterfallAuctionModule(harness.session) }
}

function openAuction(
    reservations: { playerId: string; lotId: string; amount: number }[],
    valid = ['PassAuction', 'BuyAuctionLot', 'ReserveBid'],
    availability = {},
    progress: { remainingLotIds?: string[]; awards?: AuctionAward[] } = {}
) {
    const harness = testSession(
        {
            ...minimalPlayState(),
            openingAuction: {
                remainingLotIds: ['A', 'B', 'C'],
                reservations,
                nextPlayerId: 'alex',
                passedPlayerIds: [],
                discount: 5,
                awards: [],
                completed: false,
                ...progress
            }
        },
        {
            auctionRules: {
                lots: () => [
                    { id: 'A', name: 'A', price: 20 },
                    { id: 'B', name: 'B', price: 30 },
                    { id: 'C', name: 'C', price: 40 }
                ],
                increment: 5,
                bidOrder: 'clockwise-from-highest' as const,
                award: () => {},
                payIncome: () => {}
            }
        },
        valid,
        availability
    )
    return { ...harness, module: new WaterfallAuctionModule(harness.session) }
}

describe('OfferAuctionModule', () => {
    it('has no model and refuses selection when the title has no offer auction', () => {
        const { module } = offers(['PassAuction'])
        expect(module.model).toBeUndefined()
        expect(() => module.select('lot')).toThrow('Auction selection is unavailable')
    })

    it('can act on either an offer or a pass, and only while interactive', () => {
        expect(offers(['OfferAuctionLot']).module.canAct).toBe(true)
        expect(offers(['PassAuction']).module.canAct).toBe(true)
        expect(offers(['BuyShares']).module.canAct).toBe(false)
        expect(offers(['PassAuction'], { interactive: false }).module.canAct).toBe(false)
    })

    it('passes as one action when nothing is selected', async () => {
        const { module, applied } = offers(['PassAuction'])
        await module.pass()
        expect(applied).toMatchObject([{ type: 'PassAuction' }])
    })

    it('starts with nothing pending and yields Undo to game history', () => {
        const { module } = offers(['PassAuction'])
        expect(module.choice.hasManual()).toBe(false)
        expect(module.choice.undo()).toBe(false)
    })
})

describe('WaterfallAuctionModule', () => {
    it('has no model and refuses selection when the title has no waterfall auction', () => {
        const { module } = waterfall(['PassAuction'])
        expect(module.model).toBeUndefined()
        expect(() => module.selectLot('buy', 'lot')).toThrow('Auction selection is unavailable')
    })

    it('can act only when passing is valid and the session is interactive', () => {
        expect(waterfall(['PassAuction']).module.canAct).toBe(true)
        expect(waterfall(['OfferAuctionLot']).module.canAct).toBe(false)
        expect(waterfall(['PassAuction'], { interactive: false }).module.canAct).toBe(false)
    })

    it('is active for every player, with the turn only for the player who may pass', () => {
        const waiting = openAuction([], []).module
        expect(waiting.active).toBe(true)
        expect(waiting.ownTurn).toBe(false)
        const busy = openAuction([], undefined, { interactive: false }).module
        expect(busy.ownTurn).toBe(true)
        expect(busy.canAct).toBe(false)
        expect(waterfall(['PassAuction']).module.active).toBe(false)
    })

    it('shows a staged bid only to the player whose turn it is', () => {
        const bid = { kind: 'bid' as const, lotId: 'B', amount: 35 }
        const own = openAuction([]).module
        own.choice.choose('choice', bid)
        expect(own.selection).toEqual(bid)
        const waiting = openAuction([], []).module
        waiting.choice.choose('choice', bid)
        expect(waiting.selection).toBeUndefined()
    })

    it('refuses a bid amount before a bid is selected', () => {
        expect(() => waterfall(['PassAuction']).module.setBid(50)).toThrow('Select a bid first')
    })

    it('passing discards a staged bid', async () => {
        const { module, applied } = openAuction([])
        module.selectLot('bid', 'B')
        await module.pass()
        expect(applied).toMatchObject([{ type: 'PassAuction' }])
        expect(module.choice.hasManual()).toBe(false)
    })

    it('passes as one action when nothing is selected', async () => {
        const { module, applied } = waterfall(['PassAuction'])
        await module.pass()
        expect(applied).toMatchObject([{ type: 'PassAuction' }])
    })

    it('buys the open lot as one action at its discounted price, dropping a staged bid', async () => {
        const { module, applied } = openAuction([])
        module.selectLot('bid', 'B')
        await module.buy('A')
        expect(applied).toMatchObject([{ type: 'BuyAuctionLot', lotId: 'A', expectedPrice: 15 }])
        expect(module.choice.hasManual()).toBe(false)
    })

    it('lists remaining lots with bids highest first and each player’s bids in lot order', () => {
        const { module } = openAuction([
            { playerId: 'alex', lotId: 'C', amount: 45 },
            { playerId: 'blair', lotId: 'B', amount: 35 },
            { playerId: 'alex', lotId: 'B', amount: 40 }
        ])
        expect(
            module.remainingLots.map(({ lot, bids }) => [lot.id, bids.map((bid) => bid.amount)])
        ).toEqual([
            ['A', []],
            ['B', [40, 35]],
            ['C', [45]]
        ])
        expect(module.playerBids('alex').map(({ lot, amount }) => [lot.id, amount])).toEqual([
            ['B', 40],
            ['C', 45]
        ])
        expect(module.playerBids('casey')).toEqual([])
    })

    it('keeps won lots in waterfall order with their award', () => {
        const award = { lotId: 'A', playerId: 'blair', price: 15 }
        const { module } = openAuction(
            [{ playerId: 'alex', lotId: 'C', amount: 45 }],
            undefined,
            undefined,
            { remainingLotIds: ['B', 'C'], awards: [award] }
        )
        expect(module.lots.map(({ lot, award, bids }) => [lot.id, award, bids.length])).toEqual([
            ['A', award, 0],
            ['B', undefined, 0],
            ['C', undefined, 1]
        ])
        expect(module.remainingLots.map(({ lot }) => lot.id)).toEqual(['B', 'C'])
    })
})
