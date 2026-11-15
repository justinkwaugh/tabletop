import type { RouteRules } from '@tabletop/18xx'
import { DestinationRuns1870 } from './destinations.js'
import { Map1870 } from './map.js'
import { requireState1870 } from './state.js'
import { TileSet1870 } from './tiles.js'
import { revenueTokenRoutes } from './tokens.js'
import { TrainDepot1870, revenueStages } from './trains.js'

export const RouteRules1870: RouteRules = {
    map: Map1870,
    tileSet: TileSet1870,
    depot: TrainDepot1870,
    revenueStage: (state) => revenueStages(state.phaseId),
    requiresCity: () => false,
    ...revenueTokenRoutes,
    // A company's destination station doubles its city at the end of a run (p. 20).
    revenuePolicy(train, state, companyId) {
        const doubling = DestinationRuns1870.doubling(requireState1870(state), train, companyId)
        return doubling ? { connectionBonuses: [doubling] } : {}
    },
    // A connection run has one train run from the starting city to the destination (p. 22).
    requiredRouteEnds: (state, companyId) =>
        DestinationRuns1870.requiredRouteEnds(requireState1870(state), companyId)
}
