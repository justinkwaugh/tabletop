import { describe, expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap, letterNumberHexCoordinates, type MapLocation } from './map.js'
import { createCityTileFace } from '../tiles/faces.js'

const base: MapLocation = {
    id: 'center',
    coordinates: { q: 0, r: 0 },
    preprintedTile: createCityTileFace('white', [], 0, 1),
    buildable: true,
    terrain: { cost: 80, kinds: ['water', 'mountain'] },
    reservations: [{ companyId: 'A', nodeId: 'city' }]
}

describe('railway map', () => {
    it.each([HexOrientation.Flat, HexOrientation.Pointy])(
        'uses Common adjacency independently of map labels, %s',
        (orientation) => {
            const map = new RailwayMap({
                id: 'test',
                name: 'Test',
                orientation,
                locations: [base, { ...base, id: 'neighbor', coordinates: { q: 0, r: 1 } }]
            })
            const edge = orientation === HexOrientation.Flat ? 0 : 5
            expect(map.neighbor('center', edge)?.id).toBe('neighbor')
            expect(map.neighbor('neighbor', orientation === HexOrientation.Flat ? 3 : 2)?.id).toBe(
                'center'
            )
            expect(map.neighbor('center', 1)).toBeUndefined()
            expect(map.preprintedTiles.center).toBe(map.location('center').preprintedTile)
            expect(new RailwayMap(JSON.parse(JSON.stringify(map.definition))).definition).toEqual(
                map.definition
            )
            expect(Object.isFrozen(map.location('center').terrain)).toBe(true)
        }
    )
    it('rejects duplicate coordinates, invalid city references, and fractional coordinates', () => {
        const definition = {
            id: 'test',
            name: 'Test',
            orientation: HexOrientation.Flat,
            locations: [base]
        }
        expect(
            () => new RailwayMap({ ...definition, locations: [base, { ...base, id: 'other' }] })
        ).toThrow('coordinates')
        expect(
            () =>
                new RailwayMap({
                    ...definition,
                    locations: [{ ...base, coordinates: { q: 0.5, r: 0 } }]
                })
        ).toThrow('integral')
        expect(
            () =>
                new RailwayMap({
                    ...definition,
                    locations: [{ ...base, reservations: [{ companyId: 'A', nodeId: 'missing' }] }]
                })
        ).toThrow('city')
    })
    it('decodes explicit letter-number conventions without using labels as graph coordinates', () => {
        expect(letterNumberHexCoordinates('K19', HexOrientation.Flat, 1)).toEqual({ q: 10, r: 4 })
        expect(letterNumberHexCoordinates('I2', HexOrientation.Flat, 0)).toEqual({ q: 8, r: -3 })
        expect(letterNumberHexCoordinates('I2', HexOrientation.Pointy, 0)).toEqual({ q: -3, r: 8 })
        expect(() => letterNumberHexCoordinates('A2', HexOrientation.Flat, 1)).toThrow('parity')
    })
})
