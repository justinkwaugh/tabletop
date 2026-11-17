import { describe, expect, it } from 'vitest'
import type { Point } from '@tabletop/common'
import { MAP_IDS, boardMap, hexIdToAxial, type MapId } from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { boardGeometry, HEX_WIDTH, type BoardGeometry } from './boardGeometry.js'
import {
    BONUS_PILL,
    bonusPill,
    CAPACITY_MARK,
    capacityMarks,
    MEEPLE,
    MEEPLE_EXTENT,
    PASSENGER_SCALE,
    START_BAND_WIDTH,
    startBandSpans
} from './cityMarks.js'
import { passengerSpot } from './passengerLayout.js'
import { insetCellPoints } from './pickMarks.js'
import { trackSlots } from './trackLayout.js'
import { cityPieces } from './boardPieces.js'
import { CUBE_EDGE_WIDTH } from './cubeShape.js'
import { legendBox, MAP_LAYOUTS, titleBox } from './mapLayouts.js'
import {
    ALPS_HATCH,
    alpsHatchPath,
    bonusPillSpot,
    BUFFER_STOP,
    bufferStopSpots,
    outlineBandPaths,
    HEX_LIMIT_MARK,
    entryRingSides,
    hexLimitMarks,
    impassableSides
} from './terrainMarks.js'
import {
    boxCorners,
    boxesOverlap,
    boxInside,
    centredBox,
    insideConvexPolygon,
    reachPastConvex
} from '$lib/testing/shapeChecks.js'
import { contrastRatio } from '$lib/testing/colourMetrics.js'
import { paletteNames, tokenValue } from '$lib/testing/paletteSource.js'

// The ground layer's source, to read how it draws the long-distance mark.
const GROUND_LAYER =
    import.meta.glob<string>('../components/board/GroundLayer.svelte', {
        query: '?raw',
        import: 'default',
        eager: true
    })['../components/board/GroundLayer.svelte'] ?? ''

type Reach = { left: number; top: number; right: number; bottom: number }

/** The reach of a path drawn with absolute M, H and V commands only, before its stroke. */
function pathReach(path: string): Reach {
    const xs: number[] = []
    const ys: number[] = []
    for (const [, command, args] of path.matchAll(/([MHV])([^MHV]+)/g)) {
        const numbers = (args ?? '')
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        if (command === 'M') {
            xs.push(numbers[0] ?? NaN)
            ys.push(numbers[1] ?? NaN)
        } else if (command === 'H') xs.push(...numbers)
        else ys.push(...numbers)
    }
    return {
        left: Math.min(...xs),
        top: Math.min(...ys),
        right: Math.max(...xs),
        bottom: Math.max(...ys)
    }
}

function grow(reach: Reach, by: number): Reach {
    return {
        left: reach.left - by,
        top: reach.top - by,
        right: reach.right + by,
        bottom: reach.bottom + by
    }
}

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

    it('keeps every USA capacity mark in the sea where it was, Chicago’s 6 further out', () => {
        const marks = capacityMarks(boardGeometry('map.usa'))
        expect(marks.every((mark) => !mark.inHex)).toBe(true)
        const tenth = (value: number) => Math.round(value * 10) / 10
        expect(marks.map((mark) => [mark.cityId, tenth(mark.x), tenth(mark.y)])).toEqual([
            // Out past the passenger's head, which stands in the hex above Chicago's cubes.
            ['city.usa.chicago', 1493.6, 322.3],
            ['city.usa.new-york', 2099.8, 440],
            ['city.usa.philadelphia', 1995.9, 500],
            ['city.usa.baltimore', 1926.6, 620],
            ['city.usa.washington', 1926.6, 740],
            ['city.usa.charleston', 1822.7, 800],
            ['city.usa.jacksonville', 1753.4, 920]
        ])
    })
})

describe('limit marks in the sea beside a hex that opens on water (R-4.1.4, R-8)', () => {
    const marksOf = (mapId: MapId) =>
        capacityMarks(boardGeometry(mapId), MAP_LAYOUTS[mapId].limitMarksInHex)
    const hexIdsOf = (mapId: MapId, inHex: boolean) =>
        marksOf(mapId)
            .filter((mark) => mark.inHex === inHex)
            .map((mark) => mark.hexId)
    const cityHexes = (mapId: MapId, names: string[]) =>
        names.map((name) => cityNamed(mapId, name).hexId)

    it('moves each marked hex with a side on open water into the sea: Australia’s four long-distance hexes', () => {
        expect(hexIdsOf('map.au', false)).toEqual([
            ...cityHexes('map.au', ['Brisbane', 'Perth']),
            'hex.au.34-8',
            'hex.au.2-12',
            'hex.au.1-13',
            'hex.au.3-13'
        ])
        expect(hexIdsOf('map.au', true)).toEqual([])
        expect(hexIdsOf('map.ca', false)).toEqual(cityHexes('map.ca', ['Toronto']))
        expect(hexIdsOf('map.ca', true)).toEqual([])
    })

    it('keeps in the hex every mark with no side on open water, and the layout’s border cities', () => {
        const entries = boardMap('map.fr')
            .hexes.filter((hex) => boardMap('map.fr').groupsOf(hex.id).includes('paris-entry'))
            .map((hex) => hex.id)
        expect(hexIdsOf('map.fr', false)).toEqual([])
        expect(hexIdsOf('map.fr', true)).toEqual([
            ...cityHexes('map.fr', ['Lille', 'Valenciennes', 'Sedan', 'Metz', 'Paris']),
            ...entries
        ])
        expect(hexIdsOf('map.de', false)).toEqual([])
        expect(hexIdsOf('map.de', true)).toEqual(cityHexes('map.de', ['Berlin']))
        expect(hexIdsOf('map.usa', true)).toEqual([])
    })

    it('stands every sea mark on the board, over no land and clear of the other marks, title and legend', () => {
        for (const mapId of MAP_IDS) {
            const geometry = boardGeometry(mapId)
            const cells = geometry.hexIds.flatMap((hexId) => geometry.place(hexId).cells)
            const sea = marksOf(mapId).filter((mark) => !mark.inHex)
            const boxOf = (mark: Point) =>
                centredBox({ ...mark, width: CAPACITY_MARK.side, height: CAPACITY_MARK.side })
            for (const mark of sea) {
                const box = boxOf(mark)
                const label = `${mapId} ${mark.hexId}`
                expect(boxInside(box, geometry.extents), label).toBe(true)
                for (const cell of cells) {
                    for (const corner of squareCorners(mark, CAPACITY_MARK.side)) {
                        expect(reachPastConvex(corner, cell.vertices), label).toBeGreaterThan(0)
                    }
                    for (const vertex of cell.vertices) {
                        expect(boxInside({ ...vertex, width: 0, height: 0 }, box), label).toBe(
                            false
                        )
                    }
                }
                expect(boxesOverlap(box, titleBox(MAP_LAYOUTS[mapId])), label).toBe(false)
                expect(boxesOverlap(box, legendBox(mapId)), label).toBe(false)
                for (const other of sea.filter((found) => found !== mark)) {
                    const apart = Math.max(Math.abs(other.x - mark.x), Math.abs(other.y - mark.y))
                    expect(apart, `${label} ${other.hexId}`).toBeGreaterThanOrEqual(
                        CAPACITY_MARK.side + CAPACITY_MARK.gap
                    )
                }
            }
        }
    })

    it('keeps every limit mark, in the sea or in a hex, clear of every waiting passenger', () => {
        // The meeple as its head, a disc, over a box from the head's middle down, arms out.
        for (const mapId of MAP_IDS) {
            const marks = marksOf(mapId)
            for (const city of boardMap(mapId).cities) {
                const spot = passengerSpot(city.id, false)
                const head = {
                    x: spot.x,
                    y: spot.y + MEEPLE.head.cy * PASSENGER_SCALE,
                    r: (MEEPLE.head.r + MEEPLE.edgeWidth / 2) * PASSENGER_SCALE
                }
                const body = {
                    x: spot.x + MEEPLE_EXTENT.left * PASSENGER_SCALE,
                    y: head.y,
                    width: (MEEPLE_EXTENT.right - MEEPLE_EXTENT.left) * PASSENGER_SCALE,
                    height: (MEEPLE_EXTENT.bottom - MEEPLE.head.cy) * PASSENGER_SCALE
                }
                for (const mark of marks) {
                    const box = centredBox({
                        ...mark,
                        width: CAPACITY_MARK.side,
                        height: CAPACITY_MARK.side
                    })
                    const nearest = {
                        x: Math.min(Math.max(head.x, box.x), box.x + box.width),
                        y: Math.min(Math.max(head.y, box.y), box.y + box.height)
                    }
                    const label = `${city.id} and the "${mark.text}" of ${mark.hexId}`
                    expect(
                        Math.hypot(nearest.x - head.x, nearest.y - head.y),
                        label
                    ).toBeGreaterThan(head.r)
                    expect(boxesOverlap(body, box), label).toBe(false)
                }
            }
        }
    })

    it('stands a mark past the first open side in the frame’s order clear of the marks before it', () => {
        const geometry = boardGeometry('map.au')
        // The side, in degrees from east, past which each long-distance hex's 1 stands: the
        // north-east, but Perth's neighbour, whose north is beside Perth's own 1, its south-west.
        const sides: Record<string, number> = {
            'hex.au.34-8': -30,
            'hex.au.2-12': -30,
            'hex.au.1-13': 150,
            'hex.au.3-13': -30
        }
        const marks = marksOf('map.au').filter((found) => found.hexId in sides)
        expect(marks).toHaveLength(4)
        for (const mark of marks) {
            const center = geometry.place(mark.hexId).center
            const degrees = (Math.atan2(mark.y - center.y, mark.x - center.x) * 180) / Math.PI
            expect(degrees, mark.hexId).toBeCloseTo(sides[mark.hexId] ?? NaN)
            expect(Math.hypot(mark.x - center.x, mark.y - center.y), mark.hexId).toBeCloseTo(
                HEX_WIDTH / 2 + CAPACITY_MARK.gap + CAPACITY_MARK.side / 2
            )
            expect(mark.text).toBe('1')
        }
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
    const geometry = boardGeometry('map.au')
    const { box } = BUFFER_STOP
    const bufferStopBox = (spot: Point) => ({ ...box, x: spot.x + box.x, y: spot.y + box.y })
    const seaOnes = capacityMarks(geometry, MAP_LAYOUTS['map.au'].limitMarksInHex).map((mark) =>
        centredBox({ ...mark, width: CAPACITY_MARK.side, height: CAPACITY_MARK.side })
    )
    /** Every waiting passenger's head on the map, a head reaching into the hex above included. */
    const heads = boardMap('map.au').cities.map((city) => {
        const passenger = passengerSpot(city.id, false)
        const head = centredBox({
            x: passenger.x,
            y: passenger.y + MEEPLE.head.cy * PASSENGER_SCALE,
            width: (MEEPLE.head.r * 2 + MEEPLE.edgeWidth) * PASSENGER_SCALE,
            height: (MEEPLE.head.r * 2 + MEEPLE.edgeWidth) * PASSENGER_SCALE
        })
        return { cityId: city.id, head }
    })

    it('stands a buffer stop, the turn ending there, in each long-distance hex and in Perth and Brisbane, and on no other map', () => {
        const longDistance = geometry.map.hexes.filter((hex) => hex.terrain === 'long-distance')
        expect(longDistance).toHaveLength(4)
        const cities = boardMap('map.au').longDistanceCities.map(
            (cityId) => boardMap('map.au').city(cityId).hexId
        )
        expect(cities).toEqual(['hex.au.0-12', 'hex.au.34-6'])
        expect(bufferStopSpots(geometry).map((spot) => spot.hexId)).toEqual(
            geometry.map.hexes
                .filter((hex) => hex.terrain === 'long-distance' || cities.includes(hex.id))
                .map((hex) => hex.id)
        )
        for (const mapId of MAP_IDS.filter((id) => id !== 'map.au')) {
            expect(bufferStopSpots(boardGeometry(mapId)), mapId).toEqual([])
        }
    })

    it('draws two rails, two ties across them and a stop bar over their top ends, its box their reach with every stroke', () => {
        const { rails, railWidth, ties, tieWidth, bar, barEdgeWidth } = BUFFER_STOP
        expect(rails.match(/M/g)).toHaveLength(2)
        expect(pathReach(rails)).toEqual({ left: -3, top: -3, right: 3, bottom: 7 })
        expect(ties.match(/M/g)).toHaveLength(2)
        expect(pathReach(ties)).toEqual({ left: -5, top: 1.5, right: 5, bottom: 5 })
        // The rails run up into the bar, which covers their top ends and is wider than the ties.
        expect(bar.y).toBeLessThan(-3)
        expect(bar.y + bar.height).toBeGreaterThanOrEqual(-3)
        expect(bar.x).toBeLessThan(-5)
        expect(bar.x + bar.width).toBeGreaterThan(5)
        expect(railWidth).toBeGreaterThan(tieWidth)
        const parts = [
            grow(pathReach(rails), railWidth / 2),
            grow(pathReach(ties), tieWidth / 2),
            grow(
                { left: bar.x, top: bar.y, right: bar.x + bar.width, bottom: bar.y + bar.height },
                barEdgeWidth / 2
            )
        ]
        expect(box.x).toBeCloseTo(Math.min(...parts.map((part) => part.left)), 9)
        expect(box.y).toBeCloseTo(Math.min(...parts.map((part) => part.top)), 9)
        expect(box.x + box.width).toBeCloseTo(Math.max(...parts.map((part) => part.right)), 9)
        expect(box.y + box.height).toBeCloseTo(Math.max(...parts.map((part) => part.bottom)), 9)
    })

    it('stands the buffer stop at the bottom of the hex, wholly inside it, clear of the 1s in the sea and of every passenger’s head', () => {
        const longDistance = geometry.map.hexes.filter((hex) => hex.terrain === 'long-distance')
        for (const hex of longDistance) {
            const { center, cells } = geometry.place(hex.id)
            const corners = cells[0]?.vertices ?? []
            const spot = bufferStopSpots(geometry).find((found) => found.hexId === hex.id)
            expect(spot, hex.id).toEqual({ hexId: hex.id, x: center.x, y: center.y + 24 })
            if (!spot) continue
            const stop = bufferStopBox(spot)
            for (const corner of boxCorners(stop)) {
                expect(insideConvexPolygon(corner, corners), hex.id).toBe(true)
            }
            // Below where an in-hex 1 would stand, were its 1 not in the sea.
            const mark = hexLimitMarks(geometry).find((found) => found.hexId === hex.id)
            expect(mark?.y ?? Infinity).toBeLessThan(stop.y)
            for (const one of seaOnes) {
                expect(boxesOverlap(stop, one), `${hex.id} and a 1`).toBe(false)
            }
            for (const { cityId, head } of heads) {
                expect(boxesOverlap(stop, head), `${hex.id} and ${cityId}'s head`).toBe(false)
            }
        }
    })

    it('stands Perth’s and Brisbane’s buffer stop at the top of the city, wholly inside it, clear of its pill, its cube, the 1s in the sea and any passenger’s head', () => {
        const pieces = cityPieces(buildState({ mapId: 'map.au' }))
        for (const cityId of boardMap('map.au').longDistanceCities) {
            const city = pieces.find((piece) => piece.cityId === cityId)
            if (!city?.bonus) throw new Error(`${cityId} has no bonus`)
            const spot = bufferStopSpots(geometry).find((found) => found.hexId === city.hexId)
            if (!spot) throw new Error(`${cityId} has no buffer stop`)
            const { center, cells } = geometry.place(city.hexId)
            expect(spot).toEqual({ hexId: city.hexId, x: center.x, y: center.y - 22 })
            const stop = bufferStopBox(spot)
            const corners = cells[0]?.vertices ?? []
            for (const corner of boxCorners(stop)) {
                expect(insideConvexPolygon(corner, corners), cityId).toBe(true)
            }
            const pill = centredBox({
                ...bonusPillSpot(city.hexId),
                width: bonusPill(city.bonus).width + BONUS_PILL.strokeWidth,
                height: BONUS_PILL.height + BONUS_PILL.strokeWidth
            })
            expect(boxesOverlap(stop, pill), `${cityId} pill`).toBe(false)
            // The one locomotive it holds, its edge included.
            for (const slot of trackSlots(city.hexId, 1)) {
                const cube = centredBox({
                    ...slot,
                    width: slot.width + CUBE_EDGE_WIDTH,
                    height: slot.height + CUBE_EDGE_WIDTH
                })
                expect(boxesOverlap(stop, cube), `${cityId} cube`).toBe(false)
            }
            for (const one of seaOnes) {
                expect(boxesOverlap(stop, one), `${cityId} and a 1`).toBe(false)
            }
            // Every waiting passenger's head, the hex below's included, which stands in this hex.
            for (const { cityId: other, head } of heads) {
                expect(boxesOverlap(stop, head), `${cityId} and ${other}'s head`).toBe(false)
            }
        }
    })

    it('draws the rails and ties in ink, round-ended, and the stop bar in --rtr-impassable edged in ink', () => {
        const ground = GROUND_LAYER
        const from = ground.indexOf('data-buffer-stop')
        expect(from).toBeGreaterThan(0)
        const mark = ground.slice(from, ground.indexOf('</g>', from))
        const paths = [...mark.matchAll(/<path\b[^>]*>/g)].map(([tag]) => tag)
        expect(paths).toHaveLength(2)
        expect(paths[0]).toContain('d={BUFFER_STOP.rails}')
        expect(paths[0]).toContain('stroke-width={BUFFER_STOP.railWidth}')
        expect(paths[1]).toContain('d={BUFFER_STOP.ties}')
        expect(paths[1]).toContain('stroke-width={BUFFER_STOP.tieWidth}')
        for (const path of paths) {
            expect(path).toContain('stroke="var(--rtr-ink)"')
            expect(path).toContain('stroke-linecap="round"')
        }
        const bars = [...mark.matchAll(/<rect\b[^>]*>/g)].map(([tag]) => tag)
        expect(bars).toHaveLength(1)
        expect(bars[0]).toContain('fill="var(--rtr-impassable)"')
        expect(bars[0]).toContain('stroke="var(--rtr-ink)"')
        expect(bars[0]).toContain('stroke-width={BUFFER_STOP.barEdgeWidth}')
        // The bar is drawn last, over the rails' top ends.
        expect(mark.indexOf('<rect')).toBeGreaterThan(mark.lastIndexOf('<path'))
    })

    it.each(paletteNames())(
        'stands the bar’s red at 3:1 or more on the long-distance ochre and on a city’s cream middle, in the %s palette',
        (palette) => {
            const red = tokenValue(palette, 'rtr-impassable')
            const weak = ['rtr-long-haul', 'rtr-plain']
                .map((ground) => ({
                    ground,
                    ratio: contrastRatio(red, tokenValue(palette, ground))
                }))
                .filter(({ ratio }) => ratio < 3)
                .map(({ ground, ratio }) => `${ground} ${ratio.toFixed(2)}:1`)
            expect(weak).toEqual([])
        }
    )
})

describe('impassable sides (R-8.3, R-8.4)', () => {
    const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 0.5

    it('finds exactly the map’s impassable sides: Canada’s 18, France’s 7', () => {
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

    it('lays each side’s line along the side its two hexes share, a whole side long', () => {
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

describe('the ring round Paris (R-8.4)', () => {
    const geometry = boardGeometry('map.fr')
    const entries = geometry.map.hexes.filter((hex) =>
        geometry.map.groupsOf(hex.id).includes('paris-entry')
    )
    const near = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < 0.5

    it('edges the six entry hexes’ outside in navy: each one’s three sides away from Paris and the ring', () => {
        const sides = entryRingSides(geometry)
        expect(sides).toHaveLength(18)
        for (const { hexId, from, to } of sides) {
            expect(entries.map((hex) => hex.id)).toContain(hexId)
            const corners = geometry.place(hexId).cells[0]?.vertices ?? []
            expect(corners.some((corner) => near(corner, from))).toBe(true)
            expect(corners.some((corner) => near(corner, to))).toBe(true)
            // The cell across the side is neither Paris nor another entry hex.
            const center = geometry.place(hexId).center
            const across = { x: from.x + to.x - center.x, y: from.y + to.y - center.y }
            for (const inner of [...entries.map((hex) => hex.id), cityHex('map.fr', 'Paris')]) {
                const innerCenter = geometry.place(inner).center
                expect(near(across, innerCenter), `${hexId} faces an inner hex`).toBe(false)
            }
        }
        for (const hex of entries) {
            expect(
                sides.filter((side) => side.hexId === hex.id),
                hex.id
            ).toHaveLength(3)
        }
    })

    it('draws no ring on a map without entry hexes', () => {
        for (const mapId of ['map.usa', 'map.au', 'map.ca', 'map.de'] as const) {
            expect(entryRingSides(boardGeometry(mapId))).toEqual([])
        }
    })

    it('stands the four border cities’ 1 inside the hex, not in the margin past the land', () => {
        const names = ['Lille', 'Valenciennes', 'Sedan', 'Metz']
        const marks = capacityMarks(geometry, MAP_LAYOUTS['map.fr'].limitMarksInHex)
        for (const name of names) {
            const city = cityNamed('map.fr', name)
            const mark = marks.find((found) => found.cityId === city.id)
            expect(mark, name).toMatchObject({ text: '1', inHex: true })
            if (!mark) continue
            for (const corner of squareCorners(
                mark,
                HEX_LIMIT_MARK.side + HEX_LIMIT_MARK.strokeWidth
            )) {
                expect(insideACell(geometry, city.hexId, corner), name).toBe(true)
            }
        }
        expect(MAP_LAYOUTS['map.fr'].limitMarksInHex).toEqual(
            names.map((name) => cityNamed('map.fr', name).id)
        )
        // Every other map keeps its marks where open water is found.
        for (const mapId of ['map.usa', 'map.au', 'map.ca', 'map.de'] as const) {
            expect(MAP_LAYOUTS[mapId].limitMarksInHex ?? []).toEqual([])
        }
    })
})

function cityHex(mapId: MapId, name: string) {
    return cityNamed(mapId, name).hexId
}

describe('Berlin, one city over two cells (R-8.5)', () => {
    const geometry = boardGeometry('map.de')
    const berlin = cityNamed('map.de', 'Berlin')
    const place = geometry.place(berlin.hexId)
    const [own, second] = place.cells
    const tolerance = 0.06
    const insideBerlin = (point: Point) =>
        place.cells.some((cell) => reachPastConvex(point, cell.vertices) <= tolerance)
    const loopPoints = (loop: string): Point[] =>
        loop.split(' ').map((pair) => {
            const [x, y] = pair.split(',').map(Number)
            return { x: x ?? NaN, y: y ?? NaN }
        })

    it('draws Berlin’s outline as one loop of ten corners round its two cells', () => {
        expect(place.cells).toHaveLength(2)
        expect(place.outline).toHaveLength(10)
        for (const corner of place.outline) expect(insideBerlin(corner)).toBe(true)
    })

    it('fills one cream middle and rings it once: every inset is one loop inside both cells', () => {
        for (const inset of [0, 3.5, 9]) {
            const loops = insetCellPoints(berlin.hexId, inset)
            expect(loops, `inset ${inset}`).toHaveLength(1)
            const points = loopPoints(loops[0] ?? '')
            expect(points).toHaveLength(10)
            for (const point of points) expect(insideBerlin(point), `inset ${inset}`).toBe(true)
        }
        // A single cell keeps its own six corners.
        const single = cityNamed('map.de', 'Hamburg')
        expect(insetCellPoints(single.hexId, 9)).toHaveLength(1)
        expect(loopPoints(insetCellPoints(single.hexId, 9)[0] ?? '')).toHaveLength(6)
    })

    it('bands Berlin once round its whole outline, a colour a half, split top to bottom', () => {
        const outline = place.outline.map((corner) => ({
            x: corner.x - place.center.x,
            y: corner.y - place.center.y
        }))
        const paths = outlineBandPaths(outline, startBandSpans(2), START_BAND_WIDTH)
        expect(paths).toHaveLength(2)
        const [right, left] = paths.map((path) =>
            [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
                x: Number(match[1]) + place.center.x,
                y: Number(match[2]) + place.center.y
            }))
        )
        for (const point of [...(right ?? []), ...(left ?? [])]) {
            expect(insideBerlin(point)).toBe(true)
        }
        expect(Math.min(...(right ?? []).map((point) => point.x))).toBeGreaterThan(
            place.center.x - 0.5
        )
        expect(Math.max(...(left ?? []).map((point) => point.x))).toBeLessThan(place.center.x + 0.5)
        // One colour rings the whole outline, its inner loop a band's width in.
        const [ring] = outlineBandPaths(outline, startBandSpans(1), START_BAND_WIDTH)
        expect(ring?.split('Z').filter(Boolean)).toHaveLength(2)
    })

    it('alternates Berlin’s cubes between its cells: full size up to four, Chicago’s size at five or six', () => {
        if (!own || !second) throw new Error('Berlin has two cells')
        for (let held = 1; held <= 6; held++) {
            const slots = trackSlots(berlin.hexId, held)
            expect(slots).toHaveLength(held)
            slots.forEach((slot, index) => {
                const cell = index % 2 === 0 ? own : second
                for (const corner of squareCorners(slot, slot.width)) {
                    expect(insideConvexPolygon(corner, cell.vertices), `${held}: ${index}`).toBe(
                        true
                    )
                }
                expect(slot.width, `${held}: ${index}`).toBe(held >= 5 ? 16 : 26)
            })
        }
    })

    it('stands the passenger and the 6 in Berlin’s own cell and the pill in its second', () => {
        if (!own || !second) throw new Error('Berlin has two cells')
        const passenger = passengerSpot(berlin.id, false)
        expect(insideConvexPolygon(passenger, own.vertices)).toBe(true)
        expect(passenger.x).toBeGreaterThan(own.center.x)
        const six = capacityMarks(geometry).find((mark) => mark.cityId === berlin.id)
        expect(six && insideConvexPolygon(six, own.vertices)).toBe(true)
        const pill = bonusPillSpot(berlin.hexId)
        expect(insideConvexPolygon(pill, second.vertices)).toBe(true)
        expect(pill.y).toBeGreaterThan(second.center.y)
        // A single-cell city's pill stands at its bottom centre, as before.
        const hamburg = geometry.place(cityNamed('map.de', 'Hamburg').hexId)
        expect(bonusPillSpot(cityNamed('map.de', 'Hamburg').hexId)).toEqual({
            x: hamburg.center.x + geometry.hexFrame.bonusPill.x,
            y: hamburg.center.y + geometry.hexFrame.bonusPill.y
        })
    })
})
