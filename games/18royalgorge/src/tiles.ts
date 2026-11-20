import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as city,
    createTownTileFace as town,
    sameStopCounts,
    withTiles,
    type TileDefinition,
    type TileFace,
    type TileInventory
} from '@tabletop/18xx'
import {
    GorgeEastId,
    GorgeTownId,
    GorgeWestId,
    MapRoyalGorge,
    SalidaLabel,
    SulphurSpringsLabel
} from './map.js'

const tileId = (printedNumber: string) => `18royalgorge:${printedNumber}`

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return {
        id: tileId(printedNumber),
        printedNumber,
        aliases: [],
        scope: '18royalgorge',
        face
    }
}

/** Florence's and Fountain's city as their railroad's home, before any tile (Rule 1). */
export const HomeCityTileId = tileId('HC')
/** Florence's home city, which keeps the hex's river cost for its first tile. */
export const RiverHomeCityTileId = tileId('HCR')

/**
 * Sulphur Springs's city tiles, one of each colour: its private turns the town into the one of
 * its tile's colour, which then upgrades to the next like any city (TR-5, B2).
 */
export const SulphurSpringsTileIds: Readonly<Record<string, string>> = {
    yellow: tileId('R1'),
    green: tileId('R2'),
    brown: tileId('R3')
}

/** The gorge's tiles, the green laid by the Treaty of Boston, the brown as one upgrade (RG-1). */
export const GreenGorgeTileIds: Readonly<Record<string, string>> = {
    [GorgeWestId]: tileId('GA'),
    [GorgeTownId]: tileId('GB'),
    [GorgeEastId]: tileId('GC')
}
export const BrownGorgeTileIds: Readonly<Record<string, string>> = {
    [GorgeWestId]: tileId('GD'),
    [GorgeTownId]: tileId('GE'),
    [GorgeEastId]: tileId('GF')
}

/** Salida's two-space green S tile, which only its two-space brown tile may replace. */
export const SalidaTwoSpaceGreenId = tileId('S3')
export const SalidaOneSpaceBrownId = tileId('S4')

const salida = (
    color: string,
    revenue: number,
    slots: number,
    edges: readonly (0 | 1 | 2 | 3 | 4 | 5)[]
) => city(color, edges, revenue, slots, [SalidaLabel])
const sulphur = (color: string, revenue: number, slots: number) =>
    city(color, [0, 1, 5], revenue, slots, [SulphurSpringsLabel])

const TitleTiles: readonly TileDefinition[] = [
    titleTile('HC', city('white', [], 0, 1)),
    titleTile('HCR', { ...city('white', [], 0, 1), upgradeCost: 20 }),
    titleTile('R1', sulphur('yellow', 30, 1)),
    titleTile('R2', sulphur('green', 40, 1)),
    titleTile('R3', sulphur('brown', 60, 2)),
    titleTile('S1', salida('yellow', 30, 1, [3, 5])),
    titleTile('S2', salida('green', 40, 1, [2, 3, 5])),
    titleTile('S3', salida('green', 40, 2, [2, 3, 5])),
    titleTile('S4', salida('brown', 50, 1, [2, 3, 5])),
    titleTile('S5', salida('brown', 60, 2, [2, 3, 5])),
    titleTile('GA', city('green', [2, 5], 30, 1)),
    titleTile('GB', town('green', [[2, 4]], 40)),
    titleTile('GC', city('green', [1, 4], 60, 1)),
    titleTile('GD', city('brown', [2, 5], 40, 1)),
    titleTile('GE', town('brown', [[2, 4]], 60)),
    titleTile('GF', city('brown', [1, 4], 80, 1))
]

export const TileCatalogRoyalGorge = new TileCatalog(TitleTiles)

/**
 * The rulebook's tile manifest, with the 57, 58, 19, 20 and 144 its upgrade chart shows but the
 * manifest omits (Components; OQ-17).
 */
const StandardCounts: Readonly<Record<string, number>> = {
    '3': 5,
    '4': 5,
    '5': 3,
    '6': 4,
    '7': 4,
    '8': 12,
    '9': 12,
    '57': 5,
    '58': 5,
    '14': 5,
    '15': 5,
    '16': 1,
    '19': 1,
    '20': 1,
    '23': 2,
    '24': 2,
    '25': 2,
    '26': 2,
    '27': 2,
    '28': 1,
    '29': 1,
    '30': 1,
    '31': 1,
    '39': 2,
    '40': 1,
    '41': 1,
    '42': 1,
    '43': 1,
    '44': 1,
    '45': 1,
    '46': 1,
    '47': 1,
    '63': 2,
    '87': 2,
    '88': 2,
    '143': 2,
    '144': 2,
    '204': 1,
    '911': 3,
    '171': 1
}

export const TileSetRoyalGorge = new TileSet(
    {
        id: '18royalgorge:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            // One of each of the title's own tiles.
            ...TitleTiles.map((tile) => ({
                id: tile.printedNumber,
                faceDefinitionIds: [tile.id],
                count: 1
            }))
        ]
    },
    [StandardTileCatalog, TileCatalogRoyalGorge]
)

/**
 * Upgrades keep their stops, but for Sulphur Springs's town becoming a city of the same colour
 * by its private (B2).
 */
export function preservesStopsRoyalGorge(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (after.labels.includes(SulphurSpringsLabel) && before.color === after.color)
    )
}

export function tileFaceRoyalGorge(definitionId: string): TileFace {
    const definition = TileSetRoyalGorge.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 18RoyalGorge tile ${definitionId}`)
    return definition.face
}

/** The tiles only an event or a private lays, never an ordinary lay. */
export const SpecialTileIds: readonly string[] = [
    HomeCityTileId,
    RiverHomeCityTileId,
    ...Object.values(GreenGorgeTileIds)
]

/** The board as the game's tiles leave it. */
export function mapStateRoyalGorge(state: { tileInventory: TileInventory }): RailwayMapState {
    return new RailwayMapState(MapRoyalGorge, TileSetRoyalGorge, state.tileInventory)
}

/** The inventory with a colour's gorge tiles laid on the gorge's three hexes. */
export function withGorgeTiles(
    inventory: TileInventory,
    tileIds: Readonly<Record<string, string>>
): TileInventory {
    return withTiles(
        TileSetRoyalGorge,
        inventory,
        Object.entries(tileIds).map(([locationId, definitionId]) => ({
            locationId,
            definitionId,
            rotation: 0
        }))
    )
}
