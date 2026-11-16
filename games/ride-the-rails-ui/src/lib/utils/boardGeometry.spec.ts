import { describe, expect, it } from 'vitest'
import { hexIdAt, isUsaHex, USA_CITIES, USA_HEXES } from '@tabletop/ride-the-rails'
import {
    BOARD_EXTENTS,
    BOARD_HEIGHT,
    BOARD_MARGIN,
    BOARD_WIDTH,
    HEX_SIZE,
    HEX_WIDTH,
    hexCenter,
    hexCorners,
    hexGeometry,
    MAP_EXTENTS,
    stationOf
} from './boardGeometry.js'
import { boxCorners, discBox, insideConvexPolygon } from '$lib/testing/shapeChecks.js'

describe('hex positions (rules-interpretations.md, Ids and coordinates)', () => {
    it('gives every hex of the map data a centre and six corners', () => {
        for (const hex of USA_HEXES) {
            const geometry = hexGeometry(hex.id)
            expect(geometry.vertices).toHaveLength(6)
            for (const corner of geometry.vertices) {
                expect(
                    Math.hypot(corner.x - geometry.center.x, corner.y - geometry.center.y)
                ).toBeCloseTo(HEX_SIZE, 0)
            }
        }
    })

    it('places a pointy hex at x = dcol × √3 s / 2 and y = row × 1.5 s from the first hex', () => {
        const [first] = USA_HEXES
        const origin = hexCenter(first.id)
        for (const hex of USA_HEXES) {
            const center = hexCenter(hex.id)
            expect(center.x - origin.x).toBeCloseTo(((hex.dcol - first.dcol) * HEX_WIDTH) / 2, 6)
            expect(center.y - origin.y).toBeCloseTo((hex.row - first.row) * 1.5 * HEX_SIZE, 6)
        }
    })

    it('names no hex the map data lacks', () => {
        for (let row = 0; row <= 20; row++) {
            for (let dcol = 0; dcol <= 67; dcol++) {
                const hexId = hexIdAt({ row, dcol })
                if (isUsaHex(hexId)) {
                    expect(() => hexGeometry(hexId)).not.toThrow()
                } else {
                    expect(() => hexGeometry(hexId)).toThrow()
                }
            }
        }
    })

    it('crops the board to the land, a margin of sea, 40 board units on every side', () => {
        expect(BOARD_MARGIN).toBe(40)
        expect(BOARD_WIDTH).toBeCloseTo(MAP_EXTENTS.width + 80, 6)
        expect(BOARD_HEIGHT).toBeCloseTo(MAP_EXTENTS.height + 80, 6)
    })

    it('gives the board the map data’s extents plus the fixed margin on every side', () => {
        const corners = USA_HEXES.flatMap((hex) => hexCorners(hex.id))
        const left = Math.min(...corners.map((corner) => corner.x))
        const top = Math.min(...corners.map((corner) => corner.y))
        const right = Math.max(...corners.map((corner) => corner.x))
        const bottom = Math.max(...corners.map((corner) => corner.y))
        expect(MAP_EXTENTS).toEqual({ x: left, y: top, width: right - left, height: bottom - top })
        expect(left).toBeCloseTo(BOARD_MARGIN, 6)
        expect(top).toBeCloseTo(BOARD_MARGIN, 6)
        expect(BOARD_WIDTH).toBeCloseTo(right + BOARD_MARGIN, 6)
        expect(BOARD_HEIGHT).toBeCloseTo(bottom + BOARD_MARGIN, 6)
        expect(BOARD_EXTENTS).toEqual({ x: 0, y: 0, width: BOARD_WIDTH, height: BOARD_HEIGHT })
    })
})

describe('cities', () => {
    it('gives every city a station inside its hex', () => {
        for (const city of USA_CITIES) {
            const corners = hexCorners(city.hexId)
            for (const corner of boxCorners(discBox(stationOf(city.id)))) {
                expect(insideConvexPolygon(corner, corners)).toBe(true)
            }
        }
    })
})
