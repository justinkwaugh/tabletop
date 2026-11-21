import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/locomotive-werks'
import { historyEntries } from './history.js'

function action(index: number, fields: Partial<GameAction> & { type: string }): GameAction {
    return { id: `a${index}`, gameId: 'g', index, source: ActionSource.User, ...fields }
}

describe('history entries', () => {
    const actions: GameAction[] = [
        action(0, { type: ActionType.PassDevelopment, playerId: 'p1' }),
        action(1, { type: ActionType.Develop, playerId: 'p1' }),
        action(2, { type: ActionType.ExpandCapacity, playerId: 'p1' }),
        action(3, { type: ActionType.Ship, playerId: 'p1' }),
        action(4, { type: ActionType.Ship, playerId: 'p1' }),
        action(5, { type: ActionType.PayTaxes, source: ActionSource.System }),
        action(6, { type: ActionType.AdjustMarket, source: ActionSource.System }),
        action(7, { type: ActionType.Develop, playerId: 'p2' })
    ]
    const rounds = [
        { type: 'round' as const, number: 1, start: 0, end: 7 },
        { type: 'round' as const, number: 2, start: 7 }
    ]

    it('groups a player’s consecutive actions into one turn, ending it at a shipment', () => {
        const entries = historyEntries(actions, rounds)
        expect(entries.map((entry) => entry.kind)).toEqual([
            'round',
            'turn',
            'turn',
            'system',
            'system',
            'round',
            'turn'
        ])
        const [, first, second] = entries
        expect(first.kind === 'turn' && first.actions.map((entry) => entry.index)).toEqual([
            0, 1, 2, 3
        ])
        expect(second.kind === 'turn' && second.actions.map((entry) => entry.index)).toEqual([4])
    })

    it('marks a round that has begun before its first action', () => {
        const entries = historyEntries(actions.slice(0, 7), rounds)
        expect(entries.at(-1)).toEqual({
            kind: 'round',
            key: 'round-2',
            number: 2,
            lastIndex: undefined
        })
    })

    it('lets a round marker jump to the round’s last action', () => {
        const [first] = historyEntries(actions, rounds)
        expect(first).toMatchObject({ kind: 'round', number: 1, lastIndex: 6 })
    })

    it('puts a shipment made automatically in its player’s turn', () => {
        const entries = historyEntries(
            [
                action(0, { type: ActionType.ExpandCapacity, playerId: 'p1' }),
                action(1, { type: ActionType.Ship, playerId: 'p1', source: ActionSource.System })
            ],
            [{ type: 'round', number: 1, start: 0 }]
        )
        expect(entries.at(-1)).toMatchObject({ kind: 'turn', playerId: 'p1' })
        expect(entries.at(-1)?.kind === 'turn' && entries.at(-1)).toMatchObject({
            actions: [{ index: 0 }, { index: 1 }]
        })
    })
})
