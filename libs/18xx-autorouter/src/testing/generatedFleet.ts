import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    TileSet,
    TrainDepot,
    createCityTileFace as city,
    createJunctionTileFace as junction,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as staged,
    createTownTileFace as town,
    createTrackTileFace as track,
    type FleetRules,
    type RevenueCenter,
    type RouteRules,
    type TileEdge,
    type TileFace,
    type TileNode,
    type TilePath,
    type TrainDistance,
    type TrainRunningState
} from '@tabletop/18xx'

export const Home: RevenueCenter = { locationId: '0,0', nodeId: 'city' }
const Edges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]
export const Distances: Readonly<Record<string, TrainDistance>> = {
    R2: { measure: 'revenue-centers', maximum: 2 },
    R3: { measure: 'revenue-centers', maximum: 3 },
    H3: { measure: 'hex-edges', maximum: 3 },
    C2: { measure: 'cities-and-offboards', maximum: 2 },
    L: { measure: 'revenue-centers', maximum: 3 },
    P21: { measure: 'revenue-centers', maximum: 2, extraTowns: 1 },
    P32: { measure: 'revenue-centers', maximum: 3, extraTowns: 2 }
}

/** What the generated maps hold beside cities, towns, offboards and junctions. */
export type GeneratedStops = 'halts'

export function random(seed: number): () => number {
    let value = seed
    return () => {
        value = (value + 0x6d2b79f5) | 0
        let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32
    }
}

/** A halt with track to the sides; with a revenue, a halt on the first side joined to a town. */
function haltFace(open: readonly TileEdge[], revenue?: number): TileFace {
    const halt: TileNode = {
        id: 'halt',
        kind: 'town',
        revenue: { kind: 'fixed', amount: 0 },
        halt: true
    }
    const toNode = (edge: TileEdge, nodeId: string): TilePath => ({
        id: `${nodeId}-edge-${edge}`,
        endpoints: [
            { kind: 'edge', edge },
            { kind: 'node', nodeId }
        ]
    })
    const [first, ...rest] = open
    if (revenue === undefined || first === undefined || !rest.length)
        return {
            color: 'yellow',
            nodes: [halt],
            paths: open.map((edge) => toNode(edge, 'halt')),
            labels: []
        }
    return {
        color: 'yellow',
        nodes: [halt, { id: 'town', kind: 'town', revenue: { kind: 'fixed', amount: revenue } }],
        paths: [
            toNode(first, 'halt'),
            ...rest.map((edge) => toNode(edge, 'town')),
            {
                id: 'halt-town',
                endpoints: [
                    { kind: 'node', nodeId: 'halt' },
                    { kind: 'node', nodeId: 'town' }
                ]
            }
        ],
        labels: []
    }
}

function generatedFace(
    next: () => number,
    open: readonly TileEdge[],
    outer: boolean,
    stops?: GeneratedStops
): TileFace {
    const roll = next()
    const value = (base: number) => base + 10 * Math.floor(next() * 5)
    if (!open.length) return track('yellow', [])
    if (outer && roll < 0.15) return offboard(open, staged([['yellow', value(30)]]))
    if (roll < 0.5) return city('yellow', open, value(10), 1)
    if (stops === 'halts' && roll < 0.7) {
        const kind = next()
        if (kind < 0.3) return haltFace(open)
        if (kind < 0.6) return haltFace(open, value(10))
    }
    if (roll < 0.7) return town('yellow', [open], value(10))
    if (roll < 0.85 && open.length >= 3) return junction('yellow', open)
    return track(
        'yellow',
        open.flatMap((edge, index) =>
            index % 2 && open[index - 1] !== undefined ? [[open[index - 1], edge] as const] : []
        )
    )
}

export function generated(
    seed: number,
    radius: number,
    trainKinds: readonly string[],
    fleet?: FleetRules,
    stops?: GeneratedStops
): { state: TrainRunningState; rules: RouteRules } {
    const next = random(seed)
    const places = []
    for (let q = -radius; q <= radius; q++)
        for (let r = -radius; r <= radius; r++)
            if (Math.abs(q + r) <= radius)
                places.push({ id: `${q},${r}`, coordinates: { q, r }, buildable: true })
    const grid = new RailwayMap({
        id: 'grid',
        name: 'Grid',
        orientation: HexOrientation.Flat,
        locations: places.map((place) => ({ ...place, preprintedTile: track('yellow', []) }))
    })
    // Track meets across a hex side exactly where both tiles open onto it.
    const open = new Map(places.map((place): [string, TileEdge[]] => [place.id, []]))
    for (const { id } of places)
        for (const edge of Edges) {
            const across = grid.across(id, edge)
            if (!across || across.location.id < id || next() >= 0.6) continue
            open.get(id)!.push(edge)
            open.get(across.location.id)!.push(across.edge)
        }
    const locations = places.map((place) => {
        const sides = open.get(place.id)!
        const { q, r } = place.coordinates
        const outer = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === radius
        return {
            ...place,
            preprintedTile:
                place.id === Home.locationId
                    ? city('yellow', sides, 20, 2)
                    : generatedFace(next, sides, outer, stops)
        }
    })
    const tileSet = new TileSet({ id: 'empty', entries: [] }, [])
    const kinds = [...new Set(trainKinds)]
    const depot = new TrainDepot({
        id: 'fleet',
        trains: kinds.map((kind) => ({
            id: kind,
            name: kind,
            price: 0,
            distance: Distances[kind]
        })),
        supply: []
    })
    const rival = locations.find(
        (location) =>
            location.id !== Home.locationId && location.preprintedTile.nodes[0]?.kind === 'city'
    )
    const state: TrainRunningState = {
        bank: {},
        companies: [{ id: 'A', kind: 'major', shareCount: 10 }],
        cash: [],
        certificates: [],
        certificatePools: [],
        stations: [
            { id: 'A:home', companyId: 'A', status: 'placed', position: { ...Home, slot: 0 } },
            ...(rival && next() < 0.5
                ? [
                      {
                          id: 'rival',
                          companyId: 'B',
                          status: 'placed' as const,
                          position: { locationId: rival.id, nodeId: 'city', slot: 0 }
                      }
                  ]
                : [])
        ],
        stationReservations: [],
        tileInventory: tileSet.createInventory(),
        trainInventory: {
            depotId: 'fleet',
            nextTrainNumber: 1,
            trains: trainKinds.map((kind, index) => ({
                id: `${kind}-${index}`,
                definitionId: kind,
                status: 'owned',
                owner: { kind: 'company', companyId: 'A' }
            }))
        },
        phaseId: 'yellow',
        routeStep: { companyId: 'A' }
    }
    const rules: RouteRules = {
        map: new RailwayMap({
            id: 'generated',
            name: 'Generated',
            orientation: HexOrientation.Flat,
            locations
        }),
        tileSet,
        depot,
        requiresCity: (train) => train.distance.measure === 'cities-and-offboards',
        revenueStage: (state) => [state.phaseId],
        ...(fleet ? { fleet } : {})
    }
    return { state, rules }
}
