import type { TrainRoute } from '@tabletop/18xx'
import type { MapRoute } from '../maps/mapDrawing.js'

const RouteColors = ['#b24bce', '#ed9226', '#d34b38', '#325aba']
export function routeColor(index: number): string {
    return RouteColors[index % RouteColors.length]
}

export function trainRouteOverlays(
    routes: readonly Pick<TrainRoute, 'trainId' | 'paths'>[]
): MapRoute[] {
    return routes.map((route, index) => ({
        id: route.trainId,
        color: routeColor(index),
        segments: route.paths
    }))
}
