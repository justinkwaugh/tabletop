import { describe, expect, it } from 'vitest'
import { Region, mapSlotsFor } from '@tabletop/oath'
import { assertExists, type BoundingBox } from '@tabletop/common'
import {
    BOARD_WIDTH,
    CARD_STRIP_RECTS,
    DISCARD_RECTS,
    FAVOR_BANK_CENTERS,
    SHARED_FAVOR_CENTER,
    SITE_SLOT_RECTS,
    SURFACE_HEIGHT,
    stripLayout,
    type StripSpace
} from './boardGeometry.js'
import {
    allSitesFrameRect,
    banksFocusRect,
    regionFocusRect,
    siteFocusRect,
    siteRowsFrameRect,
    travelFrameRect
} from './boardFocusAreas.js'

const contains = (outer: BoundingBox, inner: BoundingBox) =>
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height

function rectOf(table: Readonly<Record<string, BoundingBox>>, slotId: string): BoundingBox {
    const rect = table[slotId]
    assertExists(rect, `${slotId} has a rectangle`)
    return rect
}

const disjoint = (a: BoundingBox, b: BoundingBox) =>
    a.x + a.width <= b.x || b.x + b.width <= a.x

describe('the board focus views (scenario 45)', () => {
    it('a region holds its discard pile, its sites and the strips beside them', () => {
        for (const region of [Region.Cradle, Region.Provinces, Region.Hinterland]) {
            const rect = regionFocusRect(region)
            expect(contains(rect, DISCARD_RECTS[region])).toBe(true)
            for (const slotId of mapSlotsFor(region)) {
                expect(contains(rect, rectOf(SITE_SLOT_RECTS, slotId))).toBe(true)
                expect(contains(rect, rectOf(CARD_STRIP_RECTS, slotId))).toBe(true)
            }
        }
    })

    it('a region holds every denizen and relic space its strips can lay out, and the chip under its last site', () => {
        for (const region of [Region.Cradle, Region.Provinces, Region.Hinterland]) {
            const rect = regionFocusRect(region)
            for (const slotId of mapSlotsFor(region)) {
                const full: StripSpace[] = []
                for (let i = 0; i < 8; i++) full.push({ kind: i % 3 === 2 ? 'relic' : 'denizen', pickable: false })
                for (const placed of stripLayout(rectOf(CARD_STRIP_RECTS, slotId), full)) {
                    expect(contains(rect, placed)).toBe(true)
                }
                const site = rectOf(SITE_SLOT_RECTS, slotId)
                expect(rect.y + rect.height).toBeGreaterThanOrEqual(site.y + site.height + 13)
            }
            expect(rect.y).toBeLessThanOrEqual(DISCARD_RECTS[region].y - 20)
        }
    })

    it('the three regions sit side by side without overlapping', () => {
        expect(disjoint(regionFocusRect(Region.Cradle), regionFocusRect(Region.Provinces))).toBe(true)
        expect(disjoint(regionFocusRect(Region.Provinces), regionFocusRect(Region.Hinterland))).toBe(true)
    })

    it('the banks view holds the six banks and the shared one, and no site', () => {
        const rect = banksFocusRect()
        for (const center of [...Object.values(FAVOR_BANK_CENTERS), SHARED_FAVOR_CENTER]) {
            expect(center.x > rect.x && center.x < rect.x + rect.width).toBe(true)
            expect(center.y > rect.y && center.y < rect.y + rect.height).toBe(true)
        }
        expect(rect.height).toBeLessThan(200)
    })

    it('a site’s row holds its card, every space its strip can lay out and its chip, as a region does', () => {
        for (const slotId of Object.keys(SITE_SLOT_RECTS)) {
            const rect = siteFocusRect(slotId)
            const full: StripSpace[] = []
            for (let i = 0; i < 8; i++) full.push({ kind: i % 3 === 2 ? 'relic' : 'denizen', pickable: false })
            for (const placed of stripLayout(rectOf(CARD_STRIP_RECTS, slotId), full)) {
                expect(contains(rect, placed)).toBe(true)
            }
            const site = rectOf(SITE_SLOT_RECTS, slotId)
            expect(rect.y + rect.height).toBeGreaterThanOrEqual(site.y + site.height + 13)
            expect(rect.height).toBeLessThan(site.height + 60)
            expect(contains(rect, rectOf(SITE_SLOT_RECTS, slotId))).toBe(true)
            expect(contains(rect, rectOf(CARD_STRIP_RECTS, slotId))).toBe(true)
            expect(rect.x >= 0 && rect.x + rect.width <= BOARD_WIDTH).toBe(true)
            expect(rect.y >= 0 && rect.y + rect.height <= SURFACE_HEIGHT).toBe(true)
        }
    })
})

describe('Travel on a phone frames the lit sites (Choose a Travel destination)', () => {
    const regions = [Region.Cradle, Region.Provinces, Region.Hinterland]

    it('a region’s frame holds its sites and not the strips beside them, and every region is framed at one size', () => {
        const [first, ...others] = regions.map(travelFrameRect)
        for (const rect of others) {
            expect(rect.width).toBe(first.width)
            expect(rect.height).toBe(first.height)
        }
        for (const region of regions) {
            const rect = travelFrameRect(region)
            for (const slotId of mapSlotsFor(region)) {
                expect(contains(rect, rectOf(SITE_SLOT_RECTS, slotId))).toBe(true)
                expect(disjoint(rect, rectOf(CARD_STRIP_RECTS, slotId))).toBe(true)
            }
        }
    })

    it('sideways, one frame holds every site and none of the strips beyond the last column', () => {
        const rect = allSitesFrameRect()
        for (const slotId of Object.keys(SITE_SLOT_RECTS)) {
            expect(contains(rect, rectOf(SITE_SLOT_RECTS, slotId))).toBe(true)
        }
        for (const slotId of mapSlotsFor(Region.Hinterland)) {
            expect(disjoint(rect, rectOf(CARD_STRIP_RECTS, slotId))).toBe(true)
        }
    })

    it('Setup sideways frames the rows its start sites stand in: the top row for three, and for one', () => {
        const top = [Region.Cradle, Region.Provinces, Region.Hinterland].map((region) => mapSlotsFor(region)[0])
        const rect = siteRowsFrameRect(top)
        for (const slotId of top) expect(contains(rect, rectOf(SITE_SLOT_RECTS, slotId))).toBe(true)
        for (const region of [Region.Cradle, Region.Provinces, Region.Hinterland]) {
            const second = rectOf(SITE_SLOT_RECTS, mapSlotsFor(region)[1])
            expect(rect.y + rect.height).toBeLessThan(second.y + second.height / 2)
        }
        expect(siteRowsFrameRect([top[0]])).toEqual(rect)
    })
})
