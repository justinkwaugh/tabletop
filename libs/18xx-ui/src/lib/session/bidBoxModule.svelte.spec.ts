import { describe, expect, it } from 'vitest'
import { BidBoxAward, isPlaceBids, type BidBoxRules } from '@tabletop/18xx'
import { minimalPlayState, TestPlayerId } from '@tabletop/18xx/testing'
import { BidBoxModule } from './bidBoxModule.svelte.js'
import { testSession } from './moduleTestSession.js'

const Rival = 'robin'
const bidBoxRules: BidBoxRules = {
    increment: 5,
    bidsPerTurn: 3,
    tokens: () => 3,
    openingBid: () => 100,
    round: { passing: 'consecutive', nextPlayerOrder: () => [TestPlayerId], soldOut: () => false },
    // Settling is the logic's; the module only reads the bids.
    settlement: {
        schema: BidBoxAward,
        settle: () => ({ lotId: 'M1', boxId: 'minor:1', playerId: Rival, amount: 0 })
    }
}

function bidding(validActionTypes = ['PlaceBids'], turnBids?: number) {
    const state = {
        ...minimalPlayState(),
        cash: [
            { owner: { kind: 'bank' as const }, amount: 'unlimited' as const },
            { owner: { kind: 'player' as const, playerId: TestPlayerId }, amount: 400 }
        ],
        machineState: 'StockRound',
        bidBoxes: {
            stacks: [{ id: 'minor', lotIds: ['M4'] }],
            boxes: [
                { boxId: 'minor:1', lotId: 'M1' },
                { boxId: 'minor:2', lotId: 'M2' },
                { boxId: 'minor:3', lotId: 'M3' }
            ],
            bids: [
                { lotId: 'M1', playerId: TestPlayerId, amount: 100 },
                { lotId: 'M1', playerId: Rival, amount: 110 }
            ],
            ...(turnBids ? { turnBids } : {})
        }
    }
    const { session, applied } = testSession(state, { bidBoxRules }, validActionTypes)
    return { module: new BidBoxModule(session), applied }
}

describe('bid boxes', () => {
    it('lists each box with its bids, the highest first, and what the player could bid', () => {
        const { module } = bidding()
        expect(module.lots.map((lot) => [lot.boxId, lot.lowest])).toEqual([
            ['minor:1', 115],
            ['minor:2', 100],
            ['minor:3', 100]
        ])
        expect(module.lots[0]?.bids.map((bid) => bid.playerId)).toEqual([Rival, TestPlayerId])
        expect(module.playerBids(TestPlayerId)).toEqual([
            { lotId: 'M1', amount: 100, leading: false }
        ])
        expect(module.tokensFree(TestPlayerId)).toBe(2)
        expect(module.reserved(TestPlayerId)).toBe(0)
    })

    it('prepares one bid at a time, a press on another box replacing it', () => {
        const { module } = bidding()
        module.draft('M1', 115)
        expect(module.reserved(TestPlayerId)).toBe(115)
        expect(module.tokensFree(TestPlayerId)).toBe(2)
        module.draft('M2', 100)
        expect(module.drafted).toEqual({ lotId: 'M2', amount: 100 })
        expect(module.lots[0]?.drafted).toBeUndefined()
        expect(module.tokensFree(TestPlayerId)).toBe(1)
        module.draft('M2', 105)
        expect(module.lots[1]?.drafted).toBe(105)
        expect(module.canDraft('M2', 95)).toBe(false)
        expect(module.draftReason('M2', 102)).toBe('Bids are multiples of 5.')
        expect(module.draftReason('M2', 110)).toBeUndefined()
        expect(module.selection.undo()).toBe(true)
        expect(module.lots[1]?.drafted).toBe(100)
        expect(module.selection.undo()).toBe(true)
        expect(module.drafted).toEqual({ lotId: 'M1', amount: 115 })
    })

    it('places the prepared bid as one Action', async () => {
        const { module, applied } = bidding()
        expect(module.canPlace).toBe(false)
        module.draft('M3', 100)
        expect(module.canPlace).toBe(true)
        await module.place()
        const [action] = applied
        expect(applied).toHaveLength(1)
        expect(action && isPlaceBids(action) && action.bids).toEqual([{ lotId: 'M3', amount: 100 }])
    })

    it('counts the bids the turn has placed, and offers none past the turn’s three', () => {
        expect(bidding().module.bidsThisTurn).toBe(0)
        const two = bidding(['PlaceBids'], 2).module
        expect(two.bidsThisTurn).toBe(2)
        expect(two.canDraft('M2', 100)).toBe(true)
        const three = bidding(['PlaceBids'], 3).module
        expect(three.bidsThisTurn).toBe(3)
        expect(three.draftReason('M2', 100)).toBe('Only 3 bids may be made in a turn.')
    })

    it('offers nothing to bid to a player who may not', () => {
        const { module } = bidding([])
        expect(module.canBid).toBe(false)
        expect(module.lots.every((lot) => lot.lowest === undefined)).toBe(true)
    })
})
