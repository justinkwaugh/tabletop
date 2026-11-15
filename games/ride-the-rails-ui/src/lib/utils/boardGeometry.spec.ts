import { describe, expect, it } from 'vitest'
import type { BoundingBox } from '@tabletop/common'
import {
    hexIdAt,
    isUsaHex,
    USA_CITIES,
    USA_HEXES,
    usaCity,
    type CityId
} from '@tabletop/ride-the-rails'
import {
    BOARD_EXTENTS,
    BOARD_HEIGHT,
    BOARD_MARGIN,
    BOARD_WIDTH,
    cityLabel,
    cityLabelFontSize,
    drawsSeatInitials,
    FITTED_DESKTOP_SCALE,
    HEX_SIZE,
    HEX_WIDTH,
    hexCenter,
    hexCorners,
    hexGeometry,
    LARGEST_CITY_LABEL_FONT_SIZE,
    MAP_EXTENTS,
    MARGIN_BOXES,
    SERIF_ADVANCE_EM,
    stationOf
} from './boardGeometry.js'
import { trackSlots } from './trackLayout.js'
import {
    BONUS_PILL,
    CAPACITY_ONE,
    PASSENGER_SCALE,
    PAWN_EXTENT,
    passengerOffset
} from './cityMarks.js'
import {
    boxCorners,
    boxesOverlap,
    boxInside,
    centredBox,
    discBox,
    insideConvexPolygon
} from '$lib/testing/shapeChecks.js'

const PHONE_WIDTH = 375

const cityLabels = USA_CITIES.map((city) => ({ city, label: cityLabel(city.id) }))

describe('hex positions (components.md, Coordinates)', () => {
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

/** A city's bonus pill, capacity and passenger, in board units. */
function cityMarkBoxes(cityId: CityId): BoundingBox[] {
    const city = usaCity(cityId)
    const center = hexCenter(city.hexId)
    const passenger = passengerOffset(cityId)
    const boxes: BoundingBox[] = [
        {
            x: center.x + passenger.x + PAWN_EXTENT.left * PASSENGER_SCALE,
            y: center.y + passenger.y + PAWN_EXTENT.top * PASSENGER_SCALE,
            width: (PAWN_EXTENT.right - PAWN_EXTENT.left) * PASSENGER_SCALE,
            height: (PAWN_EXTENT.bottom - PAWN_EXTENT.top) * PASSENGER_SCALE
        }
    ]
    if (city.bonus) {
        boxes.push({
            x: center.x + BONUS_PILL.center.x - BONUS_PILL.width / 2,
            y: center.y + BONUS_PILL.center.y - BONUS_PILL.height / 2,
            width: BONUS_PILL.width,
            height: BONUS_PILL.height
        })
    }
    if (city.capacity === 1) {
        // The "1": its cap height above the baseline, and as wide as it is high.
        const size = CAPACITY_ONE.fontSize
        boxes.push({
            x: center.x + CAPACITY_ONE.x - size / 3,
            y: center.y + CAPACITY_ONE.y - size * 0.4,
            width: (size * 2) / 3,
            height: size * 0.75
        })
    }
    return boxes
}

describe('cities', () => {
    it('gives every city a station inside its hex', () => {
        for (const city of USA_CITIES) {
            const corners = hexCorners(city.hexId)
            for (const corner of boxCorners(discBox(stationOf(city.id)))) {
                expect(insideConvexPolygon(corner, corners)).toBe(true)
            }
        }
    })

    it('knows the serif’s width of every letter a city name uses', () => {
        const letters = new Set(USA_CITIES.flatMap((city) => [...city.name]))
        expect([...letters].filter((letter) => SERIF_ADVANCE_EM[letter] === undefined)).toEqual([])
    })

    it('gives every city a label anchor on the board', () => {
        for (const { label } of cityLabels) {
            expect(Number.isFinite(label.x) && Number.isFinite(label.y)).toBe(true)
            expect(boxInside(label.box, BOARD_EXTENTS)).toBe(true)
        }
    })

    it('keeps the fitted desktop scale’s label size the largest a label takes on the board', () => {
        for (const viewScale of [0.1, 0.2, FITTED_DESKTOP_SCALE, 0.6, 1]) {
            expect(cityLabelFontSize(viewScale)).toBeLessThanOrEqual(LARGEST_CITY_LABEL_FONT_SIZE)
        }
        expect(cityLabel(USA_CITIES[0].id).fontSize).toBe(LARGEST_CITY_LABEL_FONT_SIZE)
    })

    it('overlaps no two city labels at the fitted desktop scale', () => {
        const overlapping = cityLabels.flatMap(({ city, label }, index) =>
            cityLabels
                .slice(index + 1)
                .filter((other) => boxesOverlap(label.box, other.label.box))
                .map((other) => `${city.name} / ${other.city.name}`)
        )
        expect(overlapping).toEqual([])
    })

    it('covers no city mark, track slot or margin box with a label', () => {
        const obstacles = [
            ...Object.values(MARGIN_BOXES),
            ...USA_CITIES.flatMap((city) => [
                ...cityMarkBoxes(city.id),
                ...trackSlots(city.hexId).map(centredBox)
            ])
        ]
        const covering = cityLabels.filter(({ label }) =>
            obstacles.some((obstacle) => boxesOverlap(label.box, obstacle))
        )
        expect(covering.map(({ city }) => city.name)).toEqual([])
    })
})

describe('margin boxes', () => {
    const boxes = Object.entries(MARGIN_BOXES)

    it('lie inside the board', () => {
        for (const [, box] of boxes) expect(boxInside(box, BOARD_EXTENTS)).toBe(true)
    })

    it('cover no hex', () => {
        const covered = boxes.flatMap(([name, box]) =>
            USA_HEXES.filter((hex) => boxesOverlap(box, hexGeometry(hex.id).boundingBox)).map(
                (hex) => `${name}: ${hex.id}`
            )
        )
        expect(covered).toEqual([])
    })

    it('overlap no other margin box', () => {
        for (const [name, box] of boxes) {
            for (const [otherName, other] of boxes) {
                if (name !== otherName) expect(boxesOverlap(box, other)).toBe(false)
            }
        }
    })

    it('sit in the lower half of the board, the round and turn order tracks west, the railroads east', () => {
        for (const [, box] of boxes) expect(box.y + box.height).toBeGreaterThan(BOARD_HEIGHT / 2)
        expect(MARGIN_BOXES.roundTrack.x + MARGIN_BOXES.roundTrack.width).toBeLessThan(
            BOARD_WIDTH / 2
        )
        expect(MARGIN_BOXES.turnOrder.x + MARGIN_BOXES.turnOrder.width).toBeLessThan(
            BOARD_WIDTH / 2
        )
        expect(MARGIN_BOXES.railroadStrip.x).toBeGreaterThan(BOARD_WIDTH / 2)
        expect(MARGIN_BOXES.transcontinental.x).toBeGreaterThan(BOARD_WIDTH / 2)
    })
})

describe('seat initials', () => {
    it('are drawn at the fitted desktop scale', () => {
        expect(drawsSeatInitials(FITTED_DESKTOP_SCALE)).toBe(true)
    })

    it('are not drawn with the whole map fitted to a phone’s width', () => {
        expect(drawsSeatInitials(PHONE_WIDTH / BOARD_WIDTH)).toBe(false)
    })
})
