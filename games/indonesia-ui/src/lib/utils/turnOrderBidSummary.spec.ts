import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/indonesia'
import { summarizeConsecutiveTurnOrderBids } from './turnOrderBidSummary.js'

describe('summarizeConsecutiveTurnOrderBids', () => {
    it('sorts summarized players by highest bid descending and first bid order for ties', () => {
        const actions = [
            {
                id: 'a1',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p1',
                amount: 4,
                index: 1
            },
            {
                id: 'a2',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p2',
                amount: 3,
                index: 2
            },
            {
                id: 'a3',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p1',
                amount: 6,
                index: 3
            },
            {
                id: 'a4',
                gameId: 'g1',
                source: ActionSource.User,
                type: ActionType.PlaceTurnOrderBid,
                playerId: 'p3',
                amount: 6,
                index: 4
            }
        ] as unknown as GameAction[]

        const summary = summarizeConsecutiveTurnOrderBids(actions, 4)

        expect(summary.map((entry) => entry.playerId)).toEqual(['p1', 'p3', 'p2'])
        expect(summary.map((entry) => entry.total)).toEqual([6, 6, 3])
        expect(summary.map((entry) => entry.bidAction.id)).toEqual(['a3', 'a4', 'a2'])
    })
})
