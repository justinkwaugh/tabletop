import type { BoundingBox } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    FAVOR_BANK_ORDER,
    Region,
    VISIONS_DRAWN_SUPPLY_COST,
    allMapSlots,
    mapSlotsFor
} from '@tabletop/oath'
import {
    BOARD_HEIGHT,
    BOARD_WIDTH,
    CARD_STRIP_RECTS,
    DISCARD_RECTS,
    FAVOR_BANK_CENTERS,
    FAVOR_BANK_RADIUS,
    REGION_COLUMN_LEFT,
    RELIC_DECK_RECT,
    SITE_SLOT_RECTS,
    VISIONS_TRACK_CELLS,
    WORLD_DECK_RECT,
} from './boardGeometry.js'


const inBoard = (rect: BoundingBox): boolean =>
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.width <= BOARD_WIDTH &&
    rect.y + rect.height <= BOARD_HEIGHT

const overlaps = (a: BoundingBox, b: BoundingBox): boolean =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('board geometry — the map (R-2.1.1)', () => {
    it('R-2.1.1 — has a rectangle for every slot the engine deals into, and no others', () => {
        const engineSlots = Object.values(allMapSlots()).flat()
        expect(Object.keys(SITE_SLOT_RECTS).sort()).toEqual([...engineSlots].sort())
        expect(engineSlots).toHaveLength(8)
    })

    it('R-2.1.1 — every slot is on the board', () => {
        for (const [slotId, rect] of Object.entries(SITE_SLOT_RECTS)) {
            expect(inBoard(rect), `${slotId} runs off the board`).toBe(true)
        }
    })

    it('R-2.1.1 — no two slots overlap', () => {
        const entries = Object.entries(SITE_SLOT_RECTS)
        for (let i = 0; i < entries.length; i += 1) {
            for (let j = i + 1; j < entries.length; j += 1) {
                const [aId, a] = entries[i]
                const [bId, b] = entries[j]
                expect(overlaps(a, b), `${aId} overlaps ${bId}`).toBe(false)
            }
        }
    })

    it('R-2.1.1 — the regions run left to right: Cradle, Provinces, Hinterland', () => {
        expect(REGION_COLUMN_LEFT[Region.Cradle]).toBeLessThan(
            REGION_COLUMN_LEFT[Region.Provinces]
        )
        expect(REGION_COLUMN_LEFT[Region.Provinces]).toBeLessThan(
            REGION_COLUMN_LEFT[Region.Hinterland]
        )
    })

    it('R-2.1.1 — a region’s slots run top to bottom in the engine’s own order', () => {
        for (const region of Object.values(Region)) {
            const tops = mapSlotsFor(region).map((slotId) => SITE_SLOT_RECTS[slotId].y)
            expect([...tops].sort((a, b) => a - b), region).toEqual(tops)
        }
    })
})

describe('board geometry — denizen strips', () => {
    it('every slot has a strip, and it is to the right of the site', () => {
        for (const [slotId, site] of Object.entries(SITE_SLOT_RECTS)) {
            const strip = CARD_STRIP_RECTS[slotId]
            expect(strip, `${slotId} has no card strip`).toBeDefined()
            expect(strip.x, slotId).toBeGreaterThanOrEqual(site.x + site.width)
        }
    })

    it('a strip never runs under the next region’s sites', () => {
        for (const [slotId, strip] of Object.entries(CARD_STRIP_RECTS)) {
            for (const [otherId, site] of Object.entries(SITE_SLOT_RECTS)) {
                if (otherId === slotId) continue
                expect(overlaps(strip, site), `${slotId}'s strip covers ${otherId}`).toBe(false)
            }
        }
    })

    it('every strip is on the board and wide enough for two cards', () => {
        // R-2.8.1 — a site can hold more than two cards; two side by side is the floor.
        for (const [slotId, strip] of Object.entries(CARD_STRIP_RECTS)) {
            expect(inBoard(strip), `${slotId}'s strip runs off the board`).toBe(true)
            expect(strip.width, slotId).toBeGreaterThan(strip.height * (651 / 1016) * 2)
        }
    })
})

describe('board geometry — printed furniture', () => {
    it('R-2.1.3 — one favor bank marker per suit, in the engine’s bank order, left to right', () => {
        expect(Object.keys(FAVOR_BANK_CENTERS).sort()).toEqual([...FAVOR_BANK_ORDER].sort())
        const xs = FAVOR_BANK_ORDER.map((suit) => FAVOR_BANK_CENTERS[suit].x)
        expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    })

    it('R-2.1.3 — the banks sit on the board with room for their discs', () => {
        for (const suit of FAVOR_BANK_ORDER) {
            const center = FAVOR_BANK_CENTERS[suit]
            expect(center.x - FAVOR_BANK_RADIUS, suit).toBeGreaterThanOrEqual(0)
            expect(center.x + FAVOR_BANK_RADIUS, suit).toBeLessThanOrEqual(BOARD_WIDTH)
            expect(center.y + FAVOR_BANK_RADIUS, suit).toBeLessThanOrEqual(BOARD_HEIGHT)
        }
    })

    it('R-2.1.6 — the Visions Drawn track has one cell per space the engine prices', () => {
        expect(VISIONS_TRACK_CELLS).toHaveLength(VISIONS_DRAWN_SUPPLY_COST.length)
        const xs = VISIONS_TRACK_CELLS.map((cell) => cell.x)
        expect([...xs].sort((a, b) => a - b)).toEqual(xs)
        for (const cell of VISIONS_TRACK_CELLS) {
            expect(inBoard(cell)).toBe(true)
        }
    })

    it('R-2.1.2 — one discard box per region, on the board and clear of the sites', () => {
        for (const region of Object.values(Region)) {
            const box = DISCARD_RECTS[region]
            expect(inBoard(box), region).toBe(true)
            for (const [slotId, site] of Object.entries(SITE_SLOT_RECTS)) {
                expect(overlaps(box, site), `${region} discard covers ${slotId}`).toBe(false)
            }
        }
    })

    it('R-2.7 — the Relic and World Deck spaces are on the board and do not overlap', () => {
        expect(inBoard(RELIC_DECK_RECT)).toBe(true)
        expect(inBoard(WORLD_DECK_RECT)).toBe(true)
        expect(overlaps(RELIC_DECK_RECT, WORLD_DECK_RECT)).toBe(false)
    })
})
