import { describe, expect, it } from 'vitest'
import { calculateHexGeometry, HexOrientation, type Point } from '@tabletop/common'
import { USA_CITIES, cityById } from '@tabletop/ride-the-rails'
import { buildState, FLAT_FIXTURE_MAP } from '@tabletop/ride-the-rails/testing'
import { cityPieces } from './boardPieces.js'
import { MIN_RESTING_HEX_PX } from './boardFocus.js'
import { boardGeometry, geometryOf, HEX_SIZE, HEX_WIDTH } from './boardGeometry.js'
import { hexFrame, type HexFrame } from './hexFrame.js'
import {
    boxesOverlap,
    boxInside,
    centredBox,
    frameHexagon,
    insideConvexPolygon,
    reachPastConvex
} from '$lib/testing/shapeChecks.js'
import {
    BONUS_PILL,
    bonusPill,
    CAPACITY_MARK,
    capacityMarks,
    MOUNTAIN_PEAK,
    FIVE_RING,
    fiveRing,
    hexagonPoint,
    PASSENGER_HEAD_TOP,
    PASSENGER_SCALE,
    passengerOffset,
    MEEPLE,
    MEEPLE_EXTENT,
    PLAIN_CITY_BAND_WIDTH,
    START_BAND_WIDTH,
    startBand,
    startBandPaths,
    startBandSeparators,
    startBandSpans
} from './cityMarks.js'

const POINTY = hexFrame(HexOrientation.Pointy)

describe('the $5 pill', () => {
    it('is green with a white amount while the bonus is to be had', () => {
        expect(bonusPill({ kind: 'five', amount: 5, taken: false })).toEqual({
            text: '$5',
            fill: 'var(--rtr-five)',
            ink: 'var(--rtr-five-ink)',
            used: false,
            width: BONUS_PILL.width
        })
    })

    it('greys and strikes through once a railroad has had it (R-4.3.2)', () => {
        expect(bonusPill({ kind: 'five', amount: 5, taken: true })).toEqual({
            text: '$5',
            fill: 'var(--rtr-coin-used)',
            ink: 'var(--rtr-coin-used-ink)',
            used: true,
            width: BONUS_PILL.width
        })
    })

    it('shows Chicago’s $2 in gold, never used up (R-4.3.1)', () => {
        expect(bonusPill({ kind: 'coin', text: '$2' })).toEqual({
            text: '$2',
            fill: 'var(--rtr-coin)',
            ink: 'var(--rtr-coin-ink)',
            used: false,
            width: BONUS_PILL.width
        })
    })

    it('widens for a longer amount, one gold pill each, Chicago’s as it was (R-8)', () => {
        expect(bonusPill({ kind: 'coin', text: '$2' }).width).toBe(BONUS_PILL.width)
        expect(bonusPill({ kind: 'five', amount: 5, taken: false }).width).toBe(BONUS_PILL.width)
        expect(bonusPill({ kind: 'coin', text: '$50' })).toMatchObject({
            text: '$50',
            fill: 'var(--rtr-coin)',
            width: 34.3
        })
        expect(bonusPill({ kind: 'coin', text: '$3/$2' })).toMatchObject({
            text: '$3/$2',
            fill: 'var(--rtr-coin)',
            width: 45.6
        })
    })

    it('keeps the widest pill, Toronto’s, inside its flat hex at the bottom centre', () => {
        const width = bonusPill({ kind: 'coin', text: '$3/$2' }).width
        const radius = BONUS_PILL.height / 2 + BONUS_PILL.strokeWidth / 2
        const reach = width / 2 - BONUS_PILL.height / 2
        const frame = hexFrame(HexOrientation.Flat)
        const corners = frameHexagon(frame.cornerAngles, HEX_SIZE)
        for (const x of [-reach, reach]) {
            const end = { x: frame.bonusPill.x + x, y: frame.bonusPill.y }
            expect(reachPastConvex(end, corners, radius)).toBeLessThanOrEqual(0)
        }
    })

    it('reads at the phone zoom: a pill at least 12 px across where a phone rests', () => {
        const phoneScale = MIN_RESTING_HEX_PX / HEX_WIDTH
        expect(BONUS_PILL.width * phoneScale).toBeGreaterThanOrEqual(12)
    })

    it('sits at the bottom centre of the hex, on its lower edge and above its bottom corner', () => {
        const { width, height } = BONUS_PILL
        const center = POINTY.bonusPill
        expect(center.x).toBe(0)
        expect(center.y).toBeGreaterThan(0)
        expect(center.x + width / 2).toBeLessThan(HEX_WIDTH / 2)
        expect(center.y + height / 2).toBeLessThan(HEX_SIZE)
    })
})

describe('the $5 ring', () => {
    const DENVER = cityById('city.usa.denver')

    function denverBonus(track = {}) {
        const denver = cityPieces(buildState({ track })).find((city) => city.cityId === DENVER.id)
        return denver?.bonus
    }

    it('frames a $5 city while its bonus is to be had (R-4.3.2)', () => {
        expect(fiveRing(denverBonus(), POINTY)).toEqual({
            points: [0, 60, 120, 180, 240, 300]
                .map((degrees) => hexagonPoint(FIVE_RING.radius, degrees, POINTY))
                .map(({ x, y }) => `${x},${y}`)
                .join(' '),
            width: FIVE_RING.width
        })
    })

    it('is gone once a railroad has had the $5', () => {
        expect(
            fiveRing(denverBonus({ [DENVER.hexId]: ['railroad.black'] }), POINTY)
        ).toBeUndefined()
    })

    it('never frames Chicago or a city without a bonus', () => {
        expect(fiveRing({ kind: 'coin', text: '$2' }, POINTY)).toBeUndefined()
        expect(fiveRing(undefined, POINTY)).toBeUndefined()
    })

    it('lies just outside the black band: its inside on the hex edge, 3.2 units wide', () => {
        const apothem = Math.cos(Math.PI / 6)
        const inside = FIVE_RING.radius * apothem - FIVE_RING.width / 2
        expect(inside).toBeCloseTo(HEX_SIZE * apothem, 1)
        expect(FIVE_RING.width).toBe(3.2)
    })
})

describe('the start band', () => {
    it('splits the band into equal spans clockwise from the top corner', () => {
        expect(startBandSpans(1)).toEqual([{ from: 0, to: 360 }])
        expect(startBandSpans(2)).toEqual([
            { from: 0, to: 180 },
            { from: 180, to: 360 }
        ])
        expect(startBandSpans(3)).toEqual([
            { from: 0, to: 120 },
            { from: 120, to: 240 },
            { from: 240, to: 360 }
        ])
        expect(startBandSpans(4).map((span) => span.from)).toEqual([0, 90, 180, 270])
    })

    it('puts two colours’ first span on the right half and the second on the left', () => {
        const [right, left] = startBandPaths(startBandSpans(2), START_BAND_WIDTH, POINTY).map(
            (path) => [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => Number(match[1]))
        )
        expect(Math.min(...right)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...left)).toBeLessThanOrEqual(0)
    })

    it('runs along the hex’s edge from its top corner', () => {
        expect(hexagonPoint(HEX_SIZE, 0, POINTY)).toEqual({ x: 0, y: -HEX_SIZE })
        expect(hexagonPoint(HEX_SIZE, 90, POINTY)).toEqual({ x: 34.64, y: 0 })
        expect(hexagonPoint(HEX_SIZE, 180, POINTY)).toEqual({ x: 0, y: HEX_SIZE })
    })

    it('draws one path per colour with a separator at each split, and one ring for one colour', () => {
        const four = startBandSpans(4)
        expect(startBandPaths(four, START_BAND_WIDTH, POINTY)).toHaveLength(4)
        expect(startBandSeparators(four, START_BAND_WIDTH, POINTY)).toHaveLength(4)
        const one = startBandSpans(1)
        expect(startBandPaths(one, START_BAND_WIDTH, POINTY)).toHaveLength(1)
        expect(startBandPaths(one, START_BAND_WIDTH, POINTY)[0].match(/M/g)).toHaveLength(2)
        expect(startBandSeparators(one, START_BAND_WIDTH, POINTY)).toEqual([])
    })

    it('bands a city with printed start colours in those colours', () => {
        const newYork = USA_CITIES.find((city) => city.name === 'New York')
        expect(newYork && startBand(newYork.startColours)).toEqual({
            railroadIds: newYork?.startColours,
            width: START_BAND_WIDTH
        })
        expect(newYork?.startColours).toHaveLength(4)
    })

    it('bands a plain city, where only Black may start, in Black alone, thinner (R-4.2.5)', () => {
        const plain = USA_CITIES.filter((city) => city.startColours.length === 0)
        expect(plain.map((city) => city.name)).toContain('Denver')
        for (const city of plain) {
            expect(startBand(city.startColours)).toEqual({
                railroadIds: ['railroad.black'],
                width: PLAIN_CITY_BAND_WIDTH
            })
        }
        expect(PLAIN_CITY_BAND_WIDTH).toBeLessThan(START_BAND_WIDTH)
    })
})

describe('the passenger, a meeple', () => {
    // The pawn it replaces, in the same units: 9.7 wide and 14.6 tall, its edge included.
    const PAWN_WIDTH = 9.7
    const PAWN_HEIGHT = 14.6

    it('is about the pawn’s height and no wider than the pawn plus 10%', () => {
        const width = MEEPLE_EXTENT.right - MEEPLE_EXTENT.left
        const height = MEEPLE_EXTENT.bottom - MEEPLE_EXTENT.top
        expect(width).toBeLessThanOrEqual(PAWN_WIDTH * 1.1)
        expect(Math.abs(height - PAWN_HEIGHT)).toBeLessThanOrEqual(PAWN_HEIGHT * 0.05)
        expect(MEEPLE_EXTENT.left).toBe(-MEEPLE_EXTENT.right)
    })

    it('has a round head on top, arms out wider than the head, and two legs apart', () => {
        const { head } = MEEPLE
        expect(head.cy - head.r - MEEPLE.edgeWidth / 2).toBeCloseTo(MEEPLE_EXTENT.top, 5)
        expect(MEEPLE.path).toMatch(new RegExp(`A${head.r} ${head.r} `))
        // The arms reach out to the sides, well past the head.
        expect(MEEPLE.armReach).toBeGreaterThan(head.r * 1.8)
        expect(MEEPLE.armReach + MEEPLE.edgeWidth / 2).toBeCloseTo(MEEPLE_EXTENT.right, 5)
        // Two feet on the ground, with a gap between them under the crotch.
        expect(MEEPLE.crotchY).toBeLessThan(MEEPLE.footY)
        expect(MEEPLE.footY + MEEPLE.edgeWidth / 2).toBeCloseTo(MEEPLE_EXTENT.bottom, 5)
    })
})

describe('the passenger’s size on the board', () => {
    const FRAMES = [hexFrame(HexOrientation.Pointy), hexFrame(HexOrientation.Flat)]
    const offset = passengerOffset('city.usa.denver')
    // The meeple's box on the board from the hex's centre, its edge included or left out.
    const meepleBox = (edge: number) => ({
        x: offset.x + (MEEPLE_EXTENT.left + edge) * PASSENGER_SCALE,
        y: offset.y + (MEEPLE_EXTENT.top + edge) * PASSENGER_SCALE,
        width: (MEEPLE_EXTENT.right - MEEPLE_EXTENT.left - 2 * edge) * PASSENGER_SCALE,
        height: (MEEPLE_EXTENT.bottom - MEEPLE_EXTENT.top - 2 * edge) * PASSENGER_SCALE
    })
    const withEdge = meepleBox(0)
    const fillOnly = meepleBox(MEEPLE.edgeWidth / 2)

    it('stands at 2.4 times its shape, a box 25.2 wide and about 35 tall', () => {
        expect(PASSENGER_SCALE).toBe(2.4)
        expect(withEdge.width).toBeCloseTo(25.2, 5)
        expect(withEdge.height).toBeCloseTo(35.04, 5)
    })

    it('keeps its head’s top where it was, −35.3 from the hex’s centre, and grows down', () => {
        expect(PASSENGER_HEAD_TOP).toBe(-35.3)
        expect(withEdge.y).toBeCloseTo(-35.3, 5)
        expect(offset.x).toBe(14.4)
        // Its feet reach down to the cubes' middle row, above the hex's centre.
        expect(withEdge.y + withEdge.height).toBeLessThan(0)
    })

    it('stands inside its hex’s box either way up', () => {
        for (const frame of FRAMES) {
            const hexBox =
                frame.orientation === HexOrientation.Pointy
                    ? centredBox({ x: 0, y: 0, width: HEX_WIDTH, height: 2 * HEX_SIZE })
                    : centredBox({ x: 0, y: 0, width: 2 * HEX_SIZE, height: HEX_WIDTH })
            expect(boxInside(fillOnly, hexBox), frame.orientation).toBe(true)
        }
        // On a pointy hex its edge too; a flat hex's top edge is lower than a pointy hex's point.
        const pointy = centredBox({ x: 0, y: 0, width: HEX_WIDTH, height: 2 * HEX_SIZE })
        expect(boxInside(withEdge, pointy)).toBe(true)
    })

    it('keeps its head and arms clear of a city’s cubes, its legs behind the right one', () => {
        // The meeple down to the underside of its arms, its edge included.
        const upper = {
            ...withEdge,
            height: (MEEPLE.armBottomY + MEEPLE.edgeWidth / 2 - MEEPLE_EXTENT.top) * PASSENGER_SCALE
        }
        for (const frame of FRAMES) {
            const { byLayout, lone } = frame.trackSlots
            const slots = [...byLayout.city, ...(lone.city ? [lone.city] : [])]
            for (const slot of slots) {
                expect(boxesOverlap(upper, centredBox(slot)), frame.orientation).toBe(false)
            }
            const right = byLayout.city.reduce((a, b) => (b.x > a.x ? b : a))
            expect(boxesOverlap(withEdge, centredBox(right)), frame.orientation).toBe(true)
        }
    })
})

describe('the passenger’s place', () => {
    it('stands up and right of the hex’s centre, clear of the bonus pill below', () => {
        for (const city of USA_CITIES) {
            const offset = passengerOffset(city.id)
            expect(offset.x).toBeGreaterThan(0)
            expect(offset.y).toBeLessThan(0)
            const meepleBottom = offset.y + MEEPLE_EXTENT.bottom * PASSENGER_SCALE
            expect(meepleBottom).toBeLessThan(POINTY.bonusPill.y - BONUS_PILL.height / 2)
        }
    })
})

describe('a hex’s marks, either way up', () => {
    const FRAMES = [hexFrame(HexOrientation.Pointy), hexFrame(HexOrientation.Flat)]
    const name = (frame: HexFrame) => frame.orientation

    function pathPoints(path: string): Point[] {
        return [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => ({
            x: Number(match[1]),
            y: Number(match[2])
        }))
    }

    it('turns at the frame’s own corners: the platform’s hex, one corner up or one edge', () => {
        for (const frame of FRAMES) {
            const platform = calculateHexGeometry(
                { orientation: frame.orientation, dimensions: { radius: HEX_SIZE } },
                { q: 0, r: 0 }
            ).vertices
            const corners = frameHexagon(frame.cornerAngles, HEX_SIZE)
            for (const corner of corners) {
                const nearest = Math.min(
                    ...platform.map((vertex) =>
                        Math.hypot(vertex.x - corner.x, vertex.y - corner.y)
                    )
                )
                expect(nearest, name(frame)).toBeLessThan(0.1)
            }
        }
    })

    it('keeps every start band inside its hex, from one colour to four', () => {
        for (const frame of FRAMES) {
            const hexagon = frameHexagon(frame.cornerAngles, HEX_SIZE)
            for (const width of [START_BAND_WIDTH, PLAIN_CITY_BAND_WIDTH]) {
                for (const count of [1, 2, 3, 4]) {
                    const spans = startBandSpans(count)
                    const paths = [
                        ...startBandPaths(spans, width, frame),
                        ...startBandSeparators(spans, width, frame)
                    ]
                    for (const point of paths.flatMap(pathPoints)) {
                        expect(reachPastConvex(point, hexagon), name(frame)).toBeLessThanOrEqual(
                            0.01
                        )
                    }
                }
            }
        }
    })

    it('starts a flat hex’s band at the middle of its top edge, two colours split top to bottom', () => {
        const flat = hexFrame(HexOrientation.Flat)
        expect(hexagonPoint(HEX_SIZE, 0, flat)).toEqual({ x: 0, y: -34.64 })
        expect(hexagonPoint(HEX_SIZE, 30, flat)).toEqual({ x: 20, y: -34.64 })
        expect(hexagonPoint(HEX_SIZE, 90, flat)).toEqual({ x: HEX_SIZE, y: 0 })
        const [right, left] = startBandPaths(startBandSpans(2), START_BAND_WIDTH, flat).map(
            (path) => pathPoints(path).map((point) => point.x)
        )
        expect(Math.min(...right)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...left)).toBeLessThanOrEqual(0)
        for (const separator of startBandSeparators(startBandSpans(2), START_BAND_WIDTH, flat)) {
            expect(pathPoints(separator).map((point) => point.x)).toEqual([0, 0])
        }
    })

    it('rings a flat hex whole with one colour: its six corners and the top edge’s middle', () => {
        const flat = hexFrame(HexOrientation.Flat)
        const [ring] = startBandPaths(startBandSpans(1), START_BAND_WIDTH, flat)
        const [outer] = ring.split('Z')
        expect(pathPoints(outer)).toEqual([
            { x: 0, y: -34.64 },
            ...flat.cornerAngles.map((degrees) => hexagonPoint(HEX_SIZE, degrees, flat))
        ])
    })

    it('keeps the bonus pill, its edge included, inside the hex at its bottom centre', () => {
        for (const frame of FRAMES) {
            const hexagon = frameHexagon(frame.cornerAngles, HEX_SIZE)
            const radius = BONUS_PILL.height / 2 + BONUS_PILL.strokeWidth / 2
            const reach = BONUS_PILL.width / 2 - BONUS_PILL.height / 2
            expect(frame.bonusPill.x).toBe(0)
            for (const x of [-reach, reach]) {
                const end = { x: frame.bonusPill.x + x, y: frame.bonusPill.y }
                expect(reachPastConvex(end, hexagon, radius), name(frame)).toBeLessThanOrEqual(0)
            }
        }
    })

    it('keeps the passenger’s feet clear of the bonus pill below', () => {
        for (const frame of FRAMES) {
            const meepleBottom =
                passengerOffset('city.usa.denver').y + MEEPLE_EXTENT.bottom * PASSENGER_SCALE
            expect(meepleBottom).toBeLessThan(frame.bonusPill.y - BONUS_PILL.height / 2)
        }
    })

    it('keeps a mountain’s peak inside the hex, near its top', () => {
        for (const frame of FRAMES) {
            const hexagon = frameHexagon(frame.cornerAngles, HEX_SIZE)
            const peak = pathPoints(MOUNTAIN_PEAK.path).map((point) => ({
                x: point.x * MOUNTAIN_PEAK.scale,
                y: point.y * MOUNTAIN_PEAK.scale - frame.peakRise
            }))
            for (const point of peak) {
                expect(reachPastConvex(point, hexagon), name(frame)).toBeLessThan(0)
                expect(point.y).toBeLessThan(-HEX_SIZE / 2)
            }
        }
    })

    it('faces a capacity mark across each of the hex’s six sides, towards its neighbours', () => {
        for (const geometry of [boardGeometry('map.usa'), geometryOf(FLAT_FIXTURE_MAP)]) {
            const sides = geometry.hexFrame.capacitySides
            expect(new Set(sides.map((degrees) => (degrees + 360) % 360)).size).toBe(6)
            for (const hexId of geometry.hexIds) {
                const from = geometry.place(hexId)
                for (const other of geometry.map.adjacentHexIds(hexId)) {
                    const to = geometry.place(other)
                    if (from.cells.length > 1 || to.cells.length > 1) continue
                    const degrees =
                        (Math.atan2(to.center.y - from.center.y, to.center.x - from.center.x) *
                            180) /
                        Math.PI
                    const turned = sides.map((side) =>
                        Math.abs(((((side - degrees) % 360) + 540) % 360) - 180)
                    )
                    expect(Math.min(...turned), `${geometry.orientation} ${hexId}`).toBeLessThan(
                        1e-6
                    )
                }
            }
        }
    })

    it('stands each capacity mark in the sea, on the board, past a side of its city', () => {
        for (const geometry of [boardGeometry('map.usa'), geometryOf(FLAT_FIXTURE_MAP)]) {
            const marks = capacityMarks(geometry)
            const limited = geometry.map.cities.filter((city) => city.capacity !== 2)
            // The cities first, then any other hex that holds one (the fixture's long-distance hex).
            const cityMarks = marks.filter((mark) => mark.cityId !== undefined)
            expect(cityMarks.map((mark) => mark.cityId)).toEqual(limited.map((city) => city.id))
            expect(marks.slice(0, cityMarks.length)).toEqual(cityMarks)
            for (const mark of marks.filter((candidate) => !candidate.inHex)) {
                const half = CAPACITY_MARK.side / 2
                const box = {
                    x: mark.x - half,
                    y: mark.y - half,
                    width: 2 * half,
                    height: 2 * half
                }
                expect(boxInside(box, geometry.extents), mark.cityId).toBe(true)
                for (const hexId of geometry.hexIds) {
                    for (const cell of geometry.place(hexId).cells) {
                        expect(insideConvexPolygon(mark, cell.vertices), mark.cityId).toBe(false)
                    }
                }
            }
        }
    })
})
