import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMapState } from './mapState.js'
import { RailwayMap, type MapLocation } from './map.js'
import { createTrackTileFace, createCityTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import { StandardTileCatalog } from '../tiles/standardCatalog.js'
import type { StationState } from './station.js'

const set = new TileSet(
    { id: 'map-state-tiles', entries: [{ id: 'city', faceDefinitionIds: ['18xx:5'], count: 1 }] },
    [StandardTileCatalog]
)
function map(orientation = HexOrientation.Flat, extra: Partial<MapLocation> = {}) {
    return new RailwayMap({
        id: 'map-state',
        name: 'Map state',
        orientation,
        locations: [
            {
                id: 'a',
                coordinates: { q: 0, r: 0 },
                preprintedTile: createCityTileFace('white', [], 0, 1),
                buildable: true,
                ...extra
            },
            {
                id: 'b',
                coordinates: orientation === HexOrientation.Flat ? { q: 0, r: 1 } : { q: -1, r: 1 },
                preprintedTile: createTrackTileFace('gray', [[3, 0]]),
                buildable: false
            }
        ]
    })
}
it.each([HexOrientation.Flat, HexOrientation.Pointy])(
    'requires matching rotated track ends in %s maps',
    (orientation) => {
        const railway = map(orientation)
        const inventory = set.createInventory([
            { locationId: 'a', definitionId: '18xx:5', rotation: 0 }
        ])
        const mapState = new RailwayMapState(railway, set, inventory)
        expect(mapState.connections('a')).toEqual([
            { edge: 0, neighborLocationId: 'b', neighborEdge: 3 }
        ])
        expect(mapState.connections('b')).toEqual([
            { edge: 3, neighborLocationId: 'a', neighborEdge: 0 }
        ])
        inventory.placements.a.rotation = 2
        expect(new RailwayMapState(railway, set, inventory).connections('a')).toEqual([])
        expect(mapState.tile('a').rotation).toBe(0)
        expect(new RailwayMapState(railway, set, set.createInventory()).connections('b')).toEqual(
            []
        )
    }
)
it('does not connect through an impassable border', () => {
    const railway = map(HexOrientation.Flat, { borders: [{ edge: 0, kind: 'impassable' }] })
    const mapState = new RailwayMapState(
        railway,
        set,
        set.createInventory([{ locationId: 'a', definitionId: '18xx:5', rotation: 0 }])
    )
    expect(mapState.connections('a')).toEqual([])
    expect(mapState.connections('b')).toEqual([])
})
it('validates slots while allowing multiple future reservations in an occupied city', () => {
    const mapState = new RailwayMapState(map(), set, set.createInventory())
    const state: StationState = {
        stations: [
            {
                id: 'station',
                companyId: 'old',
                status: 'placed',
                position: { locationId: 'a', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [
            { companyId: 'next', locationId: 'a', nodeId: 'city' },
            { companyId: 'later', locationId: 'a', nodeId: 'city' }
        ]
    }
    expect(() => mapState.validateStations(state)).not.toThrow()
    if (state.stations[0].status !== 'placed') throw new Error('Expected placed station')
    state.stations[0].position.slot = 1
    expect(() => mapState.validateStations(state)).toThrow('existing city slot')
    state.stations = []
    state.stationReservations[0].nodeId = 'missing'
    expect(() => mapState.validateStations(state)).toThrow('existing city')
    const shipyard = new RailwayMapState(
        map(HexOrientation.Flat, { preprintedTile: createCityTileFace('gray', [0], 20, 0) }),
        set,
        set.createInventory()
    )
    expect(shipyard.tile('a').face.nodes[0]).toMatchObject({ kind: 'city', stationSlots: 0 })
    expect(() =>
        shipyard.validateStations({
            stations: [
                {
                    id: 'station',
                    companyId: 'old',
                    status: 'placed',
                    position: { locationId: 'a', nodeId: 'city', slot: 0 }
                }
            ],
            stationReservations: []
        })
    ).toThrow('existing city slot')
})
it('rejects placement outside the map and preserves printed facts when a tile is placed', () => {
    const railway = map(HexOrientation.Flat, {
        terrain: { cost: 60, kinds: ['water'] },
        markers: [{ id: 'bridge', label: 'Bridge', description: 'Bridge crossing' }]
    })
    expect(
        () =>
            new RailwayMapState(
                railway,
                set,
                set.createInventory([
                    { locationId: 'missing', definitionId: '18xx:5', rotation: 0 }
                ])
            )
    ).toThrow('Unknown map location')
    const mapState = new RailwayMapState(
        railway,
        set,
        set.createInventory([{ locationId: 'a', definitionId: '18xx:5', rotation: 0 }])
    )
    expect(mapState.tile('a').face.color).toBe('yellow')
    expect(railway.location('a').preprintedTile.color).toBe('white')
    expect(railway.location('a').terrain?.cost).toBe(60)
    expect(railway.location('a').markers?.[0].id).toBe('bridge')
})
