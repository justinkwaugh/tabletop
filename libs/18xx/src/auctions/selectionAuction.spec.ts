import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { minimalPlayState, TestPlayerId } from '../testing/index.js'
import { SelectionAuctionModel, type SelectionAuctionRules } from './selectionAuction.js'

const rules = (overrides: Partial<SelectionAuctionRules> = {}): SelectionAuctionRules => ({
    lots: () => [
        { id: 'A', name: 'A', price: 20 },
        { id: 'B', name: 'B', price: 30 }
    ],
    nominationLotIds: () => ['A'],
    passingWhileNominating: () => true,
    openingBid: () => 0,
    increment: 5,
    award: () => {},
    closeUnsold: () => {},
    ...overrides
})

function auction(overrides: Partial<SelectionAuctionRules> = {}) {
    const base = minimalPlayState()
    const state = {
        ...base,
        players: [...base.players, { playerId: 'blair', color: Color.Red }],
        turnManager: { ...base.turnManager, turnOrder: [TestPlayerId, 'blair'] },
        cash: [
            ...base.cash,
            { owner: { kind: 'player' as const, playerId: TestPlayerId }, amount: 100 },
            { owner: { kind: 'player' as const, playerId: 'blair' }, amount: 100 }
        ],
        selectionAuction: {
            remainingLotIds: ['A', 'B'],
            nominatorId: TestPlayerId,
            passedPlayerIds: [],
            awards: [],
            closedLotIds: [],
            completed: false
        }
    }
    return new SelectionAuctionModel(state, rules(overrides))
}

describe('SelectionAuctionModel', () => {
    it('offers only the lots the title allows to be nominated', () => {
        const model = auction()
        expect(model.canNominate(TestPlayerId, 'A', 0)).toBe(true)
        expect(model.canNominate(TestPlayerId, 'B', 0)).toBe(false)
    })

    it('forbids passing while nominating when the title requires a nomination', () => {
        const model = auction({ passingWhileNominating: () => false })
        expect(model.canPass(TestPlayerId)).toBe(false)
        model.nominate(TestPlayerId, 'A', 0, 'bid')
        expect(model.canPass('blair')).toBe(true)
    })

    it('removes the lots an award leaves out and follows the winner when the title asks', () => {
        const closed: string[] = []
        const model = auction({
            nominationLotIds: () => ['A', 'B'],
            lotsRemovedBy: () => ['B'],
            nominationFollowsWinner: () => true,
            closeUnsold: (_state, lotIds) => closed.push(...lotIds)
        })
        model.nominate(TestPlayerId, 'A', 0, 'bid')
        model.bid('blair', 'A', 5)
        model.pass(TestPlayerId)
        expect(model.resolve()).toEqual({
            kind: 'award',
            award: { lotId: 'A', playerId: 'blair', price: 5 },
            removedLotIds: ['B']
        })
        expect(closed).toEqual(['B'])
        expect(model.auction.closedLotIds).toEqual(['B'])
        expect(model.auction.completed).toBe(true)
        expect(model.auction.nominatorId).toBe(TestPlayerId)
    })
})
