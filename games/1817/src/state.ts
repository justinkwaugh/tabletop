import {
    BorrowingCompany,
    CashCrisisFields,
    CashCrisisMachineStates,
    CompanyAuctionFields,
    composeEighteenXXState,
    defineEighteenXXState,
    LoanFields,
    LoanMachineStates,
    LocationMarkerFields,
    PrivatePowerFields,
    RailwayFields,
    RailwayMachineStates,
    SelectionAuctionFields,
    SelectionAuctionMachineStates,
    ShortingCertificate,
    SizedCompanyFields,
    SizedCompanyMachineStates,
    validateCashCrisis,
    validateCompanyAuction,
    validateLoanStep,
    validateRailwayState,
    validateSelectionAuction,
    validateSizedCompanyRounds,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

/** How many lays each private with lay powers has made, since a ranch can later be removed. */
export const PrivateLays = Type.Record(Type.String(), Type.Integer({ minimum: 1 }))
export type PrivateLays = Type.Static<typeof PrivateLays>
/** The train types whose Inventor payout has been made. */
export const InventorPaid = Type.Array(Type.String())
/**
 * The Volatility auction's tiers, the single top lot first. A sold or removed lot leaves an empty
 * slot, since a lot's neighbours decide what a sale removes.
 */
export const Pyramid = Type.Array(Type.Array(Type.Union([Type.String(), Type.Null()])))
export type Pyramid = Type.Static<typeof Pyramid>

export const EighteenSeventeenState = composeEighteenXXState(
    {
        ...RailwayFields,
        ...PrivatePowerFields,
        companies: Type.Array(BorrowingCompany),
        certificates: Type.Array(ShortingCertificate),
        ...SelectionAuctionFields,
        ...LoanFields,
        ...CashCrisisFields,
        ...CompanyAuctionFields,
        ...LocationMarkerFields,
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
        ...SizedCompanyFields
    },
    [
        ...RailwayMachineStates,
        ...SelectionAuctionMachineStates,
        ...LoanMachineStates,
        ...CashCrisisMachineStates,
        ...SizedCompanyMachineStates
    ]
)
export type EighteenSeventeenState = Type.Static<typeof EighteenSeventeenState>
export type EighteenSeventeenOptions = Pick<
    EighteenSeventeenState,
    'shortSqueeze' | 'fiveShorts' | 'modernTrains' | 'volatility'
>
export type EighteenSeventeenStateHandler = EighteenXXStateHandler<HydratedEighteenSeventeenState>
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

export type HydratedEighteenSeventeenState = HydratedEighteenXXState<typeof EighteenSeventeenState>
export const EighteenSeventeenStateDefinition = defineEighteenXXState(EighteenSeventeenState, [
    validateRailwayState,
    validateSelectionAuction,
    validateCompanyAuction,
    validateLoanStep,
    validateCashCrisis,
    validateSizedCompanyRounds
])
