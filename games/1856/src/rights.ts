import {
    ConstructionReachability,
    RailwayMapState,
    getCompany,
    holdsAccessRight,
    privateOwner,
    type AccessRightRules,
    type AccessRightState,
    type PurchaseOffer
} from '@tabletop/18xx'
import { BridgeId, TunnelId } from './ids.js'
import { BuffaloLocationIds, Map1856, SarniaLocationId } from './map.js'
import { requireState1856 } from './state.js'
import { TileSet1856 } from './tiles.js'

export const BridgeRightId = 'bridge'
export const TunnelRightId = 'tunnel'

/** The private whose owning company holds each right, and sells it to others. */
export const RightPrivates: Readonly<Record<string, string>> = {
    [BridgeRightId]: BridgeId,
    [TunnelRightId]: TunnelId
}

/** The right a private gives the company that owns it. */
export function privateRight(privateCompanyId: string): string | undefined {
    return Object.entries(RightPrivates).find(([, id]) => id === privateCompanyId)?.[0]
}

/** Where each right pays; a company must reach it to buy the right (designer, 2000). */
const RightLocations: Readonly<Record<string, readonly string[]>> = {
    [BridgeRightId]: BuffaloLocationIds,
    [TunnelRightId]: [SarniaLocationId]
}

/** The bridge and tunnel tokens: three of each, the owning company's among them (designer). */
export const RightSupply1856 = 3

/**
 * A company buys the right to the +$10 for $50 from the company owning its private, or from the
 * bank once the private has closed; not while a player owns the private (Niagara Falls
 * Suspension Bridge Company, St. Clair Frontier Tunnel Company).
 */
export const AccessRightRules1856: AccessRightRules = {
    rights: [
        { id: BridgeRightId, name: 'Bridge token', supply: RightSupply1856 },
        { id: TunnelRightId, name: 'Tunnel token', supply: RightSupply1856 }
    ],
    purchaseTerms(state, companyId, rightId) {
        const privateCompanyId = RightPrivates[rightId]
        if (!privateCompanyId) return { reason: 'Unknown right.' }
        const reach = new ConstructionReachability(
            new RailwayMapState(Map1856, TileSet1856, state.tileInventory),
            requireState1856(state),
            companyId
        )
        if (!RightLocations[rightId]?.some((locationId) => reach.canReach(locationId)))
            return { reason: 'Only a company that can reach it may buy this right.' }
        if (getCompany(state, privateCompanyId).closed)
            return { price: 50, recipient: { kind: 'bank' } }
        const owner = privateOwner(state, privateCompanyId)
        if (owner?.kind !== 'company')
            return { reason: 'The right may not be bought while a player owns the private.' }
        return { price: 50, recipient: owner }
    }
}

/** A company buying the private gains its right, and never loses it (Niagara Falls, St. Clair). */
export function grantPrivateRight(state: AccessRightState, offer: PurchaseOffer): void {
    if (offer.asset.kind !== 'private') return
    const rightId = privateRight(offer.asset.privateCompanyId)
    if (!rightId || holdsAccessRight(state, offer.buyer.companyId, rightId)) return
    state.accessRights = [
        ...(state.accessRights ?? []),
        { rightId, companyId: offer.buyer.companyId }
    ]
}
