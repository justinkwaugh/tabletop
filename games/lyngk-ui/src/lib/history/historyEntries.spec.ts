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

const move = (playerId: string, passedPlayerId?: string) =>
    action(playerId, {
        type: ActionType.MoveStack,
        from: { q: 0, r: 0 },
        via: [],
        to: { q: 0, r: 1 },
        metadata: {
            moved: [PieceColor.Red],
            landedOn: [PieceColor.Blue],
            scored: false,
            completedSix: false,
            passedPlayerId
        }
    })

describe('historyEntries', () => {
    it('folds a claim into the move that follows it', () => {
        const entries = historyEntries([claim('a', PieceColor.Red), move('a'), move('b')])
        expect(entries.map((entry) => [entry.kind, entry.firstIndex, entry.lastIndex])).toEqual([
            ['move', 0, 1],
            ['move', 2, 2]
        ])
        expect(entries[0].claimed).toBe(PieceColor.Red)
    })

    it('names the player a move passed over, as the move records it', () => {
        const entries = historyEntries([move('a', 'b'), move('a'), move('b')])
        expect(entries.map((entry) => entry.kind === 'move' && entry.passedPlayerId)).toEqual([
            'b',
            undefined,
            undefined
        ])
    })

    it('refuses a move without its recorded outcome', () => {
        const bare = action('a', {
            type: ActionType.MoveStack,
            from: { q: 0, r: 0 },
            via: [],
            to: { q: 0, r: 1 }
        })
        expect(() => historyEntries([bare])).toThrow()
    })

    it('shows a claim on its own until the move comes', () => {
        const entries = historyEntries([move('a'), claim('b', PieceColor.Green)])
        expect(entries.at(-1)?.kind).toBe('claim')
    })
})
