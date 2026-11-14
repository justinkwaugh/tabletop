import { describe, expect, it } from 'vitest'
import {
    hexCapacity,
    usaCity,
    USA_CITIES,
    USA_HEXES,
    type CityId,
    type HexId
} from '@tabletop/ride-the-rails'
import { hexCorners, stationOf } from './boardGeometry.js'
import { CUBE_ASPECT } from './cubeShape.js'
import { MOST_LOCOMOTIVES_IN_A_HEX, trackSlot, trackSlotLayout, trackSlots } from './trackLayout.js'
import {
    boxCorners,
    boxesOverlap,
    centredBox,
    discBox,
    insideConvexPolygon
} from '$lib/testing/shapeChecks.js'

function cityHex(cityId: CityId): HexId {
    return usaCity(cityId).hexId
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
            expect(() => trackSlot(hex.id, most - 1)).not.toThrow()
            expect(() => trackSlot(hex.id, most)).toThrow()
        }
    })
})

describe('track slot shapes', () => {
    it('keeps every slot inside its hex, clear of the other slots and of the station', () => {
        for (const hex of USA_HEXES) {
            const corners = hexCorners(hex.id)
            const boxes = trackSlots(hex.id).map(centredBox)
            for (const box of boxes) {
                for (const corner of boxCorners(box)) {
                    expect(insideConvexPolygon(corner, corners)).toBe(true)
                }
            }
            boxes.forEach((box, index) => {
                for (const other of boxes.slice(index + 1))
                    expect(boxesOverlap(box, other)).toBe(false)
            })
            if (hex.terrain === 'city') {
                const station = discBox(stationOf(hex.cityId))
                for (const box of boxes) expect(boxesOverlap(box, station)).toBe(false)
            }
        }
    })

    it('keeps the cube’s proportions in every slot', () => {
        for (const hex of USA_HEXES) {
            for (const slot of trackSlots(hex.id)) {
                expect(slot.width / slot.height).toBeCloseTo(CUBE_ASPECT, 6)
            }
        }
    })

    it('sizes the cubes by capacity: largest two to an open hex, one to an East Coast city, six small in Chicago', () => {
        const widths = (hexId: HexId | undefined) =>
            hexId ? trackSlots(hexId).map((slot) => slot.width) : []
        expect(widths(PLAIN_HEX?.id)).toEqual([28, 28])
        expect(widths(MOUNTAIN_HEX?.id)).toEqual([28, 28])
        expect(widths(cityHex('city.usa.denver'))).toEqual([20, 20])
        expect(widths(cityHex('city.usa.new-york'))).toEqual([21])
        expect(widths(cityHex('city.usa.chicago'))).toEqual([15, 15, 15, 15, 15, 15])
    })

    it('stands an open hex’s two cubes side by side and a city’s below its station', () => {
        const denver = cityHex('city.usa.denver')
        const station = stationOf('city.usa.denver')
        const [left, right] = trackSlots(denver)
        expect(left.y).toBe(right.y)
        expect(left.x).toBeLessThan(station.x)
        expect(right.x).toBeGreaterThan(station.x)
        expect(left.y - left.height / 2).toBeGreaterThanOrEqual(station.y + station.radius)
        const [only] = trackSlots(cityHex('city.usa.new-york'))
        expect(only.x).toBe(stationOf('city.usa.new-york').x)
    })
})
