import { assertExists } from '@tabletop/common'
import type { StationState, RailwayMap, TileSet } from '@tabletop/18xx'
import type { BoardArtwork, MapToken } from './mapDrawing.js'
import type { TileLayout } from '../tiles/tileDrawing.js'

export type StationAppearance = { label: string; color: string; imageUrl?: string }
export type MapViewDefinition = {
    boardArtwork?: BoardArtwork
    map: RailwayMap
    tileSet: TileSet
    stations: Readonly<Record<string, StationAppearance>>
    /**
     * Token artwork for the published presentation. Entries override ``stations`` while the
     * published artwork toggle is on; companies without an entry keep their generic appearance.
     */
    publishedStations?: Readonly<Record<string, StationAppearance>>
    revenueStageColors?: Readonly<Record<string, string>>
    markerImages?: Readonly<Record<string, string>>
    layouts?: Readonly<Record<string, TileLayout>>
    /**
     * Layout overrides that only apply in the published presentation, keyed like ``layouts``.
     * Used to move station slots onto the printed city circles of the board artwork.
     */
    publishedLayouts?: Readonly<Record<string, TileLayout>>
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
