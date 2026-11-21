import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
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

describe('historyEntries', () => {
    it('folds a claim into the move that follows it', () => {
        const entries = historyEntries([claim('a', PieceColor.Red), move('a'), move('b')])
        expect(entries.map((entry) => [entry.kind, entry.firstIndex, entry.lastIndex])).toEqual([
            ['move', 0, 1],
            ['move', 2, 2]
        ])
        expect(entries[0]).toMatchObject({ claimed: PieceColor.Red })
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

    it('gives a called game its own entry after the last move', () => {
        const entries = historyEntries([move('a'), call])
        expect(entries).toMatchObject([
            { kind: 'move', playerId: 'a', firstIndex: 0, lastIndex: 0 },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })

    it('keeps a call after a claim whose move never came out of the claim', () => {
        const entries = historyEntries([claim('b', PieceColor.Green), call])
        expect(entries).toMatchObject([
            { kind: 'claim', playerId: 'b', firstIndex: 0, lastIndex: 0 },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })

    it('gives each piece placed while setting the board its own entry', () => {
        const place = (playerId: string, color: PieceColor) =>
            action(playerId, { type: ActionType.PlacePiece, coords: { q: 0, r: 0 }, color })
        expect(
            historyEntries([place('a', PieceColor.Red), place('b', PieceColor.Joker)])
        ).toMatchObject([
            { kind: 'place', playerId: 'a', color: PieceColor.Red, firstIndex: 0 },
            { kind: 'place', playerId: 'b', color: PieceColor.Joker, firstIndex: 1 }
        ])
    })
})
