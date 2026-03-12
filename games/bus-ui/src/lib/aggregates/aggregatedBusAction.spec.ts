import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/bus'
import {
    aggregateBusActions,
    isAggregatedBusAction
} from './aggregatedBusAction.js'

function createBusAction(
    overrides: Partial<GameAction> & Pick<GameAction, 'id' | 'gameId' | 'type'>
): GameAction {
    return {
        source: ActionSource.User,
        ...overrides
    }
}

describe('aggregateBusActions', () => {
    it('preserves the first action index for history jumps', () => {
        const firstAction = createBusAction({
            id: 'a1',
            gameId: 'g1',
            type: ActionType.PlaceBusLine,
            playerId: 'p1',
            index: 17
        })
        const secondAction = createBusAction({
            id: 'a2',
            gameId: 'g1',
            type: ActionType.PlaceBusLine,
            playerId: 'p1',
            index: 18
        })

        const aggregated = aggregateBusActions([firstAction, secondAction])

        expect(isAggregatedBusAction(aggregated)).toBe(true)
        if (!isAggregatedBusAction(aggregated)) {
            throw new Error('Expected aggregated bus action')
        }
        expect(aggregated.index).toBe(17)
        expect(aggregated.lastActionIndex).toBe(18)
    })
})
