import type { RouteRules } from '@tabletop/18xx'
import { coalFieldsAccess } from './coalFields.js'
import { revenueTokenRoutes } from './revenueTokens.js'
import { EighteenThirtyTwoMap } from './map.js'
import { EighteenThirtyTwoTileSet } from './tiles.js'
import { EighteenThirtyTwoTrainDepot, revenueStages } from './trains.js'

export const EighteenThirtyTwoRouteRules: RouteRules = {
    map: EighteenThirtyTwoMap,
    tileSet: EighteenThirtyTwoTileSet,
    depot: EighteenThirtyTwoTrainDepot,
    revenueStage: (state) => revenueStages(state.phaseId),
    requiresCity: () => false,
    ...coalFieldsAccess,
    ...revenueTokenRoutes
}
