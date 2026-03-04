import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/indonesia'
import { aggregateActions, isAggregatedIndonesiaAction } from './actionAggregator.js'

function expandAction(id: string, playerId: string, areaId: string): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.Expand,
        playerId,
        areaId
    } as unknown as GameAction
}

function passAction(id: string, playerId: string): GameAction {
    return {
        id,
        gameId: 'g1',
        source: ActionSource.User,
        type: ActionType.Pass,
        playerId
    } as unknown as GameAction
}

describe('aggregateActions', () => {
    it('aggregates consecutive expand actions by the same player', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01'),
            expandAction('a2', 'p1', 'A02'),
            expandAction('a3', 'p1', 'A03')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(1)
        expect(isAggregatedIndonesiaAction(aggregated[0])).toBe(true)
        expect(aggregated[0]).toMatchObject({
            playerId: 'p1',
            aggregatedType: ActionType.Expand,
            count: 3
        })
    })

    it('starts a new aggregate when player changes', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01'),
            expandAction('a2', 'p2', 'A02')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(2)
        expect(aggregated.every((action) => isAggregatedIndonesiaAction(action))).toBe(true)
        expect(aggregated[0]).toMatchObject({ playerId: 'p1', count: 1 })
        expect(aggregated[1]).toMatchObject({ playerId: 'p2', count: 1 })
    })

    it('flushes expand aggregate when a non-expand action is encountered', () => {
        const actions = [
            expandAction('a1', 'p1', 'A01'),
            expandAction('a2', 'p1', 'A02'),
            passAction('a3', 'p1'),
            expandAction('a4', 'p1', 'A03')
        ]

        const aggregated = Array.from(aggregateActions(actions))

        expect(aggregated).toHaveLength(3)
        expect(aggregated[0]).toMatchObject({ type: 'AggregatedIndonesiaAction', count: 2 })
        expect(aggregated[1]?.type).toBe(ActionType.Pass)
        expect(aggregated[2]).toMatchObject({ type: 'AggregatedIndonesiaAction', count: 1 })
    })
})
