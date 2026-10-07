import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    RailwayFields,
    RailwayMachineStates,
    StockTurnPurchaseFields,
    validatePendingPar,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import type * as Type from 'typebox'

export const EighteenThirtyTwoState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
)
export type EighteenThirtyTwoState = Type.Static<typeof EighteenThirtyTwoState>
export type HydratedEighteenThirtyTwoState = HydratedEighteenXXState<typeof EighteenThirtyTwoState>
export type EighteenThirtyTwoStateHandler = EighteenXXStateHandler<HydratedEighteenThirtyTwoState>
export const EighteenThirtyTwoStateDefinition = defineEighteenXXState(EighteenThirtyTwoState, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar
])
