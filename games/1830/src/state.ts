import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
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

export const EighteenThirtyState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateStationFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,

        ...AuctionFields,
        multipleBrownFromIpo: Type.Optional(Type.Literal(true))
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
)
export type EighteenThirtyState = Type.Static<typeof EighteenThirtyState>
export type HydratedEighteenThirtyState = HydratedEighteenXXState<typeof EighteenThirtyState>
export const EighteenThirtyStateDefinition = defineEighteenXXState(EighteenThirtyState, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar
])
