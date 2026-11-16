import { describe, expect, it } from 'vitest'
import {
    hexCapacity,
    usaCity,
    USA_CITIES,
    USA_HEXES,
    type CityId,
    type HexId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import type { Point } from '@tabletop/common'
import { hexCenter, hexCorners } from './boardGeometry.js'
import { BONUS_PILL, MEEPLE, PASSENGER_SCALE, passengerOffset } from './cityMarks.js'
import { CUBE_CORNER_RATIO, CUBE_EDGE_WIDTH, CUBE_UNIT } from './cubeShape.js'
import {
    ghostCubes,
    MOST_LOCOMOTIVES_IN_A_HEX,
    SHARED_GHOST_SCALE,
    trackSlot,
    trackSlotLayout,
    trackSlots,
    type TrackSlot
} from './trackLayout.js'
import { boxesOverlap, centredBox } from '$lib/testing/shapeChecks.js'

function cityHex(cityId: CityId): HexId {
    return usaCity(cityId).hexId
}

/** The cube drawn in a slot, a rounded square, as the corners of its box in board units. */
function cubeCorners(slot: TrackSlot): Point[] {
    const half = slot.width / 2
    return [-1, 1].flatMap((sx) =>
        [-1, 1].map((sy) => ({ x: slot.x + sx * half, y: slot.y + sy * half }))
    )
}

/**
 * How far a slot's rounded square, its edge included, reaches past the hex's edge: the most, over
 * the hex's sides, of its distance outside each (negative inside).
 */
function reachPastHex(slot: TrackSlot, hexId: HexId): number {
    const center = hexCenter(hexId)
    const corners = hexCorners(hexId)
    const radius = slot.width * CUBE_CORNER_RATIO
    const half = slot.width / 2 - radius
    return Math.max(
        ...corners.map((from, index) => {
            const to = corners[(index + 1) % corners.length]
            const length = Math.hypot(to.x - from.x, to.y - from.y)
            let nx = (to.y - from.y) / length
            let ny = -(to.x - from.x) / length
            // Point the normal away from the hex's centre.
            if ((from.x - center.x) * nx + (from.y - center.y) * ny < 0) {
                nx = -nx
                ny = -ny
            }
            const middle = (slot.x - from.x) * nx + (slot.y - from.y) * ny
            return middle + half * (Math.abs(nx) + Math.abs(ny)) + radius + CUBE_EDGE_WIDTH / 2
        })
    )
}

const PLAIN_HEX = USA_HEXES.find((hex) => hex.terrain === 'plain')
const MOUNTAIN_HEX = USA_HEXES.find((hex) => hex.terrain === 'mountain')

describe('track slots by capacity (R-4.1.4)', () => {
    it('lays out a plain or mountain hex, a city, an East Coast city and Chicago apart', () => {
        expect(PLAIN_HEX && trackSlotLayout(PLAIN_HEX.id)).toBe('open-hex')
        expect(MOUNTAIN_HEX && trackSlotLayout(MOUNTAIN_HEX.id)).toBe('open-hex')
        expect(trackSlotLayout(cityHex('city.usa.denver'))).toBe('city')
        expect(trackSlotLayout(cityHex('city.usa.new-york'))).toBe('east-coast-city')
        expect(trackSlotLayout(cityHex('city.usa.chicago'))).toBe('chicago')
    })

    it('gives two slots to a hex that holds two, one to an East Coast city', () => {
        expect(PLAIN_HEX && trackSlots(PLAIN_HEX.id)).toHaveLength(2)
        expect(MOUNTAIN_HEX && trackSlots(MOUNTAIN_HEX.id)).toHaveLength(2)
        expect(trackSlots(cityHex('city.usa.denver'))).toHaveLength(2)
        for (const city of USA_CITIES.filter((city) => city.groups.includes('east-coast'))) {
            expect(trackSlots(city.hexId)).toHaveLength(1)
        }
    })

    it('gives Chicago, which has no limit, a slot for each of the six railroads (R-4.1.3)', () => {
        expect(MOST_LOCOMOTIVES_IN_A_HEX).toBe(6)
        expect(trackSlots(cityHex('city.usa.chicago'))).toHaveLength(MOST_LOCOMOTIVES_IN_A_HEX)
    })

    it('has a slot for every locomotive every hex may hold', () => {
        for (const hex of USA_HEXES) {
            const capacity = hexCapacity(hex.id)
            const most = capacity === 'unlimited' ? MOST_LOCOMOTIVES_IN_A_HEX : capacity
            expect(trackSlots(hex.id)).toHaveLength(most)
            expect(() => trackSlot(hex.id, most - 1, most)).not.toThrow()
            expect(() => trackSlot(hex.id, most, most)).toThrow()
        }
    })
})

describe('track slot shapes', () => {
    it('keeps every cube inside its hex, Chicago’s front corners all but', () => {
        for (const hex of USA_HEXES) {
            const reach = Math.max(...trackSlots(hex.id).map((slot) => reachPastHex(slot, hex.id)))
            // Six cubes in two rows: the front row's outer corners round off just over the edge.
            const room = trackSlotLayout(hex.id) === 'chicago' ? 2.1 : 0
            expect(reach, hex.id).toBeLessThanOrEqual(room)
        }
    })

    it('stands no two cubes in a row on each other; Chicago’s front row is drawn after its back', () => {
        for (const hex of USA_HEXES) {
            const slots = trackSlots(hex.id)
            slots.forEach((slot, index) => {
                for (const other of slots.slice(index + 1).filter((next) => next.y === slot.y)) {
                    expect(boxesOverlap(centredBox(slot), centredBox(other))).toBe(false)
                }
                for (const later of slots.slice(index + 1)) {
                    expect(later.y).toBeGreaterThanOrEqual(slot.y)
                }
            })
        }
    })

    it('keeps a city’s cubes clear of its bonus pill and its passenger', () => {
        const pill = {
            x: BONUS_PILL.center.x - BONUS_PILL.width / 2,
            y: BONUS_PILL.center.y - BONUS_PILL.height / 2,
            width: BONUS_PILL.width,
            height: BONUS_PILL.height
        }
        for (const city of USA_CITIES) {
            const center = hexCenter(city.hexId)
            const passenger = passengerOffset(city.id)
            // The meeple's head, the part a cube in front of it could hide.
            const head = {
                x: passenger.x + MEEPLE.head.cx * PASSENGER_SCALE,
                y: passenger.y + MEEPLE.head.cy * PASSENGER_SCALE,
                radius: MEEPLE.head.r * PASSENGER_SCALE
            }
            for (const slot of trackSlots(city.hexId)) {
                const local = { ...slot, x: slot.x - center.x, y: slot.y - center.y }
                expect(boxesOverlap(centredBox(local), pill), city.name).toBe(false)
                for (const corner of cubeCorners(local)) {
                    expect(Math.hypot(corner.x - head.x, corner.y - head.y)).toBeGreaterThan(
                        head.radius
                    )
                }
            }
        }
    })

    it('makes every slot square', () => {
        for (const hex of USA_HEXES) {
            for (const slot of trackSlots(hex.id)) expect(slot.width).toBe(slot.height)
        }
    })

    it('sizes every cube alike but Chicago’s six, which are smaller', () => {
        const widths = (hexId: HexId | undefined) =>
            hexId ? trackSlots(hexId).map((slot) => slot.width) : []
        expect(widths(PLAIN_HEX?.id)).toEqual([26, 26])
        expect(widths(MOUNTAIN_HEX?.id)).toEqual([26, 26])
        expect(widths(cityHex('city.usa.denver'))).toEqual([26, 26])
        expect(widths(cityHex('city.usa.new-york'))).toEqual([26])
        expect(widths(cityHex('city.usa.chicago'))).toEqual([16, 16, 16, 16, 16, 16])
    })

    it('places each slot from its hex’s centre', () => {
        const offsets = (hexId: HexId | undefined) => {
            if (!hexId) return []
            const center = hexCenter(hexId)
            return trackSlots(hexId).map((slot) => [
                Math.round((slot.x - center.x) * 10) / 10,
                Math.round((slot.y - center.y) * 10) / 10
            ])
        }
        expect(offsets(PLAIN_HEX?.id)).toEqual([
            [-16.8, 2],
            [16.8, 2]
        ])
        expect(offsets(cityHex('city.usa.denver'))).toEqual([
            [-16.8, 2],
            [16.8, 2]
        ])
        expect(offsets(cityHex('city.usa.new-york'))).toEqual([[0, 2]])
        expect(offsets(cityHex('city.usa.chicago'))).toEqual([
            [-19.6, -7.5],
            [0, -7.5],
            [19.6, -7.5],
            [-19.6, 9.5],
            [0, 9.5],
            [19.6, 9.5]
        ])
    })
})

describe('ghost cubes in a lit hex', () => {
    const plain = PLAIN_HEX?.id ?? 'hex.usa.0-0'
    const RED: RailroadId = 'railroad.red'
    const BLUE: RailroadId = 'railroad.blue'
    const BLACK: RailroadId = 'railroad.black'

    it('stands one railroad in the next free slot, full size', () => {
        // A lone railroad in an empty hex stands in the middle, where its cube would.
        expect(ghostCubes(plain, {}, [RED])).toEqual([
            { ...trackSlots(plain, 1)[0], railroadId: RED }
        ])
        expect(ghostCubes(plain, { [plain]: [BLACK] }, [RED])).toEqual([
            { ...trackSlots(plain)[1], railroadId: RED }
        ])
    })

    it('stands two railroads in the two free slots, in order', () => {
        expect(ghostCubes(plain, {}, [RED, BLUE])).toEqual([
            { ...trackSlots(plain)[0], railroadId: RED },
            { ...trackSlots(plain)[1], railroadId: BLUE }
        ])
        const chicago = cityHex('city.usa.chicago')
        expect(ghostCubes(chicago, { [chicago]: [BLACK, BLUE] }, [RED])).toEqual([
            { ...trackSlots(chicago)[2], railroadId: RED }
        ])
    })

    it('shares the one free slot when fewer are free than railroads, smaller and spread', () => {
        const slot = trackSlots(plain)[1]
        const [back, front] = ghostCubes(plain, { [plain]: [BLACK] }, [RED, BLUE])
        const scale = slot.width / CUBE_UNIT
        expect(back).toMatchObject({ railroadId: RED, width: slot.width * SHARED_GHOST_SCALE })
        expect(front).toMatchObject({ railroadId: BLUE, height: slot.height * SHARED_GHOST_SCALE })
        expect(back.x).toBeCloseTo(slot.x - 3.2 * scale, 6)
        expect(back.y).toBeCloseTo(slot.y - 1.4 * scale, 6)
        expect(front.x).toBeCloseTo(slot.x + 3.2 * scale, 6)
        expect(front.y).toBeCloseTo(slot.y + 1.4 * scale, 6)
        const newYork = cityHex('city.usa.new-york')
        expect(ghostCubes(newYork, {}, [RED, BLUE, BLACK]).map((ghost) => ghost.x)).toEqual([
            trackSlots(newYork)[0].x - 3.2 * (26 / CUBE_UNIT),
            trackSlots(newYork)[0].x,
            trackSlots(newYork)[0].x + 3.2 * (26 / CUBE_UNIT)
        ])
    })
})

describe('Chicago’s cubes as they arrive', () => {
    const chicago = cityHex('city.usa.chicago')
    const center = hexCenter(chicago)
    function shape(held: number): [number, number, number][] {
        return trackSlots(chicago, held).map((placed) => [
            Math.round((placed.x - center.x) * 10) / 10,
            Math.round((placed.y - center.y) * 10) / 10,
            placed.width
        ])
    }

    it('stands one full size in the middle, then two side by side like any city', () => {
        const city = trackSlots(cityHex('city.usa.denver'), 2).map((placed) => placed.width)
        expect(shape(1)).toHaveLength(1)
        expect(shape(1)[0]?.slice(0, 2)).toEqual([0, shape(2)[0]?.[1]])
        expect(shape(2).map(([, , width]) => width)).toEqual(city)
        expect(shape(2)[0]?.[0]).toBeLessThan(0)
        expect(shape(2)[1]?.[0]).toBeGreaterThan(0)
    })

    it('makes three smaller straight across, then lifts them for a fourth below in the middle', () => {
        const three = shape(3)
        expect(new Set(three.map(([, y]) => y)).size).toBe(1)
        expect(three[0]?.[2]).toBeLessThan(shape(2)[0]?.[2] ?? 0)
        const four = shape(4)
        expect(four.slice(0, 3).map(([x]) => x)).toEqual(three.map(([x]) => x))
        expect(four[3]?.[0]).toBe(0)
        expect(four[3]?.[1]).toBeGreaterThan(four[0]?.[1] ?? 0)
    })

    it('splits the bottom row for a fifth, then holds two rows of three', () => {
        const five = shape(5)
        expect(five.slice(3).map(([x]) => Math.sign(x))).toEqual([-1, 1])
        expect(five[3]?.[1]).toBe(five[4]?.[1])
        const six = shape(6)
        expect(six).toHaveLength(6)
        expect(new Set(six.map(([, y]) => y)).size).toBe(2)
    })
})
