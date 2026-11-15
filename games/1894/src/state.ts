import {
    AccessRightFields,
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    CorporateFinanceFields,
    PrivateStationFields,
    RailwayFields,
    RailwayMachineStates,
    StockTurnPurchaseFields,
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
        ...CorporateFinanceFields
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
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
