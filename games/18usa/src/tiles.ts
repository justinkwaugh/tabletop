import {
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as city,
    createJunctionTileFace as junction,
    createSeparateCitiesTileFace as cities,
    createStagedTileRevenue,
    type TileDefinition,
    type TileEdge,
    type TileFace,
    type TileInventory,
    type TileManifestEntry
} from '@tabletop/18xx'

const PlainTiles = [
    '5',
    '6',
    '7',
    '8',
    '9',
    '14',
    '15',
    '57',
    '63',
    '80',
    '81',
    '82',
    '83',
    '448',
    '544',
    '545',
    '546',
    '611',
    '619'
]
const LabelledCityTiles = ['592', '593', '597']

const AllEdges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]

/** P26's rural junction: a stop worth $10 that uses none of a train's distance. */
function ruralJunction(edges: readonly TileEdge[]): TileFace {
    return {
        color: 'yellow',
        nodes: [
            {
                id: 'city',
                kind: 'city',
                revenue: { kind: 'fixed', amount: 10 },
                stationSlots: 0,
                uncounted: true
            }
        ],
        paths: edges.map((edge) => ({
            id: `edge-${edge}`,
            endpoints: [
                { kind: 'edge', edge },
                { kind: 'node', nodeId: 'city' }
            ]
        })),
        labels: ['R.J.']
    }
}

const companyTownRevenue = createStagedTileRevenue([
    ['yellow', 30],
    ['green', 40],
    ['brown', 50]
])
const companyTown = (edges: readonly TileEdge[]) =>
    city('gray', edges, companyTownRevenue, 1, ['C.T.'])

const titleTile = (printedNumber: string, face: TileFace): TileDefinition => ({
    id: `18usa:${printedNumber}`,
    printedNumber,
    aliases: [],
    scope: '18USA',
    face
})

export const EighteenUSATitleTiles = new TileCatalog([
    titleTile('X01', city('yellow', [1, 3, 5], 30, 1, ['ATL'])),
    titleTile('X02', city('yellow', [1, 3, 5], 30, 1, ['CHI'])),
    titleTile('X03', city('yellow', [1, 3, 5], 30, 1, ['DFW'])),
    titleTile('X04', city('yellow', [1, 3, 5], 30, 1, ['DEN'])),
    titleTile('X05', city('yellow', [1, 2, 5], 30, 1, ['LA'])),
    titleTile('X06', city('yellow', [1, 3, 5], 30, 1, ['NO'])),
    titleTile('X07', ruralJunction([1, 2, 3, 4])),
    titleTile('X08', ruralJunction([1, 2, 4, 5])),
    titleTile('X09', ruralJunction([1, 3, 4, 5])),
    titleTile('X10', city('green', [0, 1, 3, 5], 50, 2, ['DFW'])),
    titleTile('X11', city('green', [1, 2, 5], 50, 2, ['LA'])),
    titleTile(
        'X12',
        cities(
            'green',
            [
                { edges: [0, 3], revenue: 60, stationSlots: 2 },
                { edges: [1, 2], revenue: 60, stationSlots: 1 }
            ],
            ['NY']
        )
    ),
    titleTile('X13', city('brown', [0, 1, 2, 5], 50, 3, ['CLE'])),
    titleTile('X14', city('brown', [0, 1, 3, 4, 5], 60, 3, ['DFW'])),
    titleTile('X15', city('brown', [0, 3, 4, 5], 70, 3, ['LA'])),
    titleTile('X16', city('brown', [0, 1, 2, 3], 80, 4, ['NY'])),
    titleTile('X17', junction('gray', [0, 1, 2, 3, 4])),
    titleTile('X18', city('gray', AllEdges, 80, 3, ['DFW'])),
    titleTile('X19', city('gray', [0, 3, 4, 5], 90, 4, ['LA'])),
    titleTile('X20', companyTown([1, 2, 3, 4])),
    titleTile('X21', companyTown([1, 2, 4, 5])),
    titleTile('X22', companyTown([1, 3, 4, 5])),
    titleTile('X23', city('gray', AllEdges, 50, 3, ['RHQ'])),
    titleTile('X30', city('gray', [2, 3, 4, 5], 100, 4, ['NY'])),
    titleTile('60', junction('gray', AllEdges))
])

const TitleTileCounts: Readonly<Record<string, number | 'unlimited'>> = {
    X01: 1,
    X02: 1,
    X03: 1,
    X04: 1,
    X05: 1,
    X06: 1,
    X07: 1,
    X08: 1,
    X09: 1,
    X10: 1,
    X11: 1,
    X12: 1,
    X13: 1,
    X14: 1,
    X15: 1,
    X16: 1,
    X17: 'unlimited',
    X18: 1,
    X19: 1,
    X20: 1,
    X21: 1,
    X22: 1,
    X23: 1,
    X30: 1,
    '60': 'unlimited'
}

export const EighteenUSATileSet = new TileSet(
    {
        id: '18usa:standard',
        entries: [
            ...PlainTiles.map<TileManifestEntry>((number) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count: 'unlimited'
            })),
            ...LabelledCityTiles.map<TileManifestEntry>((number) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count: 4
            })),
            ...Object.entries(TitleTileCounts).map<TileManifestEntry>(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18usa:${number}`],
                count
            }))
        ]
    },
    [StandardTileCatalog, EighteenUSATitleTiles]
)
export const EighteenUSATiles = EighteenUSATileSet.definitions

/** Yellow, green and brown city tiles without labels, which any ordinary city may use. */
export const PlainCityTileIds: Readonly<Record<string, readonly string[]>> = {
    yellow: ['18xx:5', '18xx:6', '18xx:57'],
    green: ['18xx:14', '18xx:15', '18xx:619'],
    brown: ['18xx:63', '18xx:611', '18xx:448']
}
export const RuralJunctionTileIds = ['18usa:X07', '18usa:X08', '18usa:X09']
export const CompanyTownTileIds = ['18usa:X20', '18usa:X21', '18usa:X22']

/** Whether a Company Town tile lies on the location (P27). */
export function isCompanyTown(inventory: TileInventory, locationId: string): boolean {
    const placement = inventory.placements[locationId]
    return !!placement && CompanyTownTileIds.includes(placement.definitionId)
}
export const RegionalHeadquartersTileId = '18usa:X23'
export const ClevelandBrownTileId = '18usa:X13'
