import { describe, expect, it } from 'vitest'
import type { BoundingBox } from '@tabletop/common'
import { BOARD_GRID, type SpaceId } from '@tabletop/promontory-point'
import {
    BOARD_BOUNDS,
    HEX,
    PRICE_TRACK_SPACES,
    SPACE_CENTRES,
    STRIP_SLOTS
} from '$lib/utils/boardGeometry.js'
import {
    BOARD_DRAWN_SCALE,
    FramingCommand,
    HEX_FIELD_RECT,
    PickFraming,
    hexFieldScale,
    litFrameRect,
    litKey,
    pickFrameMaxScale
} from './boardFraming.js'

// The drawn surface starts at the strip's left edge, so a map point sits right of it.
const drawn = (box: BoundingBox): BoundingBox => ({
    x: (box.x - BOARD_BOUNDS.x) * BOARD_DRAWN_SCALE,
    y: (box.y - BOARD_BOUNDS.y) * BOARD_DRAWN_SCALE,
    width: box.width * BOARD_DRAWN_SCALE,
    height: box.height * BOARD_DRAWN_SCALE
})

function overlaps(a: BoundingBox, b: BoundingBox): boolean {
    return (
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
    )
}

function centreInside(spaceId: SpaceId, box: BoundingBox): boolean {
    const centre = SPACE_CENTRES.get(spaceId)
    if (centre === undefined) return false
    const x = (centre.x - BOARD_BOUNDS.x) * BOARD_DRAWN_SCALE
    const y = (centre.y - BOARD_BOUNDS.y) * BOARD_DRAWN_SCALE
    return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height
}

// The phone's 390 × 844 column leaves the board about 351 × 430 pixels.
const PHONE_BOARD = { width: 351, height: 430 }

describe('phone board framing (contract, "Phone layout")', () => {
    it("R-1.1, R-1.1-H3: the hex field holds every space and leaves the strip and the price track's run out", () => {
        for (const space of BOARD_GRID.spaces()) {
            expect(centreInside(space.spaceId, HEX_FIELD_RECT), space.spaceId).toBe(true)
        }
        for (const slot of [STRIP_SLOTS.bag, STRIP_SLOTS.shares, STRIP_SLOTS.endTracker]) {
            expect(overlaps(HEX_FIELD_RECT, drawn(slot))).toBe(false)
            expect(drawn(slot).x + drawn(slot).width).toBeLessThan(HEX_FIELD_RECT.x)
        }
        // The track's last spaces turn along the coast under the field's corner; the run is clear.
        for (const space of PRICE_TRACK_SPACES.filter((track) => track.priceIndex >= 7)) {
            for (const slot of Object.values(space.slots)) {
                expect(overlaps(HEX_FIELD_RECT, drawn(slot))).toBe(false)
            }
        }
    })

    it('rests the hex field fitted to the phone board width, about 30 px a hex', () => {
        const scale = hexFieldScale(PHONE_BOARD)
        expect(scale).toBeCloseTo(PHONE_BOARD.width / HEX_FIELD_RECT.width)
        const hexWidth = HEX.xRadius * 2 * BOARD_DRAWN_SCALE * scale
        expect(hexWidth).toBeGreaterThan(24)
        expect(hexWidth).toBeLessThan(34)
    })

    it('R-3.3: frames the lit hexes edge to edge, at up to twice the resting scale', () => {
        const lit = BOARD_GRID.spaces()
            .slice(0, 3)
            .map((space) => space.spaceId)
        const rect = litFrameRect(lit)
        expect(rect).toBeDefined()
        for (const spaceId of lit) {
            expect(centreInside(spaceId, rect ?? HEX_FIELD_RECT)).toBe(true)
        }
        expect(pickFrameMaxScale(PHONE_BOARD)).toBeCloseTo(2 * hexFieldScale(PHONE_BOARD))

        const one = litFrameRect([lit[0] ?? 'space.0.0'])
        expect(one?.width).toBeCloseTo(HEX.xRadius * 2 * BOARD_DRAWN_SCALE)
        expect(one?.height).toBeCloseTo(HEX.yRadius * 2 * BOARD_DRAWN_SCALE)
    })

    it('frames nothing when no hex is lit; one key per lit set, in any order', () => {
        expect(litFrameRect([])).toBeUndefined()
        const a: SpaceId = 'space.0.0'
        const b: SpaceId = 'space.1.0'
        expect(litKey([a, b])).toBe(litKey([b, a]))
        expect(litKey([a])).not.toBe(litKey([a, b]))
    })

    it('the board rests on the hex field once; a pick frames once and returns when it ends', () => {
        const framing = new PickFraming()
        const a: SpaceId[] = ['space.0.0', 'space.1.0']
        const b: SpaceId[] = ['space.2.0']
        expect(framing.litChanged([])).toBe(FramingCommand.Rest)
        expect(framing.litChanged([])).toBe(FramingCommand.None)
        expect(framing.litChanged(a)).toBe(FramingCommand.Frame)
        expect(framing.litChanged([...a].reverse())).toBe(FramingCommand.None)
        expect(framing.litChanged(b)).toBe(FramingCommand.Frame)
        expect(framing.litChanged([])).toBe(FramingCommand.Rest)
    })

    it('a hand pan clears the framing: the pick is not framed again and its end leaves the view', () => {
        const framing = new PickFraming()
        const a: SpaceId[] = ['space.0.0', 'space.1.0']
        framing.litChanged([])
        expect(framing.litChanged(a)).toBe(FramingCommand.Frame)
        framing.handMove(a)
        expect(framing.litChanged(a)).toBe(FramingCommand.None)
        expect(framing.litChanged([])).toBe(FramingCommand.None)
        // The next pick frames again, and its end returns to the hex field.
        expect(framing.litChanged(a)).toBe(FramingCommand.Frame)
        expect(framing.litChanged([])).toBe(FramingCommand.Rest)
    })
})
