import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import {
    RouteEvaluation,
    type FleetRules,
    type RouteRules,
    type TrainRunningState
} from '@tabletop/18xx'
import { Autorouter, routeProblemKey } from './autorouter.js'
import { exhaustiveFleetValue, exhaustiveRevenue } from './testing/exhaustiveRevenue.js'
import { Home, generated } from './testing/generatedFleet.js'
const router = await Autorouter.create(
    new Uint8Array(await readFile(new URL('../esm/solver.wasm', import.meta.url))).buffer
)
const solve = (
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    timeLimitMs: number
) => router.solve(state, rules, companyId, { timeLimitMs })

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
