import {
    PrivatePowerFields,
    PrivateTrackFields,
    RailwayFields,
    RailwayMachineStates,
    SelectionAuctionFields,
    SelectionAuctionMachineStates,
    TurnMarkFields,
    composeEighteenXXState,
    defineEighteenXXState,
    validateRailwayState,
    validateSelectionAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })
const Count = Type.Integer({ minimum: 0 })

/** How many steel cubes are left in each column of the steel market, its dearest ones (ST-1). */
export const SteelMarket = Type.Record(Id, Count)
export type SteelMarket = Type.Static<typeof SteelMarket>

/** The operating company's steel this turn: the column of each colour it uses (ST-2). */
export const SteelTurn = Type.Object(
    {
        companyId: Id,
        /** The column each colour's steel has come from this turn, fixed once used. */
        columns: Type.Record(Id, Id),
        /** The column, or the Steel Depot, chosen for each colour's next steel. */
        choices: Type.Optional(Type.Record(Id, Id)),
        /** Steel taken free from the Steel Depot for yellow tiles this turn (B3). */
        depotSteel: Count
    },
    { additionalProperties: false }
)
export type SteelTurn = Type.Static<typeof SteelTurn>

export const GoldShipment = Type.Object(
    {
        companyId: Id,
        locationId: Id,
        /** The 13lb Gold Nugget made the shipment (G2). */
        nugget: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type GoldShipment = Type.Static<typeof GoldShipment>

/** A train lengthened for the operating turn's run (B5, Y3, G6). */
export const TrainExtension = Type.Object(
    { trainId: Id, sourceId: Id, stops: Type.Integer({ minimum: 1, maximum: 2 }) },
    { additionalProperties: false }
)
export type TrainExtension = Type.Static<typeof TrainExtension>

/** How the game's end was triggered by the first 6x2 (EG-2, EG-4). */
export const TrainEndTrigger = Type.Object(
    { setNumber: Type.Integer({ minimum: 1 }), byExport: Type.Boolean() },
    { additionalProperties: false }
)
export type TrainEndTrigger = Type.Static<typeof TrainEndTrigger>

export const TitleFieldsRoyalGorge = {
    /**
     * The shorter game variant: the end trigger finishes only the current set, unless an export
     * triggered it (Game Play Variants). The other variants shape only the setup.
     */
    shorterGame: Type.Optional(Type.Literal(true)),
    steelMarket: SteelMarket,
    steelTurn: Type.Optional(SteelTurn),
    /** Steel left on the Steel Depot card (B3). */
    depotSteel: Count,
    /** Gold cubes on the map, by hex (GO-1). */
    goldCubes: Type.Record(Id, Type.Integer({ minimum: 1 })),
    /** Gold shipped this set of operating rounds, covering the gold track from the left (GO-3). */
    goldShipped: Count,
    goldShipment: Type.Optional(GoldShipment),
    /** Hexes holding a ghost town, in placement order (Y2). */
    ghostTowns: Type.Array(Id, { uniqueItems: true }),
    /** Coal still in Coal Creek's mine, its owning railroad's cubes, and the Coal Depot's (Y3, G6). */
    coalCreekSupply: Count,
    coalCreekCubes: Count,
    coalDepotCubes: Count,
    trainExtensions: Type.Array(TrainExtension),
    /** Money on the Local Jeweler card, its owner's at the next stock round (Y6). */
    jewelerCash: Count,
    /** The debt marker's space on the share value track (DB-4). */
    debtSpaceId: Id,
    /** Debt tokens each indebted railroad still owes, from the Treaty of Boston (DB-3). */
    debts: Type.Record(Id, Type.Integer({ minimum: 1 })),
    /** The railroads that paid a debt this operating round (DB-5). */
    debtPaidIds: Type.Array(Id, { uniqueItems: true }),
    /** The operating lessee chose, before running, to run through the gorge on its lease (G3). */
    bridgeLeaseInUse: Type.Optional(Type.Literal(true)),
    /** The lessee has paid Rio Grande for this turn's run through the gorge (G3). */
    bridgeLeasePaid: Type.Optional(Type.Literal(true)),
    /** The last operating round whose end has been settled, as set and round numbers (EG-1). */
    settledRound: Type.Optional(
        Type.Object(
            { set: Type.Integer({ minimum: 1 }), round: Type.Integer({ minimum: 1 }) },
            { additionalProperties: false }
        )
    ),
    /** The metal companies whose shares a player bought with the Metals Investor this round. */
    investorPurchases: Type.Array(Id, { uniqueItems: true }),
    trainEndTrigger: Type.Optional(TrainEndTrigger)
}

export const StateRoyalGorge = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        ...PrivateTrackFields,
        ...SelectionAuctionFields,
        ...TurnMarkFields,
        ...TitleFieldsRoyalGorge
    },
    [...RailwayMachineStates, ...SelectionAuctionMachineStates]
)
export type StateRoyalGorge = Type.Static<typeof StateRoyalGorge>
export type HydratedStateRoyalGorge = HydratedEighteenXXState<typeof StateRoyalGorge>
export type StateHandlerRoyalGorge = EighteenXXStateHandler<HydratedStateRoyalGorge>

export const StateDefinitionRoyalGorge = defineEighteenXXState(StateRoyalGorge, [
    validateRailwayState,
    validateSelectionAuction
])

function isStateRoyalGorge(state: object): state is HydratedStateRoyalGorge {
    return 'steelMarket' in state && 'goldCubes' in state
}

/** A family hook's state, which is always this title's. */
export function requireStateRoyalGorge(state: object): HydratedStateRoyalGorge {
    assert(isStateRoyalGorge(state), 'Family hooks receive the 18RoyalGorge state')
    return state
}
