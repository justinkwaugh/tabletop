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

export const OoLabel = 'OO'
export const TorontoLabel = 'T'
export const BarrieLondonLabel = 'B-L'
export const LondonLabel = 'Lon'
export const BarrieLabel = 'Bar'
export const HamiltonLabel = 'H'
/** The label of the hexes taking brown #125 in place of #63 (Lay or Upgrade Track). */
export const LLabel = 'L'

function titleTile(printedNumber: string, face: TileFace): TileDefinition {
    return {
        id: `1856:${printedNumber}`,
        printedNumber,
        aliases: [],
        scope: '1856',
        face
    }
}

const torontoCities = (color: string, revenue: number, stationSlots: number): TileFace =>
    citiesFace(
        color,
        [
            { edges: [0, 1], revenue, stationSlots },
            { edges: [2, 3], revenue, stationSlots }
        ],
        [TorontoLabel]
    )

/** Toronto's, London and Barrie's, Hamilton's and the L hexes' tiles, from the tile list. */
export const TileCatalog1856 = new TileCatalog([
    titleTile('120', torontoCities('green', 60, 1)),
    titleTile('121', cityFace('green', [0, 2, 4], 50, 2, [BarrieLondonLabel])),
    titleTile('122', torontoCities('brown', 80, 2)),
    titleTile('123', cityFace('gray', [0, 1, 2, 3, 4], 60, 3, [HamiltonLabel])),
    titleTile('124', cityFace('gray', [0, 1, 2, 3], 100, 4, [TorontoLabel])),
    titleTile('125', cityFace('brown', [0, 1, 2, 3, 4], 40, 2, [LLabel])),
    titleTile('126', cityFace('brown', [0, 1, 2, 3, 4, 5], 60, 2, [LondonLabel])),
    titleTile('127', cityFace('brown', [0, 1, 2, 3, 4], 60, 2, [BarrieLabel]))
])

/** The tile list's counts (Tiles and Upgrades). */
const StandardCounts: Readonly<Record<string, number>> = {
    '1': 1,
    '2': 1,
    '3': 3,
    '4': 3,
    '5': 2,
    '6': 2,
    '7': 7,
    '8': 13,
    '9': 13,
    '55': 1,
    '56': 1,
    '57': 4,
    '58': 3,
    '69': 1,
    '14': 4,
    '15': 4,
    '16': 1,
    '17': 1,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 4,
    '24': 4,
    '25': 1,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '59': 2,
    '39': 1,
    '40': 1,
    '41': 3,
    '42': 3,
    '43': 2,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 2,
    '63': 4,
    '64': 1,
    '65': 1,
    '66': 1,
    '67': 1,
    '68': 1,
    '70': 1
}

const TitleCounts: Readonly<Record<string, number>> = {
    '120': 1,
    '121': 2,
    '122': 1,
    '123': 1,
    '124': 1,
    '125': 4,
    '126': 1,
    '127': 1
}

export const TileSet1856 = new TileSet(
    {
        id: '1856:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1856:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1856]
)

const cityCount = (face: TileFace) => face.nodes.filter((node) => node.kind === 'city').length

/** Toronto's two cities join on #124 and Hamilton's on #123; other upgrades keep their stops. */
export function preservesStops1856(before: TileFace, after: TileFace): boolean {
    return (
        sameStopCounts(before, after) ||
        (after.color === 'gray' && cityCount(before) === 2 && cityCount(after) === 1)
    )
}
