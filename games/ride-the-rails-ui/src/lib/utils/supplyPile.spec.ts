import { describe, expect, it } from 'vitest'
import { LOCOMOTIVES_PER_RAILROAD } from '@tabletop/ride-the-rails'
import {
    PILE_CUBE,
    PILE_PAD,
    BUILD_PILE_ROOM,
    BUILD_PILE_ROW,
    CARD_PILE_UNIT,
    SHARE_BUTTON_ROW,
    fittedPileUnit,
    pileCubes,
    pileFootprint,
    rowWidth
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

describe('a supply pile in columns of five', () => {
    it('draws nothing for an empty supply', () => {
        expect(pileCubes(0)).toEqual([])
    })

    it('puts a last cube at the front of the first column', () => {
        expect(rounded(pileCubes(1))).toEqual(rounded([at(0, 4 * 10.4)]))
    })

    it('fills each column from the front, drawn back to front', () => {
        expect(rounded(pileCubes(9))).toEqual(
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
        const cubes = pileCubes(LOCOMOTIVES_PER_RAILROAD)
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

describe('a pile’s footprint', () => {
    it('holds a full supply when fixed, whatever is left, so a desktop card’s pile never moves', () => {
        for (const count of [0, 7, LOCOMOTIVES_PER_RAILROAD]) {
            const { width, height } = pileFootprint('fixed', count)
            expect(width).toBeCloseTo(62 + PILE_CUBE.side + 2 * PILE_PAD, 6)
            expect(height).toBeCloseTo(4 * 10.4 + PILE_CUBE.side + 2 * PILE_PAD, 6)
        }
        for (const cube of pileCubes(LOCOMOTIVES_PER_RAILROAD)) {
            expect(cube.x + PILE_CUBE.side / 2).toBeLessThanOrEqual(
                pileFootprint('fixed', LOCOMOTIVES_PER_RAILROAD).width - PILE_PAD + 1e-9
            )
        }
    })

    it('follows the count when following: a column of five at a time, always five rows high', () => {
        const widths = [1, 5, 6, 10, 11, 15, 16, 22, 27].map(
            (count) => Math.round(pileFootprint('follow', count).width * 100) / 100
        )
        // 10.2 for one column, then 11 a column and 3.5 more after every second.
        expect(widths).toEqual([10.2, 10.2, 21.2, 21.2, 35.7, 35.7, 46.7, 61.2, 72.2])
        expect(pileFootprint('follow', 9).height).toBeCloseTo(51.8, 6)
    })

    it('keeps one column for an empty supply, where its dashed ghost is drawn', () => {
        expect(pileFootprint('follow', 0).width).toBeCloseTo(10.2, 6)
        expect(pileFootprint('follow', 0).height).toBeCloseTo(51.8, 6)
    })

    it('fills a desktop card’s 56 px, which has no name head, six columns wide', () => {
        const card = pileFootprint('fixed', LOCOMOTIVES_PER_RAILROAD)
        expect(card.height * CARD_PILE_UNIT).toBeCloseTo(56, 6)
        // The narrowest card, 128 px less its edges, holds all six columns.
        expect(card.width * CARD_PILE_UNIT).toBeLessThanOrEqual(128 - 2 * 1.5 - 11)
        // One scale for cubes and gaps alike, so the gaps grow with the cubes.
        expect(PILE_CUBE.side * CARD_PILE_UNIT).toBeCloseTo(9.95, 2)
    })
})

describe('the pile unit that fits a row of piles', () => {
    const follow = (counts: readonly number[]) =>
        counts.map((count) => pileFootprint('follow', count).width)

    it('draws the share buttons at most 1.1, as in round 2 (Red 22, Blue 24, Orange 27)', () => {
        expect(fittedPileUnit(follow([22, 24, 27]), 316, SHARE_BUTTON_ROW)).toBe(1.1)
    })

    it('shrinks round 5’s six share buttons to fit the panel’s 316 px', () => {
        const counts = [0, 3, 7, 15, 22, 26]
        const unit = fittedPileUnit(follow(counts), 316, SHARE_BUTTON_ROW)
        expect(unit).toBeCloseTo(0.78, 2)
        expect(rowWidth(follow(counts), unit, SHARE_BUTTON_ROW)).toBeLessThanOrEqual(316)
    })

    it('draws the build panel’s piles at most 0.62, and three full piles in 160 px at 0.59', () => {
        expect(fittedPileUnit(follow([27, 22]), BUILD_PILE_ROOM, BUILD_PILE_ROW)).toBe(0.62)
        const full = follow([27, 27, 27])
        const unit = fittedPileUnit(full, BUILD_PILE_ROOM, BUILD_PILE_ROW)
        expect(unit).toBeCloseTo(0.59, 2)
        expect(rowWidth(full, unit, BUILD_PILE_ROW)).toBeLessThanOrEqual(BUILD_PILE_ROOM)
    })

    it('keeps the largest unit before the room is measured', () => {
        expect(fittedPileUnit(follow([27, 27, 27, 27, 27, 27]), 0, SHARE_BUTTON_ROW)).toBe(1.1)
    })
})
