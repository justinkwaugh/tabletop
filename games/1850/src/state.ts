import {
    AuctionFields,
    composeEighteenXXState,
    ConsentingRedemptionState,
    defineEighteenXXState,
    PrivatePowerFields,
    ProtectingPriceState,
    RailwayFields,
    RailwayMachineStates,
    railwayStateValidation,
    StockTurnPurchaseFields,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    ClosingOperatingCorporationState,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import type * as Type from 'typebox'
import { TitleFields1850 } from './titleState.js'

export const State1850 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...TitleFields1850
    },
    [
        ...RailwayMachineStates,
        ...WaterfallAuctionMachineStates,
        ClosingOperatingCorporationState,
        ProtectingPriceState,
        ConsentingRedemptionState
    ]
)
export type State1850 = Type.Static<typeof State1850>
export type HydratedState1850 = HydratedEighteenXXState<typeof State1850>
export type StateHandler1850 = EighteenXXStateHandler<HydratedState1850>
export const StateDefinition1850 = defineEighteenXXState(State1850, [
    // A sale's price protection waits on presidents mid-turn, after the company's run.
    railwayStateValidation({ operatingInterruptions: [ProtectingPriceState] }),
    validateWaterfallAuction
])

function isState1850(state: object): state is HydratedState1850 {
    return 'edgeTokens' in state && 'mesabiRights' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1850(state: object): HydratedState1850 {
    assert(isState1850(state), 'Family hooks receive the 1850 state')
    return state
}
