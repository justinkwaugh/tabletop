import { describe, expect, it } from 'vitest'
import { HexOrientation, type Point } from '@tabletop/common'
import {
    boardMap,
    flatHexCoordinates,
    hexIdAt,
    isHexId,
    USA_CITIES,
    USA_HEXES
} from '@tabletop/ride-the-rails'
import { FLAT_FIXTURE_MAP, GAMMA, GAMMA_HEX } from '@tabletop/ride-the-rails/testing'
import {
    BOARD_MARGIN,
    boardGeometry,
    DESKTOP_BOARD_VIEW,
    geometryOf,
    HEX_SIZE,
    HEX_WIDTH,
    hexBox,
    hexCells,
    hexCenter,
    hexOutline,
    stationOf,
    type BoardGeometry
} from './boardGeometry.js'
import { boxCorners, discBox, insideConvexPolygon } from '$lib/testing/shapeChecks.js'

const USA = boardGeometry('map.usa')
const FLAT = geometryOf(FLAT_FIXTURE_MAP)

function cornersOf(geometry: BoardGeometry): Point[] {
    return geometry.hexIds.flatMap((hexId) =>
        geometry.place(hexId).cells.flatMap((cell) => cell.vertices)
    )
}

function boundsOf(points: readonly Point[]) {
    const left = Math.min(...points.map((point) => point.x))
    const top = Math.min(...points.map((point) => point.y))
    const right = Math.max(...points.map((point) => point.x))
    const bottom = Math.max(...points.map((point) => point.y))
    return { left, top, right, bottom }
}

function distance(a: Point, b: Point): number {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

describe('hex positions (rules-interpretations.md, Ids and coordinates)', () => {
    it('gives every hex of the map data one cell with a centre and six corners', () => {
        for (const hex of USA_HEXES) {
            const cells = hexCells(hex.id)
            expect(cells).toHaveLength(1)
            const [cell] = cells
            expect(cell.center).toEqual(hexCenter(hex.id))
            expect(cell.vertices).toHaveLength(6)
            for (const corner of cell.vertices) {
                expect(distance(corner, cell.center)).toBeCloseTo(HEX_SIZE, 0)
            }
            expect(hexOutline(hex.id)).toEqual(cell.vertices)
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

    it('stands the USA’s hexes on a corner: a pointy top, as wide as its flats', () => {
        expect(USA.orientation).toBe(HexOrientation.Pointy)
        const [hex] = USA_HEXES
        const center = hexCenter(hex.id)
        const [cell] = hexCells(hex.id)
        const top = Math.min(...cell.vertices.map((corner) => corner.y))
        expect(cell.vertices.filter((corner) => corner.y === top)).toHaveLength(1)
        expect(hexBox(hex.id)).toEqual({
            x: center.x - HEX_WIDTH / 2,
            y: center.y - HEX_SIZE,
            width: HEX_WIDTH,
            height: HEX_SIZE * 2
        })
    })

    it('names no hex the map data lacks', () => {
        for (let row = 0; row <= 20; row++) {
            for (let dcol = 0; dcol <= 67; dcol++) {
                const hexId = hexIdAt({ row, dcol })
                if (isHexId(hexId)) {
                    expect(() => hexCells(hexId)).not.toThrow()
                } else {
                    expect(() => hexCells(hexId)).toThrow()
                }
            }
        }
    })

    it('reads the hexes in the map’s own order', () => {
        expect(USA.hexIds).toEqual(boardMap('map.usa').hexes.map((hex) => hex.id))
        expect(FLAT.hexIds).toEqual(FLAT_FIXTURE_MAP.hexes.map((hex) => hex.id))
    })
})

describe('the board’s extents', () => {
    it('crops the board to the land, a margin of sea, 40 board units on every side', () => {
        expect(BOARD_MARGIN).toBe(40)
        expect(USA.width).toBeCloseTo(USA.mapExtents.width + 80, 6)
        expect(USA.height).toBeCloseTo(USA.mapExtents.height + 80, 6)
    })

    for (const [name, geometry] of [
        ['USA', USA],
        ['flat fixture', FLAT]
    ] as const) {
        it(`gives the ${name} board the map data’s extents plus the fixed margin on every side`, () => {
            const { left, top, right, bottom } = boundsOf(cornersOf(geometry))
            expect(geometry.mapExtents).toEqual({
                x: left,
                y: top,
                width: right - left,
                height: bottom - top
            })
            expect(left).toBeCloseTo(BOARD_MARGIN, 6)
            expect(top).toBeCloseTo(BOARD_MARGIN, 6)
            expect(geometry.width).toBeCloseTo(right + BOARD_MARGIN, 6)
            expect(geometry.height).toBeCloseTo(bottom + BOARD_MARGIN, 6)
            expect(geometry.extents).toEqual({
                x: 0,
                y: 0,
                width: geometry.width,
                height: geometry.height
            })
        })

        it(`fits the ${name} board to a desktop window, never past full size`, () => {
            expect(geometry.fittedDesktopScale).toBe(
                Math.min(
                    DESKTOP_BOARD_VIEW.width / geometry.width,
                    DESKTOP_BOARD_VIEW.height / geometry.height,
                    1
                )
            )
        })
    }

    it('builds each map’s board once', () => {
        expect(boardGeometry('map.usa')).toBe(USA)
        expect(USA.mapId).toBe('map.usa')
    })
})

describe('a flat map', () => {
    const oneCellHexes = FLAT.hexIds.filter((hexId) => FLAT.place(hexId).cells.length === 1)

    it('stands its hexes on a side: a flat top, as tall as its flats', () => {
        expect(FLAT.orientation).toBe(HexOrientation.Flat)
        for (const hexId of oneCellHexes) {
            const { cells, center, box } = FLAT.place(hexId)
            const [cell] = cells
            expect(cell.vertices).toHaveLength(6)
            for (const corner of cell.vertices) {
                expect(distance(corner, center)).toBeCloseTo(HEX_SIZE, 0)
            }
            const top = Math.min(...cell.vertices.map((corner) => corner.y))
            expect(cell.vertices.filter((corner) => corner.y === top)).toHaveLength(2)
            expect(box).toEqual({
                x: center.x - HEX_SIZE,
                y: center.y - HEX_WIDTH / 2,
                width: HEX_SIZE * 2,
                height: HEX_WIDTH
            })
        }
    })

    it('places a flat hex at x = col × 1.5 s and y = drow × √3 s / 2 from the first hex', () => {
        const [first] = FLAT.hexIds
        const from = flatHexCoordinates(first)
        const origin = FLAT.place(first).center
        for (const hexId of oneCellHexes) {
            const { col, drow } = flatHexCoordinates(hexId)
            const center = FLAT.place(hexId).center
            expect(center.x - origin.x).toBeCloseTo((col - from.col) * 1.5 * HEX_SIZE, 6)
            expect(center.y - origin.y).toBeCloseTo(((drow - from.drow) * HEX_WIDTH) / 2, 6)
        }
    })

    it('draws neighbours side by side: centres a flat’s width apart', () => {
        for (const hexId of oneCellHexes) {
            for (const other of FLAT_FIXTURE_MAP.adjacentHexIds(hexId)) {
                if (FLAT.place(other).cells.length !== 1) continue
                expect(distance(FLAT.place(hexId).center, FLAT.place(other).center)).toBeCloseTo(
                    HEX_WIDTH,
                    6
                )
            }
        }
    })
})

describe('a hex printed over two cells', () => {
    const gamma = FLAT.place(GAMMA_HEX)

    it('covers each of its cells, its id’s cell first', () => {
        expect(gamma.cells).toHaveLength(2)
        const [own, extra] = gamma.cells
        const { col, drow } = flatHexCoordinates(GAMMA_HEX)
        const first = FLAT.place(FLAT.hexIds[0])
        const from = flatHexCoordinates(FLAT.hexIds[0])
        expect(own.center.x - first.center.x).toBeCloseTo((col - from.col) * 1.5 * HEX_SIZE, 6)
        expect(own.center.y - first.center.y).toBeCloseTo(((drow - from.drow) * HEX_WIDTH) / 2, 6)
        // The cell below it, one flat's width further south.
        expect(extra.center.x).toBeCloseTo(own.center.x, 6)
        expect(extra.center.y - own.center.y).toBeCloseTo(HEX_WIDTH, 6)
    })

    it('is centred on the mean of its cells, and boxed round both', () => {
        const [own, extra] = gamma.cells
        expect(gamma.center.x).toBeCloseTo((own.center.x + extra.center.x) / 2, 6)
        expect(gamma.center.y).toBeCloseTo((own.center.y + extra.center.y) / 2, 6)
        expect(gamma.box.x).toBeCloseTo(own.center.x - HEX_SIZE, 6)
        expect(gamma.box.y).toBeCloseTo(own.center.y - HEX_WIDTH / 2, 6)
        expect(gamma.box.width).toBeCloseTo(HEX_SIZE * 2, 6)
        expect(gamma.box.height).toBeCloseTo(HEX_WIDTH * 2, 6)
    })

    it('is outlined as one shape round both cells, without the side they share', () => {
        const [own, extra] = gamma.cells
        const key = (point: Point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`
        const outline = gamma.outline.map(key)
        const corners = new Set([...own.vertices, ...extra.vertices].map(key))
        // Twelve corners, two of them shared.
        expect(corners.size).toBe(10)
        expect(outline).toHaveLength(10)
        expect(new Set(outline)).toEqual(corners)
    })

    it('gives the city one station, at the hex’s centre', () => {
        expect(FLAT.station(GAMMA)).toEqual({ ...gamma.center, radius: 10 })
    })
})

describe('cities', () => {
    it('gives every city a station inside its hex', () => {
        for (const city of USA_CITIES) {
            const corners = hexOutline(city.hexId)
            for (const corner of boxCorners(discBox(stationOf(city.id)))) {
                expect(insideConvexPolygon(corner, corners)).toBe(true)
            }
        }
    })
})
