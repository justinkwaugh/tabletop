import {
    RouteEvaluation,
    type RoutePath,
    type RouteRules,
    type Train,
    type TrainRoute,
    type TrainRunningState,
    trainsOwnedBy
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
    const candidates = trainsOwnedBy(state, { kind: 'company', companyId }).map((train) =>
        everyRoute(evaluation, state, rules, companyId, train)
    )
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
    const candidates = trainsOwnedBy(state, { kind: 'company', companyId }).map((train) => {
        const distinct = new Map<string, TrainRoute>()
        for (const route of everyRoute(evaluation, state, rules, companyId, train)) {
            const evaluated = evaluation.evaluateFleetRoute(companyId, route)
            if (!evaluated.route) continue
            const stops = evaluated.route.visits.map(
                (visit) => `${visit.locationId}/${visit.nodeId}`
            )
            const key = JSON.stringify([
                [stops.join(' '), [...stops].reverse().join(' ')].sort()[0],
                [...new Set(evaluated.route.locationIds)].sort(),
                rules.fleet?.sharedTrack ? [] : [...evaluated.resources].sort()
            ])
            if (!distinct.has(key)) distinct.set(key, route)
        }
        return [...distinct.values()]
    })
    return bestCombination(evaluation, companyId, candidates)
}
