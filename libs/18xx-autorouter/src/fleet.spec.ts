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
    type FleetRules,
    type RevenueCenter,
    type RouteRules,
    type TileEdge,
    type TileFace,
    type TrainDistance,
    type TrainRunningState
} from '@tabletop/18xx'
import { Autorouter, routeProblemKey } from './autorouter.js'
import { exhaustiveFleetValue, exhaustiveRevenue } from './testing/exhaustiveRevenue.js'
const router = await Autorouter.create(
    new Uint8Array(await readFile(new URL('../esm/solver.wasm', import.meta.url))).buffer
)
const solve = (
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    timeLimitMs: number
) => router.solve(state, rules, companyId, { timeLimitMs })

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

function toyFleet({
    sharedTrack,
    payOnce = true
}: {
    sharedTrack?: true
    payOnce?: boolean
}): FleetRules {
    return {
        ...(sharedTrack ? { sharedTrack } : {}),
        ...(payOnce ? { payOnce: {} } : {}),
        connectivity: { at: 'city', root: 'home' },
        trains: {
            L: { hexSubsidy: 10, payingStopLimit: { count: 1, kinds: ['city', 'offboard'] } }
        }
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
        const { state, rules } = generated(
            seed,
            1,
            kinds,
            toyFleet({ payOnce: seed % 5 !== 0, ...(sharedTrack ? { sharedTrack } : {}) })
        )
        const solved = solve(state, rules, 'A', 30_000)
        expect(solved.exhaustive, `seed ${seed}`).toBe(true)
        const found = solved.result.revenue + (solved.result.subsidy ?? 0)
        expect(found, `seed ${seed}`).toBe(exhaustiveFleetValue(state, rules, 'A'))
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
    expect(fleetsThatShare).toBeGreaterThan(0)
})

it('searches larger fleets on a larger map within its bounds', () => {
    for (let seed = 1; seed <= 6; seed++) {
        const { state, rules } = generated(
            seed,
            2,
            ['R3', 'H3', 'L', 'R2'],
            toyFleet({ sharedTrack: true })
        )
        const solved = solve(state, rules, 'A', 30_000)
        expect(solved.exhaustive).toBe(true)
        expect(
            new RouteEvaluation(state, rules).evaluate(
                'A',
                solved.result.routes.map(({ trainId, start, paths }) => ({ trainId, start, paths }))
            ).result
        ).toEqual(solved.result)
    }
})

it('runs fleet titles through the native autorouter', async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    const router = await Autorouter.create(new Uint8Array(bytes).buffer)
    const { state, rules } = generated(7, 1, ['R3', 'L'], toyFleet({ sharedTrack: true }))
    const before = structuredClone(state)
    const solved = router.solve(state, rules, 'A')
    expect(solved.exhaustive).toBe(true)
    expect(solved.metrics.memoryBytes).toBeGreaterThan(0)
    expect(solved.result.revenue + (solved.result.subsidy ?? 0)).toBe(
        exhaustiveFleetValue(state, rules, 'A')
    )
    expect(state).toEqual(before)
})

it('returns a checked fleet when its time runs out', () => {
    const { state, rules } = generated(3, 2, ['R3', 'H3', 'L'], toyFleet({ sharedTrack: true }))
    const solved = solve(state, rules, 'A', 0.001)
    expect(solved.exhaustive).toBe(false)
    expect(new RouteEvaluation(state, rules).evaluate('A', solved.result.routes).result).toEqual(
        solved.result
    )
})

it('encodes fleet policies and train-specific access in the problem key', () => {
    const { state, rules } = generated(7, 1, ['R3', 'L'], toyFleet({ sharedTrack: true }))
    const key = routeProblemKey(state, rules, 'A')
    expect(
        routeProblemKey(
            state,
            { ...rules, fleet: { ...rules.fleet, trains: { L: { hexSubsidy: 20 } } } },
            'A'
        )
    ).not.toBe(key)
    expect(
        routeProblemKey(
            state,
            { ...rules, stopAllowed: (_state, _company, _center, train) => train?.id !== 'L' },
            'A'
        )
    ).not.toBe(key)
    const withoutLocal = router.solve(
        state,
        { ...rules, canRunTrain: (_state, train) => train.definitionId !== 'L' },
        'A'
    )
    expect(withoutLocal.result.routes.every((route) => route.definitionId !== 'L')).toBe(true)
})

it('has no native imports capable of calling title settlement during search', async () => {
    const bytes = await readFile(new URL('../esm/solver.wasm', import.meta.url))
    const module = await WebAssembly.compile(bytes)
    expect(WebAssembly.Module.imports(module)).toEqual([
        { module: 'clock', name: 'now', kind: 'function' }
    ])
})

it('agrees with canonical settlement on freight chains and permanent groupings', () => {
    let positive = 0
    for (let seed = 1; seed <= 12; seed++) {
        const fleet: FleetRules = {
            ...toyFleet({ sharedTrack: true }),
            routeShape: { endKinds: ['city', 'offboard'], minimumCities: 1 },
            trains: { R2: { freight: 'required' }, R3: { freight: 'optional' } },
            freightChains: {
                bonusPerHex: 20,
                endRates: [{ stops: [Home], bonusPerHex: 30 }],
                offboardDistance: 'adjacent-hex'
            }
        }
        const kinds =
            seed % 3 === 0
                ? ['R3', 'R3', 'R3']
                : seed % 3 === 1
                  ? ['R2', 'R3', 'R3']
                  : ['R2', 'R2', 'R3']
        const { state, rules } = generated(seed, 1, kinds, fleet)
        const solved = router.solve(state, rules, 'A')
        expect(solved.exhaustive, `seed ${seed}`).toBe(true)
        expect(solved.result.revenue, `seed ${seed}`).toBe(exhaustiveRevenue(state, rules, 'A'))
        if (solved.result.revenue > 0) positive++
    }
    expect(positive).toBeGreaterThan(0)
})
