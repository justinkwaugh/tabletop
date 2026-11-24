import { assertExists } from '@tabletop/common'
import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as cityFace,
    createSeparateCitiesTileFace as citiesFace,
    createTownTileFace as townFace,
    sameStopCounts,
    type TileDefinition,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return { id: `1880:${printedNumber}`, printedNumber, aliases: [], scope: '1880', face }
}

export const BeijingLabel = 'B'
export const ShanghaiLabel = 'S'
export const OOLabel = 'OO'

export const TileColorOrder1880: readonly string[] = ['white', 'yellow', 'green', 'brown', 'gray']

const AllEdges = [0, 1, 2, 3, 4, 5] as const

const twoTowns = (first: readonly TileEdge[], second: readonly TileEdge[]): TileFace =>
    townFace('yellow', [first, second], 20)
const greenOO = (first: readonly TileEdge[], second: readonly TileEdge[]): TileFace =>
    citiesFace(
        'green',
        [
            { edges: first, revenue: 40, stationSlots: 1 },
            { edges: second, revenue: 40, stationSlots: 1 }
        ],
        [OOLabel]
    )

/** 1880's own tiles, as the tile manifest prints them (p. 23). */
export const TileCatalog1880 = new TileCatalog([
    titleTile('8850', townFace('yellow', [[0, 5]], 20)),
    titleTile('8851', townFace('yellow', [[0, 4]], 20)),
    titleTile('8852', townFace('yellow', [[0, 3]], 20)),
    titleTile('8854', twoTowns([0, 3], [4, 5])),
    titleTile('8855', twoTowns([0, 3], [2, 5])),
    titleTile('8856', twoTowns([0, 4], [3, 5])),
    titleTile('8857', twoTowns([1, 4], [3, 5])),
    titleTile('8858', twoTowns([0, 2], [3, 5])),
    titleTile('8866', townFace('green', [[1, 2, 3, 5]], 20)),
    titleTile('8871', townFace('brown', [AllEdges], 20)),
    titleTile(
        '235',
        citiesFace(
            'yellow',
            [
                { edges: [0], revenue: 30, stationSlots: 1 },
                { edges: [], revenue: 30, stationSlots: 1 }
            ],
            [OOLabel]
        )
    ),
    titleTile('8860', greenOO([1, 5], [2, 4])),
    titleTile('8861', greenOO([0, 1], [3, 4])),
    titleTile('8862', greenOO([0, 5], [3, 4])),
    titleTile('8863', greenOO([0, 1], [2, 5])),
    titleTile('8864', greenOO([1, 5], [2, 3])),
    titleTile('8865', greenOO([1, 5], [3, 4])),
    titleTile('8872', cityFace('brown', [0, 1, 2, 3], 50, 2, [OOLabel])),
    titleTile('8873', cityFace('brown', [0, 2, 3, 4], 50, 2, [OOLabel])),
    titleTile('8874', cityFace('brown', [0, 2, 3, 5], 50, 2, [OOLabel])),
    titleTile('8875', cityFace('gray', AllEdges, 60, 2, [OOLabel])),
    titleTile('8877', cityFace('yellow', [0, 3], 30, 1, [ShanghaiLabel])),
    titleTile('8878', cityFace('green', [0, 1, 3, 4], 40, 2, [ShanghaiLabel])),
    titleTile('8879', cityFace('brown', [0, 1, 2, 3, 4], 60, 2, [ShanghaiLabel])),
    titleTile('8880', cityFace('gray', [0, 1, 2, 3, 4], 70, 2, [ShanghaiLabel])),
    titleTile(
        '8886',
        citiesFace(
            'green',
            AllEdges.map((edge) => ({ edges: [edge], revenue: 40, stationSlots: 1 })),
            [BeijingLabel]
        )
    ),
    titleTile('8887', cityFace('brown', AllEdges, 60, 6, [BeijingLabel])),
    titleTile('8888', cityFace('gray', AllEdges, 80, 6, [BeijingLabel]))
])

/** The tile manifest's counts (p. 23). */
const StandardCounts: Readonly<Record<string, number>> = {
    '5': 6,
    '6': 6,
    '7': 5,
    '8': 15,
    '9': 15,
    '14': 4,
    '15': 8,
    '16': 2,
    '17': 1,
    '18': 1,
    '19': 2,
    '20': 2,
    '23': 4,
    '24': 4,
    '25': 3,
    '26': 2,
    '27': 2,
    '28': 2,
    '29': 2,
    '30': 1,
    '31': 1,
    '57': 6,
    '63': 6,
    '455': 3,
    '611': 3,
    '619': 4,
    '887': 5,
    '888': 3,
    '895': 3
}
const TitleCounts: Readonly<Record<string, number>> = {
    '235': 5,
    '8850': 5,
    '8851': 6,
    '8852': 6,
    '8854': 2,
    '8855': 2,
    '8856': 2,
    '8857': 2,
    '8858': 2,
    '8860': 1,
    '8861': 1,
    '8862': 1,
    '8863': 1,
    '8864': 1,
    '8865': 1,
    '8866': 3,
    '8871': 3,
    '8872': 2,
    '8873': 2,
    '8874': 2,
    '8875': 1,
    '8877': 1,
    '8878': 1,
    '8879': 1,
    '8880': 1,
    '8886': 1,
    '8887': 1,
    '8888': 1
}

export const TileSet1880 = new TileSet(
    {
        id: '1880:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1880:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1880]
)

const countOf = (face: TileFace, kind: 'city' | 'town') =>
    face.nodes.filter((node) => node.kind === kind).length

/**
 * OO cities and Beijing's cities join into one in brown, keeping their label (p. 23). A medium
 * city reaches here as the kind of stop its first tile chose (``TrackRules1880.removedStops``).
 */
export function preservesStops1880(before: TileFace, after: TileFace): boolean {
    if (
        after.color === 'brown' &&
        (before.labels.includes(OOLabel) || before.labels.includes(BeijingLabel))
    )
        return countOf(after, 'city') === 1 && countOf(after, 'town') === 0
    if (before.labels.includes(BeijingLabel) && after.labels.includes(BeijingLabel))
        return countOf(after, 'town') === 0
    return sameStopCounts(before, after)
}

export function tileFace1880(definitionId: string): TileFace {
    const definition = TileSet1880.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 1880 tile ${definitionId}`)
    return definition.face
}
