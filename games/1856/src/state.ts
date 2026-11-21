import {
    AccessRightFields,
    AuctionFields,
    BorrowingCompany,
    CashCrisisFields,
    CashCrisisMachineStates,
    ClosingOperatingCorporationState,
    LoanFields,
    LoanMachineStates,
    LocationMarkerFields,
    PrivatePowerFields,
    PrivateTrackFields,
    RailwayFields,
    RailwayMachineStates,
    StationPosition,
    StockTurnPurchaseFields,
    TurnMarkFields,
    WaterfallAuctionMachineStates,
    composeEighteenXXState,
    defineEighteenXXState,
    locationMarkers,
    railwayStateValidation,
    validateCashCrisis,
    validateWaterfallAuction,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { assert } from '@tabletop/common'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

/** The variants chosen when the game was set up (Variants). */
export const Variants1856 = Type.Object(
    {
        /** Each company's alternate destination. */
        alternateDestinations: Type.Optional(Type.Literal(true)),
        /** $1000 8-trains in place of the Diesels. */
        eightTrains: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type Variants1856 = Type.Static<typeof Variants1856>

/**
 * How a company is capitalized, fixed by the train on sale as its president's certificate is
 * bought: escrow before the 5s, incremental with them, full from the 6s (Public Company Starting
 * Treasury).
 */
export const Capitalization1856 = Type.Union([
    Type.Literal('escrow'),
    Type.Literal('incremental'),
    Type.Literal('full')
])
export type Capitalization1856 = Type.Static<typeof Capitalization1856>

/** A started company's capitalization, with what the bank holds for it until its destination. */
export const CompanyFunding1856 = Type.Object(
    {
        companyId: Id,
        capitalization: Capitalization1856,
        /** Payments for initial offering shares beyond the first five, held in escrow. */
        escrow: Type.Optional(Type.Integer({ minimum: 1 })),
        /** A fully capitalized company has received its ten times par. */
        capitalized: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type CompanyFunding1856 = Type.Static<typeof CompanyFunding1856>

/**
 * The Great Lakes Shipping Company's port token: the company it pays, which placed it; the stop
 * it stands on is its location marker (Private Companies).
 */
export const PortToken1856 = Type.Object({ companyId: Id }, { additionalProperties: false })
export type PortToken1856 = Type.Static<typeof PortToken1856>
export const PortMarkerKind = 'port-token'

/** Where the port token stands and the company it pays, once placed. */
export function portToken(
    state: object
): { companyId: string; locationId: string; nodeId: string } | undefined {
    const title = requireState1856(state)
    const [marker] = locationMarkers(title, { kind: PortMarkerKind })
    if (!title.port || !marker?.nodeId) return undefined
    return { companyId: title.port.companyId, locationId: marker.locationId, nodeId: marker.nodeId }
}

/** The Canadian Government Railways once formed (Canadian Government Railway). */
export const National1856 = Type.Object(
    {
        /** It has owned a permanent train: its price moves and it may pay dividends. */
        permanentTrain: Type.Optional(Type.Literal(true)),
        /** The train it borrowed from the bank while it has none of its own. */
        borrowedTrainId: Type.Optional(Id),
        /**
         * The president given the president's certificate for one share, who must buy a second in
         * their first turn of the next stock round (Determining the CGR President).
         */
        presidencyOwedBy: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type National1856 = Type.Static<typeof National1856>

/**
 * The CGR's formation as the first 6-train's buyer ends its turn: the presidents of companies
 * still owing loans decide in player order, then the CGR's president keeps stations and trains
 * where they may choose (Canadian Government Railway).
 */
export const NationalFormation1856 = Type.Object(
    {
        /** The president of the company that bought the first 6-train, who decides first. */
        triggerPlayerId: Id,
        /** Companies whose loans the treasury could not repay, still to be decided. */
        owing: Type.Array(Id, { uniqueItems: true }),
        /** Companies the CGR absorbs. */
        absorbed: Type.Array(Id, { uniqueItems: true }),
        formed: Type.Optional(Type.Literal(true)),
        /**
         * Where the absorbed companies' stations beyond their homes stood, of which the president
         * keeps some; the companies have closed.
         */
        stationChoice: Type.Optional(
            Type.Object(
                {
                    stations: Type.Array(
                        Type.Object(
                            { stationId: Id, companyId: Id, position: StationPosition },
                            { additionalProperties: false }
                        )
                    ),
                    keep: Type.Integer({ minimum: 0 })
                },
                { additionalProperties: false }
            )
        ),
        /** The absorbed companies' trains, of which the president keeps up to three. */
        trainChoice: Type.Optional(Type.Literal(true)),
        /** Who was to act when the formation began. */
        activePlayerIds: Type.Array(Id)
    },
    { additionalProperties: false }
)
export type NationalFormation1856 = Type.Static<typeof NationalFormation1856>
export const NationalFormationState = 'FormingNational'

export const TitleFields1856 = {
    variants: Variants1856,
    funding: Type.Array(CompanyFunding1856),
    /**
     * Companies that have reached their destinations while it still mattered: an escrow
     * company's escrow is released, and one not yet started is paid for every share (Public
     * Company Starting Treasury).
     */
    destinationsReached: Type.Array(Id, { uniqueItems: true }),
    port: Type.Optional(PortToken1856),
    national: Type.Optional(National1856),
    nationalFormation: Type.Optional(NationalFormation1856),
    /**
     * The companies counted for the certificate limit once the CGR has formed or failed to form,
     * fixed for the rest of the game (Certificate Limit Adjustment; designer, 2021).
     */
    certificateLimitCompanies: Type.Optional(Type.Integer({ minimum: 1 })),
    /** The Waterloo & Saugeen laid the Kitchener tile; it closes as the round ends. */
    waterlooLaid: Type.Optional(Type.Literal(true))
}

export const State1856 = composeEighteenXXState(
    {
        ...RailwayFields,
        companies: Type.Array(BorrowingCompany),
        ...AuctionFields,
        ...PrivatePowerFields,
        ...PrivateTrackFields,
        ...LocationMarkerFields,
        ...AccessRightFields,
        ...LoanFields,
        ...CashCrisisFields,
        ...TurnMarkFields,
        ...StockTurnPurchaseFields,
        ...TitleFields1856
    },
    [
        ...RailwayMachineStates,
        ...WaterfallAuctionMachineStates,
        ...LoanMachineStates,
        ...CashCrisisMachineStates,
        ClosingOperatingCorporationState,
        NationalFormationState
    ]
)
export type State1856 = Type.Static<typeof State1856>
export type HydratedState1856 = HydratedEighteenXXState<typeof State1856>
export type StateHandler1856 = EighteenXXStateHandler<HydratedState1856>

export const StateDefinition1856 = defineEighteenXXState(
    State1856,
    [
        railwayStateValidation({ operatingInterruptions: [NationalFormationState] }),
        validateWaterfallAuction,
        validateCashCrisis
    ],
    { bank: { breaksOnShortfall: true } }
)

function isState1856(state: object): state is HydratedState1856 {
    return 'funding' in state && 'variants' in state
}

/** A family hook's state, which is always this title's. */
export function requireState1856(state: object): HydratedState1856 {
    assert(isState1856(state), 'Family hooks receive the 1856 state')
    return state
}
