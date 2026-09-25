import { assertExists, type BoundingBox } from '@tabletop/common'
import type { StationState, RailwayMap, TileSet } from '@tabletop/18xx'
import type { BoardArtwork, MapPlacement, MapToken } from './mapDrawing.js'
import type { TileLayout } from '../tiles/tileDrawing.js'
import type { TileAppearance } from '../tiles/tileAppearance.js'

export type StationAppearance = { label: string; color: string; imageUrl?: string }
export type BoardAreas = { market?: BoundingBox; depot?: BoundingBox }

export type MapViewDefinition = {
    boardArtwork?: BoardArtwork
    /** Empty map regions, in map units, where the board view draws table panels. */
    boardAreas?: BoardAreas
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
    /** Tile rendering style used while the published artwork toggle is on. */
    publishedTileAppearance?: TileAppearance
    /**
     * Untiled hexes drawn at a different cell or with different connections from the semantic
     * map, keyed by location id; applied in both presentations. The session adds
     * ``publishedPlacements`` while the published artwork toggle is on.
     */
    placements?: Readonly<Record<string, MapPlacement>>
    /**
     * Further untiled-hex placements for the printed board, keyed by location id; applied only
     * while the published artwork toggle is on.
     */
    publishedPlacements?: Readonly<Record<string, MapPlacement>>
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
