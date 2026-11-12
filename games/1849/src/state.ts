import {
    AuctionFields,
    ClosingOperatingCorporationState,
    CorporateFinanceFields,
    LocationMarkerFields,
    PendingParFields,
    PresidencyExchangeFields,
    PrivatePowerFields,
    PrivateStationFields,
    RailwayFields,
    RailwayMachineStates,
    WaterfallAuctionMachineStates,
    composeEighteenXXState,
    defineEighteenXXState,
    railwayStateValidation,
    validatePendingPar,
    validateWaterfallAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import type * as Type from 'typebox'
import { TitleFields1849 } from './titleState.js'

export const State1849 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateStationFields,
        ...PendingParFields,
        ...PresidencyExchangeFields,
        ...AuctionFields,
        ...CorporateFinanceFields,
        ...LocationMarkerFields,
        ...TitleFields1849
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates, ClosingOperatingCorporationState]
)
export type State1849 = Type.Static<typeof State1849>
export type HydratedState1849 = HydratedEighteenXXState<typeof State1849>
export type StateHandler1849 = EighteenXXStateHandler<HydratedState1849>
export const StateDefinition1849 = defineEighteenXXState(State1849, [
    railwayStateValidation({ operatingInterruptions: [] }),
    validateWaterfallAuction,
    validatePendingPar
])

function isState1849(state: object): state is HydratedState1849 {
    return 'corporationOrder' in state && 'restarts' in state && 'loans' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1849(state: object): HydratedState1849 {
    assert(isState1849(state), 'Family hooks receive the 1849 state')
    return state
}
