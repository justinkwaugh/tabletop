import { assertExists } from '@tabletop/common'
import type { StationState, RailwayMap, TileSet } from '@tabletop/18xx'
import type { MapToken } from './mapDrawing.js'
import type { TileLayout } from '../tiles/tileDrawing.js'

export type StationAppearance = { label: string; color: string; imageUrl?: string }
export type MapViewDefinition = {
    map: RailwayMap
    tileSet: TileSet
    stations: Readonly<Record<string, StationAppearance>>
    layouts?: Readonly<Record<string, TileLayout>>
}
export function stationMapTokens(
    state: StationState,
    appearances: MapViewDefinition['stations']
): MapToken[] {
    return state.stations.flatMap((station) => {
        if (station.status !== 'placed') return []
        const appearance = appearances[station.companyId]
        assertExists(appearance, `Missing station appearance: ${station.companyId}`)
        return [{ id: station.id, ...station.position, ...appearance }]
    })
}
