import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    OwnershipExemptionFields,
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
import { assert } from '@tabletop/common'
import type * as Type from 'typebox'
import {
    ConsentingRedemptionState,
    EighteenThirtyTwoTitleFields,
    ProtectingPriceState
} from './titleState.js'

export const EighteenThirtyTwoState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...OwnershipExemptionFields,
        ...EighteenThirtyTwoTitleFields
    },
    [
        ...RailwayMachineStates,
        ...WaterfallAuctionMachineStates,
        ProtectingPriceState,
        ConsentingRedemptionState
    ]
)
export type EighteenThirtyTwoState = Type.Static<typeof EighteenThirtyTwoState>
export type HydratedEighteenThirtyTwoState = HydratedEighteenXXState<typeof EighteenThirtyTwoState>
export type EighteenThirtyTwoStateHandler = EighteenXXStateHandler<HydratedEighteenThirtyTwoState>
export const EighteenThirtyTwoStateDefinition = defineEighteenXXState(EighteenThirtyTwoState, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar
])

function isEighteenThirtyTwoState(state: object): state is HydratedEighteenThirtyTwoState {
    return 'coalRights' in state && 'revenueTokens' in state && 'usedPrivatePowerIds' in state
}

/** A family hook's state, which is always this title's. */
export function requireEighteenThirtyTwoState(state: object): HydratedEighteenThirtyTwoState {
    assert(isEighteenThirtyTwoState(state), 'Family hooks receive the 1832 state')
    return state
}
