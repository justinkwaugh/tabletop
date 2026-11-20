import {
    AuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    RailwayFields,
    RailwayMachineStates,
    railwayStateValidation,
    validatePendingPar,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    InterruptedOperatingTurnStates,
    StationPosition,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

/** The players and the NdM's president deciding the NdM merger at the first 5-train (5.3). */
export const MergingIntoNdmState = 'MergingIntoNdM'

/**
 * The NdM merger under way: offered to each player in turn, then chosen by the NdM's president
 * among the unfloated companies, then the NdM's president choosing which other station its
 * second exchange token replaces (5.3(b), (c), (f)).
 */
export const NdmMergerMex = Type.Object(
    {
        stage: Type.Union([
            Type.Literal('offering'),
            Type.Literal('choosing-company'),
            Type.Literal('choosing-station')
        ]),
        /** The president of the company that bought the first 5-train; offers start at their left. */
        triggerPlayerId: Id,
        declinedPlayerIds: Type.Array(Id, { uniqueItems: true }),
        mergedCompanyId: Type.Optional(Id),
        /** The merged company's stations its second exchange token may replace. */
        stationChoices: Type.Optional(Type.Array(StationPosition))
    },
    { additionalProperties: false }
)
export type NdmMergerMex = Type.Static<typeof NdmMergerMex>

export const OptionsFieldMex = Type.Object(
    {
        threeYellowLays: Type.Optional(Type.Literal(true)),
        earlyKcmo: Type.Optional(Type.Literal(true)),
        delayedMinorClose: Type.Optional(Type.Literal(true)),
        hardRust: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)

export const TitleFieldsMex = {
    /** The optional rules chosen for the game (rule 8). */
    options: OptionsFieldMex,
    /** The operating company has collected its mail contract this turn (4.3.1). */
    mailPaid: Type.Optional(Type.Literal(true)),
    ndmMerger: Type.Optional(NdmMergerMex),
    /** The NdM stations its merger placed, which do not count in pricing its later ones (4.3.2). */
    mergerStationIds: Type.Optional(Type.Array(Id, { uniqueItems: true })),
    /** Every player's certificate limit is one higher, there having been no merger (5.3(i)). */
    certificateLimitRaised: Type.Optional(Type.Literal(true))
}

export const StateMex = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PendingParFields,
        ...AuctionFields,
        ...TitleFieldsMex
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates, MergingIntoNdmState]
)
export type StateMex = Type.Static<typeof StateMex>
export type HydratedStateMex = HydratedEighteenXXState<typeof StateMex>
export type StateHandlerMex = EighteenXXStateHandler<HydratedStateMex>

export const StateDefinitionMex = defineEighteenXXState(StateMex, [
    // The NdM merger is decided within the first 5-train's phase change (5.3).
    railwayStateValidation({
        operatingInterruptions: [...InterruptedOperatingTurnStates, MergingIntoNdmState],
        phaseDecisionStates: [MergingIntoNdmState]
    }),
    validateWaterfallAuction,
    validatePendingPar
])

function isStateMex(state: object): state is HydratedStateMex {
    return 'options' in state && 'stockRound' in state && 'tileInventory' in state
}

/** A family hook's state, which is always this title's. */
export function requireStateMex(state: object): HydratedStateMex {
    assert(isStateMex(state), 'Family hooks receive the 18MEX state')
    return state
}
