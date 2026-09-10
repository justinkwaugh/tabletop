import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import type { StationState } from '../map/station.js'
import { createCityTileFace, createTrackTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import { TrackNetwork } from './trackNetwork.js'
import type { TileFace } from '../tiles/tile.js'
const tiles = new TileSet({ id: 'empty', entries: [] }, [])
function map(middle: TileFace) {
    return new RailwayMapState(
        new RailwayMap({
            id: 'network',
            name: 'Network',
            orientation: HexOrientation.Flat,
            locations: [
                createCityTileFace('yellow', [0], 20, 1),
                middle,
                createTrackTileFace('gray', [[3, 0]])
            ].map((preprintedTile, r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                preprintedTile,
                buildable: true
            }))
        }),
        tiles,
        tiles.createInventory()
    )
}
const stations: StationState = {
    stations: [
        {
            id: 'home',
            companyId: 'A',
            status: 'placed',
            position: { locationId: '0', nodeId: 'city', slot: 0 }
        },
        {
            id: 'rival',
            companyId: 'B',
            status: 'placed',
            position: { locationId: '1', nodeId: 'city', slot: 0 }
        }
    ],
    stationReservations: []
}
it('reaches a full rival city but cannot build through it until capacity opens', () => {
    const state = map(createCityTileFace('yellow', [3, 0], 20, 1))
    const network = new TrackNetwork(state, stations, 'A')
    expect(network.reaches('1', { kind: 'node', nodeId: 'city' })).toBe(true)
    expect(network.reaches('2', { kind: 'edge', edge: 3 })).toBe(false)
    const upgraded = new TrackNetwork(state, stations, 'A', {
        locationId: '1',
        face: createCityTileFace('green', [3, 0], 30, 2)
    })
    expect(upgraded.reaches('2', { kind: 'edge', edge: 3 })).toBe(true)
})
it('does not join crossing tracks or treat an untokenable city as a station barrier', () => {
    const crossing = createTrackTileFace('green', [
        [3, 0],
        [2, 5]
    ])
    const ownOnly = { ...stations, stations: stations.stations.slice(0, 1) }
    const network = new TrackNetwork(map(crossing), ownOnly, 'A')
    expect(network.usesPath('1', crossing.paths[0].id)).toBe(true)
    expect(network.usesPath('1', crossing.paths[1].id)).toBe(false)
    expect(
        new TrackNetwork(
            map(createCityTileFace('gray', [3, 0], 20, 0)),
            ownOnly,
            'A'
        ).reaches('2', { kind: 'edge', edge: 3 })
    ).toBe(true)
})
