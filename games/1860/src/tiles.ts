import { assertExists } from '@tabletop/common'
import {
    RailwayMapState,
    StandardTileCatalog,
    TileCatalog,
    TileSet,
    type TileDefinition,
    type TileEdge,
    type TileFace,
    type TileInventory,
    type TileNode,
    type TilePath
} from '@tabletop/18xx'
import { Map1860 } from './map.js'

const Scope = '1860'
const tileId = (number: string) => `${Scope}:${number}`

const fixed = (amount: number) => ({ kind: 'fixed' as const, amount })
const cityNode = (id: string, revenue: number, stationSlots = 1): TileNode => ({
    id,
    kind: 'city',
    stationSlots,
    revenue: fixed(revenue)
})
const townNode = (id: string, revenue: number): TileNode => ({
    id,
    kind: 'town',
    revenue: fixed(revenue)
})
const haltNode = (id: string): TileNode => ({ id, kind: 'town', revenue: fixed(0), halt: true })

function edgePath(edge: TileEdge, nodeId: string): TilePath {
    return {
        id: `${nodeId}-edge-${edge}`,
        endpoints: [
            { kind: 'edge', edge },
            { kind: 'node', nodeId }
        ]
    }
}

function nodePath(from: string, to: string): TilePath {
    return {
        id: `${from}-${to}`,
        endpoints: [
            { kind: 'node', nodeId: from },
            { kind: 'node', nodeId: to }
        ]
    }
}

function edgesTo(nodeId: string, edges: readonly TileEdge[]): TilePath[] {
    return edges.map((edge) => edgePath(edge, nodeId))
}

function face(
    color: string,
    nodes: readonly TileNode[],
    paths: readonly TilePath[],
    labels: readonly string[] = []
): TileFace {
    return { color, nodes: [...nodes], paths: [...paths], labels: [...labels] }
}

function plain(color: string, connections: readonly (readonly [TileEdge, TileEdge])[]): TileFace {
    return face(
        color,
        [],
        connections.map(([a, b]) => ({
            id: `edge-${a}-edge-${b}`,
            endpoints: [
                { kind: 'edge', edge: a },
                { kind: 'edge', edge: b }
            ]
        }))
    )
}

/** A stop with track from the given sides: a halt, a small station or a large station. */
const halt = (color: string, edges: readonly TileEdge[]) =>
    face(color, [haltNode('halt')], edgesTo('halt', edges))
const smallStation = (color: string, edges: readonly TileEdge[], revenue: number) =>
    face(color, [townNode('town', revenue)], edgesTo('town', edges))
const largeStation = (
    color: string,
    edges: readonly TileEdge[],
    revenue: number,
    labels: readonly string[] = [],
    stationSlots = 1
) => face(color, [cityNode('city', revenue, stationSlots)], edgesTo('city', edges), labels)

/** Two villages joined in a line, each with track to one side (tiles #744, #745). */
const twoHalts = (edge: TileEdge) =>
    face(
        'yellow',
        [haltNode('halt-0'), haltNode('halt-1')],
        [edgePath(0, 'halt-0'), edgePath(edge, 'halt-1'), nodePath('halt-0', 'halt-1')]
    )

/** A halt on the track to side 0, joined to a small station with track to the others. */
const haltAndStation = (color: string, edges: readonly TileEdge[], revenue: number) =>
    face(
        color,
        [haltNode('halt'), townNode('town', revenue)],
        [edgePath(0, 'halt'), ...edgesTo('town', edges), nodePath('halt', 'town')]
    )

/** Cowes: a halt by side 0 joined to the small station, which runs on to the large station. */
const cowes = (color: string, haltEdges: readonly TileEdge[], city: number, town: number) =>
    face(
        color,
        [cityNode('city', city), townNode('town', town), haltNode('halt')],
        [...edgesTo('halt', haltEdges), nodePath('halt', 'town'), nodePath('city', 'town')],
        ['C']
    )

/** Newport's two stations, Newport to the north and Shide on the south side (#763, #773). */
const newport = (
    color: string,
    newportRevenue: number,
    slots: number,
    shide: number,
    shideEdges: readonly TileEdge[],
    joined: boolean
) =>
    face(
        color,
        [cityNode('city-0', newportRevenue, slots), cityNode('city-1', shide)],
        [
            ...edgesTo('city-0', [1, 2, 3, 4]),
            ...edgesTo('city-1', shideEdges),
            ...(joined ? [nodePath('city-0', 'city-1')] : [])
        ],
        ['N']
    )

/** Ventnor's two stations, each with its own line (#760, #774). */
const ventnor = (color: string, revenue: number) =>
    face(
        color,
        [cityNode('city-0', revenue), cityNode('city-1', revenue)],
        [edgePath(2, 'city-0'), edgePath(1, 'city-1')],
        ['V']
    )

/** Merstone with Blackwater's halt on the line north to Newport (#761, #775). */
const merstone = (
    color: string,
    revenue: number,
    slots: number,
    edges: readonly TileEdge[],
    blackwater: TileNode
) =>
    face(
        color,
        [cityNode('city', revenue, slots), blackwater],
        [...edgesTo('city', edges), edgePath(3, blackwater.id), nodePath('city', blackwater.id)],
        ['M']
    )

const TitleFaces: Readonly<Record<string, TileFace>> = {
    '741': halt('yellow', [0, 1]),
    '742': halt('yellow', [0, 2]),
    '743': halt('yellow', [0, 3]),
    '744': twoHalts(3),
    '745': twoHalts(2),
    '746': largeStation('yellow', [0, 3], 10, ['B']),
    '787': cowes('yellow', [0], 20, 10),
    '747': smallStation('green', [0, 1], 10),
    '748': smallStation('green', [0, 2], 10),
    '749': smallStation('green', [0, 3], 10),
    '750': halt('green', [0, 1, 2]),
    '751': halt('green', [0, 5, 3]),
    '752': halt('green', [0, 1, 3]),
    '753': halt('green', [0, 2, 4]),
    '754': haltAndStation('green', [2, 3], 10),
    '755': haltAndStation('green', [4, 3], 10),
    '756': largeStation('green', [0, 1], 30),
    '757': largeStation('green', [0, 1, 3, 4], 20, ['B']),
    '758': largeStation('green', [4, 5], 50, ['R']),
    '759': largeStation('green', [0], 30),
    '760': ventnor('green', 40),
    '761': merstone('green', 20, 1, [0, 4, 5], haltNode('halt')),
    '762': largeStation('green', [0, 1, 2, 3], 20, ['B']),
    '763': newport('green', 50, 1, 30, [0], false),
    '788': cowes('green', [0, 1], 30, 10),
    '764': smallStation('brown', [0, 1], 20),
    '765': smallStation('brown', [0, 3], 20),
    '766': smallStation('brown', [0, 2], 20),
    '767': smallStation('brown', [0, 1, 2, 3], 10),
    '768': smallStation('brown', [0, 1, 3, 4], 10),
    '769': smallStation('brown', [0, 2, 3, 4], 10),
    '770': largeStation('brown', [0, 1, 2, 3, 4], 30, ['B'], 2),
    '771': largeStation('brown', [0, 1, 2], 50),
    '772': largeStation('brown', [0, 1], 40),
    '773': newport('brown', 60, 2, 20, [0, 5], true),
    '774': ventnor('brown', 50),
    '775': merstone('brown', 20, 2, [0, 1, 2, 4, 5], townNode('town', 10)),
    '776': largeStation('brown', [0, 1, 2, 3], 40, [], 2),
    '777': largeStation('brown', [0], 60),
    '778': plain('brown', [
        [0, 3],
        [1, 5],
        [2, 4]
    ]),
    '779': plain('brown', [
        [4, 5],
        [1, 3],
        [0, 2]
    ]),
    '780': plain('brown', [
        [1, 2],
        [4, 5],
        [0, 3]
    ]),
    '781': plain('brown', [
        [0, 1],
        [2, 3],
        [4, 5]
    ]),
    '782': haltAndStation('brown', [2, 3, 4, 5], 20),
    '783': haltAndStation('brown', [1, 2, 3, 5], 20),
    '784': haltAndStation('brown', [1, 3, 4, 5], 20),
    '785': haltAndStation('brown', [1, 2, 3, 4], 20),
    '786': largeStation('brown', [4, 5], 60, ['R']),
    '789': cowes('brown', [0, 1], 60, 20)
}

const TitleTiles: readonly TileDefinition[] = Object.entries(TitleFaces).map(([number, face]) => ({
    id: tileId(number),
    printedNumber: number,
    aliases: [],
    scope: Scope,
    face
}))

export const TileCatalog1860 = new TileCatalog(TitleTiles)

/**
 * Tiles laid only as printed: Ryde's, Newport's with Shide to the south, and Merstone's with
 * Blackwater to the north (Special Rules for Tile Placement).
 */
export const FixedRotationTileIds: readonly string[] = [
    '758',
    '761',
    '763',
    '773',
    '775',
    '786',
    // The green and russet Cowes run south and south-west (TR-9).
    '788',
    '789'
].map(tileId)
/** The yellow Cowes tile, laid running south or south-west (TR-9). */
export const YellowCowesTileId = tileId('787')

const StandardCounts: Readonly<Record<string, number>> = {
    '5': 2,
    '6': 2,
    '7': 2,
    '8': 4,
    '9': 4,
    '57': 2,
    '115': 2,
    '12': 2,
    '16': 2,
    '17': 2,
    '18': 2,
    '19': 2,
    '20': 2,
    '21': 1,
    '22': 1,
    '205': 1,
    '206': 1,
    '625': 1,
    '626': 1
}

const TitleCounts: Readonly<Record<string, number>> = {
    '741': 5,
    '742': 10,
    '743': 7,
    '744': 2,
    '745': 2,
    '746': 2,
    '747': 3,
    '748': 3,
    '749': 2,
    '750': 3,
    '751': 3,
    '752': 3,
    '753': 3,
    '754': 2,
    '755': 2,
    '756': 2,
    '757': 2,
    '759': 3,
    '762': 2,
    '764': 2,
    '765': 2,
    '766': 2,
    '767': 2,
    '768': 2,
    '769': 2,
    '770': 2,
    '771': 2,
    '772': 2,
    '776': 3,
    '777': 2
}

/** The tile manifest for the extended map (Tile Manifest; The Map). */
export const TileSet1860 = new TileSet(
    {
        id: '1860:extended',
        entries: [
            ...Object.entries(StandardCounts).map(([number, count]) => ({
                id: number,
                faceDefinitionIds: [`18xx:${number}`],
                count
            })),
            ...Object.keys(TitleFaces).map((number) => ({
                id: number,
                faceDefinitionIds: [tileId(number)],
                count: TitleCounts[number] ?? 1
            }))
        ]
    },
    [StandardTileCatalog, TileCatalog1860]
)

export function tileFace1860(definitionId: string): TileFace {
    const definition = TileSet1860.definitions.find((tile) => tile.id === definitionId)
    assertExists(definition, `Unknown 1860 tile ${definitionId}`)
    return definition.face
}

export function mapState1860(state: { tileInventory: TileInventory }): RailwayMapState {
    return new RailwayMapState(Map1860, TileSet1860, state.tileInventory)
}
