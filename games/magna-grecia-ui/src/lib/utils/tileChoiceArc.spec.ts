import { describe, expect, it } from 'vitest'
import { tileChoiceArc } from './tileChoiceArc.js'

const bounds = { width: 1000, height: 800 }

describe('tile choice arc', () => {
    it('fans the choices out above the hex when there is room', () => {
        const points = tileChoiceArc({
            center: { x: 500, y: 400 },
            count: 2,
            radius: 110,
            choiceSize: 70,
            bounds
        })
        expect(points).toHaveLength(2)
        expect(points.every((point) => point.y < 400)).toBe(true)
        expect(points[0].x).toBeGreaterThan(0)
        const gap = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
        expect(gap).toBeGreaterThan(70)
    })

    it('flips below the hex near the top edge', () => {
        const points = tileChoiceArc({
            center: { x: 500, y: 60 },
            count: 2,
            radius: 110,
            choiceSize: 70,
            bounds
        })
        expect(points.every((point) => point.y > 60)).toBe(true)
    })

    it('returns nothing when there are no choices', () => {
        expect(
            tileChoiceArc({ center: { x: 1, y: 1 }, count: 0, radius: 1, choiceSize: 1, bounds })
        ).toEqual([])
    })
})
