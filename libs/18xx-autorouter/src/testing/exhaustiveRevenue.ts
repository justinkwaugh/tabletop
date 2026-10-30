import {
    RouteEvaluation,
    type RoutePath,
    type RouteRules,
    type TrainRoute,
    type TrainRunningState,
    trainsOwnedBy
} from '@tabletop/18xx'

export function exhaustiveRevenue(
    state: TrainRunningState,
    rules: RouteRules,
    companyId: string
): number {
    const evaluation = new RouteEvaluation(state, rules)
    const candidates = trainsOwnedBy(state, { kind: 'company', companyId }).map((train) => {
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
        for (const start of evaluation.network.centers())
            walk({ trainId: train.id, start, paths: [] })
        return routes
    })
    let best = 0
    const choose = (index: number, routes: TrainRoute[]) => {
        if (index === candidates.length) {
            best = Math.max(best, evaluation.evaluate(companyId, routes).result?.revenue ?? 0)
            return
        }
        choose(index + 1, routes)
        for (const route of candidates[index]) choose(index + 1, [...routes, route])
    }
    choose(0, [])
    return best
}
