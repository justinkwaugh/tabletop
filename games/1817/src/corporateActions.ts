import type { EighteenSeventeenStateHandler, EighteenSeventeenState } from './state.js'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    ActionSource,
    PlayerAction,
    HydratableAction,
    assert,
    type GameAction,
    type HydratedGameState
} from '@tabletop/common'
import {
    CashPayment,
    CorporateStockActionsHandler,
    canTakeLoan,
    companyMarketSpace,
    controllingOwner,
    corporateTurnOpen,
    finiteCashOwnedBy,
    isTakeLoan,
    recordStockAction,
    settleCashPayments
} from '@tabletop/18xx'
import { inClosingZone } from './marketZones.js'
import { EighteenSeventeenLoanRules } from './loanRules.js'
import { EighteenSeventeenStockRoundRules, MarketPoolId, treasuryPoolId } from './roundRules.js'

export function buyBackCertificateIds(state: EighteenSeventeenState, companyId: string): string[] {
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

export function canTakeCorporateLoan(
    state: EighteenSeventeenState,
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
    state: EighteenSeventeenState,
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
    state: EighteenSeventeenState,
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

export type CorporateActionOption = {
    companyId: string
    canBorrow: boolean
    /** The next market share it could buy back, its price, and how many the market holds. */
    buyBack?: { certificateId: string; price: number; available: number }
}

/** The companies the player may act for now and what each may do. */
export function corporateActionOptions(
    state: EighteenSeventeenState,
    playerId: string
): CorporateActionOption[] {
    return state.companies.flatMap((company) => {
        if (
            company.kind === 'private' ||
            !company.started ||
            controllingOwner(state, company.id)?.playerId !== playerId
        )
            return []
        const certificateIds = buyBackCertificateIds(state, company.id)
        const certificateId = certificateIds[0]
        const option: CorporateActionOption = {
            companyId: company.id,
            canBorrow: canTakeCorporateLoan(state, playerId, company.id),
            ...(certificateId && !buyBackReason(state, playerId, company.id, [certificateId])
                ? {
                      buyBack: {
                          certificateId,
                          price: buyBackPrice(state, company.id, [certificateId]),
                          available: certificateIds.length
                      }
                  }
                : {})
        }
        return option.canBorrow || option.buyBack ? [option] : []
    })
}

export const BuyBackShares = Type.Object(
    {
        ...PlayerAction.properties,
        type: Type.Literal('BuyBackShares'),
        companyId: Type.String(),
        certificateIds: Type.Array(Type.String(), { minItems: 1 }),
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
    apply(state: HydratedGameState & EighteenSeventeenState): void {
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
export function corporateActionsHandler(
    handler: EighteenSeventeenStateHandler
): EighteenSeventeenStateHandler {
    return new CorporateStockActionsHandler(handler, [
        {
            type: 'TakeLoan',
            available: (state, playerId) =>
                corporateActionOptions(state, playerId).some((option) => option.canBorrow),
            isValid: (action, state) =>
                isTakeLoan(action) && canTakeCorporateLoan(state, action.playerId, action.companyId)
        },
        {
            type: 'BuyBackShares',
            available: (state, playerId) =>
                corporateActionOptions(state, playerId).some((option) => option.buyBack),
            isValid: (action, state) =>
                isBuyBackShares(action) &&
                !buyBackReason(state, action.playerId, action.companyId, action.certificateIds)
        }
    ])
}
