import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    TileEdges,
    TileSet,
    TrainDepot,
    createCityTileFace as city,
    createTrackTileFace as track,
    type RouteRules,
    type TileEdge,
    type TileFace,
    type TrainRunningState
} from '@tabletop/18xx'

const Coordinates = [
    { q: 0, r: 0 },
    { q: 1, r: -1 },
    { q: 1, r: 0 },
    { q: 0, r: 1 },
    { q: -1, r: 1 }
]

function layout(faces: readonly TileFace[]): RailwayMap {
    return new RailwayMap({
        id: 'loop',
        name: 'Loop',
        orientation: HexOrientation.Flat,
        locations: Coordinates.map((coordinates, index) => ({
            id: String(index),
            coordinates,
            preprintedTile: faces[index] ?? track('yellow', []),
            buildable: true
        }))
    })
}

/**
 * Company A, with a station in hex 1's $20 city and a 2-train, whose only route runs to hex 4's
 * $30 city through hex 0 twice: 1 → 0 → 2 → 3 → 0 → 4, on hex 0's crossing tile.
 */
export function loopPosition(routeRules: Partial<RouteRules> = {}) {
    const blank = layout([])
    const edge = (from: number, to: number): TileEdge => {
        const found = TileEdges.find(
            (edge) => blank.neighbor(String(from), edge)?.id === String(to)
        )
        if (found === undefined) throw new Error(`Hexes ${from} and ${to} are not adjacent`)
        return found
    }
    const faces: TileFace[] = [
        track('yellow', [
            [edge(0, 1), edge(0, 2)],
            [edge(0, 3), edge(0, 4)]
        ]),
        city('yellow', [edge(1, 0)], 20, 1),
        track('yellow', [[edge(2, 0), edge(2, 3)]]),
        track('yellow', [[edge(3, 2), edge(3, 0)]]),
        city('yellow', [edge(4, 0)], 30, 1)
    ]
    const tileSet = new TileSet({ id: 'empty', entries: [] }, [])
    const depot = new TrainDepot({
        id: 'test',
        trains: [
            { id: '2', name: '2', price: 0, distance: { measure: 'revenue-centers', maximum: 2 } }
        ],
        supply: []
    })
    const rules: RouteRules = {
        map: layout(faces),
        tileSet,
        depot,
        requiresCity: () => false,
        revenueStage: (state) => [state.phaseId],
        ...routeRules
    }
    const state: TrainRunningState = {
        bank: {},
        companies: [{ id: 'A', kind: 'major', shareCount: 10 }],
        cash: [],
        certificates: [],
        certificatePools: [],
        stations: [
            {
                id: 'home',
                companyId: 'A',
                status: 'placed',
                position: { locationId: '1', nodeId: 'city', slot: 0 }
            }
        ],
        stationReservations: [],
        tileInventory: tileSet.createInventory(),
        trainInventory: {
            depotId: 'test',
            nextTrainNumber: 1,
            trains: [
                {
                    id: 'train',
                    definitionId: '2',
                    status: 'owned',
                    owner: { kind: 'company', companyId: 'A' }
                }
            ]
        },
        phaseId: 'yellow',
        routeStep: { companyId: 'A' }
    }
    return { state, rules }
}
