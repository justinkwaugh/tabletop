import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { SimpleAuction, assert } from '@tabletop/common'
import {
    HydratedEighteenXXState,
    extendEighteenXXState,
    type EighteenXXStateDefinition,
    type EighteenXXStateHandler,
    type RailwayMap,
    type TileSet,
    type TrainDepot
} from '@tabletop/18xx'

const Id = Type.String({ minLength: 1 })
/** The company converted or merged this turn, until its trading, loans and stations are done. */
export const Conversion = Type.Object(
    {
        companyId: Id,
        merged: Type.Optional(Type.Literal(true)),
        price: Type.Integer({ minimum: 1 }),
        traderIds: Type.Array(Id),
        stationsOwed: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type Conversion = Type.Static<typeof Conversion>
export const ClosingZone = Type.Union([Type.Literal('acquisition'), Type.Literal('liquidation')])
export type ClosingZone = Type.Static<typeof ClosingZone>
/** How many lays each private with lay powers has made, since a ranch can later be removed. */
export const PrivateLays = Type.Record(Type.String(), Type.Integer({ minimum: 1 }))
export type PrivateLays = Type.Static<typeof PrivateLays>
/** The train types whose Inventor payout has been made. */
export const InventorPaid = Type.Array(Type.String())
/** The presidents bankruptcy took from their companies, by company. */
export const FormerPresidents = Type.Record(Type.String(), Type.String())
export type FormerPresidents = Type.Static<typeof FormerPresidents>

/**
 * The Volatility auction's tiers, the single top lot first. A sold or removed lot leaves an empty
 * slot, since a lot's neighbours decide what a sale removes.
 */
export const Pyramid = Type.Array(Type.Array(Type.Union([Type.String(), Type.Null()])))
export type Pyramid = Type.Static<typeof Pyramid>

/** The merger and conversion round that follows an operating round. */
export const MergerRound = Type.Object(
    {
        set: Type.Integer({ minimum: 1 }),
        round: Type.Integer({ minimum: 1 }),
        companyIds: Type.Array(Id),
        // The zones as the operating round ended, which decide the acquisition round's skips.
        closingZones: Type.Array(
            Type.Object({ companyId: Id, zone: ClosingZone }, { additionalProperties: false })
        ),
        convertedIds: Type.Array(Id),
        conversion: Type.Optional(Conversion),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type MergerRound = Type.Static<typeof MergerRound>
export const MergerRoundStates = [
    'MergerRound',
    'TradingConvertedShares',
    'BorrowingAfterConversion'
] as const

export const SaleKind = Type.Union([Type.Literal('offered'), ClosingZone])
export type SaleKind = Type.Static<typeof SaleKind>
/** A liquidated company's cash, gone to the bank, and the loans its sale must repay. */
export const HeldAside = Type.Object(
    { cash: Type.Integer({ minimum: 0 }), loans: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type HeldAside = Type.Static<typeof HeldAside>
export const SaleTerms = Type.Object(
    { companyId: Id, kind: SaleKind, heldAside: Type.Optional(HeldAside) },
    { additionalProperties: false }
)
export type SaleTerms = Type.Static<typeof SaleTerms>
export const CompanySale = Type.Object(
    { ...SaleTerms.properties, bidding: SimpleAuction },
    { additionalProperties: false }
)
export type CompanySale = Type.Static<typeof CompanySale>
/** A company bought in the acquisition round, until its buyer's loans and holders settle. */
export const Acquisition = Type.Object(
    {
        sale: SaleTerms,
        buyerId: Id,
        price: Type.Integer({ minimum: 1 }),
        inheritedLoans: Type.Integer({ minimum: 0 }),
        repaidLoans: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type Acquisition = Type.Static<typeof Acquisition>
/** The acquisition round that follows a merger round. */
export const AcquisitionRound = Type.Object(
    {
        set: Type.Integer({ minimum: 1 }),
        round: Type.Integer({ minimum: 1 }),
        companyIds: Type.Array(Id),
        sale: Type.Optional(CompanySale),
        acquisition: Type.Optional(Acquisition),
        completed: Type.Boolean()
    },
    { additionalProperties: false }
)
export type AcquisitionRound = Type.Static<typeof AcquisitionRound>
export const AcquisitionRoundStates = [
    'AcquisitionRound',
    'AcquisitionBidding',
    'ChoosingAcquirer',
    'AcquisitionLoans'
] as const
/** Where a merged or acquiring company gives up the stations and trains over its limits. */
export const CompanyExcessStates = ['ReducingStations', 'DiscardingMergedTrains'] as const

export const EighteenSeventeenState = extendEighteenXXState(
    {
        // The bank's remaining subsidy toward privates sold below face value in the opening
        // auction; positions prepared after the opening have none.
        seedMoney: Type.Optional(Type.Integer({ minimum: 0 })),
        shortSqueeze: Type.Optional(Type.Literal(true)),
        fiveShorts: Type.Optional(Type.Literal(true)),
        modernTrains: Type.Optional(Type.Literal(true)),
        volatility: Type.Optional(Type.Literal(true)),
        pyramid: Type.Optional(Pyramid),
        privateLays: Type.Optional(PrivateLays),
        inventorPaid: Type.Optional(InventorPaid),
        formerPresidents: Type.Optional(FormerPresidents),
        mergerRound: Type.Optional(MergerRound),
        acquisitionRound: Type.Optional(AcquisitionRound)
    },
    [...MergerRoundStates, ...AcquisitionRoundStates, ...CompanyExcessStates]
)
export type EighteenSeventeenState = Type.Static<typeof EighteenSeventeenState>
export type EighteenSeventeenOptions = Pick<
    EighteenSeventeenState,
    'shortSqueeze' | 'fiveShorts' | 'modernTrains' | 'volatility'
>
export type EighteenSeventeenStateHandler = EighteenXXStateHandler<HydratedEighteenSeventeenState>
const Validator = Compile(EighteenSeventeenState)
export function privateLaysMade(
    state: Pick<EighteenSeventeenState, 'privateLays'>,
    privateId: string
): number {
    return state.privateLays?.[privateId] ?? 0
}

export function recordPrivateLay(
    state: Pick<EighteenSeventeenState, 'privateLays'>,
    privateId: string
): void {
    state.privateLays ??= {}
    state.privateLays[privateId] = privateLaysMade(state, privateId) + 1
}

export function formerPresident(
    state: Pick<EighteenSeventeenState, 'formerPresidents'>,
    companyId: string
): string | undefined {
    return state.formerPresidents?.[companyId]
}

export function recordFormerPresident(
    state: Pick<EighteenSeventeenState, 'formerPresidents'>,
    companyId: string,
    playerId: string
): void {
    state.formerPresidents ??= {}
    state.formerPresidents[companyId] = playerId
}

export function inventorPaid(state: Pick<EighteenSeventeenState, 'inventorPaid'>): string[] {
    return state.inventorPaid ?? []
}

export function seedMoneyLeft(
    state: Pick<EighteenSeventeenState, 'seedMoney'>
): number | undefined {
    return state.seedMoney
}

export function pyramidOf(state: Pick<EighteenSeventeenState, 'pyramid'>): Pyramid | undefined {
    return state.pyramid
}

export function mergerRoundOf(
    state: Pick<EighteenSeventeenState, 'mergerRound'>
): MergerRound | undefined {
    return state.mergerRound
}

export function dropCompany(round: { companyIds: string[] }, companyId: string): void {
    round.companyIds = round.companyIds.filter((id) => id !== companyId)
}

export function setMergerRound(state: EighteenSeventeenState, round: MergerRound): void {
    state.mergerRound = round
}

/** The round in progress, whose conversion is underway when one is. */
export function activeMergerRound(
    state: Pick<EighteenSeventeenState, 'mergerRound'>
): MergerRound | undefined {
    const round = mergerRoundOf(state)
    return round && !round.completed ? round : undefined
}

export function acquisitionRoundOf(
    state: Pick<EighteenSeventeenState, 'acquisitionRound'>
): AcquisitionRound | undefined {
    return state.acquisitionRound
}

export function setAcquisitionRound(state: EighteenSeventeenState, round: AcquisitionRound): void {
    state.acquisitionRound = round
}

export function activeAcquisitionRound(
    state: Pick<EighteenSeventeenState, 'acquisitionRound'>
): AcquisitionRound | undefined {
    const round = acquisitionRoundOf(state)
    return round && !round.completed ? round : undefined
}

/** The optional rules chosen when the game was set up. */
export function eighteenSeventeenOptions(state: EighteenSeventeenOptions): {
    shortSqueeze: boolean
    fiveShorts: boolean
    modernTrains: boolean
    volatility: boolean
} {
    return {
        shortSqueeze: state.shortSqueeze === true,
        fiveShorts: state.fiveShorts === true,
        modernTrains: state.modernTrains === true,
        volatility: state.volatility === true
    }
}

export class HydratedEighteenSeventeenState extends HydratedEighteenXXState<
    typeof EighteenSeventeenState
> {
    declare seedMoney?: number
    declare shortSqueeze?: true
    declare fiveShorts?: true
    declare modernTrains?: true
    declare volatility?: true
    declare pyramid?: Pyramid
    declare privateLays?: PrivateLays
    declare inventorPaid?: string[]
    declare formerPresidents?: FormerPresidents
    declare mergerRound?: MergerRound
    declare acquisitionRound?: AcquisitionRound
    constructor(data: unknown, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
        super(data, map, tileSet, depot, Validator)
        const inStates = (states: readonly string[]) => states.includes(this.machineState)
        const merging = !!activeMergerRound(this)
        const acquiring = !!activeAcquisitionRound(this)
        assert(
            merging === inStates(MergerRoundStates) || (merging && inStates(CompanyExcessStates)),
            'A merger round in progress belongs to its own states'
        )
        assert(
            !inStates(AcquisitionRoundStates) || acquiring,
            'The acquisition round’s states belong to it'
        )
        assert(
            !inStates(CompanyExcessStates) || merging || acquiring,
            'A company gives up its excess in a merger or acquisition round'
        )
    }
}

export const EighteenSeventeenStateDefinition: EighteenXXStateDefinition<
    typeof EighteenSeventeenState,
    HydratedEighteenSeventeenState
> = {
    schema: EighteenSeventeenState,
    hydrate: (data, map, tileSet, depot) =>
        new HydratedEighteenSeventeenState(data, map, tileSet, depot)
}
