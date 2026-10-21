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
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

export const EighteenNinetyFourState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        /** The French company drawn at setup to start floated beside the Belge (§3). */
        frenchCompanyId: Type.String()
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
