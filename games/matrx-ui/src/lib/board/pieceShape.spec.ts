import { describe, expect, it } from 'vitest'
import { BoardShape, PieceKind } from '@tabletop/matrx'
import { PIECE_RADIUS, viewOf } from './geometry.js'
import {
    boardHoleLight,
    holeLight,
    holeLightBelow,
    markOf,
    pieceDrawing,
    type Disc
} from './pieceShape.js'

const view = viewOf(BoardShape.Matrx)
const radius = PIECE_RADIUS
const dvonn: Disc = { tone: 'light', kind: PieceKind.Dvonn }
const others: Disc[] = Object.values(PieceKind)
    .filter((kind) => kind !== PieceKind.Dvonn)
    .map((kind) => ({ tone: 'dark', kind }))

// A hole's lens (from lens()), down the screen at its middle, from its far edge to its near one.
function span(path: string | undefined): [number, number] {
    expect(path).toBeDefined()
    const [x, mid, rx, ry] = path!
        .replace(/[MAZ]/g, ' ')
        .trim()
        .split(/\s+/)
        .slice(0, 4)
        .map(Number)
    const half = ry - ry * Math.sqrt(1 - (x / rx) ** 2)
    return [mid - half, mid + half]
}

function shifted([far, near]: [number, number], by: number): [number, number] {
    return [far + by, near + by]
}

function seenThrough(): string | undefined {
    const mark = markOf(view, dvonn, radius)
    return mark?.kind === 'hole' ? mark.through : undefined
}

// Each disc's underside, from where the stack stands: bottom first.
const bases = pieceDrawing(view, 2, radius).bases

describe('light down a DVONN hole', () => {
    it('falls only through a DVONN disc', () => {
        expect(holeLightBelow(view, radius, dvonn)).toBeDefined()
        expect(boardHoleLight(view, radius, dvonn)).toBeDefined()
        for (const disc of others) {
            expect(holeLightBelow(view, radius, disc)).toBeUndefined()
            expect(boardHoleLight(view, radius, disc)).toBeUndefined()
        }
        expect(holeLightBelow(view, radius, undefined)).toBeUndefined()
        expect(boardHoleLight(view, radius, undefined)).toBeUndefined()
    })

    it('lights less than shows through the hole, short by the gap under the disc', () => {
        const seen = span(seenThrough())
        const lit = span(holeLight(view, radius))
        expect(lit[1]).toBeCloseTo(seen[1])
        // The gap's seam, beyond the lit patch, at its true height.
        expect(lit[0] - seen[0]).toBeCloseTo(-bases[0])
        expect(lit[0]).toBeGreaterThan(seen[0])
    })

    it('lands on the disc below where the disc above lets it through', () => {
        const fromAbove = shifted(span(holeLight(view, radius)), bases[1])
        const onBelow = shifted(span(holeLightBelow(view, radius, dvonn)), bases[0])
        expect(onBelow[0]).toBeCloseTo(fromAbove[0])
        expect(onBelow[1]).toBeCloseTo(fromAbove[1])
    })

    it('lands on the board under the bottom disc', () => {
        const fromDisc = shifted(span(holeLight(view, radius)), bases[0])
        const onBoard = span(boardHoleLight(view, radius, dvonn))
        expect(onBoard[0]).toBeCloseTo(fromDisc[0])
        expect(onBoard[1]).toBeCloseTo(fromDisc[1])
    })

    it('shows the lit board down two DVONN discs', () => {
        const top = shifted(span(seenThrough()), bases[1])
        const bottom = shifted(span(seenThrough()), bases[0])
        const board = span(boardHoleLight(view, radius, dvonn))
        const far = Math.max(top[0], bottom[0], board[0])
        const near = Math.min(top[1], bottom[1], board[1])
        expect(near).toBeGreaterThan(far)
    })
})
