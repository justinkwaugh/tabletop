import {
    AccessRightFields,
    AuctionFields,
    CashCrisisFields,
    CashCrisisMachineStates,
    ClosingOperatingCorporationState,
    CorporateFinanceFields,
    LocationMarkerFields,
    BorrowingCompany,
    LoanFields,
    LoanMachineStates,
    PendingParFields,
    PresidencyExchangeFields,
    PrivatePowerFields,
    PrivateStationFields,
    TurnMarkFields,
    RailwayFields,
    RailwayMachineStates,
    WaterfallAuctionMachineStates,
    composeEighteenXXState,
    defineEighteenXXState,
    railwayStateValidation,
    validateCashCrisis,
    validatePendingPar,
    validateWaterfallAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'
import { TitleFields1849 } from './titleState.js'

export const State1849 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateStationFields,
        ...LoanFields,
        // A corporation counts its issued bond as a loan (§14.2).
        companies: Type.Array(BorrowingCompany),
        ...PendingParFields,
        ...PresidencyExchangeFields,
        ...AuctionFields,
        ...CorporateFinanceFields,
        ...LocationMarkerFields,
        ...AccessRightFields,
        ...CashCrisisFields,
        ...TurnMarkFields,
        ...TitleFields1849
    },
    [
        ...RailwayMachineStates,
        ...WaterfallAuctionMachineStates,
        ...LoanMachineStates,
        ...CashCrisisMachineStates,
        ClosingOperatingCorporationState
    ]
)
export type State1849 = Type.Static<typeof State1849>
export type HydratedState1849 = HydratedEighteenXXState<typeof State1849>
export type StateHandler1849 = EighteenXXStateHandler<HydratedState1849>
export const StateDefinition1849 = defineEighteenXXState(State1849, [
    railwayStateValidation({ operatingInterruptions: [] }),
    validateWaterfallAuction,
    validatePendingPar,
    validateCashCrisis
])

function isState1849(state: object): state is HydratedState1849 {
    return 'corporationOrder' in state && 'restarts' in state && 'loans' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1849(state: object): HydratedState1849 {
    assert(isState1849(state), 'Family hooks receive the 1849 state')
    return state
}
