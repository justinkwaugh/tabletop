import {
    AuctionFields,
    composeEighteenXXState,
    ConsentingRedemptionState,
    defineEighteenXXState,
    PendingParFields,
    PlacingDestinationStationState,
    PrivatePowerFields,
    ProtectingPriceState,
    RailwayFields,
    RailwayMachineStates,
    railwayStateValidation,
    StockTurnPurchaseFields,
    validatePendingPar,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    ClosingOperatingCorporationState,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import type * as Type from 'typebox'
import { TitleFields1870 } from './titleState.js'

export const State1870 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...TitleFields1870
    },
    [
        ...RailwayMachineStates,
        ...WaterfallAuctionMachineStates,
        ClosingOperatingCorporationState,
        ProtectingPriceState,
        ConsentingRedemptionState,
        PlacingDestinationStationState
    ]
)
export type State1870 = Type.Static<typeof State1870>
export type HydratedState1870 = HydratedEighteenXXState<typeof State1870>
export type StateHandler1870 = EighteenXXStateHandler<HydratedState1870>
export const StateDefinition1870 = defineEighteenXXState(State1870, [
    // A sale's price protection waits on presidents mid-turn, after the company's run.
    railwayStateValidation({ operatingInterruptions: [ProtectingPriceState] }),
    validateWaterfallAuction,
    validatePendingPar
])

function isState1870(state: object): state is HydratedState1870 {
    return 'revenueTokens' in state && 'destinationRunsMade' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1870(state: object): HydratedState1870 {
    assert(isState1870(state), 'Family hooks receive the 1870 state')
    return state
}
