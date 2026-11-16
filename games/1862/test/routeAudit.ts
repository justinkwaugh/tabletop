import { RouteEvaluation, type OperatingResult, type TrainRoute } from '@tabletop/18xx'
import { RouteRules1862 } from '../src/routeRules.js'
import type { HydratedState1862 } from '../src/state.js'

export function positiveRun(
    state: HydratedState1862,
    companyId: string
): OperatingResult | undefined {
    const evaluation = new RouteEvaluation(state, RouteRules1862)
    const profiles = new Map(
        evaluation.runnableTrains(companyId).map((train) => [train.definitionId, train])
    )
    const walk = (route: TrainRoute): OperatingResult | undefined => {
        const result = evaluation.evaluate(companyId, [route]).result
        if (result && result.revenue > 0) return result
        for (const path of evaluation.network.extensions(route.start, route.paths)) {
            const next = { ...route, paths: [...route.paths, path] }
            if (!evaluation.evaluateRoute(companyId, next, false).result) continue
            const found = walk(next)
            if (found) return found
        }
        return undefined
    }
    for (const train of profiles.values())
        for (const start of evaluation.network.centers()) {
            const found = walk({ trainId: train.id, start, paths: [] })
            if (found) return found
        }
    return undefined
}
