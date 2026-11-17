import {
    composeEighteenXXState,
    defineEighteenXXState,
    InterruptedOperatingTurnStates,
    PendingParFields,
    PlayerLoanFields,
    railwayStateValidation,
    RailwayFields,
    RailwayMachineStates,
    SelectionAuctionFields,
    SelectionAuctionMachineStates,
    StockRoundInterruptionFields,
    StockRoundInterruptionMachineStates,
    TurnMarkFields,
    validatePendingPar,
    validateSelectionAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

/** The players choosing their foreign investors after the private auction (§VII). */
export const ChoosingInvestorsState = 'ChoosingInvestors'
/** The Rocket of China's owner choosing which company takes the second 4-train (§VI). */
export const ExchangingRocketState = 'ExchangingRocket'

/**
 * A foreign investor joined to its company's network, awaiting its owner's choice of where its
 * treasury goes, then the company's choice whether its station replaces the investor's (§VII):
 * one choice when the owner directs the company, else the director's after the owner's.
 */
export const InvestorMerger1880 = Type.Object(
    {
        investorId: Id,
        companyId: Id,
        /** The company's director, choosing the station once the treasury is settled. */
        stationChooser: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type InvestorMerger1880 = Type.Static<typeof InvestorMerger1880>

export const TitleFields1880 = {
    /** Each started major's par slot, 0 the top of its par price's four (§XII). */
    parSlots: Type.Record(Id, Type.Integer({ minimum: 0, maximum: 3 })),
    /** Each started major's building permits: the phase letters it builds in (§VIII). */
    permits: Type.Record(Id, Type.String({ pattern: '^A?B?C?D?$', minLength: 1 })),
    /** The operating round in which the last 8-train left the bank, ending the game (§XV). */
    lastEightRound: Type.Optional(Type.Integer({ minimum: 1 })),
    /** The company that last bought a new train from the bank (§X Purchase of Trains). */
    trainMarker: Type.Optional(Id),
    /** The majors that have received the second half of their capital (§XII). */
    fullyCapitalized: Type.Array(Id, { uniqueItems: true }),
    investorMerger: Type.Optional(InvestorMerger1880),
    /** The foreign investors the random investors variant left out of the game at setup. */
    removedInvestorIds: Type.Optional(Type.Array(Id, { minItems: 1, uniqueItems: true })),
    /** The Rocket of China's owner, choosing where the second 4-train goes (§VI). */
    rocketExchanger: Type.Optional(Id)
}

export const State1880 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...SelectionAuctionFields,
        ...PendingParFields,
        ...StockRoundInterruptionFields,
        ...PlayerLoanFields,
        ...TurnMarkFields,
        ...TitleFields1880
    },
    [
        ...RailwayMachineStates,
        ...SelectionAuctionMachineStates,
        ...StockRoundInterruptionMachineStates,
        ChoosingInvestorsState,
        ExchangingRocketState
    ]
)
export type State1880 = Type.Static<typeof State1880>
export type HydratedState1880 = HydratedEighteenXXState<typeof State1880>
export type StateHandler1880 = EighteenXXStateHandler<HydratedState1880>

export const StateDefinition1880 = defineEighteenXXState(State1880, [
    // A stock round may interrupt an operating turn after its run, which keeps its earnings
    // through it (§XII), as may the Rocket of China's exchange during a phase change (§VI).
    railwayStateValidation({
        operatingInterruptions: [...InterruptedOperatingTurnStates, ExchangingRocketState],
        phaseDecisionStates: [ExchangingRocketState]
    }),
    validateSelectionAuction,
    validatePendingPar
])

function isState1880(state: object): state is HydratedState1880 {
    return 'parSlots' in state && 'permits' in state && 'stockRound' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1880(state: object): HydratedState1880 {
    assert(isState1880(state), 'Family hooks receive the 1880 state')
    return state
}
