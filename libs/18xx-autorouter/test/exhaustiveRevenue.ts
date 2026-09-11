import {
    RouteEvaluation,
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
        const routes: TrainRoute[] = []
        const walk = (route: TrainRoute) => {
            if (evaluation.evaluateRoute(companyId, route).result) routes.push(route)
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
