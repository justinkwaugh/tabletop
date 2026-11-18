import {
    AccessRightFields,
    AuctionFields,
    OwnershipExemptionFields,
    TurnMarkFields,
    composeEighteenXXState,
    defineEighteenXXState,
    PendingParFields,
    PrivatePowerFields,
    PrivateStationFields,
    PrivateTrackFields,
    RailwayFields,
    RailwayMachineStates,
    StockTurnPurchaseFields,
    validatePendingPar,
    validateRailwayState,
    validateWaterfallAuction,
    WaterfallAuctionMachineStates,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

/**
 * A system: the surviving company, which keeps its id, shares and stock marker, and the company
 * merged into it, which remains as its second shell (§7.5, §13.4). Each shell lists its trains; a
 * train just acquired waits, in neither, to be placed.
 */
export const System1828 = Type.Object(
    {
        absorbedId: Id,
        shellTrainIds: Type.Tuple([
            Type.Array(Id, { uniqueItems: true }),
            Type.Array(Id, { uniqueItems: true })
        ])
    },
    { additionalProperties: false }
)
export type System1828 = Type.Static<typeof System1828>

/** A player's decision on the single share of the merging companies they hold beyond pairs. */
export const SingleShareDecision = Type.Object(
    { playerId: Id, tradeUp: Type.Boolean() },
    { additionalProperties: false }
)
export type SingleShareDecision = Type.Static<typeof SingleShareDecision>

/** The single share a player with an odd total sets aside from the pairs (§7.5.2 step 4). */
export const SetAsideShare = Type.Object(
    { playerId: Id, companyId: Id },
    { additionalProperties: false }
)
export type SetAsideShare = Type.Static<typeof SetAsideShare>

/**
 * A merger in progress (§7.5.2): the other director's consent; then the acting player's choice of
 * the station each shared hex loses, the single share each odd holder sets aside, and whether
 * each trades it up, before the system forms.
 */
export const Merger1828 = Type.Object(
    {
        playerId: Id,
        survivorId: Id,
        absorbedId: Id,
        /** ``failed`` lasts only until the acting player's turn ends as a pass (§7.5.2.2). */
        stage: Type.Union([
            Type.Literal('consent'),
            Type.Literal('shares'),
            Type.Literal('failed')
        ]),
        /** The stations chosen to become blocking stations, in hexes both companies hold. */
        blockedStationIds: Type.Array(Id, { uniqueItems: true }),
        setAsides: Type.Array(SetAsideShare),
        decisions: Type.Array(SingleShareDecision)
    },
    { additionalProperties: false }
)
export type Merger1828 = Type.Static<typeof Merger1828>

export const TitleFields1828 = {
    /** The systems formed, by surviving company (§13.4). */
    systems: Type.Record(Id, System1828),
    /** The stock round in which each company floated, which governs mergers (§7.5.1). */
    floatedInStockRound: Type.Record(Id, Type.Integer({ minimum: 1 })),
    /** The Virginia Coalfields Tunnel's coal marker, still there until the tunnel is built (§4). */
    tunnelCoal: Type.Boolean(),
    merger: Type.Optional(Merger1828),
    /** Where the Cobourg & Peterborough laid its tile this operating round (§13.2.2.5). */
    cobourgLay: Type.Optional(Id),
    /** The unparred companies have been removed at the first purple stock round (§17.7). */
    unparredRemoved: Type.Optional(Type.Literal(true))
}

export const State1828 = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateTrackFields,
        ...PrivateStationFields,
        ...PendingParFields,
        ...StockTurnPurchaseFields,
        ...AuctionFields,
        ...AccessRightFields,
        ...TurnMarkFields,
        ...OwnershipExemptionFields,
        ...TitleFields1828
    },
    [...RailwayMachineStates, ...WaterfallAuctionMachineStates]
)
export type State1828 = Type.Static<typeof State1828>
export type HydratedState1828 = HydratedEighteenXXState<typeof State1828>
export type StateHandler1828 = EighteenXXStateHandler<HydratedState1828>

function validateTitleState(state: HydratedState1828): void {
    for (const [systemId, system] of Object.entries(state.systems)) {
        assert(
            state.companies.some((company) => company.id === systemId && !company.closed),
            'A system is an open company'
        )
        assert(
            state.companies.some((company) => company.id === system.absorbedId && company.closed),
            'A system’s second shell is a closed company'
        )
    }
    assert(
        !state.merger || state.machineState === 'StockRound',
        'A merger happens in a stock round'
    )
}

export const StateDefinition1828 = defineEighteenXXState(State1828, [
    validateRailwayState,
    validateWaterfallAuction,
    validatePendingPar,
    validateTitleState
])

function isState1828(state: object): state is HydratedState1828 {
    return 'systems' in state && 'tunnelCoal' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1828(state: object): HydratedState1828 {
    assert(isState1828(state), 'Family hooks receive the 1828 state')
    return state
}
