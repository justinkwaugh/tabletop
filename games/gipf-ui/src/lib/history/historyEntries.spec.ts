import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
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
        expect(entry).toMatchObject({ kind: 'push', lastIndex: 1, shifted: 2 })
        expect(entry.takings).toEqual([
            { from: { q: 0, r: 3 }, to: { q: 0, r: 0 }, returned: 4, captured: 2, capturedGipf: 1 }
        ])
    })

    it('gives the opponent’s taking its own entry', () => {
        const entries = historyEntries([push('a', 'w'), take('b', 'b', [['b', false]])])
        expect(entries.map((entry) => [entry.kind, entry.playerId])).toEqual([
            ['push', 'w'],
            ['taking', 'b']
        ])
    })
})
