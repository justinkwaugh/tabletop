import { assertExists } from '@tabletop/common'
import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    createSeparateCitiesTileFace as citiesFace,
    sameStopCounts,
    type TileDefinition,
    type TileFace
} from '@tabletop/18xx'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1882:${printedNumber}`, printedNumber, aliases: [], scope: '1882', face }
}

export const ReginaLabel = 'R'

/** Regina's own tiles: two cities in green, joined into one in brown (§17). */
export const TileCatalog1882 = new TileCatalog([
    titleTile(
        'R1',
        citiesFace(
            'green',
            [
                { edges: [0, 1], revenue: 60, stationSlots: 1 },
                { edges: [2, 3], revenue: 60, stationSlots: 1 }
            ],
            [ReginaLabel]
        )
    ),
    titleTile('R2', cityFace('brown', [0, 1, 2, 3], 70, 2, [ReginaLabel]))
])

/** The tile chart's counts (§17). */
const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 1,
    '4': 1,
    '7': 5,
    '8': 10,
    '9': 10,
    '14': 3,
    '15': 2,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 3,
    '24': 3,
    '26': 1,
    '27': 1,
    '41': 2,
    '42': 2,
    '43': 2,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 1,
    '55': 1,
    '56': 1,
    '57': 4,
    '58': 1,
    '59': 1,
    '63': 3,
    '66': 1,
    '67': 1,
    '68': 1,
    '69': 1
}

export const TileSet1882 = new TileSet(
    {
        id: '1882:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            { id: 'R1', faceDefinitionIds: ['1882:R1'], count: 1 },
            { id: 'R2', faceDefinitionIds: ['1882:R2'], count: 1 }
        ]
    },
    [StandardTileCatalog, TileCatalog1882]
)

/** Regina's two cities join into one in brown; every other upgrade keeps its stops. */
export function preservesStops1882(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (after.color === 'brown' &&
            before.labels.includes(ReginaLabel) &&
            after.labels.includes(ReginaLabel))
    )
}

export function tileFace1882(definitionId: string): TileFace {
    const definition = TileSet1882.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 1882 tile ${definitionId}`)
    return definition.face
}
