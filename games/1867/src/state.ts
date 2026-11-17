import {
    BorrowingCompany,
    CompanyAuctionFields,
    CorporateFinanceFields,
    composeEighteenXXState,
    defineEighteenXXState,
    LoanFields,
    MergerRoundFields,
    MergerRoundMachineStates,
    PhaseNationalisationFields,
    RailwayFields,
    RailwayMachineStates,
    SelectionAuctionFields,
    SelectionAuctionMachineStates,
    TrainlessMajorsState,
    TurnMarkFields,
    validateCompanyAuction,
    validateMergerRound,
    railwayStateValidation,
    validateSelectionAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

/** The optional rules chosen when the game was set up (GTG §14). */
export const Variants1867 = Type.Object(
    {
        /** Nationalisation pays $5 a share less for each space below $35. */
        noPriceFloor: Type.Optional(Type.Literal(true)),
        /** The first 8-train does not end the game; play until the bank breaks. */
        longGame: Type.Optional(Type.Literal(true)),
        /** After an auction the next turn is the proposer's left, not the winner's. */
        proposerOrder: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type Variants1867 = Type.Static<typeof Variants1867>

// A company without a train borrows for one rather than its president paying (GTG §8.11.3):
// there is no family train funding, and nobody goes bankrupt.
const { trainFunding: _funding, bankruptcy: _bankruptcy, ...Railway } = RailwayFields
const FamilyStates = RailwayMachineStates.filter(
    (state) => state !== 'FundingTrain' && state !== 'Bankrupt'
)

export const State1867 = composeEighteenXXState(
    {
        ...Railway,
        companies: Type.Array(BorrowingCompany),
        ...SelectionAuctionFields,
        ...CompanyAuctionFields,
        ...LoanFields,
        ...TurnMarkFields,
        ...CorporateFinanceFields,
        variants: Variants1867,
        ...MergerRoundFields,
        ...PhaseNationalisationFields
    },
    [
        ...FamilyStates,
        ...SelectionAuctionMachineStates,
        ...MergerRoundMachineStates,
        TrainlessMajorsState
    ]
)
export type State1867 = Type.Static<typeof State1867>
export type HydratedState1867 = HydratedEighteenXXState<typeof State1867>
export type StateHandler1867 = EighteenXXStateHandler<HydratedState1867>

// A phase's nationalisations may pause an operating turn (GTG §10).
export const StateDefinition1867 = defineEighteenXXState(State1867, [
    railwayStateValidation({
        operatingInterruptions: [TrainlessMajorsState],
        phaseDecisionStates: [TrainlessMajorsState]
    }),
    validateSelectionAuction,
    validateCompanyAuction,
    validateMergerRound
])

function isState1867(state: object): state is HydratedState1867 {
    return 'variants' in state && 'stockRound' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1867(state: object): HydratedState1867 {
    assert(isState1867(state), 'Family hooks receive the 1867 state')
    return state
}
