import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    Color,
    GameCallKind,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
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

    it('gives a called game its own entry after the last move', () => {
        const call: CallGameAction = {
            id: 'call',
            gameId: 'g',
            source: ActionSource.System,
            type: CALL_GAME_ACTION_TYPE,
            call: {
                kind: GameCallKind.Conceded,
                initiatorPlayerId: 'b',
                declaredWinnerId: 'a',
                approvingPlayerIds: ['b'],
                decliningPlayerIds: []
            }
        }
        const entries = historyEntries([action('a', { type: ActionType.Pass, metadata: {} }), call])
        expect(entries).toMatchObject([
            { kind: 'pass', playerId: 'a', firstIndex: 0 },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })

    it('reads the colour placed and the colour taken in I set, you choose', () => {
        const entries = historyEntries([
            action('a', {
                type: ActionType.PlacePiece,
                coords: s('E4'),
                kind: PieceKind.Tott,
                metadata: { color: Color.Black }
            }),
            action('b', {
                type: ActionType.ChooseColor,
                color: Color.White,
                metadata: { stuckPlayerId: 'a' }
            })
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', piece: PieceKind.Tott, color: Color.Black },
            { kind: 'choose', playerId: 'b', color: Color.White, stuckPlayerId: 'a' }
        ])
    })
})
