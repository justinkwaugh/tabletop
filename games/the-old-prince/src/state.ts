import {
    composeEighteenXXState,
    defineEighteenXXState,
    NumberedCertificate,
    OfferAuctionMachineStates,
    OfferPileFields,
    OwnershipExemptionFields,
    RailwayFields,
    RailwayMachineStates,
    RoleCompany,
    TrackConsentFields,
    TrancheFields,
    validateRailwayState,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

export const TheOldPrinceState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...TrackConsentFields,

        companies: Type.Array(RoleCompany),
        certificates: Type.Array(NumberedCertificate),
        ...OfferPileFields,
        ...TrancheFields,
        ...OwnershipExemptionFields
    },
    [...RailwayMachineStates, ...OfferAuctionMachineStates]
)
export type TheOldPrinceState = Type.Static<typeof TheOldPrinceState>
export type HydratedTheOldPrinceState = HydratedEighteenXXState<typeof TheOldPrinceState>
export const TheOldPrinceStateDefinition = defineEighteenXXState(
    TheOldPrinceState,
    [validateRailwayState],
    readStoredState
)

function readStoredState(data: unknown): unknown {
    if (!data || typeof data !== 'object' || !('usedPrivatePowerIds' in data)) return data
    // The existing hosted TOP save contains this obsolete empty placeholder.
    const { usedPrivatePowerIds, ...state } = data
    return Array.isArray(usedPrivatePowerIds) && usedPrivatePowerIds.length === 0 ? state : data
}
