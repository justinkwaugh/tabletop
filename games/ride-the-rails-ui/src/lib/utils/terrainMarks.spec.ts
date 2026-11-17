import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { MAP_IDS, boardMap, hexIdToAxial, type MapId } from '@tabletop/ride-the-rails'
import { boardGeometry, type BoardGeometry } from './boardGeometry.js'
import { capacityMarks } from './cityMarks.js'
import {
    ALPS_HATCH,
    alpsHatchPath,
    HEX_LIMIT_MARK,
    HOURGLASS,
    hexLimitMarks,
    impassableSides
} from './terrainMarks.js'
import { insideConvexPolygon, reachPastConvex } from '$lib/testing/shapeChecks.js'

function squareCorners(center: Point, side: number): Point[] {
    const half = side / 2
    return [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half }
    ]
}

function insideACell(
    geometry: BoardGeometry,
    hexId: Parameters<BoardGeometry['place']>[0],
    point: Point
) {
    return geometry.place(hexId).cells.some((cell) => insideConvexPolygon(point, cell.vertices))
}

function cityNamed(mapId: MapId, name: string) {
    const city = boardMap(mapId).cities.find((candidate) => candidate.name === name)
    if (!city) throw new Error(`No city ${name} on ${mapId}`)
    return city
}

describe('limit marks inside a hex (R-4.1.4, R-8)', () => {
    it('marks each hex other than a city that holds one locomotive, with a 1', () => {
        const marked = (mapId: MapId) =>
            hexLimitMarks(boardGeometry(mapId)).map((mark) => [mark.hexId, mark.text])
        const longDistance = boardMap('map.au').hexes.filter(
            (hex) => hex.terrain === 'long-distance'
        )
        expect(longDistance).toHaveLength(4)
        expect(marked('map.au')).toEqual(longDistance.map((hex) => [hex.id, '1']))
        const entries = boardMap('map.fr').hexes.filter((hex) =>
            boardMap('map.fr').groupsOf(hex.id).includes('paris-entry')
        )
        expect(entries).toHaveLength(6)
        expect(marked('map.fr')).toEqual(entries.map((hex) => [hex.id, '1']))
        for (const mapId of ['map.usa', 'map.ca', 'map.de'] as const) {
            expect(marked(mapId)).toEqual([])
        }
    })

    it('stands a hex’s mark at its top centre, wholly inside the hex (flat frame)', () => {
        for (const mapId of MAP_IDS) {
            const geometry = boardGeometry(mapId)
            for (const mark of hexLimitMarks(geometry)) {
                const center = geometry.place(mark.hexId).center
                expect(mark.x).toBeCloseTo(center.x)
                expect(mark.y).toBeLessThan(center.y)
                for (const corner of squareCorners(
                    mark,
                    HEX_LIMIT_MARK.side + HEX_LIMIT_MARK.strokeWidth
                )) {
                    expect(insideACell(geometry, mark.hexId, corner), mark.hexId).toBe(true)
                }
            }
        }
    })

    it('stands a no-limit city’s 6 in its hex where no side opens on water, in the sea where one does', () => {
        const markOf = (mapId: MapId, name: string) => {
            const city = cityNamed(mapId, name)
            const mark = capacityMarks(boardGeometry(mapId)).find(
                (found) => found.cityId === city.id
            )
            if (!mark) throw new Error(`No mark for ${name}`)
            return { mark, city }
        }
        expect(markOf('map.ca', 'Toronto').mark).toMatchObject({ text: '6', inHex: false })
        for (const [mapId, name] of [
            ['map.fr', 'Paris'],
            ['map.de', 'Berlin']
        ] as const) {
            const { mark, city } = markOf(mapId, name)
            expect(mark).toMatchObject({ text: '6', inHex: true })
            const geometry = boardGeometry(mapId)
            // Top left of the city's own cell.
            const [cell] = geometry.place(city.hexId).cells
            expect(mark.x).toBeLessThan(cell?.center.x ?? 0)
            expect(mark.y).toBeLessThan(cell?.center.y ?? 0)
            for (const corner of squareCorners(
                mark,
                HEX_LIMIT_MARK.side + HEX_LIMIT_MARK.strokeWidth
            )) {
                expect(insideACell(geometry, city.hexId, corner), name).toBe(true)
            }
        }
    })

    it('keeps every USA capacity mark in the sea, where it was', () => {
        expect(capacityMarks(boardGeometry('map.usa')).every((mark) => !mark.inHex)).toBe(true)
    })
})

/** Each `M x y L x y` segment of a path of straight lines. */
function segmentsOf(path: string): [Point, Point][] {
    return [...path.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [
        { x: Number(match[1]), y: Number(match[2]) },
        { x: Number(match[3]), y: Number(match[4]) }
    ])
}

describe('the Alps (R-8.2)', () => {
    const geometry = boardGeometry('map.au')
    const alps = geometry.map.hexes.filter((hex) => hex.terrain === 'alps')
    const segments = segmentsOf(alpsHatchPath(geometry))
    const alpsHexOf = (point: Point) =>
        alps.find((hex) =>
            geometry
                .place(hex.id)
                .cells.some((cell) => reachPastConvex(point, cell.vertices) <= 0.06)
        )

    it('hatches every Alps hex with the sea’s 45° lines, drawn lines and no pattern', () => {
        expect(alps).toHaveLength(14)
        for (const [from, to] of segments) {
            // Down and to the left at 45°, as the sea's hatch runs.
            expect(to.x - from.x).toBeCloseTo(-(to.y - from.y), 0)
        }
        for (const hex of alps) {
            const crossing = segments.filter(([from, to]) =>
                insideConvexPolygon(
                    { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
                    geometry.place(hex.id).cells[0]?.vertices ?? []
                )
            )
            expect(crossing.length, hex.id).toBeGreaterThanOrEqual(5)
        }
    })

    it('keeps the hatch inside the Alps: each line ends on an Alps hex’s edge', () => {
        for (const [from, to] of segments) {
            expect(alpsHexOf(from), `${from.x},${from.y}`).toBeDefined()
            expect(alpsHexOf(to), `${to.x},${to.y}`).toBeDefined()
        }
    })

    it('spaces the lines as the sea’s, a little heavier, on the sea’s own lattice', () => {
        expect(ALPS_HATCH.spacing).toBe(7)
        expect(ALPS_HATCH.width).toBeGreaterThan(1.5)
        for (const [from] of segments) {
            const offset = (from.x + from.y) / (ALPS_HATCH.spacing * Math.SQRT2)
            expect(Math.abs(offset - Math.round(offset))).toBeLessThan(0.02)
        }
    })

    it('draws nothing on a map with no Alps', () => {
        for (const mapId of ['map.usa', 'map.ca', 'map.fr', 'map.de'] as const) {
            expect(alpsHatchPath(boardGeometry(mapId))).toBe('')
        }
    })
})

describe('the long-distance hexes (R-8.2)', () => {
    it('stands the hourglass at the bottom of the hex, wholly inside it, below the 1', () => {
        const geometry = boardGeometry('map.au')
        const longDistance = geometry.map.hexes.filter((hex) => hex.terrain === 'long-distance')
        expect(longDistance).toHaveLength(4)
        for (const hex of longDistance) {
            const { center, cells } = geometry.place(hex.id)
            const corners = cells[0]?.vertices ?? []
            const { half, at } = HOURGLASS
            for (const corner of [
                { x: -half.x, y: -half.y },
                { x: half.x, y: -half.y },
                { x: half.x, y: half.y },
                { x: -half.x, y: half.y }
            ]) {
                const point = { x: center.x + at.x + corner.x, y: center.y + at.y + corner.y }
                expect(insideConvexPolygon(point, corners), hex.id).toBe(true)
            }
            const mark = hexLimitMarks(geometry).find((found) => found.hexId === hex.id)
            expect(mark?.y ?? Infinity).toBeLessThan(center.y + at.y - half.y)
        }
    })
})

describe('impassable sides (R-8.3, R-8.4)', () => {
    const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 0.5

    it('draws a channel on exactly the map’s impassable sides: Canada’s 18, France’s 7', () => {
        const counts = Object.fromEntries(
            MAP_IDS.map((mapId) => [mapId, impassableSides(boardGeometry(mapId)).length])
        )
        expect(counts).toEqual({
            'map.usa': 0,
            'map.au': 0,
            'map.ca': 18,
            'map.fr': 7,
            'map.de': 0
        })
        for (const mapId of ['map.ca', 'map.fr'] as const) {
            expect(impassableSides(boardGeometry(mapId)).map((side) => side.pair)).toEqual(
                boardMap(mapId).impassable
            )
        }
    })

    it('lays each channel along the side its two hexes share, a whole side long', () => {
        for (const mapId of ['map.ca', 'map.fr'] as const) {
            const geometry = boardGeometry(mapId)
            for (const { pair, from, to } of impassableSides(geometry)) {
                const [a, b] = pair
                const corners = (hexId: typeof a) =>
                    geometry.map.hasHex(hexId)
                        ? geometry.place(hexId).cells.flatMap((cell) => cell.vertices)
                        : geometry.cellAt(hexIdToAxial(geometry.orientation, hexId)).vertices
                for (const end of [from, to]) {
                    expect(
                        corners(a).some((corner) => near(corner, end)),
                        `${a} ${end.x}`
                    ).toBe(true)
                    expect(
                        corners(b).some((corner) => near(corner, end)),
                        `${b} ${end.x}`
                    ).toBe(true)
                }
                expect(Math.abs(Math.hypot(to.x - from.x, to.y - from.y) - 40)).toBeLessThan(0.1)
            }
        }
    })
})
