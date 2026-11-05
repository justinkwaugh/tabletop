import type { RouteRules } from '@tabletop/18xx'
import { londonAccess, londonBonus } from './london.js'
import {
    EighteenNinetyFourMap,
    LuxembourgLocationId,
    NetherlandsLocationId,
    OffboardLocationIds
} from './map.js'
import { EighteenNinetyFourTileSet } from './tiles.js'
import { EighteenNinetyFourPhases, EighteenNinetyFourTrainDepot } from './trains.js'

export const EighteenNinetyFourRouteRules: RouteRules = {
    map: EighteenNinetyFourMap,
    tileSet: EighteenNinetyFourTileSet,
    depot: EighteenNinetyFourTrainDepot,
    // Yellow values apply until phase 5+1 (§15).
    revenueStage: (state) => EighteenNinetyFourPhases.phase(state.phaseId).tileColors,
    requiresCity: () => false,
    stopAllowed: londonAccess,
    // The Netherlands earn F100 more on a route to another offboard location (§13.4.4).
    revenuePolicy: () => ({
        connectionBonuses: [
            {
                from: { [NetherlandsLocationId]: 100 },
                to: Object.fromEntries(OffboardLocationIds.map((id) => [id, 0])),
                sourceId: 'netherlands'
            }
        ]
    }),
    // Luxembourg is worth the route's largest other revenue (§9); London shipping's station
    // raises London (§11.2.2.6).
    bestStopBonuses: (state, companyId) => [
        { locationIds: [LuxembourgLocationId], sourceId: 'luxembourg' },
        ...londonBonus(state, companyId)
    ]
}
