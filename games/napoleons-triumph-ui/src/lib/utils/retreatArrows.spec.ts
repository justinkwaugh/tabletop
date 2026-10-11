import { describe, expect, it } from 'vitest'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { retreatArrows } from './retreatArrows.js'

const FROM = 94
const NORTH = 93
const EAST = 95

describe('the arrows of a retreat being arranged', () => {
    it('draws one arrow to each locale, counting the units sent there', () => {
        const arrows = retreatArrows(FROM, { a: NORTH, b: EAST, c: NORTH })
        expect(arrows.map(({ locale, unitCount }) => ({ locale, unitCount }))).toEqual([
            { locale: NORTH, unitCount: 2 },
            { locale: EAST, unitCount: 1 }
        ])
    })

    it('runs from the anchor of the locale left towards the anchor of the locale reached', () => {
        const [arrow] = retreatArrows(FROM, { a: NORTH })
        const start = LOCALE_GEOMETRY[FROM].anchor
        const end = LOCALE_GEOMETRY[NORTH].anchor
        const radians = (arrow.angle * Math.PI) / 180
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        expect(arrow.start).toEqual(start)
        expect(arrow.end).toEqual(end)
        expect(start.x + Math.cos(radians) * length).toBeCloseTo(end.x)
        expect(start.y + Math.sin(radians) * length).toBeCloseTo(end.y)
    })

    it('starts clear of the pieces and stops short of the count at the far end', () => {
        const [arrow] = retreatArrows(FROM, { a: NORTH })
        const start = LOCALE_GEOMETRY[FROM].anchor
        const end = LOCALE_GEOMETRY[NORTH].anchor
        const length = Math.hypot(end.x - start.x, end.y - start.y)
        const reaches = [...arrow.path.matchAll(/[MHL](-?[\d.]+)/g)].map((match) =>
            Number(match[1])
        )
        expect(Math.min(...reaches)).toBeCloseTo(length * 0.3)
        expect(Math.max(...reaches)).toBeCloseTo(length * 0.8)
    })

    it('draws nothing when no unit has a place to go', () => {
        expect(retreatArrows(FROM, {})).toEqual([])
    })
})
