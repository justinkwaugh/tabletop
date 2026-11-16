import { assertExists } from '@tabletop/common'
import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    createJunctionTileFace as junctionFace,
    createTownTileFace as townFace,
    type TileDefinition,
    type TileEdge,
    type TileFace,
    type TileSetVariant
} from '@tabletop/18xx'
import { OutOfPlayTileId1822, OverlayPieces1822 } from './overlays.js'
import { Scenarios1822 } from './scenarios.js'
import {
    EnglishChannelUpgradeCost1822,
    LondonUpgradeCost1822,
    englishChannelFace,
    londonFace
} from './faces.js'

export const TileColorOrder1822: readonly string[] = ['white', 'yellow', 'green', 'brown', 'gray']

function tile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1822:${printedNumber}`, printedNumber, aliases: [], scope: '1822', face }
}

const FiveWay: readonly TileEdge[] = [0, 1, 2, 3, 4]
const SixWay: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]
// The track of the labelled cities' own tiles (§5.8.2).
const CardiffExits: readonly TileEdge[] = [1, 2, 4]
const SwanseaExits: readonly TileEdge[] = [1, 4]
const TerminalCityExits: readonly TileEdge[] = [0, 1, 5]

// The tiles the family's standard catalogue lacks: the labelled large cities (B-M, Y, S, C, T
// and EC, §5.8.2), the grey tiles, and the London upgrades, which the board shows with a token on
// the London roundel instead of a tile (§5.10.1).
export const TileCatalog1822 = new TileCatalog([
    tile('X20', londonFace('yellow', 40, LondonUpgradeCost1822)),
    tile('207', cityFace('green', [0, 1, 2, 3], 40, 2, ['Y'])),
    tile('208', cityFace('green', [0, 1, 3, 4], 40, 2, ['Y'])),
    tile('622', cityFace('green', [0, 2, 3, 4], 40, 2, ['Y'])),
    tile('405', cityFace('green', TerminalCityExits, 40, 2, ['T'])),
    tile('X1', cityFace('green', CardiffExits, 30, 3, ['C'])),
    tile('X2', cityFace('green', FiveWay, 50, 3, ['BM'])),
    tile('X3', cityFace('green', SwanseaExits, 30, 2, ['S'])),
    tile('X4', englishChannelFace('green', 1, [2, 3, 5], EnglishChannelUpgradeCost1822)),
    tile('X21', londonFace('green', 60, LondonUpgradeCost1822)),
    tile('768', townFace('brown', [[0, 2, 3, 5]], 10)),
    tile('X5', cityFace('brown', FiveWay, 50, 3, ['Y'])),
    tile('X6', cityFace('brown', CardiffExits, 40, 3, ['C'])),
    tile('X7', cityFace('brown', SixWay, 60, 4, ['BM'])),
    tile('X8', cityFace('brown', SwanseaExits, 40, 2, ['S'])),
    tile('X9', englishChannelFace('brown', 2, [2, 3, [5, 2]], EnglishChannelUpgradeCost1822)),
    tile('X10', cityFace('brown', TerminalCityExits, 50, 2, ['T'])),
    tile('X22', londonFace('brown', 80, LondonUpgradeCost1822)),
    tile('60', junctionFace('gray', SixWay)),
    tile('169', junctionFace('gray', FiveWay)),
    tile('X11', cityFace('gray', FiveWay, 60, 3, ['Y'])),
    tile('X12', cityFace('gray', CardiffExits, 60, 3, ['C'])),
    tile('X13', cityFace('gray', SixWay, 80, 4, ['BM'])),
    tile('X14', cityFace('gray', SwanseaExits, 60, 3, ['S'])),
    tile('X15', englishChannelFace('gray', 3, [2, 3, [5, 2]])),
    tile('X16', cityFace('gray', TerminalCityExits, 60, 3, ['T'])),
    tile('X17', townFace('gray', [SixWay], 10)),
    tile('X18', cityFace('gray', FiveWay, 50, 3)),
    tile('X19', cityFace('gray', SixWay, 50, 3)),
    tile('X23', londonFace('gray', 100)),
    ...OverlayPieces1822.map((piece) => piece.tile)
])

type Count = number | 'unlimited'

// The tile manifest (rules p. 36). Plain yellow track is not meant to limit play (§5.8.15).
const StandardCounts: Readonly<Record<string, Count>> = {
    '1': 1,
    '2': 1,
    '3': 6,
    '4': 6,
    '5': 6,
    '6': 8,
    '7': 'unlimited',
    '8': 'unlimited',
    '9': 'unlimited',
    '55': 1,
    '56': 1,
    '57': 6,
    '58': 6,
    '69': 1,
    '14': 6,
    '15': 6,
    '80': 6,
    '81': 6,
    '82': 8,
    '83': 8,
    '141': 4,
    '142': 4,
    '143': 4,
    '144': 4,
    '619': 6,
    '63': 8,
    '544': 6,
    '545': 6,
    '546': 8,
    '611': 4,
    '767': 4,
    '769': 6
}

const TitleCounts: Readonly<Record<string, Count>> = {
    X20: 1,
    '207': 2,
    '208': 1,
    '622': 1,
    '405': 3,
    X1: 1,
    X2: 2,
    X3: 1,
    X4: 1,
    X21: 1,
    '768': 4,
    X5: 3,
    X6: 1,
    X7: 2,
    X8: 1,
    X9: 1,
    X10: 3,
    X22: 1,
    '60': 2,
    '169': 2,
    X11: 2,
    X12: 1,
    X13: 2,
    X14: 1,
    X15: 1,
    X16: 2,
    X17: 2,
    X18: 2,
    X19: 4,
    X23: 1
}

// A scenario prints its overlays on the board, covers the hexes it takes out of play, and
// plays without some of the supply (§6.2.1, Tile Manifest sheet).
const ScenarioTileVariants: Readonly<Record<string, TileSetVariant>> = Object.fromEntries(
    Scenarios1822.filter(
        (scenario) => scenario.overlays.length || Object.keys(scenario.tilesRemoved).length
    ).map((scenario) => [
        scenario.id,
        {
            board: scenario.overlays
                .flatMap((overlay) => [
                    ...overlay.stations,
                    ...overlay.approaches,
                    ...overlay.outOfPlay.map((locationId) => ({
                        locationId,
                        definitionId: OutOfPlayTileId1822
                    }))
                ])
                .map((tile) => ({ ...tile, rotation: 0 as const })),
            removed: scenario.tilesRemoved
        }
    ])
)
/** The scenarios that change the board or the supply, each a variant of the tile set. */
export const TileSet1822Variants: readonly string[] = Object.keys(ScenarioTileVariants)

export const TileSet1822 = new TileSet(
    {
        id: '1822:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1822:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1822],
    ScenarioTileVariants
)
export const Tiles1822 = TileSet1822.definitions

export function tileDefinition1822(definitionId: string): TileDefinition {
    const definition = Tiles1822.find((tile) => tile.id === definitionId)
    assertExists(definition, `Tile ${definitionId} is in the 1822 set`)
    return definition
}

/** The London upgrades in order, each replacing the one before (§5.10.1). */
export const LondonTileIds1822: readonly string[] = ['X20', 'X21', 'X22', 'X23'].map(
    (number) => `1822:${number}`
)
/** The English Channel's tiles in order (§5.9.1). */
export const EnglishChannelTileIds1822: readonly string[] = ['X4', 'X9', 'X15'].map(
    (number) => `1822:${number}`
)
