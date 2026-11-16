import { describe, expect, it } from 'vitest'
import {
    emptyBoard,
    HydratedGipfPotentialsBoard,
    PieceKind,
    pointAt,
    type PotentialKind,
    type Unit
} from '@tabletop/gipf-potentials'
import { boardChange } from './boardChange.js'

let nextId = 0
const ids = (count: number) => Array.from({ length: count }, () => nextId++)
const basic = (playerId: string): Unit => ({ playerId, kind: PieceKind.Basic, discIds: ids(1) })
const loaded = (playerId: string, load: PotentialKind): Unit => ({
    playerId,
    kind: PieceKind.Basic,
    load,
    discIds: ids(2)
})
const gipf = (playerId: string): Unit => ({ playerId, kind: PieceKind.Gipf, discIds: ids(2) })

function board(stacks: Record<string, Unit[]>): HydratedGipfPotentialsBoard {
    const hydrated = new HydratedGipfPotentialsBoard(emptyBoard())
    for (const [name, units] of Object.entries(stacks)) {
        for (const unit of units) hydrated.place(pointAt(name), unit)
    }
    return hydrated
}

function entryFrom(on: HydratedGipfPotentialsBoard, dot: string, to: string) {
    const entry = on.findEntry(pointAt(dot), pointAt(to))
    if (entry === undefined) throw Error('no entry')
    return entry
}

describe('boardChange', () => {
    it('reads a push both ways, with the stacks it moved on', () => {
        const before = board({ E2: [basic('b')], E3: [gipf('w')] })
        const after = new HydratedGipfPotentialsBoard(before.dehydrate())
        const pushed = loaded('w', PieceKind.Zertz)
        after.push(entryFrom(after, 'E1', 'E2'), pushed)
        expect(boardChange(before, after)).toMatchObject({
            kind: 'push',
            shifted: 2,
            unit: pushed,
            fromCentre: false,
            forward: true
        })
        expect(boardChange(after, before)).toMatchObject({ kind: 'push', forward: false })
    })

    it('follows the dot a known push came from', () => {
        const before = board({})
        const after = board({})
        after.push(entryFrom(after, 'D1', 'E2'), loaded('w', PieceKind.Yinsh))
        const known = { dot: pointAt('D1'), to: pointAt('E2') }
        expect(boardChange(before, after, known)).toMatchObject({
            kind: 'push',
            entry: { dot: pointAt('D1') }
        })
    })

    it('reads an extra move as the TAMSK-potential leaving the piece on the centre', () => {
        const before = board({ E5: [loaded('w', PieceKind.Tamsk)] })
        const after = new HydratedGipfPotentialsBoard(before.dehydrate())
        after.push(entryFrom(after, 'A3', 'B3'), after.unload(pointAt('E5')))
        expect(boardChange(before, after)).toMatchObject({ kind: 'push', fromCentre: true })
    })

    it("reads a potential's move both ways", () => {
        const dvonn = loaded('w', PieceKind.Dvonn)
        const before = board({ D6: [dvonn], D7: [basic('b')] })
        const after = new HydratedGipfPotentialsBoard(before.dehydrate())
        after.place(pointAt('D7'), after.unload(pointAt('D6')))
        expect(boardChange(before, after)).toEqual({
            kind: 'move',
            from: pointAt('D6'),
            to: pointAt('D7'),
            disc: { playerId: 'w', kind: PieceKind.Dvonn, id: dvonn.discIds[1] },
            forward: true
        })
        expect(boardChange(after, before)).toMatchObject({
            kind: 'move',
            from: pointAt('D7'),
            to: pointAt('D6'),
            forward: false
        })
    })

    it('reads a PÜNCT cover as its potential hopping onto the GIPF-piece it covers', () => {
        const punct = loaded('w', PieceKind.Punct)
        const before = board({ G3: [punct], H2: [gipf('b')] })
        const after = new HydratedGipfPotentialsBoard(before.dehydrate())
        after.unload(pointAt('G3'))
        const cover = gipf('w')
        after.place(pointAt('H2'), cover)
        expect(boardChange(before, after)).toMatchObject({
            kind: 'move',
            from: pointAt('G3'),
            to: pointAt('H2'),
            cover: cover.discIds.map((id) => ({ playerId: 'w', kind: PieceKind.Basic, id }))
        })
        expect(boardChange(after, before)).toMatchObject({ kind: 'discs' })
    })

    it('lifts only the discs that leave a stack, and drops those that come back', () => {
        const tamsk = loaded('w', PieceKind.Tamsk)
        const before = board({ E5: [tamsk] })
        const after = new HydratedGipfPotentialsBoard(before.dehydrate())
        after.unload(pointAt('E5'))
        expect(boardChange(before, after)).toEqual({
            kind: 'discs',
            removed: [
                {
                    coords: pointAt('E5'),
                    from: 1,
                    discs: [{ playerId: 'w', kind: PieceKind.Tamsk, id: tamsk.discIds[1] }]
                }
            ],
            added: []
        })
        expect(boardChange(after, before)).toMatchObject({ kind: 'discs', removed: [] })
    })
})
