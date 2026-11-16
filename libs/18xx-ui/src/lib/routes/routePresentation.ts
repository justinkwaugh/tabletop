import { assert } from '@tabletop/common'
import type { RouteBonus, RouteResult, RunTrains, TrainRoute } from '@tabletop/18xx'
import type { MapRoute } from '../maps/mapDrawing.js'

const RouteColors = ['#b24bce', '#ed9226', '#d34b38', '#325aba']
export function routeColor(index: number): string {
    return RouteColors[index % RouteColors.length]
}

export function routeBonusArrows(
    bonuses: readonly RouteBonus[] = []
): Pick<MapRoute, 'bonusArrowIds'> {
    const bonusArrowIds = [...new Set(bonuses.flatMap((bonus) => bonus.arrowIds ?? []))]
    return bonusArrowIds.length ? { bonusArrowIds } : {}
}

// The run's metadata holds each route as evaluated, with the bonuses it earned.
export function recordedRunRoutes(run: RunTrains): readonly (TrainRoute | RouteResult)[] {
    return run.metadata?.routes ?? run.routes
}

/** What a run's payment to the treasury beside its revenue is called where a title names nothing. */
export const DefaultRunSubsidyName = 'subsidy to the treasury'

/** The hexes the trains' runs stand on: each start and its track, a run at one station having no track. */
export function runLocationIds(routes: readonly Pick<TrainRoute, 'start' | 'paths'>[]): string[] {
    return [
        ...new Set(
            routes.flatMap((route) => [
                route.start.locationId,
                ...route.paths.map((path) => path.locationId)
            ])
        )
    ]
}

/** Each train's track and any extension; colours follow ``trainIds``, as the train table's do. */
export function trainRouteOverlays(
    routes: readonly (Pick<TrainRoute, 'trainId' | 'paths' | 'extension'> &
        Partial<Pick<TrainRoute, 'start'>> &
        Pick<RouteResult, 'bonuses'>)[],
    trainIds?: readonly string[]
): MapRoute[] {
    return routes.map((route, index) => {
        const place = trainIds ? trainIds.indexOf(route.trainId) : index
        assert(place >= 0, `A route's train is one of the company's: ${route.trainId}`)
        return {
            id: route.trainId,
            color: routeColor(place),
            segments: route.paths,
            // A run at one station, on no track, is marked at the station (1822's L-trains).
            ...(route.paths.length || !route.start ? {} : { start: route.start }),
            ...(route.extension ? { extension: route.extension } : {}),
            ...routeBonusArrows(route.bonuses)
        }
    })
}
