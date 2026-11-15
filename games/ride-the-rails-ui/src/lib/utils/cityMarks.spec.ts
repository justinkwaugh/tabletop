import { describe, expect, it } from 'vitest'
import { USA_CITIES } from '@tabletop/ride-the-rails'
import { MIN_RESTING_HEX_PX } from './boardFocus.js'
import { HEX_SIZE, HEX_WIDTH } from './boardGeometry.js'
import {
    BONUS_PILL,
    bonusPill,
    hexagonPoint,
    PASSENGER_SCALE,
    passengerOffset,
    PAWN_EXTENT,
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

    it('sits up and left of the hex’s centre, inside the hex', () => {
        const { center, width, height } = BONUS_PILL
        expect(center.x).toBeLessThan(0)
        expect(center.y).toBeLessThan(0)
        expect(center.x - width / 2).toBeGreaterThan(-HEX_WIDTH / 2)
        expect(center.y - height / 2).toBeGreaterThan(-HEX_SIZE)
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

describe('the passenger’s place', () => {
    it('stands up and right of the hex’s centre, clear of the bonus pill', () => {
        for (const city of USA_CITIES) {
            const offset = passengerOffset(city.id)
            expect(offset.x).toBeGreaterThan(0)
            expect(offset.y).toBeLessThan(0)
            const pawnLeft = offset.x + PAWN_EXTENT.left * PASSENGER_SCALE
            expect(pawnLeft).toBeGreaterThan(BONUS_PILL.center.x + BONUS_PILL.width / 2)
        }
    })

    it('stands Chicago’s higher, above its back row of cubes', () => {
        expect(passengerOffset('city.usa.chicago').y).toBeLessThan(
            passengerOffset('city.usa.denver').y
        )
    })
})
