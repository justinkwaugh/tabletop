import { describe, expect, it } from 'vitest'
import { USA_CITIES } from '@tabletop/ride-the-rails'
import {
    bonusCoin,
    cityMarkScale,
    COIN_RADIUS,
    passengerOffset,
    START_RING_RADIUS,
    startRingArcs,
    coinOffset
} from './cityMarks.js'
import { stationOf } from './boardGeometry.js'

describe('the $5 coin', () => {
    it('is green with a white amount while the bonus is to be had', () => {
        expect(bonusCoin({ kind: 'five', amount: 5, taken: false })).toEqual({
            text: '$5',
            fill: 'var(--rtr-five)',
            rim: 'var(--rtr-five-rim)',
            ink: 'var(--rtr-five-ink)',
            used: false
        })
    })

    it('greys out and is struck through once a railroad has used it up (R-4.3.2)', () => {
        expect(bonusCoin({ kind: 'five', amount: 5, taken: true })).toEqual({
            text: '$5',
            fill: 'var(--rtr-coin-used)',
            rim: 'var(--rtr-coin-used-rim)',
            ink: 'var(--rtr-coin-used-ink)',
            used: true
        })
    })

    it('leaves Chicago’s gold $2, paid on every placement, never used up (R-4.3.1)', () => {
        expect(bonusCoin({ kind: 'chicago', amount: 2 })).toEqual({
            text: '$2',
            fill: 'var(--rtr-coin)',
            rim: 'var(--rtr-coin-rim)',
            ink: 'var(--rtr-coin-ink)',
            used: false
        })
    })

    it('reads at the phone zoom: a coin about 14 px across where a hex is 33 px wide', () => {
        const phoneScale = 33 / (Math.sqrt(3) * 40)
        expect(2 * COIN_RADIUS * phoneScale).toBeGreaterThanOrEqual(13)
    })
})

describe('the start ring', () => {
    it('draws one arc per start colour, each the same length, with gaps between', () => {
        for (const count of [2, 3, 4]) {
            const arcs = startRingArcs(count)
            expect(arcs).toHaveLength(count)
            for (const arc of arcs) expect(arc).toMatch(/^M[-\d. ]+A[-\d. ]+$/)
        }
    })

    it('draws a single start colour as a whole circle', () => {
        expect(startRingArcs(1)).toEqual([])
    })

    it('splits two colours into a top and a bottom half', () => {
        const [top, bottom] = startRingArcs(2).map((arc) =>
            arc.match(/-?\d+(?:\.\d+)?/g)?.map(Number)
        )
        // Each arc starts on the left and ends on the right, or the other way round.
        expect(top?.[1]).toBeLessThan(0)
        expect(bottom?.[1]).toBeGreaterThan(0)
    })

    it('rings the station outside its disc', () => {
        expect(START_RING_RADIUS).toBeGreaterThan(12)
    })
})

describe('city mark places', () => {
    it('puts the coin up and left and the passenger right of an ordinary station', () => {
        const coin = coinOffset('city.usa.denver')
        const passenger = passengerOffset('city.usa.denver')
        expect(coin.x).toBeLessThan(0)
        expect(coin.y).toBeLessThan(0)
        expect(passenger.x).toBeGreaterThan(0)
    })

    it('puts Chicago’s coin and passenger beside its station, between its rows of cubes', () => {
        expect(coinOffset('city.usa.chicago').y).toBe(0)
        expect(passengerOffset('city.usa.chicago').y).toBe(0)
    })

    it('scales the marks with the station', () => {
        for (const city of USA_CITIES) {
            expect(cityMarkScale(city.id)).toBeCloseTo(stationOf(city.id).radius / 12, 6)
        }
    })
})
