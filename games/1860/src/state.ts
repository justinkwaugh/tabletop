import {
    composeEighteenXXState,
    defineEighteenXXState,
    railwayStateValidation,
    RailwayFields,
    RailwayMachineStates,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import type * as Type from 'typebox'
import { TitleFields1860 } from './titleState.js'

/** The opening's six auctions for the right to choose a certificate. */
export const ChoiceAuctionState = 'ChoiceAuction'
/** A director laying the tile on a floating company's bare home hex (Flotation). */
export const LayingHomeTileState = 'LayingHomeTile'
/** A director returning trains over the limit as the company's turn begins (Buying Trains). */
export const ReturningTrainsState = 'ReturningTrains'
export const TitleMachineStates = [
    ChoiceAuctionState,
    LayingHomeTileState,
    ReturningTrainsState
] as const

// Players never pay for a company's trains and never go bankrupt (Buying Trains, Insolvency), so
// there is no family train funding; a company becomes insolvent, or bankrupt by its price.
const { trainFunding: _funding, bankruptcy: _bankruptcy, ...Railway } = RailwayFields
const FamilyStates = RailwayMachineStates.filter(
    (state) => state !== 'FundingTrain' && state !== 'Bankrupt'
)

export const State1860 = composeEighteenXXState({ ...Railway, ...TitleFields1860 }, [
    ...FamilyStates,
    ...TitleMachineStates
])
export type State1860 = Type.Static<typeof State1860>
export type HydratedState1860 = HydratedEighteenXXState<typeof State1860>
export type StateHandler1860 = EighteenXXStateHandler<HydratedState1860>

export const StateDefinition1860 = defineEighteenXXState(State1860, [railwayStateValidation()])

function isState1860(state: object): state is HydratedState1860 {
    return 'insolventIds' in state && 'bankruptIds' in state && 'options' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1860(state: object): HydratedState1860 {
    assert(isState1860(state), 'Family hooks receive the 1860 state')
    return state
}
