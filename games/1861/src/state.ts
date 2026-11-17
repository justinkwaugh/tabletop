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
    TrainlessMajorsState,
    validateMergerRound,
    RailwayFields,
    RailwayMachineStates,
    SelectionAuctionFields,
    SelectionAuctionMachineStates,
    TurnMarkFields,
    validateCompanyAuction,
    railwayStateValidation,
    validateSelectionAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

/** The optional rules chosen when the game was set up (§14). */
export const Variants1861 = Type.Object(
    {
        /** Nationalisation pays R5 a share less for each space below R35 (GTG §14). */
        noPriceFloor: Type.Optional(Type.Literal(true)),
        /** The RSR exports a train at the end of each set instead of operating (GTG §14). */
        trainExports: Type.Optional(Type.Literal(true)),
        /** The first 8-train does not end the game; play until the bank breaks (GTG §14). */
        longGame: Type.Optional(Type.Literal(true)),
        /** After an auction the next turn is the proposer's left, not the winner's (GTG §14). */
        proposerOrder: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type Variants1861 = Type.Static<typeof Variants1861>

// A company without a train borrows for one rather than its director paying (§10.10): there is
// no family train funding, and nobody goes bankrupt.
const { trainFunding: _funding, bankruptcy: _bankruptcy, ...Railway } = RailwayFields
const FamilyStates = RailwayMachineStates.filter(
    (state) => state !== 'FundingTrain' && state !== 'Bankrupt'
)

export const State1861 = composeEighteenXXState(
    {
        ...Railway,
        companies: Type.Array(BorrowingCompany),
        ...SelectionAuctionFields,
        ...CompanyAuctionFields,
        ...LoanFields,
        ...TurnMarkFields,
        ...CorporateFinanceFields,
        variants: Variants1861,
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
export type State1861 = Type.Static<typeof State1861>
export type HydratedState1861 = HydratedEighteenXXState<typeof State1861>
export type StateHandler1861 = EighteenXXStateHandler<HydratedState1861>

// A phase's nationalisations may pause an operating turn (§11).
export const StateDefinition1861 = defineEighteenXXState(State1861, [
    railwayStateValidation({
        operatingInterruptions: [TrainlessMajorsState],
        phaseDecisionStates: [TrainlessMajorsState]
    }),
    validateSelectionAuction,
    validateCompanyAuction,
    validateMergerRound
])

function isState1861(state: object): state is HydratedState1861 {
    return 'variants' in state && 'stockRound' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1861(state: object): HydratedState1861 {
    assert(isState1861(state), 'Family hooks receive the 1861 state')
    return state
}
