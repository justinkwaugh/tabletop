import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
    RouteEvaluation,
    atRunningStep,
    trainRoutesOf,
    trainsOwnedBy,
    type TrainRunningState
} from '@tabletop/18xx'
import { Autorouter } from '@tabletop/18xx-autorouter'
import { exhaustiveSeparateFleetValue } from '@tabletop/18xx-autorouter/testing'
import { RouteRules1860 } from './routes.js'
import { largeStationAllowance } from './trains.js'
import { Random, botMove } from '../test/bot.js'
import { kit } from '../test/kit.js'

const autorouter = await Autorouter.create(
    new Uint8Array(
        await readFile(
            createRequire(import.meta.url).resolve('@tabletop/18xx-autorouter/solver.wasm')
        )
    ).buffer
)

type Seen = { halts: number; passed: number; blocked: number; fleets: number; leased: number }

// Every run is checked against 1860's own evaluation. Trying every combination of routes takes
// seconds a position for the networks of 4+ trains and minutes for 6+, so only a sample of the
// runs with smaller trains is checked against it; the autorouter's own specs try every
// combination on generated maps for each passing rule 1860 uses, leased trains included.
const Sampled = 3
const LargestTried = 3

/** The largest first number among the company's own trains. */
function largestTrain(state: TrainRunningState, companyId: string): number {
    return Math.max(
        0,
        ...trainsOwnedBy(state, { kind: 'company', companyId }).map((train) =>
            largeStationAllowance(train.definitionId)
        )
    )
}

/**
 * Solves the company's run and checks that 1860's evaluation accepts it at the value the
 * autorouter found, and, where asked, that no combination of routes does better.
 */
function check(
    state: TrainRunningState,
    companyId: string,
    seen: Seen,
    label: string,
    tryEvery: boolean
): void {
    const solved = autorouter.solve(state, RouteRules1860, companyId, { timeLimitMs: 30_000 })
    expect(solved.exhaustive, label).toBe(true)
    const found = solved.result.revenue + (solved.result.subsidy ?? 0)
    const evaluation = new RouteEvaluation(state, RouteRules1860)
    const evaluated = evaluation.evaluate(companyId, trainRoutesOf(solved.result))
    expect(evaluated.reason, label).toBeUndefined()
    expect((evaluated.result?.revenue ?? 0) + (evaluated.result?.subsidy ?? 0), label).toBe(found)
    if (tryEvery)
        expect(found, label).toBe(exhaustiveSeparateFleetValue(state, RouteRules1860, companyId))
    const routes = trainRoutesOf(solved.result).map((route) =>
        evaluation.evaluateFleetRoute(companyId, route)
    )
    if (solved.result.subsidy) seen.halts++
    if (routes.some((entry) => entry.route && entry.route.stops.length < entry.route.visits.length))
        seen.passed++
    if (routes.some((entry) => (entry.blockedPasses ?? 0) > 0)) seen.blocked++
    if (routes.length > 1) seen.fleets++
    if (RouteRules1860.leasedTrain?.(state, companyId)) seen.leased++
}

describe('the autorouter on 1860 runs', () => {
    it('finds runs 1860 accepts at their value, the best of every combination where tried', () => {
        const seen: Seen = { halts: 0, passed: 0, blocked: 0, fleets: 0, leased: 0 }
        let small = 0
        let tried = 0
        for (const [players, seed] of [
            [3, 1],
            [4, 2]
        ]) {
            const game = kit.table(players, seed)
            const random = new Random(seed)
            for (let move = 0; move < 3000 && game.state.machineState !== 'GameOver'; move++) {
                const state = game.hydrated
                const companyId = state.routeStep?.companyId
                if (state.machineState === 'RunningTrains' && companyId) {
                    const running = atRunningStep(state, companyId)
                    const tryEvery =
                        !RouteRules1860.leasedTrain?.(running, companyId) &&
                        largestTrain(running, companyId) <= LargestTried &&
                        small++ % Sampled === 0
                    if (tryEvery) tried++
                    check(running, companyId, seen, `game ${seed}, move ${move}`, tryEvery)
                }
                const next = botMove(game, random)
                game.act(next.type, next.fields, next.playerId)
            }
        }
        expect(tried).toBeGreaterThan(10)
        expect(seen.halts).toBeGreaterThan(0)
        expect(seen.passed).toBeGreaterThan(0)
        expect(seen.blocked).toBeGreaterThan(0)
        expect(seen.fleets).toBeGreaterThan(0)
        expect(seen.leased).toBeGreaterThan(0)
    }, 120_000)
})
