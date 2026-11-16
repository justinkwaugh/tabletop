import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, pointFromName as p } from '@tabletop/yinsh'
import { historyEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

const move = (playerId: string, passedPlayerId?: string) =>
    action(playerId, {
        type: ActionType.MoveRing,
        from: p('F3'),
        to: p('F9'),
        metadata: { flipped: [], ...(passedPlayerId ? { passedPlayerId } : {}) }
    })
const row = (playerId: string) =>
    action(playerId, { type: ActionType.RemoveRow, from: p('B3'), to: p('F3') })
const ring = (playerId: string, passedPlayerId?: string) =>
    action(playerId, {
        type: ActionType.RemoveRing,
        coords: p('F9'),
        metadata: { ringsRemoved: 1, ...(passedPlayerId ? { passedPlayerId } : {}) }
    })

describe('historyEntries', () => {
    it('folds the mover’s rows into their move and gives the opponent’s their own entry', () => {
        const entries = historyEntries([
            move('a'),
            row('a'),
            ring('a'),
            row('b'),
            ring('b'),
            move('b')
        ])
        expect(entries.map((entry) => [entry.kind, entry.firstIndex, entry.lastIndex])).toEqual([
            ['move', 0, 2],
            ['take', 3, 4],
            ['move', 5, 5]
        ])
        expect(entries[0].kind === 'move' && entries[0].removals[0].ring?.ringsRemoved).toBe(1)
    })

    it('puts a pass on the entry whose action ended the turn', () => {
        const entries = historyEntries([move('a', 'b'), move('a'), row('b'), ring('b', 'a')])
        expect(
            entries.map((entry) => [
                entry.kind,
                entry.kind === 'place' ? undefined : entry.passedPlayerId
            ])
        ).toEqual([
            ['move', 'b'],
            ['move', undefined],
            ['take', 'a']
        ])
    })

    it('lists a ring removed for a row before the history starts on its own', () => {
        const entries = historyEntries([ring('a'), move('b')])
        expect(entries.map((entry) => entry.kind)).toEqual(['ring', 'move'])
    })
})
