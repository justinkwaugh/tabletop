import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import type { StationState } from '../map/station.js'
import { createCityTileFace, createTrackTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import { ConstructionReachability } from './constructionReachability.js'

const tiles = new TileSet({ id: 'empty', entries: [] }, [])
const branching = createTrackTileFace('green', [
    [3, 0],
    [0, 1]
])
// A home city leads through a branching tile into a dead-end city. Location 3 lies past the
// branch that starts at the far side of the dead end.
const mapState = new RailwayMapState(
    new RailwayMap({
        id: 'reachability',
        name: 'Reachability',
        orientation: HexOrientation.Flat,
        locations: [
            { q: 0, r: 0, face: createCityTileFace('yellow', [0], 20, 1) },
            { q: 0, r: 1, face: branching },
            { q: 0, r: 2, face: createCityTileFace('gray', [3], 10, 1) },
            { q: -1, r: 2, face: createTrackTileFace('white', []) }
        ].map(({ q, r, face }, index) => ({
            id: String(index),
            coordinates: { q, r },
            preprintedTile: face,
            buildable: true
        }))
    }),
    tiles,
    tiles.createInventory()
)
const stations: StationState = {
    stations: [
        {
            id: 'home',
            companyId: 'A',
            status: 'placed',
            position: { locationId: '0', nodeId: 'city', slot: 0 }
        }
    ],
    stationReservations: []
}

it('cannot reach track beyond a city by leaving it along the track it arrived on', () => {
    expect(mapState.map.neighbor('1', 1)?.id).toBe('3')
    const reachability = new ConstructionReachability(mapState, stations, 'A')
    expect(reachability.canReach('2')).toBe(true)
    expect(reachability.canReach('3')).toBe(false)
})

it('connects a replacement only along track a route can follow', () => {
    const reachability = new ConstructionReachability(mapState, stations, 'A')
    const { paths } = reachability.connections('1', branching, stations)
    expect(paths).toEqual(new Set([branching.paths[0].id]))
})
