import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
    RouteEvaluation,
    sameCenter,
    trainRoutesOf,
    type FleetRules,
    type RevenueCenter,
    type RouteRules,
    type TileNode,
    type TrainRunningState,
    isHalt
} from '@tabletop/18xx'
import { Autorouter, routeProblemKey } from './autorouter.js'
import { exhaustiveFleetValue, exhaustiveRevenue } from './testing/exhaustiveRevenue.js'
import { Home, generated } from './testing/generatedFleet.js'

const router = await Autorouter.create(
    new Uint8Array(await readFile(new URL('../esm/solver.wasm', import.meta.url))).buffer
)

const Connected: FleetRules = { connectivity: { at: ['city', 'town', 'offboard'], root: 'home' } }
const HaltSubsidy = 10

function nodeAt(rules: RouteRules, center: RevenueCenter): TileNode | undefined {
    return rules.map
        .location(center.locationId)
        .preprintedTile.nodes.find((node) => node.id === center.nodeId)
}

/**
 * Rules in the manner of 1860: trains pass towns and halts as they choose, a halt pays its
 * subsidy to the treasury, no route enters a hex again, and one route of the run may pass one
 * tokened-out city.
 */
function passing(rules: RouteRules, { fleet = true }: { fleet?: boolean } = {}): RouteRules {
    return {
        ...rules,
        stopOptional: (_state, _companyId, center) => nodeAt(rules, center)?.kind === 'town',
        forbidsHexReentry: () => true,
        ...(fleet
            ? {
                  stopSubsidy: (_state, _companyId, center) => {
                      const node = nodeAt(rules, center)
                      return node && isHalt(node) ? HaltSubsidy : 0
                  },
                  blockedCityPasses: () => 1,
                  fleet: Connected
              }
            : {})
    }
}

/** What the run's routes show of the features: halts called, towns passed, blocked passes. */
function features(
    state: TrainRunningState,
    rules: RouteRules,
    routes: ReturnType<typeof trainRoutesOf>
) {
    const evaluation = new RouteEvaluation(state, rules)
    const evaluated = routes.map((route) => evaluation.evaluateFleetRoute('A', route))
    return {
        passed: evaluated.some(
            (entry) => entry.route && entry.route.stops.length < entry.route.visits.length
        ),
        blocked: evaluated.some((entry) => (entry.blockedPasses ?? 0) > 0)
    }
}

const Kinds: readonly (readonly string[])[] = [
    ['P21', 'P32'],
    ['P21', 'P21', 'R2'],
    ['P32'],
    ['R2', 'P21', 'P21']
]

describe('passed stops, halts, hex reentry and blocked passes', () => {
    it('finds the best connected fleet that trying every combination finds, on generated maps', () => {
        const seen = { subsidy: 0, passed: 0, blocked: 0 }
        for (let seed = 1; seed <= 48; seed++) {
            const base = generated(seed, 1, Kinds[seed % Kinds.length], undefined, 'halts')
            const rules = passing(base.rules)
            const solved = router.solve(base.state, rules, 'A', { timeLimitMs: 30_000 })
            expect(solved.exhaustive, `seed ${seed}`).toBe(true)
            const found = solved.result.revenue + (solved.result.subsidy ?? 0)
            expect(found, `seed ${seed}`).toBe(exhaustiveFleetValue(base.state, rules, 'A'))
            const shown = features(base.state, rules, trainRoutesOf(solved.result))
            if (solved.result.subsidy) seen.subsidy++
            if (shown.passed) seen.passed++
            if (shown.blocked) seen.blocked++
        }
        expect(seen.subsidy).toBeGreaterThan(0)
        expect(seen.passed).toBeGreaterThan(0)
        expect(seen.blocked).toBeGreaterThan(0)
    })

    it('routes trains that pass towns and keep out of hexes they left without a fleet policy', () => {
        for (let seed = 1; seed <= 24; seed++) {
            const base = generated(seed, 1, ['P21', 'R3'], undefined, 'halts')
            const rules = passing(base.rules, { fleet: false })
            const solved = router.solve(base.state, rules, 'A', { timeLimitMs: 30_000 })
            expect(solved.exhaustive, `seed ${seed}`).toBe(true)
            expect(solved.result.revenue, `seed ${seed}`).toBe(
                exhaustiveRevenue(base.state, rules, 'A')
            )
        }
    })

    it('runs a leased train that earns by the stops it calls at', () => {
        for (let seed = 1; seed <= 12; seed++) {
            const base = generated(seed, 1, ['P32'], undefined, 'halts')
            const depot = base.state.trainInventory.trains.map(({ id, definitionId }) => ({
                id,
                definitionId,
                status: 'depot' as const
            }))
            const state: TrainRunningState = {
                ...base.state,
                trainInventory: { ...base.state.trainInventory, trains: depot }
            }
            const passingRules = passing(base.rules)
            const rules: RouteRules = {
                ...passingRules,
                leasedTrain: (state) => state.trainInventory.trains[0],
                stopSubsidy: () => 0,
                stopRevenue: (_state, _companyId, center) =>
                    20 + (sameCenter(center, Home) ? 40 : 0),
                extendedDefinition: (_state, _companyId, _train, definition) => ({
                    ...definition,
                    distance: { measure: 'revenue-centers', maximum: 2 }
                })
            }
            const solved = router.solve(state, rules, 'A', { timeLimitMs: 30_000 })
            expect(solved.exhaustive, `seed ${seed}`).toBe(true)
            expect(solved.result.routes.every((route) => route.trainId === depot[0].id)).toBe(true)
            expect(solved.result.revenue, `seed ${seed}`).toBe(
                exhaustiveFleetValue(state, rules, 'A')
            )
            expect(solved.result.revenue).toBeGreaterThanOrEqual(80)
        }
    })

    it('keys the problem by the passing rules', () => {
        const { state, rules } = generated(5, 1, ['P21', 'P32'], undefined, 'halts')
        const passingRules = passing(rules)
        const key = routeProblemKey(state, passingRules, 'A')
        expect(
            routeProblemKey(state, { ...passingRules, forbidsHexReentry: () => false }, 'A')
        ).not.toBe(key)
        expect(
            routeProblemKey(state, { ...passingRules, blockedCityPasses: () => 2 }, 'A')
        ).not.toBe(key)
        expect(
            routeProblemKey(state, { ...passingRules, stopOptional: () => false }, 'A')
        ).not.toBe(key)
        expect(routeProblemKey(state, { ...passingRules, stopSubsidy: () => 20 }, 'A')).not.toBe(
            key
        )
    })

    it('rejects subsidies and shared blocked passes that no fleet policy weighs', () => {
        const { state, rules } = generated(5, 1, ['P21', 'P32'], undefined, 'halts')
        expect(() => router.solve(state, { ...rules, stopSubsidy: () => 10 }, 'A')).toThrow(
            'Stop subsidies are weighed only by a declared fleet'
        )
        expect(() => router.solve(state, { ...rules, blockedCityPasses: () => 1 }, 'A')).toThrow(
            'Blocked-city passes are counted only across a declared fleet'
        )
    })
})
