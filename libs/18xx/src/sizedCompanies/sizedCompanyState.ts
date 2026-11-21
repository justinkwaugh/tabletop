import { assert, SimpleAuction } from '@tabletop/common'
import * as Type from 'typebox'
import type { EighteenXXState, HydratedEighteenXXState } from '../game/eighteenXXState.js'

const Id = Type.String({ minLength: 1 })

export const ClosingZone = Type.Union([Type.Literal('acquisition'), Type.Literal('liquidation')])
export type ClosingZone = Type.Static<typeof ClosingZone>

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

/** The merger and conversion round that follows an operating round. */
export const ConversionRound = Type.Object(
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
export type ConversionRound = Type.Static<typeof ConversionRound>
export const ConversionRoundStates = [
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

/** The presidents bankruptcy took from their companies, by company. */
export const FormerPresidents = Type.Record(Type.String(), Type.String())
export type FormerPresidents = Type.Static<typeof FormerPresidents>

// The merger and conversion round is stored as `mergerRound`, the name published 1817 games use.
export const SizedCompanyFields = {
    formerPresidents: Type.Optional(FormerPresidents),
    mergerRound: Type.Optional(ConversionRound),
    acquisitionRound: Type.Optional(AcquisitionRound)
}
export const SizedCompanyMachineStates = [
    ...ConversionRoundStates,
    ...AcquisitionRoundStates,
    ...CompanyExcessStates
] as const
/** The rounds and records of a title whose companies change size (the 1817 family). */
export type SizedCompanyRecords = Type.Static<Type.TObject<typeof SizedCompanyFields>>
export type SizedCompanyState = EighteenXXState & SizedCompanyRecords
export type HydratedSizedCompanyState = HydratedEighteenXXState & SizedCompanyRecords

export function formerPresident(
    state: Pick<SizedCompanyRecords, 'formerPresidents'>,
    companyId: string
): string | undefined {
    return state.formerPresidents?.[companyId]
}

export function recordFormerPresident(
    state: Pick<SizedCompanyRecords, 'formerPresidents'>,
    companyId: string,
    playerId: string
): void {
    state.formerPresidents ??= {}
    state.formerPresidents[companyId] = playerId
}

export function conversionRoundOf(
    state: Pick<SizedCompanyRecords, 'mergerRound'>
): ConversionRound | undefined {
    return state.mergerRound
}

/** The merger round in progress, whose conversion is underway when one is. */
export function activeConversionRound(
    state: Pick<SizedCompanyRecords, 'mergerRound'>
): ConversionRound | undefined {
    const round = conversionRoundOf(state)
    return round && !round.completed ? round : undefined
}

export function acquisitionRoundOf(
    state: Pick<SizedCompanyRecords, 'acquisitionRound'>
): AcquisitionRound | undefined {
    return state.acquisitionRound
}

export function activeAcquisitionRound(
    state: Pick<SizedCompanyRecords, 'acquisitionRound'>
): AcquisitionRound | undefined {
    const round = acquisitionRoundOf(state)
    return round && !round.completed ? round : undefined
}

export function dropCompany(round: { companyIds: string[] }, companyId: string): void {
    round.companyIds = round.companyIds.filter((id) => id !== companyId)
}

export function validateSizedCompanyRounds(
    state: { machineState: string } & Pick<SizedCompanyRecords, 'mergerRound' | 'acquisitionRound'>
): void {
    const inStates = (states: readonly string[]) => states.includes(state.machineState)
    const merging = !!activeConversionRound(state)
    const acquiring = !!activeAcquisitionRound(state)
    assert(
        merging === inStates(ConversionRoundStates) || (merging && inStates(CompanyExcessStates)),
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
