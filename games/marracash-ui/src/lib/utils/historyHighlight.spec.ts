import { describe, expect, it } from 'vitest'
import { ActionSource, CardinalDirection, type GameAction } from '@tabletop/common'
import { ActionType, MarketColor, QueueEnd, routeFrom } from '@tabletop/marracash'
import { historyHighlightFor } from './historyHighlight.js'

function action(type: ActionType, extra: object): GameAction {
    return { id: 'a', gameId: 'g', type, source: ActionSource.User, playerId: 'p', ...extra }
}

describe('history highlight', () => {
    it('traces a move along its route with the shops its visitors entered', () => {
        const move = action(ActionType.MoveVisitors, {
            fountainId: 3,
            direction: CardinalDirection.West,
            metadata: {
                destinationId: 4,
                arrivals: [MarketColor.Blue],
                entries: [{ shopId: 'P3', ownerId: 'q', customers: 1, income: 100, moverCut: 50 }]
            }
        })
        expect(historyHighlightFor(move)).toEqual({
            kind: 'route',
            route: routeFrom(3, CardinalDirection.West),
            visits: [{ shopId: 'P3', customers: 1 }]
        })
    })

    it('points at the entrance a refill filled', () => {
        const refill = action(ActionType.BringVisitors, {
            end: QueueEnd.Front,
            count: 2,
            entranceId: 8
        })
        expect(historyHighlightFor(refill)).toEqual({ kind: 'fountain', fountainId: 8 })
    })

    it('points at the shop an auction was for', () => {
        expect(historyHighlightFor(action(ActionType.StartAuction, { shopId: 'Y2' }))).toEqual({
            kind: 'shop',
            shopId: 'Y2'
        })
    })
})
