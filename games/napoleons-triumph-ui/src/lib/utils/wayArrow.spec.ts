import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { coveredBy, type BlockFootprint } from './blockShape.js'
import { boundsOfPoints, boxHolds } from './boundingBox.js'
import {
    ARROW_HEAD_LENGTH,
    arrowAlong,
    drawnArrow,
    drawnArrowOutlines,
    lineSamples
} from './wayArrow.js'

function stackAt(x: number, y: number, angle = 0): BlockFootprint[] {
    return [-22, 0, 22].map((offset) => ({ centre: { x, y: y + offset }, angle }))
}

function lengthOf(line: readonly Point[]): number {
    return line
        .slice(1)
        .reduce((sum, to, index) => sum + Math.hypot(to.x - line[index].x, to.y - line[index].y), 0)
}

describe('the arrow from where pieces stood to where they stand', () => {
    it('starts clear of the places left and stops short of the pieces', () => {
        const left = stackAt(200, 200)
        const arrived = stackAt(700, 500)
        const [tail, tip] = arrowAlong(
            [
                { x: 200, y: 200 },
                { x: 700, y: 500 }
            ],
            left,
            arrived
        )
        expect(coveredBy(left, 4)(tail)).toBe(false)
        expect(coveredBy(arrived, 4)(tip)).toBe(false)
        expect(tail.x).toBeLessThan(tip.x)
        expect(Math.hypot(tail.x - 200, tail.y - 200)).toBeLessThan(90)
        expect(Math.hypot(tip.x - 700, tip.y - 500)).toBeLessThan(90)
    })

    it('starts over the places left when the pieces stand too close for an arrow between', () => {
        const left = stackAt(200, 200)
        const arrived = stackAt(330, 200)
        const line = arrowAlong(
            [
                { x: 200, y: 200 },
                { x: 330, y: 200 }
            ],
            left,
            arrived
        )
        const [tail, tip] = line
        expect(lengthOf(line)).toBeGreaterThan(63.9)
        expect(coveredBy(arrived, 4)(tip)).toBe(false)
        expect(coveredBy(left)(tail)).toBe(true)
        expect(tail.x).toBeLessThan(tip.x)
    })

    it('comes from farther off when pieces enter and stand on the place they came in at', () => {
        const arrived = stackAt(500, 500)
        const entry = { x: 520, y: 540 }
        const line = arrowAlong([entry, { x: 500, y: 500 }], [], arrived)
        const [tail, tip] = line
        expect(lengthOf(line)).toBeGreaterThan(63.9)
        expect(coveredBy(arrived, 4)(tip)).toBe(false)
        expect(tail.y).toBeGreaterThan(tip.y)
        expect(tail.x).toBeGreaterThan(tip.x)
    })

    it('bends where the way bends, but not right beside either end', () => {
        const left = stackAt(200, 200)
        const arrived = stackAt(700, 200)
        const way = [
            { x: 200, y: 200 },
            { x: 450, y: 500 },
            { x: 700, y: 200 }
        ]
        expect(arrowAlong(way, left, arrived)).toHaveLength(3)
        const hugging = [
            { x: 200, y: 200 },
            { x: 640, y: 160 },
            { x: 700, y: 200 }
        ]
        expect(arrowAlong(hugging, left, arrived)).toHaveLength(2)
    })

    it('has nothing to draw without both ends', () => {
        expect(arrowAlong([{ x: 200, y: 200 }], [], [])).toEqual([])
    })
})

describe('drawing the arrow', () => {
    it('stops the shaft inside the head so that it does not show past the point', () => {
        const arrow = drawnArrow([
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        ])
        expect(arrow).toMatchObject({ tip: { x: 200, y: 0 }, angle: 0, scale: 1 })
        const end = arrow?.shaft.at(-1)
        expect(end?.x).toBeGreaterThan(200 - ARROW_HEAD_LENGTH)
        expect(end?.x).toBeLessThan(200 - ARROW_HEAD_LENGTH / 2)
    })

    it('points along the last stretch of a bent line', () => {
        const arrow = drawnArrow([
            { x: 0, y: 0 },
            { x: 200, y: 0 },
            { x: 200, y: 200 }
        ])
        expect(arrow?.angle).toBeCloseTo(90)
        expect(arrow?.shaft).toHaveLength(3)
    })

    it('draws a smaller head on an arrow too short for a full one', () => {
        const arrow = drawnArrow([
            { x: 0, y: 0 },
            { x: 30, y: 0 }
        ])
        expect(arrow?.scale).toBeLessThan(1)
        expect(arrow?.shaft.at(-1)?.x).toBeGreaterThan(0)
    })

    it('marks the whole line for flags to keep off', () => {
        const samples = lineSamples([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 }
        ])
        expect(samples).toContainEqual({ x: 50, y: 0 })
        expect(samples).toContainEqual({ x: 100, y: 50 })
        expect(
            samples.every(
                (point, index) => index === 0 || lengthOf([samples[index - 1], point]) <= 10
            )
        ).toBe(true)
    })
})

describe('the outline of a drawn arrow', () => {
    it('has a piece for each stretch of the shaft and one for the head, holding the tip', () => {
        const arrow = drawnArrow([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 }
        ])!
        const outlines = drawnArrowOutlines(arrow)
        expect(outlines).toHaveLength(arrow.shaft.length)
        expect(boxHolds(boundsOfPoints(outlines.at(-1)!), arrow.tip)).toBe(true)
        expect(boxHolds(boundsOfPoints(outlines[0]), { x: 50, y: 0 })).toBe(true)
    })
})
