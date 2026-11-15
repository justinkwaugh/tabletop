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
import { TitleFields1862 } from './titleState.js'

/** Title machine states: Parliament, a director buying stations, and the title's decisions. */
export const ParliamentState = 'ParliamentRound'
export const BuyingStationsState = 'BuyingStations'
export const PayingFineState = 'PayingFine'
export const MergingSharesState = 'MergingShares'
export const TitleMachineStates = [
    ParliamentState,
    BuyingStationsState,
    PayingFineState,
    MergingSharesState
] as const

// 1862 funds trains its own way, by selling treasury shares or refinancing (§7.11), so it has no
// family train funding, and a company, not a player, goes bankrupt.
const { trainFunding: _funding, bankruptcy: _bankruptcy, ...Railway } = RailwayFields
const FamilyStates = RailwayMachineStates.filter(
    (state) => state !== 'FundingTrain' && state !== 'Bankrupt'
)

export const State1862 = composeEighteenXXState({ ...Railway, ...TitleFields1862 }, [
    ...FamilyStates,
    ...TitleMachineStates
])
export type State1862 = Type.Static<typeof State1862>
export type HydratedState1862 = HydratedEighteenXXState<typeof State1862>
export type StateHandler1862 = EighteenXXStateHandler<HydratedState1862>
// A refinancing or an acquisition pauses the operating turn after its run.
export const StateDefinition1862 = defineEighteenXXState(State1862, [
    railwayStateValidation({ operatingInterruptions: [MergingSharesState] })
])

function isState1862(state: object): state is HydratedState1862 {
    return 'permits' in state && 'chartered' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1862(state: object): HydratedState1862 {
    assert(isState1862(state), 'Family hooks receive the 1862 state')
    return state
}
