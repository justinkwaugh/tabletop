import { assertExists } from '@tabletop/common'
import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'

/** Baltimore's and Boston's own city tiles (§14.2). */
export const BaltimoreLabel = 'Ba'
export const BostonLabel = 'Bo'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1828:${printedNumber}`, printedNumber, aliases: [], scope: '1828', face }
}

/**
 * The tiles 1828 prints its own way: Baltimore's single-space 53 and 61, Boston's two-space 121
 * and 997, and brown city 449.
 */
export const TileCatalog1828 = new TileCatalog([
    titleTile('53', cityFace('green', [0, 2, 4], 50, 1, [BaltimoreLabel])),
    titleTile('61', cityFace('brown', [0, 2, 3, 4], 60, 1, [BaltimoreLabel])),
    titleTile('121', cityFace('green', [0, 2, 4], 50, 2, [BostonLabel])),
    titleTile('997', cityFace('brown', [1, 2, 3, 5], 60, 2, [BostonLabel])),
    titleTile('449', cityFace('brown', [0, 1, 3, 4], 40, 2))
])

/** The designer's tile manifest (`track_tiles.csv` of the published game files). */
const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 3,
    '4': 3,
    '7': 6,
    '8': 15,
    '9': 12,
    '14': 6,
    '15': 4,
    '16': 1,
    '17': 1,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 4,
    '24': 4,
    '25': 3,
    '26': 2,
    '27': 2,
    '28': 2,
    '29': 2,
    '30': 2,
    '31': 2,
    '39': 2,
    '40': 2,
    '41': 2,
    '42': 2,
    '43': 2,
    '44': 2,
    '45': 2,
    '46': 2,
    '47': 2,
    '54': 1,
    '55': 1,
    '56': 1,
    '57': 8,
    '58': 3,
    '59': 3,
    '62': 1,
    '63': 3,
    '64': 1,
    '65': 1,
    '66': 1,
    '67': 1,
    '68': 1,
    '69': 1,
    '70': 2,
    '205': 1,
    '206': 1,
    '448': 2
}

const TitleCounts: Readonly<Record<string, number>> = {
    '53': 1,
    '61': 1,
    '121': 1,
    '997': 1,
    '449': 2
}

export const TileSet1828 = new TileSet(
    {
        id: '1828:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1828:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1828]
)

/** The only tile the Virginia Coalfields Tunnel takes (§14.3.1.2). */
export const TunnelTileId = '18xx:4'

export function tileFace1828(definitionId: string): TileFace {
    const definition = TileSet1828.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 1828 tile ${definitionId}`)
    return definition.face
}
