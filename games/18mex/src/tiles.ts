import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    createCityTileFace as city,
    createTownTileFace as town,
    type TileDefinition,
    type TileEdge,
    type TileFace,
    type TileInventory,
    type TilePath
} from '@tabletop/18xx'
import {
    CopperCanyonLabel,
    MapMex,
    MexicoCityLabel,
    MexicoCityLocationId,
    PueblaLabel,
    PueblaLocationId,
    portCity
} from './map.js'

const tileId = (name: string) => `18mex:${name}`

function titleTile(name: string, printedNumber: string, face: TileFace): TileDefinition {
    return { id: tileId(name), printedNumber, aliases: [], scope: '18mex', face }
}

function edgePath(id: string, edge: TileEdge, nodeId: string, lane = 0): TilePath {
    return {
        id,
        endpoints: [
            lane ? { kind: 'edge', edge, lane } : { kind: 'edge', edge },
            { kind: 'node', nodeId }
        ]
    }
}

function nodePath(id: string, from: string, to: string): TilePath {
    return {
        id,
        endpoints: [
            { kind: 'node', nodeId: from },
            { kind: 'node', nodeId: to }
        ]
    }
}

/**
 * Copper Canyon: a town with track to one side, and on the other a short stub that forks to two
 * sides, shared by both branches, so no two runs may use it; a curve joins those two sides
 * (TR-9).
 */
const CopperCanyon: TileFace = {
    color: 'yellow',
    nodes: [
        { id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 20 } },
        { id: 'fork', kind: 'junction' }
    ],
    paths: [
        edgePath('edge-0', 0, 'town'),
        nodePath('stub', 'town', 'fork'),
        edgePath('edge-3', 3, 'fork'),
        edgePath('edge-4', 4, 'fork'),
        {
            id: 'curve',
            endpoints: [
                { kind: 'edge', edge: 3 },
                { kind: 'edge', edge: 4 }
            ]
        }
    ],
    labels: [CopperCanyonLabel]
}

/** Mexico City's half of a double-hex tile, Toluca's town joined to the city from the brown on. */
function mexicoCity(revenue: number, stationSlots: number, toluca: number): TileFace {
    const brown = toluca > 0
    return {
        color: brown ? 'brown' : 'green',
        nodes: [
            { id: 'city', kind: 'city', stationSlots, revenue: { kind: 'fixed', amount: revenue } },
            { id: 'toluca', kind: 'town', revenue: { kind: 'fixed', amount: toluca } }
        ],
        paths: brown
            ? [
                  edgePath('edge-0', 0, 'city'),
                  edgePath('edge-1', 1, 'city'),
                  edgePath('edge-3', 3, 'city'),
                  // The two tracks east to Puebla never meet in a switch (Appendix 1).
                  edgePath('edge-5', 5, 'city'),
                  edgePath('edge-5-lane-1', 5, 'city', 1),
                  edgePath('edge-2', 2, 'toluca'),
                  nodePath('toluca', 'toluca', 'city')
              ]
            : [edgePath('edge-3', 3, 'city'), edgePath('edge-5', 5, 'city')],
        labels: [MexicoCityLabel]
    }
}

/** Puebla's half: its town, and from the brown on a second track past it from Mexico City. */
const PueblaGreen: TileFace = {
    ...town('green', [[2, 5]], 10),
    labels: [PueblaLabel],
    upgradeCost: 40
}
const PueblaBrown: TileFace = {
    color: 'brown',
    nodes: [{ id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: 10 } }],
    paths: [
        edgePath('edge-2-lane-1', 2, 'town', 1),
        edgePath('edge-5', 5, 'town'),
        {
            id: 'edge-2-edge-4',
            endpoints: [
                { kind: 'edge', edge: 2 },
                { kind: 'edge', edge: 4 }
            ]
        }
    ],
    labels: [PueblaLabel]
}

const TitleTiles: readonly TileDefinition[] = [
    titleTile('470', '470', CopperCanyon),
    titleTile('471', '471', portCity('yellow', [0, 3], 20, 10, 1, ['M'])),
    titleTile('472', '472', portCity('yellow', [0, 1, 2], 20, 10, 1, ['T'])),
    titleTile('473', '473', portCity('yellow', [0, 2], 20, 10, 1, ['V'])),
    titleTile('474', '474', town('green', [[0, 1, 2, 4, 5]], 10)),
    titleTile('475', '475', city('green', [0, 1, 5], 30, 1, ['L'])),
    titleTile('476', '476', portCity('green', [2, 4, 5], 30, 10, 1, ['M'])),
    titleTile('477', '477', portCity('green', [0, 1, 2, 5], 30, 10, 1, ['T'])),
    titleTile('478', '478', portCity('green', [2, 4], 30, 20, 2, ['V'])),
    titleTile('479MC', '479', mexicoCity(40, 2, 0)),
    titleTile('479P', '479', PueblaGreen),
    titleTile('480', '480', city('brown', [0, 1, 2, 3, 4, 5], 50, 2, ['G'])),
    titleTile('481', '481', city('brown', [0, 1, 5], 40, 2, ['L'])),
    titleTile('482', '482', portCity('brown', [2, 3, 4, 5], 40, 20, 2, ['M'])),
    titleTile('483', '483', portCity('brown', [0, 1, 2, 5], 40, 20, 1, ['T'])),
    titleTile('484', '484', portCity('brown', [2, 3, 4], 40, 30, 2, ['V'])),
    titleTile('485MC', '485', mexicoCity(60, 3, 10)),
    titleTile('485P', '485', PueblaBrown),
    titleTile('486MC', '486', mexicoCity(50, 4, 10)),
    titleTile('486P', '486', PueblaBrown)
]

export const TileCatalogMex = new TileCatalog(TitleTiles)

export const CopperCanyonTileId = tileId('470')

/**
 * Each Mexico City tile and its Puebla half: laying either lays both, in the printed
 * orientation (Table IV).
 */
export const MexicoCityPairs: readonly Readonly<Record<string, string>>[] = [
    '479',
    '485',
    '486'
].map((number) => ({
    [MexicoCityLocationId]: tileId(`${number}MC`),
    [PueblaLocationId]: tileId(`${number}P`)
}))

const StandardCounts: Readonly<Record<string, number>> = {
    '3': 3,
    '4': 3,
    '5': 2,
    '6': 2,
    '7': 5,
    '8': 11,
    '9': 11,
    '14': 3,
    '15': 3,
    '16': 1,
    '17': 1,
    '18': 1,
    '19': 1,
    '20': 1,
    '23': 4,
    '24': 4,
    '25': 3,
    '26': 1,
    '27': 1,
    '28': 1,
    '29': 1,
    '39': 1,
    '40': 2,
    '41': 3,
    '42': 3,
    '43': 2,
    '44': 1,
    '45': 2,
    '46': 2,
    '47': 2,
    '57': 4,
    '58': 4,
    '63': 7,
    '70': 1,
    '141': 2,
    '142': 2,
    '143': 2,
    '455': 1,
    '619': 2
}

/** Each title tile is one piece, but tile 474, of which there are two (Table IV). */
const TitleCounts: Readonly<Record<string, number>> = { '474': 2 }

export const TileSetMex = new TileSet(
    {
        id: '18mex:standard',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...TitleTiles.map((tile) => {
                const name = tile.id.slice('18mex:'.length)
                return { id: name, faceDefinitionIds: [tile.id], count: TitleCounts[name] ?? 1 }
            })
        ]
    },
    [StandardTileCatalog, TileCatalogMex]
)

export function tileFaceMex(definitionId: string): TileFace {
    const definition = TileSetMex.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 18MEX tile ${definitionId}`)
    return definition.face
}

export function mapStateMex(state: { tileInventory: TileInventory }): RailwayMapState {
    return new RailwayMapState(MapMex, TileSetMex, state.tileInventory)
}
