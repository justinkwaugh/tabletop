import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, pointFromName as p } from '@tabletop/yinsh'
import { historyEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

const move = (playerId: string) =>
    action(playerId, {
        type: ActionType.MoveRing,
        from: p('F3'),
        to: p('F9'),
        metadata: { flipped: [] }
    })
const row = (playerId: string) =>
    action(playerId, { type: ActionType.RemoveRow, from: p('B3'), to: p('F3') })
const ring = (playerId: string) =>
    action(playerId, {
        type: ActionType.RemoveRing,
        coords: p('F9'),
        metadata: { ringsRemoved: 1, won: false }
    })

const other = (id: string) => (id === 'a' ? 'b' : 'a')

describe('historyEntries', () => {
    it('folds the mover’s rows into their move and gives the opponent’s their own entry', () => {
        const entries = historyEntries(
            [move('a'), row('a'), ring('a'), row('b'), ring('b'), move('b')],
            other
        )
        expect(entries.map((entry) => [entry.kind, entry.firstIndex, entry.lastIndex])).toEqual([
            ['move', 0, 2],
            ['take', 3, 4],
            ['move', 5, 5]
        ])
        expect(entries[0].kind === 'move' && entries[0].removals[0].ringsRemoved).toBe(1)
    })

    it('marks a move followed by another of the same player as a pass for the other', () => {
        const entries = historyEntries([move('a'), move('a'), move('b')], other)
        expect(entries.map((entry) => entry.kind === 'move' && entry.opponentPassed)).toEqual([
            true,
            false,
            false
        ])
    })
})
