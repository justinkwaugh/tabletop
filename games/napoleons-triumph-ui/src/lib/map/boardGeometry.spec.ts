import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import { insidePolygon } from '$lib/utils/polygon.js'
import { APPROACH_GEOMETRY, LOCALE_GEOMETRY } from './boardGeometry.js'

function distanceToSide(point: Point, from: Point, to: Point): number {
    const along = { x: to.x - from.x, y: to.y - from.y }
    const length = along.x * along.x + along.y * along.y
    const reach =
        length === 0
            ? 0
            : Math.min(
                  1,
                  Math.max(
                      0,
                      ((point.x - from.x) * along.x + (point.y - from.y) * along.y) / length
                  )
              )
    return Math.hypot(point.x - (from.x + along.x * reach), point.y - (from.y + along.y * reach))
}

function distanceToOutline(point: Point, outline: readonly Point[]): number {
    return Math.min(
        ...outline.map((corner, index) =>
            distanceToSide(point, corner, outline[(index + 1) % outline.length])
        )
    )
}

describe('the locales drawn from the printed bars', () => {
    it('runs a side of each locale through the middle of every approach bar it has', () => {
        for (const [id, bar] of Object.entries(APPROACH_GEOMETRY)) {
            const { locale } = AUSTERLITZ.approach(Number(id))
            expect(
                distanceToOutline(bar.centre, LOCALE_GEOMETRY[locale].outline),
                `approach ${id} of locale ${locale}`
            ).toBeLessThan(1)
        }
    })

    it('stands each reserve stack inside its locale, clear of the edge by the room it claims', () => {
        for (const [number, locale] of Object.entries(LOCALE_GEOMETRY)) {
            expect(insidePolygon(locale.anchor, locale.outline), `locale ${number}`).toBe(true)
            expect(
                distanceToOutline(locale.anchor, locale.outline),
                `locale ${number}`
            ).toBeGreaterThan(locale.clearance - 6)
        }
    })
})
