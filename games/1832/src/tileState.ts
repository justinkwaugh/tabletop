import { RailwayMapState, type MapStateData, type TileFace } from '@tabletop/18xx'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'

export function eighteenThirtyTwoMapState(state: MapStateData): RailwayMapState {
    return new RailwayMapState(EighteenThirtyTwoMap, EighteenThirtyTwoTileSet, state.tileInventory)
}

/** The face now showing at a location, printed or placed. */
export function currentTileFace(state: MapStateData, locationId: string): TileFace {
    return eighteenThirtyTwoMapState(state).tile(locationId).face
}
