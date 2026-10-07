import { assertExists, type BoundingBox, type HexOrientation, type Point } from '@tabletop/common'
import type { StationState, RailwayMap, TileEdge, TileFace, TileSet } from '@tabletop/18xx'
import type { BoardArtwork, MapMarkerArt, MapPlacement, MapToken } from './mapDrawing.js'
import type { TileDrawing, TileDrawingStyle, TileLayout } from '../tiles/tileDrawing.js'
import type { TileAppearance } from '../tiles/tileAppearance.js'

/** Tiles drawn side by side in place of a round token, at the token's height. */
export type TokenTiles = {
    orientation: HexOrientation
    appearance: TileAppearance
    tiles: readonly { face: TileFace; drawing: TileDrawing }[]
}
export type StationAppearance = {
    label: string
    color: string
    /** A plain disc of the colour, such as the blocked home of a company not in the game. */
    solid?: true
    imageUrl?: string
    tiles?: TokenTiles
}
/** A symbol row's centre, or each symbol's own centre. */
export type SymbolPosition = Point | readonly Point[]
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
    /** Printed prefixes for revenue stages that are not phases, such as D for diesel. */
    revenueStageLabels?: Readonly<Record<string, string>>
    /** Printed before terrain costs, such as ¥. */
    terrainCostPrefix?: string
    /** Baseline of a location's name, by location id; names otherwise print across the top. */
    namePositions?: Readonly<Record<string, Point>>
    /** Explicit lines for a location's name, by location id; long names otherwise split in two. */
    nameLines?: Readonly<Record<string, readonly string[]>>
    /**
     * Where a location's revenue-sized symbols go, by location id, in place of clear space: the
     * centre of their row, or each symbol's own centre.
     */
    symbolPositions?: Readonly<
        Record<string, SymbolPosition | Readonly<Record<string, SymbolPosition>>>
    >
    /** Locations whose curved city name runs under the city, reading along its foot. */
    namesBelow?: readonly string[]
    /** Height of a location's terrain cost row, by location id, where it is not placed below the stops. */
    terrainHeights?: Readonly<Record<string, number>>
    markerArt?: Readonly<Record<string, MapMarkerArt>>
    /** Names for the kinds of marker private powers place during play, such as mines. */
    locationMarkerNames?: Readonly<Record<string, string>>
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
    joinedEdges?: Readonly<Record<string, readonly TileEdge[]>>
    /** Measurements of the tile style in use, which space cities and place annotations. */
    drawingStyle?: TileDrawingStyle
    /**
     * Leaves location names off the drawn map, or only the listed locations'; they still name
     * hexes in labels and text.
     */
    hideLocationNames?: true | readonly string[]
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
