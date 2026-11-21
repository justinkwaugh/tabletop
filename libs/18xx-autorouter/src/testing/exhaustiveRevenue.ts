import { assert } from '@tabletop/common'
import {
    RouteEvaluation,
    type RoutePath,
    type RouteRules,
    type Train,
    type TrainRoute,
    type TrainRunningState
} from '@tabletop/18xx'

/** Every complete route the train can run, found by walking from every stop. */
function everyRoute(
    evaluation: RouteEvaluation,
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    train: Train
): TrainRoute[] {
    const definition = rules.depot.trainDefinition(train.definitionId)
    const earnsInterconnections = Boolean(
        rules.revenuePolicy?.(definition, state, companyId).interconnections?.length
    )
    const routes: TrainRoute[] = []
    const extend = (route: TrainRoute, extension: RoutePath[]) => {
        for (const path of evaluation.network.extensions(route.start, [
            ...route.paths,
            ...extension
        ])) {
            const extended = { ...route, extension: [...extension, path] }
            if (evaluation.evaluateRoute(companyId, extended).result) routes.push(extended)
            extend(route, extended.extension)
        }
    }
    const walk = (route: TrainRoute) => {
        if (evaluation.evaluateRoute(companyId, route).result) {
            routes.push(route)
            if (earnsInterconnections) extend(route, [])
        }
        for (const path of evaluation.network.extensions(route.start, route.paths)) {
            const next = { ...route, paths: [...route.paths, path] }
            if (evaluation.evaluateRoute(companyId, next, false).result) walk(next)
        }
    }
    for (const start of evaluation.network.centers()) walk({ trainId: train.id, start, paths: [] })
    return routes
}

function bestCombination(
    evaluation: RouteEvaluation,
    companyId: string,
    candidates: readonly (readonly TrainRoute[])[]
): number {
    let best = 0
    const choose = (index: number, routes: TrainRoute[]) => {
        if (index === candidates.length) {
            const result = evaluation.evaluate(companyId, routes).result
            if (result) best = Math.max(best, result.revenue + (result.subsidy ?? 0))
            return
        }
        choose(index + 1, routes)
        for (const route of candidates[index]) choose(index + 1, [...routes, route])
    }
    choose(0, [])
    return best
}

export function exhaustiveRevenue(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string
): number {
    const evaluation = new RouteEvaluation(state, rules)
    const candidates = evaluation
        .runnableTrains(companyId)
        .map((train) => everyRoute(evaluation, state, rules, companyId, train))
    return bestCombination(evaluation, companyId, candidates)
}

/**
 * The best revenue and subsidy of a fleet, trying every combination of routes. Routes that settle
 * alike, by their stops either way round, their hexes and, unless shared, their track, are tried
 * once each.
 */
export function exhaustiveFleetValue(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string
): number {
    const evaluation = new RouteEvaluation(state, rules)
    const candidates = evaluation
        .runnableTrains(companyId)
        .map((train) =>
            distinctFleetRoutes(evaluation, state, rules, companyId, train).map(
                ({ route }) => route
            )
        )
    return bestCombination(evaluation, companyId, candidates)
}

type FleetOption = {
    route: TrainRoute
    value: number
    resources: readonly string[]
    blockedPasses: number
}

/**
 * Every route the train can run in a fleet, those that settle alike, by their stops either way
 * round, their hexes and, unless shared, their track, tried once each.
 */
function distinctFleetRoutes(
    evaluation: RouteEvaluation,
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string,
    train: Train
): FleetOption[] {
    const distinct = new Map<string, FleetOption>()
    for (const route of everyRoute(evaluation, state, rules, companyId, train)) {
        const evaluated = evaluation.evaluateFleetRoute(companyId, route)
        if (!evaluated.route) continue
        const stops = evaluated.route.visits.map((visit) => `${visit.locationId}/${visit.nodeId}`)
        const key = JSON.stringify([
            [stops.join(' '), [...stops].reverse().join(' ')].sort()[0],
            [...new Set(evaluated.route.locationIds)].sort(),
            rules.fleet?.sharedTrack ? [] : [...evaluated.resources].sort()
        ])
        if (!distinct.has(key))
            distinct.set(key, {
                route,
                value: evaluated.route.result.revenue + (evaluated.route.result.subsidy ?? 0),
                resources: evaluated.resources,
                blockedPasses: evaluated.blockedPasses
            })
    }
    return [...distinct.values()]
}

/**
 * The best revenue and subsidy of a fleet whose routes each earn what they would alone, as 1860's
 * do, trying every combination of routes that could still beat the best found. Every combination
 * tried is checked to earn the sum of its routes.
 */
export function exhaustiveSeparateFleetValue(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string
): number {
    const fleet = rules.fleet
    assert(
        !fleet?.payOnce &&
            !fleet?.trains &&
            !fleet?.freightChains &&
            !rules.runSubsidy &&
            !rules.runBonus &&
            !rules.longestRouteBonusPerStop,
        'Only routes that earn apart are summed'
    )
    const evaluation = new RouteEvaluation(state, rules)
    const trains = evaluation.runnableTrains(companyId)
    const options = trains.map((train) =>
        distinctFleetRoutes(evaluation, state, rules, companyId, train).sort(
            (a, b) => b.value - a.value
        )
    )
    const passLimit = rules.blockedCityPasses?.(state, companyId) ?? 0
    const most = options.map((list) => Math.max(0, list[0]?.value ?? 0))
    let best = 0
    const used = new Set<string>()
    // Trains alike take their routes best first and idle last, so no fleet is tried twice over.
    const choose = (
        index: number,
        picks: readonly (FleetOption | undefined)[],
        value: number,
        passes: number
    ) => {
        if (value + most.slice(index).reduce((sum, amount) => sum + amount, 0) <= best) return
        if (index === options.length) {
            const chosen = picks.flatMap((pick) => (pick ? [pick.route] : []))
            const result = evaluation.evaluate(companyId, chosen).result
            if (!result) return
            assert(
                result.revenue + (result.subsidy ?? 0) === value,
                'The routes earn together what they earn apart'
            )
            best = value
            return
        }
        const before = picks[index - 1]
        const previous =
            index > 0 && trains[index - 1].definitionId === trains[index].definitionId
                ? before
                    ? options[index - 1].indexOf(before)
                    : -1
                : undefined
        for (const [position, option] of options[index].entries()) {
            if (previous !== undefined && (previous < 0 || position < previous)) continue
            if (passes + option.blockedPasses > passLimit) continue
            if (!rules.fleet?.sharedTrack && option.resources.some((key) => used.has(key))) continue
            for (const key of option.resources) used.add(key)
            choose(
                index + 1,
                [...picks, option],
                value + option.value,
                passes + option.blockedPasses
            )
            for (const key of option.resources) used.delete(key)
        }
        choose(index + 1, [...picks, undefined], value, passes)
    }
    choose(0, [], 0, 0)
    return best
}
