import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { SimpleAuction, assert } from '@tabletop/common'
import {
    HydratedEighteenXXState,
    extendEighteenXXState,
    type EighteenXXState,
    type EighteenXXStateDefinition,
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
const ClosingZone = Type.Union([Type.Literal('acquisition'), Type.Literal('liquidation')])
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

export const SaleKind = Type.Union([
    Type.Literal('offered'),
    Type.Literal('acquisition'),
    Type.Literal('liquidation')
])
export type SaleKind = Type.Static<typeof SaleKind>
/** A liquidated company's cash and loans, set aside while it is sold. */
export const HeldAside = Type.Object(
    { cash: Type.Integer({ minimum: 0 }), loans: Type.Integer({ minimum: 0 }) },
    { additionalProperties: false }
)
export type HeldAside = Type.Static<typeof HeldAside>
export const CompanySale = Type.Object(
    {
        companyId: Id,
        kind: SaleKind,
        bidding: SimpleAuction,
        liquidation: Type.Optional(HeldAside)
    },
    { additionalProperties: false }
)
export type CompanySale = Type.Static<typeof CompanySale>
/** A company bought in the acquisition round, until its buyer's loans and holders settle. */
export const Acquisition = Type.Object(
    {
        companyId: Id,
        kind: SaleKind,
        liquidation: Type.Optional(HeldAside),
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

const EighteenSeventeenState = extendEighteenXXState(
    {
        // The bank's remaining subsidy toward privates sold below face value in the opening
        // auction; positions prepared after the opening have none.
        seedMoney: Type.Optional(Type.Integer({ minimum: 0 })),
        shortSqueeze: Type.Optional(Type.Literal(true)),
        fiveShorts: Type.Optional(Type.Literal(true)),
        mergerRound: Type.Optional(MergerRound),
        acquisitionRound: Type.Optional(AcquisitionRound)
    },
    [...MergerRoundStates, ...AcquisitionRoundStates, ...CompanyExcessStates]
)
const Validator = Compile(EighteenSeventeenState)
const MergerRoundValidator = Compile(MergerRound)
const AcquisitionRoundValidator = Compile(AcquisitionRound)

/** The latest merger and conversion round, as recorded in the state. */
export function mergerRoundOf(state: object): MergerRound | undefined {
    if (!('mergerRound' in state)) return undefined
    assert(MergerRoundValidator.Check(state.mergerRound), 'Invalid merger round')
    return state.mergerRound
}

export function setMergerRound(state: object, round: MergerRound): void {
    Object.assign(state, { mergerRound: round })
}

/** The round in progress, whose conversion is underway when one is. */
export function activeMergerRound(state: object): MergerRound | undefined {
    const round = mergerRoundOf(state)
    return round && !round.completed ? round : undefined
}

export function acquisitionRoundOf(state: object): AcquisitionRound | undefined {
    if (!('acquisitionRound' in state)) return undefined
    assert(AcquisitionRoundValidator.Check(state.acquisitionRound), 'Invalid acquisition round')
    return state.acquisitionRound
}

export function setAcquisitionRound(state: object, round: AcquisitionRound): void {
    Object.assign(state, { acquisitionRound: round })
}

export function activeAcquisitionRound(state: object): AcquisitionRound | undefined {
    const round = acquisitionRoundOf(state)
    return round && !round.completed ? round : undefined
}

/** The optional rules chosen when the game was set up. */
export function eighteenSeventeenOptions(state: object): {
    shortSqueeze: boolean
    fiveShorts: boolean
} {
    return { shortSqueeze: 'shortSqueeze' in state, fiveShorts: 'fiveShorts' in state }
}

export class HydratedEighteenSeventeenState extends HydratedEighteenXXState {
    declare seedMoney?: number
    declare shortSqueeze?: true
    declare fiveShorts?: true
    declare mergerRound?: MergerRound
    declare acquisitionRound?: AcquisitionRound
    constructor(data: EighteenXXState, map: RailwayMap, tileSet: TileSet, depot: TrainDepot) {
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

export const EighteenSeventeenStateDefinition: EighteenXXStateDefinition = {
    schema: EighteenSeventeenState,
    hydrate: (data, map, tileSet, depot) =>
        new HydratedEighteenSeventeenState(data, map, tileSet, depot)
}
