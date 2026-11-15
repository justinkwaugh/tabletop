import { describe, expect, it } from 'vitest'
import { LOCOMOTIVES_PER_RAILROAD } from '@tabletop/ride-the-rails'
import {
    PILE_CUBE,
    PILE_PAD,
    PILE_PIXELS_PER_UNIT,
    pileCubes,
    pileFootprint,
    type PileArrangement
} from './supplyPile.js'

/** A cube's centre from its column and row offsets, in pile units. */
function at(x: number, y: number) {
    const inset = PILE_PAD + PILE_CUBE.side / 2
    return { x: inset + x, y: inset + y }
}

function rounded(points: readonly { x: number; y: number }[]) {
    return points.map(({ x, y }) => ({
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100
    }))
}

describe('a supply pile in columns of five (desktop cards)', () => {
    it('draws nothing for an empty supply', () => {
        expect(pileCubes(0, 'columns')).toEqual([])
    })

    it('puts a last cube at the front of the first column', () => {
        expect(rounded(pileCubes(1, 'columns'))).toEqual(rounded([at(0, 4 * 10.4)]))
    })

    it('fills each column from the front, drawn back to front', () => {
        expect(rounded(pileCubes(9, 'columns'))).toEqual(
            rounded([
                at(0, 0),
                at(0, 10.4),
                at(11, 10.4),
                at(0, 2 * 10.4),
                at(11, 2 * 10.4),
                at(0, 3 * 10.4),
                at(11, 3 * 10.4),
                at(0, 4 * 10.4),
                at(11, 4 * 10.4)
            ])
        )
    })

    it('lays a full supply of 27 in six columns, a gap after every second', () => {
        const cubes = pileCubes(LOCOMOTIVES_PER_RAILROAD, 'columns')
        expect(cubes).toHaveLength(27)
        const columns = [...new Set(cubes.map((cube) => Math.round(cube.x * 100) / 100))].sort(
            (a, b) => a - b
        )
        expect(columns).toEqual(
            rounded([0, 11, 25.5, 36.5, 51, 62].map((x) => at(x, 0))).map((p) => p.x)
        )
        // The sixth column holds the last two, at the front.
        const last = cubes.filter((cube) => Math.abs(cube.x - at(62, 0).x) < 0.01)
        expect(rounded(last)).toEqual(rounded([at(62, 3 * 10.4), at(62, 4 * 10.4)]))
    })
})

describe('a supply pile in rows of five (phone rail)', () => {
    it('draws nothing for an empty supply', () => {
        expect(pileCubes(0, 'rows')).toEqual([])
    })

    it('puts a last cube at the start of the first row', () => {
        expect(rounded(pileCubes(1, 'rows'))).toEqual(rounded([at(0, 0)]))
    })

    it('fills each row of five before the next', () => {
        expect(rounded(pileCubes(9, 'rows'))).toEqual(
            rounded([
                ...[0, 11, 22, 33, 44].map((x) => at(x, 0)),
                ...[0, 11, 22, 33].map((x) => at(x, 10.4))
            ])
        )
    })

    it('lays a full supply of 27 in six rows, a gap after every second', () => {
        const cubes = pileCubes(LOCOMOTIVES_PER_RAILROAD, 'rows')
        expect(cubes).toHaveLength(27)
        const rows = [...new Set(cubes.map((cube) => Math.round(cube.y * 100) / 100))]
        expect(rows).toEqual(
            rounded([0, 10.4, 23.8, 34.2, 47.6, 58].map((y) => at(0, y))).map((p) => p.y)
        )
        expect(rounded(cubes.slice(-2))).toEqual(rounded([at(0, 58), at(11, 58)]))
    })
})

describe('a pile’s footprint', () => {
    const footprints: Record<PileArrangement, { width: number; height: number }> = {
        columns: { width: 62 + PILE_CUBE.side, height: 4 * 10.4 + PILE_CUBE.side },
        rows: { width: 44 + PILE_CUBE.side, height: 58 + PILE_CUBE.side }
    }

    it('holds a full supply, whatever is left, so a pile never moves as it shrinks', () => {
        for (const arrangement of ['columns', 'rows'] as const) {
            const { width, height } = footprints[arrangement]
            expect(pileFootprint(arrangement).width).toBeCloseTo(width + 2 * PILE_PAD, 6)
            expect(pileFootprint(arrangement).height).toBeCloseTo(height + 2 * PILE_PAD, 6)
            for (const cube of pileCubes(LOCOMOTIVES_PER_RAILROAD, arrangement)) {
                expect(cube.x + PILE_CUBE.side / 2).toBeLessThanOrEqual(
                    pileFootprint(arrangement).width - PILE_PAD + 1e-9
                )
                expect(cube.y + PILE_CUBE.side / 2).toBeLessThanOrEqual(
                    pileFootprint(arrangement).height - PILE_PAD + 1e-9
                )
            }
        }
    })

    it('fills a desktop card’s body, 1 px clear of its head and its foot, six columns wide', () => {
        // The 64 px card less its 1 px edges and its 14 px head is 48 px tall.
        const desktop = pileFootprint('columns')
        const scale = PILE_PIXELS_PER_UNIT.columns
        expect(desktop.height * scale).toBeCloseTo(48 - 2 * 1, 6)
        // The narrowest card, 128 px less its edges and padding, holds all six columns.
        expect(desktop.width * scale).toBeLessThanOrEqual(128 - 2 - 11)
        // One scale for cubes and gaps alike, so the gaps grow with the cubes.
        expect(PILE_CUBE.side * scale).toBeCloseTo(8.17, 2)
    })

    it('fits the phone rail’s 57 px', () => {
        const rail = pileFootprint('rows')
        expect(rail.width * PILE_PIXELS_PER_UNIT.rows).toBeLessThanOrEqual(57 - 2 * 3)
    })
})
