import {
    BorrowingCompany,
    CompanyAuctionFields,
    CorporateFinanceFields,
    composeEighteenXXState,
    defineEighteenXXState,
    LoanFields,
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
import { MergerRound1861, MergerRoundStates1861, validateMergerRound1861 } from './mergerState.js'

const Id = Type.String({ minLength: 1 })

/** The optional rules chosen when the game was set up (§14). */
export const Variants1861 = Type.Object(
    {
        /** Two 2+2- and two 5+5E-trains rather than unlimited ones (GTG §14). */
        twoSpecialTrains: Type.Optional(Type.Literal(true)),
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

/**
 * Public companies left without a train as phase 4, 6 or 8 begins, whose directors decide in
 * operating order whether to nationalise them (§11).
 */
export const TrainlessMajors1861 = Type.Object(
    {
        companyIds: Type.Array(Id, { uniqueItems: true }),
        continuation: Id,
        /** Who was to act where play continues. */
        activePlayerIds: Type.Array(Id)
    },
    { additionalProperties: false }
)
export type TrainlessMajors1861 = Type.Static<typeof TrainlessMajors1861>

export const TrainlessMajorsState = 'NationalisingTrainless'

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
        mergerRound: Type.Optional(MergerRound1861),
        /** Where the first 8-train was bought, which decides the last rounds (§13). */
        phaseEightAt: Type.Optional(
            Type.Object(
                { set: Type.Integer({ minimum: 1 }), round: Type.Integer({ minimum: 1 }) },
                { additionalProperties: false }
            )
        ),
        trainlessMajors: Type.Optional(TrainlessMajors1861)
    },
    [
        ...FamilyStates,
        ...SelectionAuctionMachineStates,
        ...MergerRoundStates1861,
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
    validateMergerRound1861
])

function isState1861(state: object): state is HydratedState1861 {
    return 'variants' in state && 'stockRound' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1861(state: object): HydratedState1861 {
    assert(isState1861(state), 'Family hooks receive the 1861 state')
    return state
}
