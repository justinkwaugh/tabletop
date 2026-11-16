import { holdsAccessRight, type RevenueCenter, type RouteRules } from '@tabletop/18xx'
import { BuffaloLocationIds, Map1856, SarniaLocationId } from './map.js'
import { BridgeRightId, TunnelRightId } from './rights.js'
import { portToken, requireState1856 } from './state.js'
import { TileSet1856 } from './tiles.js'
import { TrainDepot1856, revenueStages1856 } from './trains.js'

export const PortBonus1856 = 20
export const RightBonus1856 = 10

/** The port token raises its city's value by $20 for the company it serves (Great Lakes Shipping). */
function portBonus(state: object, companyId: string, center: RevenueCenter): number {
    const port = portToken(state)
    return port?.companyId === companyId &&
        port.locationId === center.locationId &&
        port.nodeId === center.nodeId
        ? PortBonus1856
        : 0
}

/** The bridge and tunnel rights add $10 to a run to Buffalo or Sarnia (Niagara Falls, St. Clair). */
function rightBonus(state: object, companyId: string, locationId: string): string | undefined {
    const title = requireState1856(state)
    if (
        BuffaloLocationIds.includes(locationId) &&
        holdsAccessRight(title, companyId, BridgeRightId)
    )
        return BridgeRightId
    if (locationId === SarniaLocationId && holdsAccessRight(title, companyId, TunnelRightId))
        return TunnelRightId
    return undefined
}

// Red areas pay their first value until the 5s, their second until the last phase; a run needs a
// station and two places, small cities counted (Operate Trains).
export const RouteRules1856: RouteRules = {
    map: Map1856,
    tileSet: TileSet1856,
    depot: TrainDepot1856,
    revenueStage: (state) => revenueStages1856(state.phaseId),
    requiresCity: () => false,
    stopBonus: (state, _train, companyId, center) =>
        portBonus(state, companyId, center) +
        (rightBonus(state, companyId, center.locationId) ? RightBonus1856 : 0),
    stopBonusSourceIds: (state, _train, companyId, center) => {
        const right = rightBonus(state, companyId, center.locationId)
        return [...(portBonus(state, companyId, center) ? ['port'] : []), ...(right ? [right] : [])]
    }
}
