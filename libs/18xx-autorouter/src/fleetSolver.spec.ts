import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { HexOrientation } from '@tabletop/common'
import {
    RailwayMap,
    RouteEvaluation,
    TileSet,
    TrainDepot,
    createCityTileFace as city,
    createJunctionTileFace as junction,
    createOffboardTileFace as offboard,
    createStagedTileRevenue as staged,
    createTownTileFace as town,
    createTrackTileFace as track,
    type FleetRoute,
    type FleetRules,
    type RevenueCenter,
    type RouteRules,
    type TileEdge,
    type TileFace,
    type TrainDistance,
    type TrainRunningState
} from '@tabletop/18xx'
import { Autorouter } from './autorouter.js'
import { solveFleet } from './fleetSolver.js'
import { exhaustiveFleetValue } from './testing/exhaustiveRevenue.js'

const Home: RevenueCenter = { locationId: '0,0', nodeId: 'city' }
const Edges: readonly TileEdge[] = [0, 1, 2, 3, 4, 5]
const Distances: Readonly<Record<string, TrainDistance>> = {
    R2: { measure: 'revenue-centers', maximum: 2 },
    R3: { measure: 'revenue-centers', maximum: 3 },
    H3: { measure: 'hex-edges', maximum: 3 },
    C2: { measure: 'cities-and-offboards', maximum: 2 },
    L: { measure: 'revenue-centers', maximum: 3 }
}

function random(seed: number): () => number {
    let value = seed
    return () => {
        value = (value + 0x6d2b79f5) | 0
        let mixed = Math.imul(value ^ (value >>> 15), 1 | value)
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
        return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32
    }
}

function generatedFace(next: () => number, open: readonly TileEdge[], outer: boolean): TileFace {
    const roll = next()
    const value = (base: number) => base + 10 * Math.floor(next() * 5)
    if (!open.length) return track('yellow', [])
    if (outer && roll < 0.15) return offboard(open, staged([['yellow', value(30)]]))
    if (roll < 0.5) return city('yellow', open, value(10), 1)
    if (roll < 0.7) return town('yellow', [open], value(10))
    if (roll < 0.85 && open.length >= 3) return junction('yellow', open)
    return track(
        'yellow',
        open.flatMap((edge, index) =>
            index % 2 && open[index - 1] !== undefined ? [[open[index - 1], edge] as const] : []
        )
    )
}

/** The toy title: one run includes the home, every other meets a run at a city, stops pay once. */
type Toy = { sharedTrack?: true; bound?: true; routeKey?: true }
function toyFleet({ sharedTrack, bound: withBound, routeKey }: Toy): FleetRules {
    const key = (center: RevenueCenter) => `${center.locationId}/${center.nodeId}`
    const subsidised = (route: FleetRoute) => route.train.id === 'L'
    return {
        ...(sharedTrack ? { sharedTrack } : {}),
        ...(routeKey
            ? {
                  // Only a subsidised train's hexes count.
                  routeKey: (train, visits, locationIds) =>
                      JSON.stringify([
                          visits.map(key),
                          train.id === 'L' ? [...new Set(locationIds)].sort() : []
                      ])
              }
            : {}),
        settle(_state, _companyId, routes) {
            const cities = routes.map(
                (route) =>
                    new Set(route.visits.filter((visit) => visit.node.kind === 'city').map(key))
            )
            const met = new Set(
                routes.flatMap((route, index) =>
                    route.visits.some((visit) => key(visit) === key(Home)) ? [index] : []
                )
            )
            if (!met.size) return { reason: 'One run must include the home city.' }
            for (let grew = true; grew;) {
                grew = false
                for (const index of routes.keys())
                    if (
                        !met.has(index) &&
                        [...met].some((other) =>
                            [...cities[index]].some((stop) => cities[other].has(stop))
                        )
                    ) {
                        met.add(index)
                        grew = true
                    }
            }
            if (met.size < routes.length) return { reason: 'Every run must meet another.' }
            const paid = new Set<string>()
            const hexes = new Set(routes.filter(subsidised).flatMap((route) => route.locationIds))
            return {
                routes: routes.map(({ result }) => {
                    const payments = result.payments.filter((payment) => {
                        if (paid.has(key(payment))) return false
                        paid.add(key(payment))
                        return true
                    })
                    return {
                        ...result,
                        payments,
                        revenue: payments.reduce((sum, payment) => sum + payment.amount, 0)
                    }
                }),
                subsidy: 10 * hexes.size
            }
        },
        ...(withBound
            ? {
                  bound(_state, _companyId, route, chosen) {
                      const paid = new Set(
                          chosen.flatMap((other) => other.result.payments.map(key))
                      )
                      const covered = new Set(
                          chosen.filter(subsidised).flatMap((other) => other.locationIds)
                      )
                      const subsidy = subsidised(route)
                          ? 10 * new Set(route.locationIds.filter((hex) => !covered.has(hex))).size
                          : 0
                      return (
                          subsidy +
                          route.result.payments
                              .filter((payment) => !paid.has(key(payment)))
                              .reduce((sum, payment) => sum + payment.amount, 0)
                      )
                  }
              }
            : {})
    }
}

function generated(
    seed: number,
    radius: number,
    trainKinds: readonly string[],
    fleet: FleetRules
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
                    : generatedFace(next, sides, outer)
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
            { id: 'home', companyId: 'A', status: 'placed', position: { ...Home, slot: 0 } },
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
        fleet
    }
    return { state, rules }
}

const Fleets: readonly (readonly string[])[] = [
    ['R2', 'R3'],
    ['H3', 'L'],
    ['R2', 'R2', 'C2'],
    ['L', 'L'],
    ['C2', 'H3', 'R2']
]

it('finds the best fleet that trying every combination finds, on generated maps', () => {
    let fleetsThatShare = 0
    for (let seed = 1; seed <= 40; seed++) {
        const kinds = Fleets[seed % Fleets.length]
        const sharedTrack = seed % 4 !== 0 ? true : undefined
        for (const toy of [{ bound: true }, {}, { bound: true, routeKey: true }] as const) {
            const { state, rules } = generated(
                seed,
                1,
                kinds,
                toyFleet({ ...toy, ...(sharedTrack ? { sharedTrack } : {}) })
            )
            const solved = solveFleet(state, rules, 'A', 30_000)
            expect(solved.exhaustive, `seed ${seed}`).toBe(true)
            const found = solved.result.revenue + (solved.result.subsidy ?? 0)
            expect(found, `seed ${seed} ${JSON.stringify(toy)}`).toBe(
                exhaustiveFleetValue(state, rules, 'A')
            )
            const network = new RouteEvaluation(state, rules).network
            const used = solved.result.routes.map(
                (route) => network.trace(route.start, route.paths).trace!.resources
            )
            if (
                used.some((keys, index) =>
                    used.slice(0, index).some((other) => other.some((key) => keys.includes(key)))
                )
            )
                fleetsThatShare++
        }
    }
    expect(fleetsThatShare).toBeGreaterThan(0)
})

it('searches larger fleets on a larger map within its bounds', () => {
    for (let seed = 1; seed <= 6; seed++) {
        const { state, rules } = generated(
            seed,
            2,
            ['R3', 'H3', 'L', 'R2'],
            toyFleet({ sharedTrack: true, bound: true, routeKey: true })
        )
        const solved = solveFleet(state, rules, 'A', 30_000)
        expect(solved.exhaustive).toBe(true)
        expect(
            new RouteEvaluation(state, rules).evaluate(
                'A',
                solved.result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
            ).result
        ).toEqual(solved.result)
    }
})

it('runs fleet titles through the autorouter without the native solver', async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    const router = await Autorouter.create(new Uint8Array(bytes).buffer)
    const { state, rules } = generated(
        7,
        1,
        ['R3', 'L'],
        toyFleet({ sharedTrack: true, bound: true, routeKey: true })
    )
    const before = structuredClone(state)
    const solved = router.solve(state, rules, 'A')
    expect(solved.exhaustive).toBe(true)
    expect(solved.result).toEqual(solveFleet(state, rules, 'A', 30_000).result)
    expect(state).toEqual(before)
})

it('returns the best fleet found, not exhaustive, when its time runs out', () => {
    const slow = toyFleet({ sharedTrack: true })
    const { state, rules } = generated(3, 2, ['R3', 'H3', 'L'], {
        ...slow,
        settle(state, companyId, routes) {
            const started = performance.now()
            while (performance.now() - started < 0.2);
            return slow.settle(state, companyId, routes)
        }
    })
    const solved = solveFleet(state, rules, 'A', 5)
    expect(solved.exhaustive).toBe(false)
    expect(
        new RouteEvaluation(state, rules).evaluate(
            'A',
            solved.result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
        ).result
    ).toEqual(solved.result)
})
