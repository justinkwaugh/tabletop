import {
    EighteenXXTransferTiming,
    RailwayMapState,
    TrackNetwork,
    controllingOwner,
    holdsAccessRight,
    privateOwningCompany,
    privatePowerUsed,
    type AccessRightRules,
    type AccessRightState,
    type CompanyDecisionState,
    type PrivateTokenTerms,
    type RevenueCenter,
    type StationState
} from '@tabletop/18xx'
import {
    LondonLocationId,
    LondonShippingLocationId,
    LuxembourgLocationId,
    EighteenNinetyFourMap
} from './map.js'
import { LondonShippingPrivateId } from './privates.js'
import { EighteenNinetyFourTileSet } from './tiles.js'

export const FerryRightId = 'ferry'
const FerryPrice = 80
const LondonShippingFerryPrice = 40

/** Without a ferry marker, a company may not run to or through London, nor build via it (§14). */
export function londonAccess(
    state: AccessRightState,
    companyId: string,
    center: RevenueCenter
): boolean {
    return (
        center.locationId !== LondonLocationId || holdsAccessRight(state, companyId, FerryRightId)
    )
}

/** Whether the company holds London shipping's station in A12 (§11.2.2.6). */
export function holdsLondonShippingStation(state: StationState, companyId: string): boolean {
    return state.stations.some(
        (station) =>
            station.status === 'placed' &&
            station.companyId === companyId &&
            station.position.locationId === LondonShippingLocationId
    )
}

/**
 * The value a company's route adds to London with the A12 station: the route's largest
 * revenue besides London's and Luxembourg's (§11.2.2.6).
 */
export function londonBonus(state: StationState, companyId: string) {
    return holdsLondonShippingStation(state, companyId)
        ? [
              {
                  locationIds: [LondonLocationId],
                  ignoredLocationIds: [LuxembourgLocationId],
                  sourceId: LondonShippingPrivateId
              }
          ]
        : []
}

// Four ferry markers: ₣80, or ₣40 for London shipping's owner, for a company whose track
// reaches London from one of its stations (§14.1).
export const EighteenNinetyFourAccessRightRules: AccessRightRules = {
    rights: [{ id: FerryRightId, name: 'Ferry marker', supply: 4 }],
    purchaseTerms(state, companyId) {
        const network = new TrackNetwork(
            new RailwayMapState(
                EighteenNinetyFourMap,
                EighteenNinetyFourTileSet,
                state.tileInventory
            ),
            state,
            companyId
        )
        if (!network.reaches(LondonLocationId, { kind: 'node', nodeId: 'city' }))
            return { reason: 'The company’s track does not reach London.' }
        return {
            price:
                privateOwningCompany(state, LondonShippingPrivateId) === companyId
                    ? LondonShippingFerryPrice
                    : FerryPrice
        }
    }
}

/** London shipping's owner may place its cheapest station free in A12, once (§11.2.2.6). */
export function londonShippingTokenTerms(
    state: CompanyDecisionState,
    privateCompanyId: string,
    playerId: string
): PrivateTokenTerms | undefined {
    if (privateCompanyId !== LondonShippingPrivateId || privatePowerUsed(state, privateCompanyId))
        return undefined
    const companyId = EighteenXXTransferTiming.operatingCompany(state)
    if (
        !companyId ||
        privateOwningCompany(state, privateCompanyId) !== companyId ||
        controllingOwner(state, companyId)?.playerId !== playerId ||
        state.stations.some(
            (station) =>
                station.status === 'placed' &&
                station.position.locationId === LondonShippingLocationId
        ) ||
        !state.stations.some(
            (station) => station.companyId === companyId && station.status === 'available'
        )
    )
        return undefined
    return {
        companyId,
        positions: [{ locationId: LondonShippingLocationId, nodeId: 'city', slot: 0 }]
    }
}
