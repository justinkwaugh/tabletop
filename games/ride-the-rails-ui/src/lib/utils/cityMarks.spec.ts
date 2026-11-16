import { describe, expect, it } from 'vitest'
import { USA_CITIES, usaCity } from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { cityPieces } from './boardPieces.js'
import { MIN_RESTING_HEX_PX } from './boardFocus.js'
import { HEX_SIZE, HEX_WIDTH } from './boardGeometry.js'
import {
    BONUS_PILL,
    bonusPill,
    FIVE_RING,
    fiveRing,
    hexagonPoint,
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

describe('the $5 pill', () => {
    it('is green with a white amount while the bonus is to be had', () => {
        expect(bonusPill({ kind: 'five', amount: 5, taken: false })).toEqual({
            text: '$5',
            fill: 'var(--rtr-five)',
            ink: 'var(--rtr-five-ink)',
            used: false
        })
    })

    it('greys and strikes through once a railroad has had it (R-4.3.2)', () => {
        expect(bonusPill({ kind: 'five', amount: 5, taken: true })).toEqual({
            text: '$5',
            fill: 'var(--rtr-coin-used)',
            ink: 'var(--rtr-coin-used-ink)',
            used: true
        })
    })

    it('shows Chicago’s $2 in gold, never used up (R-4.3.1)', () => {
        expect(bonusPill({ kind: 'chicago', amount: 2 })).toEqual({
            text: '$2',
            fill: 'var(--rtr-coin)',
            ink: 'var(--rtr-coin-ink)',
            used: false
        })
    })

    it('reads at the phone zoom: a pill at least 12 px across where a phone rests', () => {
        const phoneScale = MIN_RESTING_HEX_PX / HEX_WIDTH
        expect(BONUS_PILL.width * phoneScale).toBeGreaterThanOrEqual(12)
    })

    it('sits at the bottom centre of the hex, on its lower edge and above its bottom corner', () => {
        const { center, width, height } = BONUS_PILL
        expect(center.x).toBe(0)
        expect(center.y).toBeGreaterThan(0)
        expect(center.x + width / 2).toBeLessThan(HEX_WIDTH / 2)
        expect(center.y + height / 2).toBeLessThan(HEX_SIZE)
    })
})

describe('the $5 ring', () => {
    const DENVER = usaCity('city.usa.denver')

    function denverBonus(track = {}) {
        const denver = cityPieces(buildState({ track })).find((city) => city.cityId === DENVER.id)
        return denver?.bonus
    }

    it('frames a $5 city while its bonus is to be had (R-4.3.2)', () => {
        expect(fiveRing(denverBonus())).toEqual({
            points: [0, 60, 120, 180, 240, 300]
                .map((degrees) => hexagonPoint(FIVE_RING.radius, degrees))
                .map(({ x, y }) => `${x},${y}`)
                .join(' '),
            width: FIVE_RING.width
        })
    })

    it('is gone once a railroad has had the $5', () => {
        expect(fiveRing(denverBonus({ [DENVER.hexId]: ['railroad.black'] }))).toBeUndefined()
    })

    it('never frames Chicago or a city without a bonus', () => {
        expect(fiveRing({ kind: 'chicago', amount: 2 })).toBeUndefined()
        expect(fiveRing(undefined)).toBeUndefined()
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
        const [right, left] = startBandPaths(startBandSpans(2), START_BAND_WIDTH).map((path) =>
            [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => Number(match[1]))
        )
        expect(Math.min(...right)).toBeGreaterThanOrEqual(0)
        expect(Math.max(...left)).toBeLessThanOrEqual(0)
    })

    it('runs along the hex’s edge from its top corner', () => {
        expect(hexagonPoint(HEX_SIZE, 0)).toEqual({ x: 0, y: -HEX_SIZE })
        expect(hexagonPoint(HEX_SIZE, 90)).toEqual({ x: 34.64, y: 0 })
        expect(hexagonPoint(HEX_SIZE, 180)).toEqual({ x: 0, y: HEX_SIZE })
    })

    it('draws one path per colour with a separator at each split, and one ring for one colour', () => {
        const four = startBandSpans(4)
        expect(startBandPaths(four, START_BAND_WIDTH)).toHaveLength(4)
        expect(startBandSeparators(four, START_BAND_WIDTH)).toHaveLength(4)
        const one = startBandSpans(1)
        expect(startBandPaths(one, START_BAND_WIDTH)).toHaveLength(1)
        expect(startBandPaths(one, START_BAND_WIDTH)[0].match(/M/g)).toHaveLength(2)
        expect(startBandSeparators(one, START_BAND_WIDTH)).toEqual([])
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

describe('the passenger’s place', () => {
    it('stands up and right of the hex’s centre, clear of the bonus pill below', () => {
        for (const city of USA_CITIES) {
            const offset = passengerOffset(city.id)
            expect(offset.x).toBeGreaterThan(0)
            expect(offset.y).toBeLessThan(0)
            const meepleBottom = offset.y + MEEPLE_EXTENT.bottom * PASSENGER_SCALE
            expect(meepleBottom).toBeLessThan(BONUS_PILL.center.y - BONUS_PILL.height / 2)
        }
    })
})
