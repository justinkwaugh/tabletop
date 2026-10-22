import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PieceColor } from '@tabletop/lyngk'
import { historyEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

const claim = (playerId: string, color: PieceColor) =>
    action(playerId, { type: ActionType.ClaimColor, color })

const move = (playerId: string) =>
    action(playerId, {
        type: ActionType.MoveStack,
        from: { q: 0, r: 0 },
        via: [],
        to: { q: 0, r: 1 },
        metadata: {
            moved: [PieceColor.Red],
            landedOn: [PieceColor.Blue],
            scored: false,
            completedSix: false
        }
    })

const other = (id: string) => (id === 'a' ? 'b' : 'a')

describe('historyEntries', () => {
    it('folds a claim into the move that follows it', () => {
        const entries = historyEntries([claim('a', PieceColor.Red), move('a'), move('b')], other)
        expect(entries.map((entry) => [entry.kind, entry.firstIndex, entry.lastIndex])).toEqual([
            ['move', 0, 1],
            ['move', 2, 2]
        ])
        expect(entries[0].claimed).toBe(PieceColor.Red)
    })

    it('marks a move followed by another of the same player as a pass for the other', () => {
        const entries = historyEntries([move('a'), move('a'), move('b')], other)
        expect(entries.map((entry) => entry.kind === 'move' && entry.opponentPassed)).toEqual([
            true,
            false,
            false
        ])
    })

    it('shows a claim on its own until the move comes', () => {
        const entries = historyEntries([move('a'), claim('b', PieceColor.Green)], other)
        expect(entries.at(-1)?.kind).toBe('claim')
    })
})
