import {
    BidBoxFields,
    CorporateFinanceFields,
    OwnershipExemptionFields,
    PrivatePowerFields,
    RailwayFields,
    TrackConsentFields,
    RailwayMachineStates,
    TurnMarkFields,
    composeEighteenXXState,
    defineEighteenXXState,
    railwayStateValidation,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import type * as Type from 'typebox'
import { TitleFields1822 } from './titleState.js'

export const State1822 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...CorporateFinanceFields,
        ...OwnershipExemptionFields,
        ...TurnMarkFields,
        ...BidBoxFields,
        ...TrackConsentFields,
        ...TitleFields1822
    },
    [...RailwayMachineStates]
)
export type State1822 = Type.Static<typeof State1822>
export type HydratedState1822 = HydratedEighteenXXState<typeof State1822>
export type StateHandler1822 = EighteenXXStateHandler<HydratedState1822>
export const StateDefinition1822 = defineEighteenXXState(State1822, [
    railwayStateValidation({ operatingInterruptions: [] })
])

function isState1822(state: object): state is HydratedState1822 {
    return 'bidBoxes' in state && 'playerLoans' in state && 'debutCompanyIds' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1822(state: object): HydratedState1822 {
    assert(isState1822(state), 'Family hooks receive the 1822 state')
    return state
}
