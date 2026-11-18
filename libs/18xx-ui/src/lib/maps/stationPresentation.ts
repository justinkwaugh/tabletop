import type { TerrainIconName } from './terrainIcons.js'
import type { MapBonusArrow } from './bonusArrows.js'
import { assertExists, type BoundingBox, type HexOrientation, type Point } from '@tabletop/common'
import type { Company, StationState, RailwayMap, TileEdge, TileFace, TileSet } from '@tabletop/18xx'
import type {
    BoardArtwork,
    MapMarkerArt,
    MapPlacement,
    MapToken,
    PrintedLine
} from './mapDrawing.js'
import type { TileDrawing, TileDrawingStyle, TileLayout } from '../tiles/tileDrawing.js'
import type { TileAppearance } from '../tiles/tileAppearance.js'
import type { RevenueStageColors } from '../colors/revenueStageColors.js'

/** Marker art by location id, then marker id. */
export type LocationMarkerArt = Readonly<Record<string, Readonly<Record<string, MapMarkerArt>>>>

/** Offboard names print in the tile label face, which ships with the app, at their own size. */
export type OffboardNameStyle = {
    fontSize: number
    color: string
    /** Extra space between words, in ems, where the label face's narrow space runs them together. */
    wordSpacing?: number
}

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
export type BoardAreas = {
    market?: BoundingBox
    depot?: BoundingBox
    /** Where the title's own board panel stands, such as 1862's charter board. */
    panel?: BoundingBox
}

/** A tile that stands on the map from setup; see ``MapViewDefinition.boardTiles``. */
export type BoardTile = { name?: string; outOfPlay?: true }

export type MapViewDefinition = {
    boardArtwork?: BoardArtwork
    /** Board arrows printed beside the map, such as route bonus arrows. */
    bonusArrows?: readonly MapBonusArrow[]
    /** Empty map regions, in map units, where the board view draws table panels. */
    boardAreas?: BoardAreas
    /** Lines the board prints on untiled hexes, such as a river, by location id. */
    printedLines?: Readonly<Record<string, readonly PrintedLine[]>>
    map: RailwayMap
    tileSet: TileSet
    stations: Readonly<Record<string, StationAppearance>>
    /**
     * Token artwork for the published presentation. Entries override ``stations`` while the
     * published artwork toggle is on; companies without an entry keep their generic appearance.
     */
    publishedStations?: Readonly<Record<string, StationAppearance>>
    /**
     * How a station that another company shares through station access prints, by the access's
     * source, such as one token two corporations hold jointly.
     */
    sharedStations?: Readonly<Record<string, StationAppearance>>
    /** How a neutral station prints, such as 1882's white markers that keep a city open. */
    neutralStation?: StationAppearance
    /**
     * How a closed company's stations still on the map print, such as 1828's blocking stations;
     * a closed company's token elsewhere keeps its own look.
     */
    closedCompanyStation?: StationAppearance
    /**
     * Station spaces the board prints held beyond its homes, by company or by a shared station's
     * source, shown until a token stands there, such as a joint token's city.
     */
    printedReservations?: readonly { locationId: string; nodeId: string; companyId: string }[]
    revenueStageColors?: RevenueStageColors
    /** Printed prefixes for revenue stages that are not phases, such as D for diesel. */
    revenueStageLabels?: Readonly<Record<string, string>>
    /** Phases printed beside each revenue stage's value, such as I-II. */
    revenueStageCaptions?: Readonly<Record<string, string>>
    revenueStageCaptionColors?: Readonly<Record<string, string>>
    /** How staged values line up where a location's layout does not say. */
    revenueStack?: 'column' | 'row'
    /** Printed before terrain costs, such as ¥. */
    terrainCostPrefix?: string
    /**
     * The icon each terrain kind draws, as 1849 draws its three mountain sizes with one, two and
     * three peaks; a mountain draws two peaks unless given.
     */
    terrainIcons?: Readonly<Record<string, TerrainIconName>>
    /** Baseline of a location's name, by location id; names otherwise print across the top. */
    namePositions?: Readonly<Record<string, Point>>
    /** How far a location's name stands from the top of its hex, in its usual type, by location id. */
    nameOffsets?: Readonly<Record<string, Point>>
    /**
     * Each city's own name, by location id then city node id, curved over that city in place of
     * the location's name where the style curves names.
     */
    cityNames?: Readonly<Record<string, Readonly<Record<string, string>>>>
    /** Explicit lines for a location's name, by location id; long names otherwise split in two. */
    nameLines?: Readonly<Record<string, readonly string[]>>
    /** Offboards' and red towns' names in their own larger type, as a board printing them for its connections. */
    offboardNames?: OffboardNameStyle
    /** A location's name in its own type, by location id, such as a board's largest destination. */
    nameStyles?: Readonly<Record<string, OffboardNameStyle>>
    /**
     * Where a location's revenue-sized symbols go on its printed hex, by location id, in place of
     * clear space: the centre of their row, or each symbol's own centre. A laid tile keeps them
     * only where they stay clear of its stops and revenues.
     */
    symbolPositions?: Readonly<
        Record<string, SymbolPosition | Readonly<Record<string, SymbolPosition>>>
    >
    /** Locations whose curved city name runs under the city, reading along its foot. */
    namesBelow?: readonly string[]
    /**
     * Degrees clockwise to turn a hex's curved name from centred on its city, by location id, in
     * place of the least turn that clears its track.
     */
    nameTurns?: Readonly<Record<string, number>>
    /** Centre of a location's terrain cost row, by location id, where it is not placed below the stops. */
    terrainPositions?: Readonly<Record<string, Point>>
    /** Locations whose terrain cost stands under its symbols, where a row has no room beside track. */
    terrainCostsBelow?: readonly string[]
    /** Locations whose terrain symbols stand under the cost, where the row is too wide. */
    terrainSymbolsBelow?: readonly string[]
    /**
     * Whether a hex's terrain cost stays printed on the tiles laid over it, as where the cost is
     * paid again on every upgrade; each tile shows it in its own clear space.
     */
    terrainKeptOnTiles?: boolean
    markerArt?: Readonly<Record<string, MapMarkerArt>>
    /** Art for one location's markers, by location id then marker id, over ``markerArt``. */
    locationMarkerArt?: LocationMarkerArt
    /** Names for the kinds of marker private powers place during play, such as mines. */
    locationMarkerNames?: Readonly<Record<string, string>>
    /**
     * Markers the game state implies rather than a power places, such as a city closed to
     * upgrades for a time; each kind is named in ``locationMarkerNames``.
     */
    stateMarkers?: (state: object) => readonly StateMarker[]
    layouts?: Readonly<Record<string, TileLayout>>
    /**
     * How a one-space city draws while it holds two stations, by tile id, or hex id for a
     * printed hex, then node id: as a two-space city, in this layout over the tile's own.
     */
    sharedCityLayouts?: Readonly<Record<string, Readonly<Record<string, TileLayout>>>>
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
    /**
     * Sides along which a laid tile joins the tile beside it as one printed area, by tile
     * definition id, as a scenario overlay that spans two hexes.
     */
    joinedTileEdges?: Readonly<Record<string, readonly TileEdge[]>>
    /**
     * Locations drawn after all the others, so that what they print across a side, such as a
     * station or values standing over the hex beside them, stays above that hex.
     */
    drawnLast?: readonly string[]
    /**
     * Hexes printed as two areas, by location id: the edges on one area's side. A line divides
     * that side from the rest, and joined edges join only the side they leave by.
     */
    splitHexes?: Readonly<Record<string, readonly TileEdge[]>>
    /** Measurements of the tile style in use, which space cities and place annotations. */
    drawingStyle?: TileDrawingStyle
    /**
     * Leaves location names off the drawn map, or only the listed locations'; they still name
     * hexes in labels and text.
     */
    hideLocationNames?: true | readonly string[]
    /**
     * Tiles that are part of the board in some games rather than of the supply companies lay
     * from, by tile definition, as 1822's scenario overlays. The tile manifest leaves them out.
     * One with a name shows it in place of its hex's. One marked out of play draws nothing, and
     * the board is fitted to the hexes without one.
     */
    boardTiles?: Readonly<Record<string, BoardTile>>
    /** Hexside border widths by kind, over the default of 5 for impassable sides and 3 for others. */
    borderWidths?: Readonly<Record<string, number>>
    /** A hex whose tile prints a label, such as Pr, shows the label in place of its name. */
    labelsReplaceNames?: true
}
/** The view with art that changes with play laid over its own location marker art. */
export function withPlayedMarkerArt(
    view: MapViewDefinition,
    played: LocationMarkerArt
): MapViewDefinition {
    if (!Object.keys(played).length) return view
    const locationIds = new Set([
        ...Object.keys(view.locationMarkerArt ?? {}),
        ...Object.keys(played)
    ])
    return {
        ...view,
        locationMarkerArt: Object.fromEntries(
            [...locationIds].map((locationId) => [
                locationId,
                { ...view.locationMarkerArt?.[locationId], ...played[locationId] }
            ])
        )
    }
}

/** How a map view prints stations: by company, shared, and neutral. */
export type StationViews = Pick<
    MapViewDefinition,
    'stations' | 'sharedStations' | 'neutralStation' | 'closedCompanyStation'
>

/** The placed stations as map tokens; the companies say which are closed. */
export function stationMapTokens(
    state: StationState & { companies?: readonly Pick<Company, 'id' | 'closed'>[] },
    {
        stations: appearances,
        sharedStations: shared = {},
        neutralStation,
        closedCompanyStation
    }: StationViews
): MapToken[] {
    return state.stations.flatMap((station) => {
        if (station.status !== 'placed') return []
        const access = (state.stationAccess ?? []).find(
            (entry) =>
                entry.locationId === station.position.locationId &&
                entry.nodeId === station.position.nodeId &&
                shared[entry.sourceId]
        )
        const neutral =
            neutralStation && state.neutralStations?.some((entry) => entry.stationId === station.id)
                ? neutralStation
                : undefined
        const closed =
            closedCompanyStation &&
            state.companies?.some((company) => company.id === station.companyId && company.closed)
                ? closedCompanyStation
                : undefined
        const appearance =
            neutral ??
            closed ??
            (access && shared[access.sourceId]) ??
            appearances[station.companyId]
        assertExists(appearance, `Missing station appearance: ${station.companyId}`)
        return [{ id: station.id, ...station.position, ...appearance }]
    })
}

/** A marker the game state implies at a location, of a kind the map view names. */
export type StateMarker = { locationId: string; kind: string }

/** The markers a map draws: those placed in play, then those the state implies. */
export function withStateMarkers<Marker>(
    placed: readonly Marker[] | undefined,
    implied: readonly StateMarker[]
): readonly (Marker | StateMarker)[] | undefined {
    return implied.length ? [...(placed ?? []), ...implied] : placed
}
