import { assertExists } from '@tabletop/common'
import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    createSeparateCitiesTileFace as citiesFace,
    sameStopCounts,
    type TileDefinition,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

export const DcLabel = 'DC'
export const OoLabel = 'OO'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return {
        id: `18chesapeake:${printedNumber}`,
        printedNumber,
        aliases: [],
        scope: '18chesapeake',
        face
    }
}

/** Two cities on one tile, each joining a pair of sides. */
const twoCities = (
    color: string,
    revenue: number,
    first: readonly TileEdge[],
    second: readonly TileEdge[]
): TileFace =>
    citiesFace(
        color,
        [
            { edges: first, revenue, stationSlots: 1 },
            { edges: second, revenue, stationSlots: 1 }
        ],
        [OoLabel]
    )

/** Washington's DC tiles and the OO tiles of Baltimore and Philadelphia, from the tile chart. */
export const TileCatalogChesapeake = new TileCatalog([
    titleTile('X1', cityFace('yellow', [0, 4], 30, 1, [DcLabel])),
    titleTile('X2', cityFace('green', [0, 1, 2, 4, 5], 40, 2, [DcLabel])),
    titleTile('X3', twoCities('green', 40, [0, 2], [3, 5])),
    titleTile('X4', twoCities('green', 40, [0, 1], [2, 3])),
    titleTile('X5', twoCities('green', 40, [3, 5], [0, 4])),
    titleTile('X6', cityFace('brown', [0, 1, 2, 3, 4, 5], 70, 3, [DcLabel])),
    titleTile('X7', cityFace('brown', [0, 1, 2, 4, 5], 50, 2, [OoLabel])),
    titleTile('X8', cityFace('gray', [0, 1, 2, 3, 4, 5], 100, 4, [DcLabel])),
    titleTile('X9', cityFace('gray', [0, 1, 2, 4, 5], 70, 3, [OoLabel]))
])

/** The tile chart's counts; tiles 7, 8 and 9 are unlimited. */
const StandardCounts: Readonly<Record<string, number | 'unlimited'>> = {
    '1': 1,
    '2': 1,
    '3': 2,
    '4': 2,
    '7': 'unlimited',
    '8': 'unlimited',
    '9': 'unlimited',
    '14': 5,
    '15': 6,
    '16': 1,
    '19': 1,
    '20': 1,
    '23': 3,
    '24': 3,
    '25': 2,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '39': 1,
    '40': 1,
    '41': 1,
    '42': 1,
    '43': 2,
    '44': 1,
    '45': 1,
    '46': 1,
    '47': 2,
    '55': 1,
    '56': 1,
    '57': 7,
    '58': 2,
    '69': 1,
    '70': 1,
    '611': 5,
    '915': 1
}

const TitleCounts: Readonly<Record<string, number>> = {
    X1: 1,
    X2: 1,
    X3: 1,
    X4: 1,
    X5: 1,
    X6: 1,
    X7: 2,
    X8: 1,
    X9: 1
}

export const TileSetChesapeake = new TileSet(
    {
        id: '18chesapeake:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18chesapeake:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalogChesapeake]
)

/** The OO cities join into one in brown; every other upgrade keeps its stops. */
export function preservesStopsChesapeake(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (after.color === 'brown' &&
            before.labels.includes(OoLabel) &&
            after.labels.includes(OoLabel))
    )
}

export function tileFaceChesapeake(definitionId: string): TileFace {
    const definition = TileSetChesapeake.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 18Chesapeake tile ${definitionId}`)
    return definition.face
}
