import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    Color,
    GameCallKind,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import { ActionType, spaceFromName as s } from '@tabletop/dvonn'
import { historyEntries } from './historyEntries.js'

let counter = 0
function action(playerId: string, fields: { type: string } & Record<string, unknown>): GameAction {
    counter += 1
    return { id: `a${counter}`, gameId: 'g', source: ActionSource.User, playerId, ...fields }
}

describe('historyEntries', () => {
    it('reads placements and moves from their metadata', () => {
        const entries = historyEntries([
            action('a', {
                type: ActionType.PlacePiece,
                coords: s('E3'),
                metadata: { piece: { dvonn: true } }
            }),
            action('b', {
                type: ActionType.MoveStack,
                from: s('A1'),
                to: s('B1'),
                metadata: {
                    moved: [{ playerId: 'b' }],
                    landedOn: [{ playerId: 'a' }, { dvonn: true }],
                    removed: [
                        { coords: s('K3'), stack: [{ playerId: 'a' }, { playerId: 'b' }] },
                        { coords: s('K4'), stack: [{ playerId: 'a' }] }
                    ],
                    passedPlayerId: 'a'
                }
            })
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', dvonn: true, firstIndex: 0 },
            {
                kind: 'move',
                playerId: 'b',
                moved: 1,
                landedOn: 2,
                landedOnDvonn: false,
                removedPieces: 3,
                removedStacks: 2,
                passedPlayerId: 'a',
                firstIndex: 1
            }
        ])
    })

    it('reads the colour placed and the colour taken in I set, you choose', () => {
        const entries = historyEntries([
            action('a', {
                type: ActionType.PlacePiece,
                coords: s('E3'),
                metadata: { piece: { playerId: 'b', placedAt: s('E3') }, color: Color.Black }
            }),
            action('b', { type: ActionType.ChooseColor, color: Color.White, metadata: {} })
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', dvonn: false, color: Color.Black },
            { kind: 'choose', playerId: 'b', color: Color.White }
        ])
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
        const entries = historyEntries([
            action('a', {
                type: ActionType.PlacePiece,
                coords: s('E3'),
                metadata: { piece: { playerId: 'a' } }
            }),
            call
        ])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'a', firstIndex: 0 },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })
})
