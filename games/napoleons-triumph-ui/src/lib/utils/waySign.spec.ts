import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { WAY_SIGN_REACH, waySignArrow, type WaySignArrow } from './waySign.js'

const AT = { x: 100, y: 100 }
const WEST = { x: 0, y: 100 }
const EAST = { x: 200, y: 100 }
const NORTH = { x: 100, y: 0 }
const SOUTH_WEST = { x: 0, y: 200 }
const NEARLY_BACK = { x: 0, y: 110 }

const fromCentre = (point: Point) => Math.hypot(point.x, point.y)

function onTheCurve({ tail, knee, tip }: WaySignArrow, share: number): Point {
    const rest = 1 - share
    return {
        x: rest * rest * tail.x + 2 * rest * share * knee.x + share * share * tip.x,
        y: rest * rest * tail.y + 2 * rest * share * knee.y + share * share * tip.y
    }
}

function furthestFromCentre(arrow: WaySignArrow): number {
    return Math.max(
        ...Array.from({ length: 41 }, (_, index) => fromCentre(onTheCurve(arrow, index / 40)))
    )
}

describe('the arrow on a road-choice sign', () => {
    it('runs the whole width of the sign through its centre when the road goes straight on', () => {
        const arrow = waySignArrow(AT, WEST, EAST)
        expect(arrow.tail.x).toBeCloseTo(-WAY_SIGN_REACH)
        expect(arrow.tip.x).toBeCloseTo(WAY_SIGN_REACH)
        expect(arrow.tail.y).toBeCloseTo(0)
        expect(arrow.tip.y).toBeCloseTo(0)
        expect(arrow.angle).toBeCloseTo(0)
    })

    it('comes in from where the march comes and curves towards where it goes on', () => {
        const arrow = waySignArrow(AT, WEST, NORTH)
        expect(arrow.tail.x).toBeLessThan(arrow.tip.x)
        expect(arrow.tip.y).toBeLessThan(arrow.tail.y)
        expect(arrow.tail.y).toBeCloseTo(arrow.knee.y)
        expect(arrow.tip.x).toBeCloseTo(arrow.knee.x)
        expect(arrow.angle).toBeCloseTo(-90)
    })

    it('fills the sign and stays inside it, however the road turns', () => {
        for (const goesOnTo of [EAST, NORTH, SOUTH_WEST, NEARLY_BACK]) {
            const arrow = waySignArrow(AT, WEST, goesOnTo)
            expect(furthestFromCentre(arrow)).toBeCloseTo(WAY_SIGN_REACH)
        }
    })

    it('is centred: its two ends lie equally far from the middle of the sign', () => {
        for (const goesOnTo of [NORTH, SOUTH_WEST, NEARLY_BACK]) {
            const arrow = waySignArrow(AT, WEST, goesOnTo)
            expect(fromCentre(arrow.tail)).toBeCloseTo(fromCentre(arrow.tip))
        }
    })

    it('stops its shaft short of the tip, inside the head', () => {
        const arrow = waySignArrow(AT, WEST, EAST)
        expect(arrow.shaftEnd.x).toBeGreaterThan(0)
        expect(arrow.shaftEnd.x).toBeLessThan(arrow.tip.x)
    })

    it('runs straight when the march starts at the sign, or nothing lies beyond it', () => {
        const starting = waySignArrow(AT, undefined, EAST)
        expect(starting.tail.x).toBeCloseTo(-WAY_SIGN_REACH)
        expect(starting.tip.x).toBeCloseTo(WAY_SIGN_REACH)
        const ending = waySignArrow(AT, WEST, undefined)
        expect(ending.tail.x).toBeCloseTo(-WAY_SIGN_REACH)
        expect(ending.tip.x).toBeCloseTo(WAY_SIGN_REACH)
    })
})
