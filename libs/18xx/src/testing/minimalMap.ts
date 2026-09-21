import { HexOrientation } from '@tabletop/common'
import { RailwayMap } from '../map/map.js'
import type { RouteRules } from '../routes/routeEvaluation.js'
import type { StationRules } from '../stations/stationPlacement.js'
import { createCityTileFace } from '../tiles/faces.js'
import { TileSet } from '../tiles/inventory.js'
import { minimalTrainRules } from './minimalRules.js'

export const TestHomeLocationId = '0'
export const TestOpenLocationId = '1'

export const minimalTileSet = new TileSet({ id: 'test', entries: [] }, [])

export const minimalRailwayMap = new RailwayMap({
    id: 'test',
    name: 'Test',
    orientation: HexOrientation.Flat,
    locations: [TestHomeLocationId, TestOpenLocationId].map((id, r) => ({
        id,
        coordinates: { q: 0, r },
        buildable: true,
        preprintedTile: createCityTileFace('green', [0, 3], 30, 1)
    }))
})

export const minimalStationRules: StationRules = {
    map: minimalRailwayMap,
    tileSet: minimalTileSet,
    placementCost: () => 40,
    placementLimit: () => 1,
    pendingHomes: () => []
}

export const minimalRouteRules: RouteRules = {
    map: minimalRailwayMap,
    tileSet: minimalTileSet,
    depot: minimalTrainRules.depot,
    revenueStage: () => ['green'],
    requiresCity: () => true
}
