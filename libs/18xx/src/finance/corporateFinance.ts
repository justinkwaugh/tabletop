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
    type Certificate,
    type FinancialState
} from './finance.js'
import { nextOperatingCompany, type OperatingState } from '../operating/operatingSet.js'
import type { StockMarket, StockMarketChart } from '../stock/stockMarket.js'
import { HydratedBuyTrain } from '../trains/buyTrain.js'
import { HydratedFundTrain } from '../funding/fundTrain.js'
import { HydratedOfferPurchase } from '../transfers/offerPurchase.js'

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
export type FinanceOperation = FinanceChoice['operation']

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

export interface CorporateFinanceRules {
    choices(
        state: CorporateFinanceState,
        companyId: string,
        committed: FinanceOperation | undefined
    ): FinanceChoice[]
    /** Listed in the order they move. */
    certificates(
        state: FinancialState,
        companyId: string,
        operation: FinanceOperation
    ): Certificate[]
    /** Issued shares stay with the bank and redeemed ones go to the company, in this pool if any. */
    destinationPool(companyId: string, operation: FinanceOperation): string | undefined
    afterSettling?(state: CorporateFinanceState, choice: FinanceChoice): void
    /**
     * When in the turn shares change hands: until routes are run, or after the turn's train
     * purchases, as in 1849 §10.8, where a company that has issued or redeemed buys no more trains.
     */
    timing?: CorporateFinanceTiming
}
export type CorporateFinanceTiming = 'before-running' | 'after-trains'

// Issuing comes first in the operating order, but nothing before the run changes the price,
// limits or payout, so a president may issue or redeem at any point until routes are run.
const CorporateFinanceStates: Readonly<Record<CorporateFinanceTiming, readonly string[]>> = {
    'before-running': ['LayingTrack', 'PlacingStation', 'RunningTrains'],
    'after-trains': ['BuyingTrains']
}

function corporateFinanceCertificates(
    state: FinancialState,
    companyId: string,
    operation: FinanceOperation,
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

function choicesUpTo(
    limit: number,
    companyId: string,
    operation: FinanceOperation,
    price: number
): FinanceChoice[] {
    return Array.from({ length: limit }, (_, i) => ({
        companyId,
        operation,
        shares: i + 1,
        amount: (i + 1) * price
    }))
}

/** One choice per count of shares the company can afford, of those it may redeem at this price. */
export function redeemChoices(
    state: FinancialState,
    companyId: string,
    redeemable: number,
    price: number
): FinanceChoice[] {
    const affordable = Math.floor(finiteCashOwnedBy(state, { kind: 'company', companyId }) / price)
    return choicesUpTo(Math.min(redeemable, affordable), companyId, 'redeem', price)
}

export function corporateFinanceChoices(
    state: CorporateFinanceState,
    rules: CorporateFinanceRules
): FinanceChoice[] {
    if (!CorporateFinanceStates[rules.timing ?? 'before-running'].includes(state.machineState))
        return []
    const companyId = nextOperatingCompany(state)
    assertExists(companyId, 'Corporate finance requires an operating company')
    const company = getCompany(state, companyId)
    if (company.kind !== 'major') return []
    assert(
        !company.closed && company.floated,
        'Corporate finance requires an open, floated major corporation'
    )
    return rules.choices(
        state,
        companyId,
        state.financeStep?.companyId === companyId ? state.financeStep.operation : undefined
    )
}

/**
 * 1846 and its descendants: shares issue to the market a price space below the company's and
 * redeem from it a space above, any number that the players' holdings and the treasury allow.
 */
export function marketCorporateFinance({
    market,
    marketPoolId,
    topRedemptionPrice
}: {
    market: StockMarketChart
    marketPoolId: string
    /** What a redeemed share costs when the marker already stands on the last space. */
    topRedemptionPrice: number
}): CorporateFinanceRules {
    return {
        certificates: (state, companyId, operation) =>
            corporateFinanceCertificates(state, companyId, operation, marketPoolId),
        destinationPool: (companyId, operation) =>
            operation === 'issue' ? marketPoolId : treasuryPoolId(companyId),
        choices(state, companyId, committed) {
            const shares = corporateFinanceCertificates(state, companyId, 'redeem', marketPoolId)
            const space = market.companySpace(state.stockMarket, companyId)
            assertExists(space.moves.left, 'An operating corporation has an issuance price')
            const issuePrice = market.space(space.moves.left).price
            const redeemPrice = space.moves.right
                ? market.space(space.moves.right).price
                : topRedemptionPrice
            return [
                ...(committed === 'redeem'
                    ? []
                    : choicesUpTo(
                          corporateIssueLimit(state, companyId, marketPoolId),
                          companyId,
                          'issue',
                          issuePrice
                      )),
                ...(committed === 'issue'
                    ? []
                    : redeemChoices(state, companyId, shares.length, redeemPrice))
            ]
        }
    }
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
    declare operation: FinanceOperation
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
        const certificates = certificatesMakingShares(
            this.#rules.certificates(state, this.companyId, this.operation),
            this.shares
        )
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
        const poolId = this.#rules.destinationPool(this.companyId, this.operation)
        for (const certificate of certificates) {
            certificate.owner = issuing ? bank : company
            if (poolId) certificate.poolId = poolId
            else delete certificate.poolId
        }
        state.financeStep = { companyId: this.companyId, operation: this.operation }
        this.#rules.afterSettling?.(state, {
            companyId: this.companyId,
            operation: this.operation,
            shares: this.shares,
            amount: this.amount
        })
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

/** The first certificates, in the order they move, that hold exactly the shares. */
function certificatesMakingShares(certificates: Certificate[], shares: number): Certificate[] {
    const chosen: Certificate[] = []
    let remaining = shares
    for (const certificate of certificates) {
        if (remaining === 0) break
        const held = certificate.kind === 'share' ? certificate.shares : 0
        if (held === 0 || held > remaining) continue
        chosen.push(certificate)
        remaining -= held
    }
    assert(remaining === 0, 'The certificates do not make up the shares')
    return chosen
}

/** Whether the action acquires a train, which a company that has issued or redeemed may not. */
function acquiresTrain(action: HydratedAction): boolean {
    return (
        action instanceof HydratedBuyTrain ||
        action instanceof HydratedFundTrain ||
        (action instanceof HydratedOfferPurchase && action.asset.kind === 'train')
    )
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

const TrainAcquisitionTypes: readonly string[] = ['BuyTrain', 'FundTrain']

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
        const familyActions = this.handler.validActionsForPlayer(playerId, context)
        return [
            ...(this.closesTrainPurchases(state)
                ? familyActions.filter((type) => !TrainAcquisitionTypes.includes(type))
                : familyActions),
            ...(state.isActivePlayer(playerId) && corporateFinanceChoices(state, this.rules).length
                ? ['CorporateFinance']
                : [])
        ]
    }
    isValidAction(action: HydratedAction, context: MachineContext<State>): boolean {
        if (action instanceof HydratedCorporateFinance) return action.isValid(context.gameState)
        if (this.closesTrainPurchases(context.gameState) && acquiresTrain(action)) return false
        return this.handler.isValidAction(action, context)
    }
    /** After-train finance ends the turn's train purchases once the company has used it. */
    private closesTrainPurchases(state: State): boolean {
        return (
            this.rules.timing === 'after-trains' &&
            state.machineState === 'BuyingTrains' &&
            state.financeStep !== undefined &&
            state.financeStep.companyId === nextOperatingCompany(state)
        )
    }
    onAction(action: HydratedAction, context: MachineContext<State>): string {
        return action instanceof HydratedCorporateFinance
            ? context.gameState.machineState
            : this.handler.onAction(action, context)
    }
}
