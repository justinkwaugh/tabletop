import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, PieceKind, spaceFromName as s } from '@tabletop/tzaar'
import { historyEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

describe('historyEntries', () => {
    it('reads placements, captures, stackings and passes from their metadata', () => {
        const entries = historyEntries([
            action('a', {
                type: ActionType.PlacePiece,
                coords: s('E4'),
                kind: PieceKind.Tzarra,
                metadata: { stuckPlayerId: 'b' }
            }),
            action('a', {
                type: ActionType.Capture,
                from: s('D1'),
                to: s('D2'),
                metadata: {
                    moved: { height: 2, kind: PieceKind.Tzarra },
                    captured: { height: 1, kind: PieceKind.Tzaar },
                    eliminatedKind: PieceKind.Tzaar,
                    noSecondMove: true
                }
            }),
            action('b', {
                type: ActionType.Stack,
                from: s('C4'),
                to: s('A2'),
                metadata: {
                    moved: { height: 1, kind: PieceKind.Tott },
                    landedOnHeight: 2,
                    stuckPlayerId: 'a'
                }
            }),
            action('a', { type: ActionType.Pass, metadata: {} })
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', piece: PieceKind.Tzarra, stuckPlayerId: 'b' },
            {
                kind: 'capture',
                playerId: 'a',
                moved: { height: 2, kind: PieceKind.Tzarra },
                captured: { height: 1, kind: PieceKind.Tzaar },
                eliminated: PieceKind.Tzaar,
                opening: false,
                noSecondMove: true,
                firstIndex: 1
            },
            {
                kind: 'stack',
                playerId: 'b',
                moved: { height: 1, kind: PieceKind.Tott },
                landedOnHeight: 2,
                stuckPlayerId: 'a'
            },
            { kind: 'pass', playerId: 'a', firstIndex: 3 }
        ])
        expect(entries[3]).not.toHaveProperty('stuckPlayerId', expect.anything())
    })

    it('refuses a played action without its record', () => {
        expect(() =>
            historyEntries([action('a', { type: ActionType.Capture, from: s('D1'), to: s('D2') })])
        ).toThrow(/records its outcome/)
    })
})
