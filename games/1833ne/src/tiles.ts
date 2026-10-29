import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as city,
    createTownTileFace as town,
    type TileEdge,
    type TileFace
} from '@tabletop/18xx'

type Stop = {
    id: string
    kind: 'city' | 'offboard'
    revenue: number
    slots?: number
    edges: readonly TileEdge[]
}

/** A tile with several distinct cities and terminals, as Boston's, Montreal's and Portland's. */
function stops(color: string, label: string, entries: readonly Stop[]): TileFace {
    return {
        color,
        labels: [label],
        nodes: entries.map((entry) =>
            entry.kind === 'city'
                ? {
                      id: entry.id,
                      kind: 'city',
                      stationSlots: entry.slots ?? 1,
                      revenue: { kind: 'fixed', amount: entry.revenue }
                  }
                : {
                      id: entry.id,
                      kind: 'offboard',
                      revenue: { kind: 'fixed', amount: entry.revenue }
                  }
        ),
        paths: entries.flatMap((entry) =>
            entry.edges.map((edge) => ({
                id: `${entry.id}-edge-${edge}`,
                endpoints: [
                    { kind: 'edge', edge },
                    { kind: 'node', nodeId: entry.id }
                ]
            }))
        )
    }
}

const labelled = (face: TileFace, label: string): TileFace => ({ ...face, labels: [label] })
const all: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]

const Westport: TileFace = {
    color: 'green',
    labels: ['We'],
    nodes: [{ id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 30 } }],
    paths: [
        {
            id: 'town-edge-1',
            endpoints: [
                { kind: 'edge', edge: 1 },
                { kind: 'node', nodeId: 'town' }
            ]
        },
        {
            id: 'town-edge-3',
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'node', nodeId: 'town' }
            ]
        },
        {
            id: 'edge-3-edge-5',
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'edge', edge: 5 }
            ]
        }
    ]
}

const TitleFaces: Readonly<Record<string, TileFace>> = {
    N10: labelled(town('yellow', [[2, 4]], 20), 'Hy'),
    // Sherbrooke's one space holds the St. Lawrence corporations' joint token (p. 21).
    N11: city('yellow', [0, 3, 4], 20, 1, ['Sh']),
    N21: city('green', [0, 3, 4], 30, 1, ['Sh']),
    N22: city('green', [0, 4, 5], 40, 2, ['Pr']),
    N23: stops('green', 'B', [
        { id: 'city-0', kind: 'city', revenue: 50, slots: 2, edges: [0, 1, 5] },
        { id: 'city-1', kind: 'city', revenue: 50, edges: [3, 4] },
        { id: 'terminal', kind: 'offboard', revenue: 50, edges: [2] }
    ]),
    N24: stops('green', 'Po', [
        { id: 'city-0', kind: 'city', revenue: 40, edges: [1] },
        { id: 'city-1', kind: 'city', revenue: 40, edges: [3] },
        { id: 'terminal', kind: 'offboard', revenue: 40, edges: [2] }
    ]),
    N25: stops('green', 'Mo', [
        { id: 'city-0', kind: 'city', revenue: 50, slots: 2, edges: [0, 5] },
        { id: 'city-1', kind: 'city', revenue: 50, edges: [4] }
    ]),
    N26: Westport,
    N27: city('green', [0, 3, 4, 5], 40, 2, ['Ma']),
    N28: city('green', [0, 2, 3, 5], 40, 2, ['Ma']),
    N40: town('green', [[0, 3, 4]], 20),
    N41: town('green', [[0, 2, 3]], 20),
    N42: town('green', [[0, 4, 5]], 20),
    N43: town('green', [[0, 2, 4]], 20),
    N32: city('brown', all, 80, 2, ['Pr']),
    N33: city('brown', all, 90, 4, ['B']),
    N34: city('brown', [1, 2, 3], 70, 3, ['Po']),
    N35: city('brown', [0, 4, 5], 80, 3, ['Mo']),
    N50: city('brown', all, 60, 2),
    N51: city('brown', [0, 1, 3, 4], 50, 2),
    N52: city('brown', [0, 3, 4, 5], 50, 2),
    N53: city('brown', [0, 1, 3, 5], 50, 2),
    N54: city('brown', all, 70, 3),
    N60: town('brown', [[0, 1, 3, 4]], 30),
    N61: town('brown', [[0, 1, 2, 3]], 30),
    N62: town('brown', [[0, 1, 3, 5]], 30)
}

export const TileCatalog1833NE = new TileCatalog(
    Object.entries(TitleFaces).map(([number, face]) => ({
        id: `1833ne:${number}`,
        printedNumber: number,
        aliases: [],
        scope: '1833NE',
        face
    }))
)

/** Rulebook p. 21; #8 and #9 are printed back to back with unlimited supply, plus four #7. */
const StandardCounts: Readonly<Record<string, number>> = {
    '3': 4,
    '4': 4,
    '5': 3,
    '6': 6,
    '57': 5,
    '58': 7,
    '14': 4,
    '15': 4,
    '16': 1,
    '17': 1,
    '19': 1,
    '20': 1,
    '23': 5,
    '24': 5,
    '25': 3,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '30': 1,
    '31': 1,
    '619': 4,
    '39': 1,
    '40': 1,
    '41': 1,
    '42': 1,
    '43': 1,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 1,
    '70': 1
}

const TitleCounts: Readonly<Record<string, number>> = {
    N10: 1,
    N11: 1,
    N21: 1,
    N22: 1,
    N23: 1,
    N24: 1,
    N25: 1,
    N26: 1,
    N27: 1,
    N28: 1,
    N40: 4,
    N41: 4,
    N42: 3,
    N43: 3,
    N32: 1,
    N33: 1,
    N34: 1,
    N35: 1,
    N50: 5,
    N51: 2,
    N52: 2,
    N53: 2,
    N54: 2,
    N60: 2,
    N61: 2,
    N62: 2
}

/** The 50-value brown cities, laid only where no 60 or 70 fits or none is left (p. 21). */
export const FallbackBrownCities = ['1833ne:N51', '1833ne:N52', '1833ne:N53']
export const PreferredBrownCities = ['1833ne:N50', '1833ne:N54']

export const TileSet1833NE = new TileSet(
    {
        id: '1833ne',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            // The basic yellow track tiles #7, #8 and #9 are unlimited (§6.47).
            { id: '7', faceDefinitionIds: ['18xx:7'], count: 'unlimited' as const },
            {
                id: '8/9',
                faceDefinitionIds: ['18xx:8', '18xx:9'],
                count: 'unlimited' as const
            },
            ...Object.entries(TitleCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`1833ne:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1833NE]
)
