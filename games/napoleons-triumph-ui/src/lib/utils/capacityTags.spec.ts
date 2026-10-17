import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import { CAPACITY_BOXES, LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { boundsOfPoints } from './boundingBox.js'
import { CAPACITY_TAG_SIZE, capacityTags } from './capacityTags.js'
import { outlinesOverlap } from './convexOutline.js'
import { cornersOf, squareAround } from './orientedBox.js'
import { insidePolygon } from './polygon.js'

const capacityOf = (locale: number) => AUSTERLITZ.locale(locale).capacity

describe('capacity tags', () => {
    it('are one for every locale on its printed box when all are shown and nothing is in the way', () => {
        const tags = capacityTags(capacityOf, { allShown: true, scale: 1, obstacles: [] })
        expect(tags.map((tag) => tag.locale).sort((a, b) => a - b)).toEqual(
            Object.keys(LOCALE_GEOMETRY)
                .map(Number)
                .sort((a, b) => a - b)
        )
        for (const tag of tags) {
            expect(tag.capacity).toBe(capacityOf(tag.locale))
            expect(tag.centre).toEqual(CAPACITY_BOXES[tag.locale])
            expect(tag.moved).toBe(false)
        }
    })

    it('are only shown for the boxes something covers when they are not all shown', () => {
        expect(capacityTags(capacityOf, { allShown: false, scale: 1, obstacles: [] })).toEqual([])
        const covering = cornersOf(squareAround(CAPACITY_BOXES[96], 4))
        const tags = capacityTags(capacityOf, {
            allShown: false,
            scale: 1,
            obstacles: [covering]
        })
        expect(tags.map((tag) => tag.locale)).toEqual([96])
    })

    it('go to the nearest clear spot wholly inside their locale when their box is covered', () => {
        const stack = cornersOf(squareAround(CAPACITY_BOXES[96], 30))
        const scale = 2
        const [tag] = capacityTags(capacityOf, { allShown: false, scale, obstacles: [stack] })
        expect(tag.moved).toBe(true)
        expect(tag.cover.halfLength * 2).toBe(CAPACITY_TAG_SIZE * scale)
        const corners = cornersOf(tag.cover)
        const outline = LOCALE_GEOMETRY[96].outline
        expect(corners.every((corner) => insidePolygon(corner, outline))).toBe(true)
        expect(outlinesOverlap(corners, stack)).toBe(false)
        const printed = CAPACITY_BOXES[96]
        expect(Math.hypot(tag.centre.x - printed.x, tag.centre.y - printed.y)).toBeLessThan(
            30 + CAPACITY_TAG_SIZE * scale
        )
    })

    it('never cross the outline of their locale where it bends in between their corners while it has room', () => {
        const scale = 3
        const obstacles = Object.values(CAPACITY_BOXES).map((at) => cornersOf(squareAround(at, 4)))
        for (const tag of capacityTags(capacityOf, { allShown: false, scale, obstacles })) {
            if (!tag.moved || tag.crossesBorder) continue
            const corners = cornersOf(tag.cover)
            const outline = LOCALE_GEOMETRY[tag.locale].outline
            const sides = outline.map((corner, index) => [
                corner,
                outline[(index + 1) % outline.length]
            ])
            expect(sides.some((side) => outlinesOverlap(corners, side))).toBe(false)
        }
    })

    it('keep their middle in their locale when it has no clear room for the whole tag', () => {
        const stack = cornersOf(squareAround(CAPACITY_BOXES[96], 30))
        const bounds = boundsOfPoints(LOCALE_GEOMETRY[96].outline)
        const scale = Math.ceil(bounds.width / CAPACITY_TAG_SIZE) + 1
        const [tag] = capacityTags(capacityOf, { allShown: false, scale, obstacles: [stack] })
        expect(tag).toMatchObject({ moved: true, crossesBorder: true })
        expect(insidePolygon(tag.centre, LOCALE_GEOMETRY[96].outline)).toBe(true)
        expect(outlinesOverlap(cornersOf(tag.cover), stack)).toBe(false)
    })

    it('stay on their box over whatever covers it when the locale has no clear spot', () => {
        const bounds = boundsOfPoints(LOCALE_GEOMETRY[96].outline)
        const wholeLocale = cornersOf({
            centre: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
            along: { x: 1, y: 0 },
            halfLength: bounds.width / 2,
            halfWidth: bounds.height / 2
        })
        const tag = capacityTags(capacityOf, {
            allShown: false,
            scale: 1,
            obstacles: [wholeLocale]
        }).find((shown) => shown.locale === 96)
        expect(tag).toMatchObject({ centre: CAPACITY_BOXES[96], moved: false })
    })
})
