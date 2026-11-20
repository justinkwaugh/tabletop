import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import { ActionType, type PushPiece, type RemoveRow } from '@tabletop/gipf'
import { historyEntries } from './historyEntries.js'

const base = (id: string, playerId: string) => ({
    id,
    gameId: 'g',
    source: ActionSource.User,
    playerId
})

const push = (id: string, playerId: string): PushPiece => ({
    ...base(id, playerId),
    type: ActionType.PushPiece,
    dot: { q: 0, r: 4 },
    to: { q: 0, r: 3 },
    gipf: false,
    metadata: { line: [], shifted: 2 }
})

const take = (id: string, playerId: string, removedOwners: [string, boolean][]): RemoveRow => ({
    ...base(id, playerId),
    type: ActionType.RemoveRow,
    from: { q: 0, r: 3 },
    to: { q: 0, r: 0 },
    keep: [],
    metadata: {
        removed: removedOwners.map(([owner, gipf], r) => ({
            playerId: owner,
            gipf,
            coords: { q: 0, r }
        }))
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
        declaredWinnerId: 'w',
        approvingPlayerIds: ['b'],
        decliningPlayerIds: []
    }
}

describe('historyEntries', () => {
    it('folds the mover’s takings into their push, counting a GIPF-piece as two', () => {
        const actions: GameAction[] = [
            push('a', 'w'),
            take('b', 'w', [
                ['w', false],
                ['w', false],
                ['w', false],
                ['w', false],
                ['b', true]
            ])
        ]
        const [entry] = historyEntries(actions)
        expect(entry).toMatchObject({
            kind: 'push',
            lastIndex: 1,
            shifted: 2,
            takings: [
                {
                    from: { q: 0, r: 3 },
                    to: { q: 0, r: 0 },
                    returned: 4,
                    captured: 2,
                    capturedGipf: 1
                }
            ]
        })
    })

    it('gives the opponent’s taking its own entry', () => {
        const entries = historyEntries([push('a', 'w'), take('b', 'b', [['b', false]])])
        expect(entries).toMatchObject([
            { kind: 'push', playerId: 'w' },
            { kind: 'taking', playerId: 'b' }
        ])
    })

    it('gives a called game its own entry after the last move', () => {
        const entries = historyEntries([push('a', 'w'), take('b', 'w', [['w', false]]), call])
        expect(entries).toMatchObject([
            { kind: 'push', playerId: 'w', firstIndex: 0, lastIndex: 1 },
            { kind: 'call', firstIndex: 2, lastIndex: 2, action: call }
        ])
    })

    it('keeps a call apart from a push whose rows are still to take', () => {
        const entries = historyEntries([push('a', 'w'), call])
        expect(entries).toMatchObject([
            { kind: 'push', playerId: 'w', firstIndex: 0, lastIndex: 0, takings: [] },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })
})
