import { describe, expect, it } from 'vitest'
import { Region } from '@tabletop/oath'
import { openingRegion, regionCounts, travelChip } from './travelOnTheMap.js'
import type { TravelWay } from './actionOffers.js'

const way = (cost: number, terms: Partial<TravelWay> = {}): TravelWay => ({
    tolls: [],
    flipSecret: false,
    discountTolls: [],
    cost,
    ...terms
})

describe('the cost chip on a lit site (Choose a Travel destination)', () => {
    it('one way to pay in Supply alone reads in words, its tolls named as before', () => {
        expect(travelChip([way(2)], '')).toEqual({ words: '2 supply' })
        expect(travelChip([way(1, { tolls: ['denizen.nomad.way-station'] })], ' + 1 favor to Ann')).toEqual({
            words: '1 supply + 1 favor to Ann'
        })
    })

    it('two ways read as numbers and symbols with "or" between them, in the engine’s order (R-11.12)', () => {
        expect(travelChip([way(2), way(0, { flipSecret: true })], '')).toEqual({
            ways: [
                { cost: 2, favor: 0, secret: false },
                { cost: 0, favor: 0, secret: true }
            ]
        })
        expect(travelChip([way(1), way(0, { tolls: ['denizen.nomad.way-station'] })], '')).toEqual({
            ways: [
                { cost: 1, favor: 0, secret: false },
                { cost: 0, favor: 1, secret: false }
            ]
        })
    })

    it('one way that flips a secret reads as its number and the secret, not in words', () => {
        expect(travelChip([way(0, { flipSecret: true })], ' + a secret flipped')).toEqual({
            ways: [{ cost: 0, favor: 0, secret: true }]
        })
    })

    it('no way to pay, no chip', () => {
        expect(travelChip([], '')).toBeUndefined()
    })
})

describe('the region a Travel on a phone opens on', () => {
    const regionOf = (slotId: string) =>
        slotId.startsWith('c') ? Region.Cradle : slotId.startsWith('p') ? Region.Provinces : Region.Hinterland

    it('counts the lit sites by region, in the board’s order, an empty region at 0', () => {
        expect(regionCounts(['p1', 'h2', 'p3'], regionOf)).toEqual([
            { region: Region.Cradle, count: 0 },
            { region: Region.Provinces, count: 2 },
            { region: Region.Hinterland, count: 1 }
        ])
    })

    it('opens on the pawn’s region when it has a destination', () => {
        expect(openingRegion(Region.Provinces, regionCounts(['c2', 'p1', 'h2'], regionOf))).toBe(
            Region.Provinces
        )
    })

    it('else on the first region in the board’s order that has one', () => {
        expect(openingRegion(Region.Cradle, regionCounts(['h1', 'p1'], regionOf))).toBe(Region.Provinces)
        expect(openingRegion(Region.Provinces, regionCounts(['h1'], regionOf))).toBe(Region.Hinterland)
        expect(openingRegion(undefined, regionCounts(['h1', 'c2'], regionOf))).toBe(Region.Cradle)
    })

    it('with no destination anywhere, on the pawn’s region', () => {
        expect(openingRegion(Region.Hinterland, regionCounts([], regionOf))).toBe(Region.Hinterland)
    })
})
