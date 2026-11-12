import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import { ActionType, PieceKind, pointAt, type Captured, type RemoveRow } from '@tabletop/matrx'
import { capturedInOrder, tallyStacks } from './tally.js'

describe('tallyStacks', () => {
    it('stands the first taken at the right, filling each stack before the next', () => {
        expect(tallyStacks([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[7], [4, 5, 6], [1, 2, 3]])
    })

    it('draws nothing when nothing is taken', () => {
        expect(tallyStacks([])).toEqual([])
    })
})

describe('capturedInOrder', () => {
    const none: Captured = { gipf: 0, tamsk: 0, zertz: 0, dvonn: 0, yinsh: 0, punct: 0 }
    const take = (id: string, removed: RemoveRow['metadata']): RemoveRow => ({
        id,
        gameId: 'g',
        source: ActionSource.User,
        playerId: 'w',
        type: ActionType.RemoveRow,
        from: pointAt('E2'),
        to: pointAt('E5'),
        keep: [],
        metadata: removed
    })
    const actions = [
        take('a', {
            removed: [
                {
                    coords: pointAt('E2'),
                    unit: { playerId: 'b', kind: PieceKind.Yinsh, discIds: [3] }
                },
                {
                    coords: pointAt('E3'),
                    unit: { playerId: 'w', kind: PieceKind.Zertz, discIds: [4] }
                }
            ]
        }),
        take('b', {
            removed: [
                {
                    coords: pointAt('E6'),
                    unit: { playerId: 'b', kind: PieceKind.Gipf, discIds: [0] }
                },
                {
                    coords: pointAt('E7'),
                    unit: { playerId: 'b', kind: PieceKind.Dvonn, discIds: [5, 6] }
                }
            ]
        })
    ]

    it('lists the discs taken from the opponent in the order they were taken', () => {
        const captured = { ...none, yinsh: 1, gipf: 1, dvonn: 2 }
        expect(capturedInOrder('w', captured, actions)).toEqual([
            PieceKind.Yinsh,
            PieceKind.Gipf,
            PieceKind.Dvonn,
            PieceKind.Dvonn
        ])
    })

    it('groups them by kind when the actions held do not account for them all', () => {
        const captured = { ...none, yinsh: 2, gipf: 1, dvonn: 2 }
        expect(capturedInOrder('w', captured, actions.slice(1))).toEqual([
            PieceKind.Gipf,
            PieceKind.Dvonn,
            PieceKind.Dvonn,
            PieceKind.Yinsh,
            PieceKind.Yinsh
        ])
    })
})
