import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    GameAction,
    HydratableAction,
    assert,
    assertExists,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { EighteenXXPlayerAction } from '../actions/eighteenXXPlayerAction.js'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import { CashPayment, settleCashPayments } from './cashPayments.js'
import {
    certificatesInPool,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    treasuryPoolId,
    type FinancialState
} from './finance.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import type { StockMarket, StockMarketChart } from '../stock/stockMarket.js'

/**
 * Issuing treasury shares to the market and redeeming them, during the operating turn: 1846 and
 * its descendants.
 */
export interface CorporateFinanceRules {
    market: StockMarketChart
    marketPoolId: string
    /** What a redeemed share costs when the marker already stands on the last space. */
    topRedemptionPrice: number
}

const FinanceOperation = Type.Union([Type.Literal('issue'), Type.Literal('redeem')])
export const FinanceChoice = Type.Object(
    {
        companyId: Type.String(),
        operation: FinanceOperation,
        shares: Type.Integer({ minimum: 1 }),
        amount: Type.Integer({ minimum: 0 })
    },
    { additionalProperties: false }
)
export type FinanceChoice = Type.Static<typeof FinanceChoice>

/** The direction a corporation committed to this turn: it may not both issue and redeem. */
export const FinanceStep = Type.Object(
    { companyId: Type.String(), operation: FinanceOperation },
    { additionalProperties: false }
)
export type FinanceStep = Type.Static<typeof FinanceStep>
export const CorporateFinanceFields = { financeStep: Type.Optional(FinanceStep) }
export type CorporateFinanceState = FinancialState &
    Pick<OperatingState, 'operatingSet'> &
    Type.Static<Type.TObject<typeof CorporateFinanceFields>> & {
        machineState: string
        activePlayerIds: string[]
        stockMarket: StockMarket
    }

// Issuing comes first in the operating order, but nothing before the run changes the price,
// limits or payout, so a president may issue or redeem at any point until routes are run.
const CorporateFinanceStates: readonly string[] = ['LayingTrack', 'RunningTrains']

export function corporateFinanceCertificates(
    state: FinancialState,
    companyId: string,
    operation: 'issue' | 'redeem',
    marketPoolId: string
) {
    const certificates =
        operation === 'issue'
            ? certificatesInPool(state, treasuryPoolId(companyId))
            : certificatesInPool(state, marketPoolId)
    return certificates.filter((certificate) => certificate.companyId === companyId)
}

/** The shares a corporation may issue: no more than players hold beyond those in the market. */
export function corporateIssueLimit(
    state: FinancialState,
    companyId: string,
    marketPoolId: string
): number {
    const treasury = corporateFinanceCertificates(state, companyId, 'issue', marketPoolId)
    const market = corporateFinanceCertificates(state, companyId, 'redeem', marketPoolId)
    const playerShares = state.certificates.reduce(
        (total, certificate) =>
            total +
            (certificate.companyId === companyId &&
            certificate.kind === 'share' &&
            certificate.owner.kind === 'player'
                ? certificate.shares
                : 0),
        0
    )
    return Math.max(0, Math.min(treasury.length, playerShares - market.length))
}

export function corporateFinanceChoices(
    state: CorporateFinanceState,
    rules: CorporateFinanceRules
): FinanceChoice[] {
    if (!CorporateFinanceStates.includes(state.machineState)) return []
    const companyId = nextOperatingCompany(state)
    assertExists(companyId, 'Corporate finance requires an operating company')
    const company = getCompany(state, companyId)
    if (company.kind !== 'major') return []
    assert(
        !company.closed && company.floated,
        'Corporate finance requires an open, floated major corporation'
    )
    const committed =
        state.financeStep?.companyId === companyId ? state.financeStep.operation : undefined
    const market = corporateFinanceCertificates(state, companyId, 'redeem', rules.marketPoolId)
    const space = rules.market.companySpace(state.stockMarket, companyId)
    assertExists(space.moves.left, 'An operating corporation has an issuance price')
    const issuePrice = rules.market.space(space.moves.left).price
    const redeemPrice = space.moves.right
        ? rules.market.space(space.moves.right).price
        : rules.topRedemptionPrice
    const issueLimit =
        committed === 'redeem' ? 0 : corporateIssueLimit(state, companyId, rules.marketPoolId)
    const redeemLimit =
        committed === 'issue'
            ? 0
            : Math.min(
                  market.length,
                  Math.floor(finiteCashOwnedBy(state, { kind: 'company', companyId }) / redeemPrice)
              )
    return [
        ...Array.from({ length: issueLimit }, (_, i): FinanceChoice => ({
            companyId,
            operation: 'issue',
            shares: i + 1,
            amount: (i + 1) * issuePrice
        })),
        ...Array.from({ length: redeemLimit }, (_, i): FinanceChoice => ({
            companyId,
            operation: 'redeem',
            shares: i + 1,
            amount: (i + 1) * redeemPrice
        }))
    ]
}

export const CorporateFinance = Type.Object(
    {
        ...EighteenXXPlayerAction.properties,
        ...FinanceChoice.properties,
        type: Type.Literal('CorporateFinance'),
        source: Type.Literal(ActionSource.User),
        metadata: Type.Optional(
            Type.Object(
                {
                    ...FinanceChoice.properties,
                    certificateIds: Type.Array(Type.String()),
                    payments: Type.Array(CashPayment)
                },
                { additionalProperties: false }
            )
        )
    },
    { additionalProperties: false }
)
export type CorporateFinance = Type.Static<typeof CorporateFinance>
export const CorporateFinanceValidator = Compile(CorporateFinance)
export function isCorporateFinance(action: GameAction): action is CorporateFinance {
    return action.type === 'CorporateFinance' && CorporateFinanceValidator.Check(action)
}

export class HydratedCorporateFinance extends HydratableAction<typeof CorporateFinance> {
    declare playerId: string
    declare companyId: string
    declare operation: FinanceChoice['operation']
    declare shares: number
    declare amount: number
    declare metadata?: CorporateFinance['metadata']
    readonly #rules: CorporateFinanceRules
    constructor(data: CorporateFinance, rules: CorporateFinanceRules) {
        super(data, CorporateFinanceValidator)
        this.#rules = rules
    }
    isValid(state: HydratedGameState & CorporateFinanceState): boolean {
        return (
            this.source === ActionSource.User &&
            state.activePlayerIds.includes(this.playerId) &&
            nextOperatingCompany(state) === this.companyId &&
            controllingOwner(state, this.companyId)?.playerId === this.playerId &&
            corporateFinanceChoices(state, this.#rules).some(
                (choice) =>
                    choice.companyId === this.companyId &&
                    choice.operation === this.operation &&
                    choice.shares === this.shares &&
                    choice.amount === this.amount
            )
        )
    }
    apply(state: HydratedGameState & CorporateFinanceState): void {
        assert(this.isValid(state), 'Invalid corporate share transaction')
        const company = { kind: 'company' as const, companyId: this.companyId }
        const bank = { kind: 'bank' as const }
        const issuing = this.operation === 'issue'
        const certificates = corporateFinanceCertificates(
            state,
            this.companyId,
            this.operation,
            this.#rules.marketPoolId
        ).slice(0, this.shares)
        const payments: CashPayment[] = this.amount
            ? [
                  {
                      from: issuing ? bank : company,
                      to: issuing ? company : bank,
                      amount: this.amount
                  }
              ]
            : []
        settleCashPayments(state, payments)
        for (const certificate of certificates) {
            certificate.owner = issuing ? bank : company
            certificate.poolId = issuing ? this.#rules.marketPoolId : treasuryPoolId(this.companyId)
        }
        state.financeStep = { companyId: this.companyId, operation: this.operation }
        this.metadata = {
            companyId: this.companyId,
            operation: this.operation,
            shares: this.shares,
            amount: this.amount,
            certificateIds: certificates.map((certificate) => certificate.id),
            payments
        }
    }
}

export function corporateFinanceActions(rules: CorporateFinanceRules): ActionDefinition[] {
    return [
        defineAction(
            CorporateFinance,
            isCorporateFinance,
            (data) => new HydratedCorporateFinance(data, rules)
        )
    ]
}

/** Adds issuing and redeeming to an operating step that stays where it is afterwards. */
export class CorporateFinanceHandler<
    State extends HydratedGameState & CorporateFinanceState
> implements MachineStateHandler<HydratedAction, State> {
    constructor(
        private readonly handler: MachineStateHandler<HydratedAction, State>,
        private readonly rules: CorporateFinanceRules
    ) {}
    enter(context: MachineContext<State>): void {
        this.handler.enter(context)
    }
    validActionsForPlayer(playerId: string, context: MachineContext<State>): string[] {
        const state = context.gameState
        return [
            ...this.handler.validActionsForPlayer(playerId, context),
            ...(state.isActivePlayer(playerId) && corporateFinanceChoices(state, this.rules).length
                ? ['CorporateFinance']
                : [])
        ]
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        return action instanceof HydratedCorporateFinance
            ? action.isValid(context.gameState)
            : this.handler.isValidAction(action, context)
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return action instanceof HydratedCorporateFinance
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
