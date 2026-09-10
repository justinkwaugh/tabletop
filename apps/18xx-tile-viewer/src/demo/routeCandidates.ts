import type { RouteEvaluation, TrainRoute } from '@tabletop/18xx'
export function* enumerateRouteCandidates(
    running: RouteEvaluation,
    companyId: string,
    trainId: string,
    maxVisited = Infinity
): Generator<TrainRoute> {
    let visited = 0
    for (const start of running.network.centers()) {
        const pending: TrainRoute[] = [{ trainId, start, paths: [] }]
        while (pending.length) {
            if (++visited > maxVisited) return
            const route = pending.pop()!
            if (!running.evaluateRoute(companyId, route, false).result) continue
            if (running.evaluateRoute(companyId, route).result) yield route
            for (const path of running.network.extensions(route.start, route.paths))
                pending.push({ ...route, paths: [...route.paths, path] })
        }
    }
}
