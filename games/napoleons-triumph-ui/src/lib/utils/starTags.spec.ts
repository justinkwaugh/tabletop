import { describe, expect, it } from 'vitest'
import { AUSTERLITZ, Hold, Star, type StarHold } from '@tabletop/napoleons-triumph'
import { LOCALE_GEOMETRY, PRINTED_STARS } from '$lib/map/boardGeometry.js'
import { outlinesOverlap } from './convexOutline.js'
import { cornersOf, squareAround } from './orientedBox.js'
import { insidePolygon } from './polygon.js'
import { starTagSize, starTags } from './starTags.js'

const starsOf = (locale: number) => AUSTERLITZ.locale(locale).stars
const THREE_STARS = 87
const NOBODY_HOLDS: StarHold[] = []

describe('the printed objective stars', () => {
    it('are where the rules put stars, as many in each locale, each inside its locale', () => {
        const objectives = AUSTERLITZ.allLocales.filter((locale) => locale.stars.length > 0)
        expect(
            Object.keys(PRINTED_STARS)
                .map(Number)
                .sort((a, b) => a - b)
        ).toEqual(objectives.map((locale) => locale.id).sort((a, b) => a - b))
        for (const locale of objectives) {
            expect(PRINTED_STARS[locale.id]).toHaveLength(locale.stars.length)
            for (const star of PRINTED_STARS[locale.id]) {
                expect(insidePolygon(star, LOCALE_GEOMETRY[locale.id].outline)).toBe(true)
            }
        }
    })
})

describe('star tags', () => {
    it('are shown only for the locales whose printed stars something covers', () => {
        expect(
            starTags(starsOf, NOBODY_HOLDS, { scale: 1, obstacles: [], capacityTags: [] })
        ).toEqual([])
        const covering = cornersOf(squareAround(PRINTED_STARS[THREE_STARS][1], 3))
        const tags = starTags(starsOf, NOBODY_HOLDS, {
            scale: 1,
            obstacles: [covering],
            capacityTags: []
        })
        expect(tags.map((tag) => tag.locale)).toEqual([THREE_STARS])
        expect(tags[0].stars).toEqual([
            { star: Star.Green, hold: undefined },
            { star: Star.Red, hold: undefined },
            { star: Star.Black, hold: undefined }
        ])
    })

    it('go to the nearest clear spot wholly inside their locale, at the size of their stars', () => {
        const stack = cornersOf(squareAround(PRINTED_STARS[THREE_STARS][1], 30))
        const scale = 2
        const [tag] = starTags(starsOf, NOBODY_HOLDS, {
            scale,
            obstacles: [stack],
            capacityTags: []
        })
        expect(tag.moved).toBe(true)
        const size = starTagSize(3)
        expect(tag.cover.halfLength * 2).toBe(size.width * scale)
        expect(tag.cover.halfWidth * 2).toBe(size.height * scale)
        const corners = cornersOf(tag.cover)
        expect(
            corners.every((corner) => insidePolygon(corner, LOCALE_GEOMETRY[THREE_STARS].outline))
        ).toBe(true)
        expect(outlinesOverlap(corners, stack)).toBe(false)
    })

    it('are shown on the print wherever a star is held, filling the stars of the army that holds them', () => {
        const holds: StarHold[] = [
            { star: Star.Green, locales: [{ locale: THREE_STARS, hold: Hold.Held }] },
            { star: Star.Red, locales: [{ locale: THREE_STARS, hold: Hold.Held }] },
            { star: Star.Black, locales: [{ locale: THREE_STARS, hold: Hold.Possible }] },
            { star: Star.Blue, locales: [] }
        ]
        const [tag] = starTags(starsOf, holds, { scale: 1, obstacles: [], capacityTags: [] })
        expect(tag).toMatchObject({ locale: THREE_STARS, moved: false })
        expect(tag.stars).toEqual([
            { star: Star.Green, hold: Hold.Held },
            { star: Star.Red, hold: Hold.Held },
            { star: Star.Black, hold: Hold.Possible }
        ])
    })

    it('keep clear of capacity tags without counting them as covering the print', () => {
        const capacityTag = cornersOf(squareAround(PRINTED_STARS[THREE_STARS][1], 10))
        expect(
            starTags(starsOf, NOBODY_HOLDS, {
                scale: 1,
                obstacles: [],
                capacityTags: [capacityTag]
            })
        ).toEqual([])
        const stack = cornersOf(squareAround(PRINTED_STARS[THREE_STARS][0], 3))
        const [tag] = starTags(starsOf, NOBODY_HOLDS, {
            scale: 1,
            obstacles: [stack],
            capacityTags: [capacityTag]
        })
        expect(outlinesOverlap(cornersOf(tag.cover), capacityTag)).toBe(false)
    })
})
