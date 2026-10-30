import { describe, expect, it } from 'vitest'
import {
    BoardShape,
    emptyBoard,
    HydratedMatrxBoard,
    PieceKind,
    pointAt,
    type Unit
} from '@tabletop/matrx'
import { boardChange } from './boardChange.js'

const pair = (playerId: string, kind: PieceKind): Unit => ({ playerId, kind, paired: true })
const single = (playerId: string, kind: PieceKind): Unit => ({ playerId, kind, paired: false })

function board(stacks: Record<string, Unit[]>): HydratedMatrxBoard {
    const hydrated = new HydratedMatrxBoard(emptyBoard(BoardShape.Matrx))
    for (const [name, units] of Object.entries(stacks)) {
        for (const unit of units) hydrated.place(pointAt(name), unit)
    }
    return hydrated
}

function entryFrom(on: HydratedMatrxBoard, dot: string, to: string) {
    const entry = on.findEntry(pointAt(dot), pointAt(to))
    if (entry === undefined) throw Error('no entry')
    return entry
}

describe('boardChange', () => {
    it('reads a push both ways, with the stacks it moved on', () => {
        const before = board({ E2: [single('b', PieceKind.Yinsh)], E3: [gipf('w')] })
        const after = new HydratedMatrxBoard(before.dehydrate())
        after.push(entryFrom(after, 'E1', 'E2'), pair('w', PieceKind.Zertz))
        expect(boardChange(before, after)).toMatchObject({
            kind: 'push',
            shifted: 2,
            unit: pair('w', PieceKind.Zertz),
            fromCentre: false,
            forward: true
        })
        expect(boardChange(after, before)).toMatchObject({ kind: 'push', forward: false })
    })

    it('follows the dot a known push came from', () => {
        const before = board({})
        const after = board({})
        after.push(entryFrom(after, 'D1', 'E2'), pair('w', PieceKind.Yinsh))
        const known = { dot: pointAt('D1'), to: pointAt('E2') }
        expect(boardChange(before, after, known)).toMatchObject({
            kind: 'push',
            entry: { dot: pointAt('D1') }
        })
    })

    it('reads an extra move as the centre pair giving its top piece', () => {
        const before = board({ E5: [pair('w', PieceKind.Tamsk)] })
        const after = new HydratedMatrxBoard(before.dehydrate())
        after.push(entryFrom(after, 'A3', 'B3'), after.takeTopOfPair(pointAt('E5')))
        expect(boardChange(before, after)).toMatchObject({ kind: 'push', fromCentre: true })
    })

    it("reads a potential's move both ways", () => {
        const before = board({ D6: [pair('w', PieceKind.Dvonn)], G4: [pair('b', PieceKind.Dvonn)] })
        const after = new HydratedMatrxBoard(before.dehydrate())
        after.movePotential(pointAt('D6'), pointAt('G4'))
        expect(boardChange(before, after)).toEqual({
            kind: 'move',
            from: pointAt('D6'),
            to: pointAt('G4'),
            disc: { playerId: 'w', kind: PieceKind.Dvonn },
            forward: true
        })
        expect(boardChange(after, before)).toMatchObject({
            kind: 'move',
            from: pointAt('G4'),
            to: pointAt('D6'),
            forward: false
        })
    })

    it('lifts only the discs that leave a stack, and drops those that come back', () => {
        const before = board({
            E5: [pair('w', PieceKind.Tamsk)],
            E6: [pair('w', PieceKind.Dvonn), single('b', PieceKind.Dvonn)]
        })
        const after = board({
            E5: [single('w', PieceKind.Tamsk)],
            E6: [pair('w', PieceKind.Dvonn)]
        })
        const change = boardChange(before, after)
        expect(change).toEqual({
            kind: 'discs',
            removed: [
                {
                    coords: pointAt('E5'),
                    from: 1,
                    discs: [{ playerId: 'w', kind: PieceKind.Tamsk }]
                },
                {
                    coords: pointAt('E6'),
                    from: 2,
                    discs: [{ playerId: 'b', kind: PieceKind.Dvonn }]
                }
            ].toSorted((a, b) => a.coords.q - b.coords.q || b.coords.r - a.coords.r),
            added: []
        })
        expect(boardChange(after, before)).toMatchObject({ kind: 'discs', removed: [] })
    })
})

function gipf(playerId: string): Unit {
    return single(playerId, PieceKind.Gipf)
}
