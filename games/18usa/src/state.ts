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
    railwayStateValidation,
    validateSelectionAuction,
    validateSizedCompanyRounds,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import * as Type from 'typebox'

const Id = Type.String({ minLength: 1 })

/** P13's president deciding which train the Boneyard keeps from a rust (P13). */
export const SavingTrainState = 'SavingTrain'

/** The subsidy tile each subsidy city still offers; all go when the first stock round ends (§11.6.1). */
export const CitySubsidies = Type.Record(Id, Id)
/** The token each red area was dealt, and P6's where it replaced one (§2.6). */
export const RedAreaTokenIds = Type.Record(Id, Id)
/** How many tokens or lays each private with limited uses has spent. */
export const PrivateUses = Type.Record(Id, Type.Integer({ minimum: 1 }))
/** The +10 and +10/+20 subsidy tokens on their cities (§11.6.1). */
export const CityBonuses = Type.Record(Id, Id)

/** The trains P30 and P19 were given for a company's run (P19, P30). */
export const TrainAssignments = Type.Object(
    {
        companyId: Id,
        setNumber: Type.Integer({ minimum: 1 }),
        roundNumber: Type.Integer({ minimum: 1 }),
        doubleHeadedTrainId: Type.Optional(Id),
        switchedTrainId: Type.Optional(Id)
    },
    { additionalProperties: false }
)
export type TrainAssignments = Type.Static<typeof TrainAssignments>

export const EighteenUSAState = composeEighteenXXState(
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
        ...SizedCompanyFields,
        seventeenTrains: Type.Optional(Type.Literal(true)),
        highStartPrices: Type.Optional(Type.Literal(true)),
        noPresidentLimit: Type.Optional(Type.Literal(true)),
        redAreaTokens: RedAreaTokenIds,
        metropolisIds: Type.Array(Id),
        /** The candidates not chosen at setup, whose tiles P10 Carnegie Steel holds (§2.4). */
        carnegieIds: Type.Array(Id),
        citySubsidies: CitySubsidies,
        /** The subsidy cities dealt a "No subsidy" tile, which P29 Bankrupt Railroad rewards (P29). */
        noSubsidyCityIds: Type.Array(Id),
        cityBonuses: Type.Optional(CityBonuses),
        privateUses: Type.Optional(PrivateUses),
        trainAssignments: Type.Optional(TrainAssignments),
        /** Denver's metropolis tile has been turned by its first company (§12.2.3). */
        denverTurned: Type.Optional(Type.Literal(true)),
        /** The trains a rust would take from P13's company, while its president decides (P13). */
        boneyard: Type.Optional(
            Type.Object(
                { companyId: Id, trainIds: Type.Array(Id, { minItems: 1 }) },
                { additionalProperties: false }
            )
        ),
        /** The train P13 kept from rusting, which still counts for the limit until it goes (P13). */
        savedTrainId: Type.Optional(Id)
    },
    [
        ...RailwayMachineStates,
        ...SelectionAuctionMachineStates,
        ...LoanMachineStates,
        ...CashCrisisMachineStates,
        ...SizedCompanyMachineStates,
        SavingTrainState
    ]
)
export type EighteenUSAState = Type.Static<typeof EighteenUSAState>
export type EighteenUSAOptions = Pick<
    EighteenUSAState,
    'seventeenTrains' | 'highStartPrices' | 'noPresidentLimit'
>
export type EighteenUSAStateHandler = EighteenXXStateHandler<HydratedEighteenUSAState>

/** The optional rules chosen when the game was set up. */
export function eighteenUSAOptions(state: EighteenUSAOptions): {
    seventeenTrains: boolean
    highStartPrices: boolean
    noPresidentLimit: boolean
} {
    return {
        seventeenTrains: state.seventeenTrains === true,
        highStartPrices: state.highStartPrices === true,
        noPresidentLimit: state.noPresidentLimit === true
    }
}

export function privateUsesMade(
    state: Pick<EighteenUSAState, 'privateUses'>,
    privateId: string
): number {
    return state.privateUses?.[privateId] ?? 0
}

export function recordPrivateUse(
    state: Pick<EighteenUSAState, 'privateUses'>,
    privateId: string
): void {
    state.privateUses ??= {}
    state.privateUses[privateId] = privateUsesMade(state, privateId) + 1
}

export type HydratedEighteenUSAState = HydratedEighteenXXState<typeof EighteenUSAState>
export const EighteenUSAStateDefinition = defineEighteenXXState(EighteenUSAState, [
    railwayStateValidation({ phaseDecisionStates: [SavingTrainState] }),
    validateSelectionAuction,
    validateCompanyAuction,
    validateLoanStep,
    validateCashCrisis,
    validateSizedCompanyRounds
])
