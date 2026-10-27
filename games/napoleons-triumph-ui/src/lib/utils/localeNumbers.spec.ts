import { describe, expect, it } from 'vitest'
import { LOCALE_GEOMETRY } from '$lib/map/boardGeometry.js'
import { FIGURE_HEIGHT, FIGURE_WIDTH, localeNumberSize, localeNumbers } from './localeNumbers.js'

describe('the locale numbers printed on the map', () => {
    it('stand at each locale’s anchor', () => {
        const [number] = localeNumbers([72])
        expect(number).toMatchObject({ locale: 72, at: LOCALE_GEOMETRY[72].anchor })
    })

    it('grow with the room clear of the locale’s edges, up to a limit', () => {
        expect(localeNumberSize(72, 40)).toBeGreaterThan(localeNumberSize(72, 30))
        expect(localeNumberSize(72, 1000)).toBe(localeNumberSize(72, 2000))
    })

    it('are smaller with three figures than two in the same room', () => {
        expect(localeNumberSize(164, 30)).toBeLessThan(localeNumberSize(64, 30))
    })

    it('fit inside the room clear of the edges', () => {
        for (const [locale, { clearance }] of Object.entries(LOCALE_GEOMETRY)) {
            const size = localeNumberSize(Number(locale), clearance)
            const halfWidth = (locale.length * FIGURE_WIDTH * size) / 2
            expect(Math.hypot(halfWidth, (FIGURE_HEIGHT / 2) * size)).toBeLessThanOrEqual(clearance)
        }
    })
})
