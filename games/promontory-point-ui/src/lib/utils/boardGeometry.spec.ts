import { describe, expect, it } from 'vitest'
import type { BoundingBox, Point } from '@tabletop/common'
import { BOARD_GRID, PRICE_TRACK_LENGTH, RAILROAD_IDS } from '@tabletop/promontory-point'
import {
    BORDER_TRACK_LENGTH,
    BORDER_TRACK_SPACES,
    HEX,
    HOME_HEX_CENTRES,
    MAP_SIZE,
    PRICE_TRACK_SPACES,
    SPACE_CENTRES,
    SEA_SLOTS,
    boxCentre,
    hexCentre
} from './boardGeometry.js'

// The printed runs are hand-ruled: the tabs at 10, 30, 40, 60, 80 and 90 and the short end rows
// of the price track are a few pixels off the run's pitch. Every measured step stays within this.
const PITCH_TOLERANCE = 8

function overlaps(a: BoundingBox, b: BoundingBox): boolean {
    return (
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    )
}

function contains(outer: BoundingBox, inner: BoundingBox): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    )
}

function overlappingPairs(boxes: { name: string; box: BoundingBox }[]): string[] {
    return boxes.flatMap((a, i) =>
        boxes.slice(i + 1).flatMap((b) => (overlaps(a.box, b.box) ? [`${a.name} × ${b.name}`] : []))
    )
}

function hexBox(centre: Point): BoundingBox {
    return {
        x: centre.x - HEX.xRadius,
        y: centre.y - HEX.yRadius,
        width: HEX.xRadius * 2,
        height: HEX.yRadius * 2
    }
}

function expectEvenPitch(positions: number[]) {
    const steps = positions.slice(1).map((value, i) => value - positions[i])
    const mean = steps.reduce((sum, step) => sum + step, 0) / steps.length
    for (const step of steps) {
        expect(Math.sign(step)).toBe(Math.sign(mean))
        expect(Math.abs(step - mean)).toBeLessThanOrEqual(PITCH_TOLERANCE)
    }
}

const MAP_BOX: BoundingBox = { x: 0, y: 0, ...MAP_SIZE }

const priceSlotBoxes = PRICE_TRACK_SPACES.flatMap((space) =>
    RAILROAD_IDS.map((railroadId) => ({
        name: `price ${space.priceIndex} ${railroadId}`,
        box: space.slots[railroadId]
    }))
)

const borderBoxes = BORDER_TRACK_SPACES.map((space) => ({
    name: `border ${space.value}`,
    box: space.box
}))

const seaBoxes = [
    { name: 'bag', box: SEA_SLOTS.bag },
    { name: 'end tracker', box: SEA_SLOTS.endTracker },
    ...RAILROAD_IDS.map((railroadId) => ({
        name: `deck ${railroadId}`,
        box: SEA_SLOTS.decks[railroadId]
    }))
]

describe('hex centres (R-1.1, R-1.1-H3)', () => {
    it('places every space in the board data and names no other', () => {
        const dataIds = BOARD_GRID.spaces().map((space) => space.spaceId)
        expect(SPACE_CENTRES.size).toBe(123)
        expect([...SPACE_CENTRES.keys()].sort()).toEqual([...dataIds].sort())
        for (const spaceId of SPACE_CENTRES.keys()) {
            expect(BOARD_GRID.space(spaceId), spaceId).toBeDefined()
        }
    })

    it('places the coastal space -6,5', () => {
        expect(SPACE_CENTRES.get('space.-6.5')).toEqual(hexCentre({ q: -6, r: 5 }))
    })

    it('places the four home hexes, apart from every space', () => {
        expect(Object.keys(HOME_HEX_CENTRES).sort()).toEqual([...RAILROAD_IDS].sort())
        for (const railroadId of RAILROAD_IDS) {
            const centre = HOME_HEX_CENTRES[railroadId]
            expect(centre).toEqual(hexCentre(BOARD_GRID.homeHex(railroadId).coords))
            for (const spaceCentre of SPACE_CENTRES.values()) {
                expect(spaceCentre).not.toEqual(centre)
            }
        }
    })

    it('keeps every hex on the map, clear of the tracks and the sea slots', () => {
        const centres = [...SPACE_CENTRES.values(), ...Object.values(HOME_HEX_CENTRES)]
        for (const centre of centres) {
            const box = hexBox(centre)
            expect(contains(MAP_BOX, box)).toBe(true)
            for (const other of [...priceSlotBoxes, ...borderBoxes, ...seaBoxes]) {
                expect(overlaps(box, other.box), other.name).toBe(false)
            }
        }
    })
})

describe('price track (R-1.2)', () => {
    it('has one space per price index, in index order', () => {
        expect(PRICE_TRACK_SPACES).toHaveLength(PRICE_TRACK_LENGTH)
        PRICE_TRACK_SPACES.forEach((space, index) => expect(space.priceIndex).toBe(index))
    })

    const rowCentre = (index: number) => boxCentre(PRICE_TRACK_SPACES[index].slots['railroad.cp'])
    const leftColumn = PRICE_TRACK_SPACES.slice(7).reverse()
    const rightColumn = PRICE_TRACK_SPACES.slice(0, 7).reverse()

    it('runs 25 to 3 down the left column, then 2, 1 and the five 0s up the right', () => {
        const columnSplit = rowCentre(0).x
        expect(leftColumn.every((space) => rowCentre(space.priceIndex).x < columnSplit)).toBe(true)
        expectEvenPitch(leftColumn.map((space) => rowCentre(space.priceIndex).y))
        expectEvenPitch(rightColumn.map((space) => rowCentre(space.priceIndex).y))
        expect(leftColumn.map((space) => rowCentre(space.priceIndex).y)).toEqual(
            [...leftColumn.map((space) => rowCentre(space.priceIndex).y)].sort((a, b) => a - b)
        )
        expect(rightColumn.map((space) => rowCentre(space.priceIndex).y)).toEqual(
            [...rightColumn.map((space) => rowCentre(space.priceIndex).y)].sort((a, b) => b - a)
        )
        expect(rowCentre(6).y).toBe(rowCentre(7).y)
        expect(rowCentre(0).y).toBe(rowCentre(13).y)
    })

    it('gives each railroad a fixed slot across its row, CP, UP, KP, SP from the left', () => {
        for (const space of PRICE_TRACK_SPACES) {
            const xs = RAILROAD_IDS.map((railroadId) => space.slots[railroadId].x)
            expect(xs).toEqual([...xs].sort((a, b) => a - b))
            expect(new Set(RAILROAD_IDS.map((railroadId) => space.slots[railroadId].y)).size).toBe(
                1
            )
        }
    })

    it('never overlaps two slots', () => {
        expect(overlappingPairs(priceSlotBoxes)).toEqual([])
    })
})

describe('border track (R-1.3-H1)', () => {
    it('has 100 spaces, 0 to 99', () => {
        expect(BORDER_TRACK_SPACES).toHaveLength(BORDER_TRACK_LENGTH)
        BORDER_TRACK_SPACES.forEach((space, value) => expect(space.value).toBe(value))
    })

    it('starts at the bottom-left corner and runs clockwise', () => {
        const centres = BORDER_TRACK_SPACES.map((space) => boxCentre(space.box))
        const zero = BORDER_TRACK_SPACES[0].box
        expect(zero.x).toBe(0)
        expect(zero.y + zero.height).toBe(MAP_SIZE.height)
        const corners = [20, 50, 70].map((value) => BORDER_TRACK_SPACES[value].box)
        expect(corners[0]).toMatchObject({ x: 0, y: 0 })
        expect(corners[1].x + corners[1].width).toBe(MAP_SIZE.width)
        expect(corners[1].y).toBe(0)
        expect(corners[2].x + corners[2].width).toBe(MAP_SIZE.width)
        expect(corners[2].y + corners[2].height).toBe(MAP_SIZE.height)

        const up = centres.slice(0, 21)
        const right = centres.slice(20, 51)
        const down = centres.slice(50, 71)
        const left = [...centres.slice(70), centres[0]]
        expect(new Set(up.map((c) => c.x)).size).toBe(1)
        expect(new Set(right.map((c) => c.y)).size).toBe(1)
        expect(new Set(down.map((c) => c.x)).size).toBe(1)
        expect(new Set(left.map((c) => c.y)).size).toBe(1)
        expect(up[1].y).toBeLessThan(up[0].y)
        expect(right[1].x).toBeGreaterThan(right[0].x)
        expect(down[1].y).toBeGreaterThan(down[0].y)
        expect(left[1].x).toBeLessThan(left[0].x)
        expectEvenPitch(up.map((c) => c.y))
        expectEvenPitch(right.map((c) => c.x))
        expectEvenPitch(down.map((c) => c.y))
        expectEvenPitch(left.map((c) => c.x))
    })

    it('keeps every space on the map and never overlaps two', () => {
        for (const space of BORDER_TRACK_SPACES) {
            expect(contains(MAP_BOX, space.box), `border ${space.value}`).toBe(true)
        }
        expect(overlappingPairs(borderBoxes)).toEqual([])
    })

    it('shares a space as a 2×2 grid inside it', () => {
        for (const space of BORDER_TRACK_SPACES) {
            expect(space.sharingSlots).toHaveLength(4)
            for (const slot of space.sharingSlots) {
                expect(contains(space.box, slot)).toBe(true)
            }
            const named = space.sharingSlots.map((box, i) => ({ name: `${space.value}.${i}`, box }))
            expect(overlappingPairs(named)).toEqual([])
            expect(new Set(space.sharingSlots.map((slot) => slot.x)).size).toBe(2)
            expect(new Set(space.sharingSlots.map((slot) => slot.y)).size).toBe(2)
        }
    })
})

describe('sea slots: decks, bag and end tracker (R-1.3, O-8)', () => {
    it('sits on the map, clear of both tracks, with nothing overlapping', () => {
        for (const { name, box } of seaBoxes) {
            expect(contains(MAP_BOX, box), name).toBe(true)
        }
        expect(overlappingPairs([...seaBoxes, ...priceSlotBoxes, ...borderBoxes])).toEqual([])
    })
})
