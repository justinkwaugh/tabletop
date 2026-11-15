import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import { RailwayMapState } from '../map/mapState.js'
import { createCityTileFace, createOffboardTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import type { StationState } from '../map/station.js'
import { hasStationRoute } from './trainRequirement.js'
const tiles = new TileSet({ id: 'empty', entries: [] }, [])
function map(connected: boolean, blockedBorder = false) {
    return new RailwayMapState(
        new RailwayMap({
            id: 'train-requirement',
            name: 'Train requirement',
            orientation: HexOrientation.Flat,
            locations: [0, 1].map((r) => ({
                id: String(r),
                coordinates: { q: 0, r },
                buildable: true,
                preprintedTile: createCityTileFace(
                    'yellow',
                    connected ? [r === 0 ? 0 : 3] : [],
                    20,
                    1
                ),
                ...(blockedBorder && r === 0
                    ? { borders: [{ edge: 0 as const, kind: 'impassable' as const }] }
                    : {})
            }))
        }),
        tiles,
        tiles.createInventory()
    )
}
const state: StationState = {
    stations: [0, 1].map((r) => ({
        id: String(r),
        companyId: 'A',
        status: 'placed',
        position: { locationId: String(r), nodeId: 'city', slot: 0 }
    })),
    stationReservations: []
}
it('does not confuse two disconnected stations with a runnable connection', () => {
    expect(hasStationRoute(map(false), state, 'A')).toBe(false)
    expect(hasStationRoute(map(true), state, 'A')).toBe(true)
    expect(hasStationRoute(map(true, true), state, 'A')).toBe(false)
})
it('counts a full rival city as a destination', () => {
    const rival: StationState = {
        ...state,
        stations: state.stations.map((station, index) => ({
            ...station,
            companyId: index ? 'B' : 'A'
        }))
    }
    expect(hasStationRoute(map(true), rival, 'A')).toBe(true)
})

it('leaves out offboards where routes need two cities or towns', () => {
    const ported = new RailwayMapState(
        new RailwayMap({
            id: 'train-requirement-port',
            name: 'Train requirement port',
            orientation: HexOrientation.Flat,
            locations: [
                {
                    id: '0',
                    coordinates: { q: 0, r: 0 },
                    buildable: true,
                    preprintedTile: createCityTileFace('yellow', [0], 20, 1)
                },
                {
                    id: '1',
                    coordinates: { q: 0, r: 1 },
                    buildable: false,
                    preprintedTile: createOffboardTileFace([3], {
                        kind: 'fixed',
                        amount: 20
                    })
                }
            ]
        }),
        tiles,
        tiles.createInventory()
    )
    const home: StationState = { stations: [state.stations[0]], stationReservations: [] }
    expect(hasStationRoute(ported, home, 'A')).toBe(true)
    expect(hasStationRoute(ported, home, 'A', undefined, true)).toBe(false)
})
