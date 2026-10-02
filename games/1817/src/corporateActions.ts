import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedAction,
    type HydratedGameState,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    canTakeLoan,
    companyMarketSpace,
    controllingOwner,
    finiteCashOwnedBy,
    isTakeLoan,
    recordStockAction,
    settleCashPayments,
    type EighteenXXState,
    type EighteenXXStateHandler,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { inClosingZone } from './marketZones.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { EighteenSeventeenStockRoundRules, MarketPoolId, treasuryPoolId } from './roundRules.js'

/** The market shares a company may buy back into its treasury. */
export function buyBackCertificateIds(state: EighteenXXState, companyId: string): string[] {
    if (inClosingZone(state.stockMarket, companyId)) return []
    return state.certificates
        .filter(
            (certificate) =>
                !certificate.retired &&
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.owner.kind === 'bank' &&
                certificate.poolId === MarketPoolId
        )
        .map((certificate) => certificate.id)
}

/** Whether the player may still act for this company in their stock turn. */
function corporateTurnOpen(state: EighteenXXState, playerId: string, companyId: string): boolean {
    const turn = state.stockRound.turn
    return (
        state.machineState === 'StockRound' &&
        !state.companyAuction &&
        state.activePlayerIds.includes(playerId) &&
        controllingOwner(state, companyId)?.playerId === playerId &&
        (turn.corporateAction ? turn.corporateAction.companyId === companyId : !turn.acted)
    )
}

export function canTakeCorporateLoan(
    state: EighteenXXState,
    playerId: string,
    companyId: string
): boolean {
    return (
        corporateTurnOpen(state, playerId, companyId) &&
        !state.stockRound.turn.corporateAction?.boughtBack &&
        canTakeLoan(state, EighteenSeventeenLoanRules, playerId, companyId)
    )
}

export function buyBackReason(
    state: EighteenXXState,
    playerId: string,
    companyId: string,
    certificateIds: readonly string[]
): string | undefined {
    if (!corporateTurnOpen(state, playerId, companyId))
        return 'Only a president may act for their company, in place of their own action.'
    const available = buyBackCertificateIds(state, companyId)
    if (
        !certificateIds.length ||
        new Set(certificateIds).size !== certificateIds.length ||
        !certificateIds.every((id) => available.includes(id))
    )
        return 'Only the company’s shares in the market can be bought back.'
    if (
        buyBackPrice(state, companyId, certificateIds) >
        finiteCashOwnedBy(state, { kind: 'company', companyId })
    )
        return 'The company cannot afford these shares.'
    return undefined
}

function buyBackPrice(
    state: EighteenXXState,
    companyId: string,
    certificateIds: readonly string[]
): number {
    const shares = state.certificates
        .filter((certificate) => certificateIds.includes(certificate.id))
        .reduce(
            (sum, certificate) =>
                sum +
                (!certificate.retired && certificate.kind === 'share' ? certificate.shares : 0),
            0
        )
    return companyMarketSpace(state.stockMarket, companyId).price * shares
}

/** The companies the player may act for now, with the corporate actions open to each. */
export function corporateActionTypes(state: EighteenXXState, playerId: string): string[] {
    const companies = state.companies.filter(
        (company) =>
            company.kind !== 'private' &&
            company.started &&
            controllingOwner(state, company.id)?.playerId === playerId
    )
    return [
        ...(companies.some((company) => canTakeCorporateLoan(state, playerId, company.id))
            ? ['TakeLoan']
            : []),
        ...(companies.some(
            (company) =>
                !buyBackReason(
                    state,
                    playerId,
                    company.id,
                    buyBackCertificateIds(state, company.id).slice(0, 1)
                )
        )
            ? ['BuyBackShares']
            : [])
    ]
}

export const BuyBackShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyBackShares'),
        companyId: Type.String(),
        certificateIds: Type.Array(Type.String(), { minItems: 1, uniqueItems: true }),
        metadata: Type.Optional(
            Type.Object({ payment: CashPayment }, { additionalProperties: false })
        )
    },
    { additionalProperties: false }
)
export type BuyBackShares = Type.Static<typeof BuyBackShares>
const Validator = Compile(BuyBackShares)
export function isBuyBackShares(action: GameAction): action is BuyBackShares {
    return (
        action instanceof HydratedBuyBackShares ||
        (action.type === 'BuyBackShares' && Validator.Check(action))
    )
}

export class HydratedBuyBackShares
    extends HydratableAction<typeof BuyBackShares>
    implements BuyBackShares
{
    declare type: 'BuyBackShares'
    declare playerId: string
    declare companyId: string
    declare certificateIds: string[]
    declare metadata?: BuyBackShares['metadata']
    constructor(data: BuyBackShares) {
        super(data instanceof HydratedBuyBackShares ? data.dehydrate() : data, Validator)
    }
    apply(state: HydratedGameState & EighteenXXState): void {
        const reason = buyBackReason(state, this.playerId, this.companyId, this.certificateIds)
        assert(this.source === ActionSource.User && !reason, reason ?? 'Invalid buy-back')
        const company = { kind: 'company' as const, companyId: this.companyId }
        const payment = {
            from: company,
            to: { kind: 'bank' as const },
            amount: buyBackPrice(state, this.companyId, this.certificateIds)
        }
        settleCashPayments(state, [payment])
        for (const certificate of state.certificates)
            if (!certificate.retired && this.certificateIds.includes(certificate.id)) {
                certificate.owner = company
                certificate.poolId = treasuryPoolId(this.companyId)
            }
        state.stockRound.turn.corporateAction = { companyId: this.companyId, boughtBack: true }
        recordStockAction(state, this.playerId, EighteenSeventeenStockRoundRules)
        this.metadata = { payment }
    }
}

/**
 * In place of their own action, a player may act for one company they preside: take loans, then
 * buy back its market shares. Afterwards only finishing the turn remains.
 */
export class CorporateActionsHandler implements EighteenXXStateHandler {
    constructor(private readonly handler: EighteenXXStateHandler) {}
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedEighteenXXState>
    ): boolean {
        const state = context.gameState
        if (isTakeLoan(action))
            return (
                action.source === ActionSource.User &&
                canTakeCorporateLoan(state, action.playerId, action.companyId)
            )
        if (isBuyBackShares(action))
            return (
                action.source === ActionSource.User &&
                !buyBackReason(state, action.playerId, action.companyId, action.certificateIds)
            )
        if (
            state.stockRound.turn.corporateAction &&
            action.source === ActionSource.User &&
            action.type !== 'FinishStockTurn'
        )
            return false
        return this.handler.isValidAction(action, context)
    }
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedEighteenXXState>
    ): string[] {
        const state = context.gameState
        const actions = this.handler.validActionsForPlayer(playerId, context)
        if (!actions.includes('FinishStockTurn')) return actions
        const corporate = corporateActionTypes(state, playerId)
        return state.stockRound.turn.corporateAction
            ? [...corporate, 'FinishStockTurn']
            : [...actions, ...corporate]
    }
    enter(context: MachineContext<HydratedEighteenXXState>): void {
        this.handler.enter(context)
    }
    onAction(action: HydratedAction, context: MachineContext<HydratedEighteenXXState>): string {
        return isTakeLoan(action) || isBuyBackShares(action)
            ? 'StockRound'
            : this.handler.onAction(action, context)
    }
}
