import {
    AccessRightFields,
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    PrivateStationFields,
    RailwayFields,
    RailwayMachineStates,
    StockTurnPurchaseFields,
    TreasuryShareFields,
    TreasuryShareMachineStates,
    validatePendingPar,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

export const EighteenNinetyFourState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateStationFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...AccessRightFields,
        ...TreasuryShareFields
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates, ...TreasuryShareMachineStates]
)
export type EighteenNinetyFourState = Type.Static<typeof EighteenNinetyFourState>
export type HydratedEighteenNinetyFourState = HydratedEighteenXXState<
    typeof EighteenNinetyFourState
>
export const EighteenNinetyFourStateDefinition = defineEighteenXXState(EighteenNinetyFourState, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar
])
