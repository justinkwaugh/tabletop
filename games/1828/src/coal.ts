import {
    ConstructionReachability,
    RailwayMapState,
    StopAccess,
    holdsAccessRight,
    type AccessRightRules,
    type AccessRightState
} from '@tabletop/18xx'
import { CobourgRailwayId } from './ids.js'
import { CoalfieldsLocationId, Map1828, TunnelLocationId } from './map.js'
import { requireState1828 } from './state.js'
import { TileSet1828 } from './tiles.js'

export const CoalRightId = 'coal'
/** Two coal markers start on the Virginia Coalfields and one on its tunnel (§4, §16). */
export const CoalMarkerCount = 3
export const CoalMarkerPrice = 120

export function coalHolders(state: AccessRightState): string[] {
    return (state.accessRights ?? [])
        .filter((right) => right.rightId === CoalRightId)
        .map((right) => right.companyId)
}

/** Whether the tunnel's coal marker is still there: the tunnel is not yet built (§14.3.1.2). */
export function tunnelHoldsCoal(state: object): boolean {
    return !requireState1828(state).tileInventory.placements[TunnelLocationId]
}

/** Coal markers on the Virginia Coalfields, for sale (§16). */
export function coalfieldsMarkers(state: object): number {
    const title = requireState1828(state)
    return CoalMarkerCount - coalHolders(title).length - (tunnelHoldsCoal(title) ? 1 : 0)
}

/**
 * Only a company holding a coal marker may build, place stations or run through the Virginia
 * Coalfields, or end a route there (§14.3.1.1, §15.2).
 */
export const CoalAccess = new StopAccess({
    locationId: CoalfieldsLocationId,
    tokens: CoalMarkerCount,
    holders: (state) => coalHolders(requireState1828(state))
})

/** Whether the company's track reaches the Virginia Coalfields (§8.3, §16). */
export function reachesCoalfields(
    state: Parameters<AccessRightRules['purchaseTerms']>[0],
    companyId: string
) {
    return new ConstructionReachability(
        new RailwayMapState(Map1828, TileSet1828, state.tileInventory),
        requireState1828(state),
        companyId,
        (locationId) => locationId === CoalfieldsLocationId
    ).canReach(CoalfieldsLocationId)
}

/** A company may own one coal marker; one reaching the Coalfields buys one there for $120 (§16). */
export const AccessRightRules1828: AccessRightRules = {
    rights: [{ id: CoalRightId, name: 'Coal marker', supply: CoalMarkerCount }],
    purchaseTerms(state, companyId) {
        if (companyId === CobourgRailwayId)
            return { reason: 'Only share companies acquire coal markers.' }
        if (coalfieldsMarkers(state) <= 0)
            return { reason: 'No coal marker remains on the Virginia Coalfields.' }
        if (!reachesCoalfields(state, companyId))
            return { reason: 'The company’s track must reach the Virginia Coalfields.' }
        return { price: CoalMarkerPrice }
    }
}

/**
 * Building the tunnel takes its coal marker: the builder's, or back to the Coalfields when the
 * builder already holds one or is the C&P, no share company (§14.3.1.2, §16.1).
 */
export function takeTunnelCoal(state: object, companyId: string): 'taken' | 'returned' {
    const title = requireState1828(state)
    if (companyId === CobourgRailwayId || holdsAccessRight(title, companyId, CoalRightId))
        return 'returned'
    title.accessRights = [...(title.accessRights ?? []), { rightId: CoalRightId, companyId }]
    return 'taken'
}
