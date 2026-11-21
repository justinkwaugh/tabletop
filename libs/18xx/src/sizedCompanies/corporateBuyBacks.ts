import { ActionSource, assert, type HydratedGameState } from '@tabletop/common'
import * as Type from 'typebox'
import type { ActionDefinition } from '../actions/actionDefinition.js'
import { titleAction } from '../actions/titleAction.js'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { controllingOwner, finiteCashOwnedBy, treasuryPoolId } from '../finance/finance.js'
import type { EighteenXXStateHandler } from '../game/eighteenXXTitleRules.js'
import type { LoanRules } from '../loans/loans.js'
import { canTakeLoan, isTakeLoan } from '../loans/takeLoan.js'
import {
    CorporateStockActionsHandler,
    corporateTurnOpen,
    type CorporateStockAction
} from '../stock/corporateStockTurn.js'
import { recordStockAction } from '../stock/stockRoundRules.js'
import type { StockRules } from '../stock/stockRules.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import type { HydratedSizedCompanyState, SizedCompanyState } from './sizedCompanyState.js'

export interface CorporateBuyBackRules {
    market: SizedCompanyMarket
    loanRules: LoanRules
    stockRules: StockRules
}

export type CorporateActionOption = {
    companyId: string
    canBorrow: boolean
    /** The next market share it could buy back, its price, and how many the market holds. */
    buyBack?: { certificateId: string; price: number; available: number }
}

const BuyBackSharesAction = titleAction('BuyBackShares', {
    companyId: Type.String(),
    certificateIds: Type.Array(Type.String(), { minItems: 1 }),
    metadata: Type.Optional(Type.Object({ payment: CashPayment }, { additionalProperties: false }))
})
export const BuyBackShares = BuyBackSharesAction.schema
export type BuyBackShares = Type.Static<typeof BuyBackShares>
export const isBuyBackShares = BuyBackSharesAction.is

/**
 * In place of their own stock action, a president may act for one company they preside: take
 * loans, then buy back its market shares with its treasury.
 */
export class CorporateBuyBacks {
    constructor(readonly rules: CorporateBuyBackRules) {}

    buyBackCertificateIds(state: SizedCompanyState, companyId: string): string[] {
        const { market } = this.rules
        if (market.inClosingZone(state.stockMarket, companyId)) return []
        return state.certificates
            .filter(
                (certificate) =>
                    certificate.kind === 'share' &&
                    certificate.companyId === companyId &&
                    certificate.owner.kind === 'bank' &&
                    certificate.poolId === market.rules.marketPoolId
            )
            .map((certificate) => certificate.id)
    }

    canTakeCorporateLoan(state: SizedCompanyState, playerId: string, companyId: string): boolean {
        return (
            corporateTurnOpen(state, playerId, companyId, this.rules.stockRules) &&
            !state.stockRound.turn.corporateAction?.boughtBack &&
            canTakeLoan(state, this.rules.loanRules, playerId, companyId)
        )
    }

    buyBackReason(
        state: SizedCompanyState,
        playerId: string,
        companyId: string,
        certificateIds: readonly string[]
    ): string | undefined {
        if (!corporateTurnOpen(state, playerId, companyId, this.rules.stockRules))
            return 'Only a president may act for their company, in place of their own action.'
        const available = this.buyBackCertificateIds(state, companyId)
        if (
            !certificateIds.length ||
            new Set(certificateIds).size !== certificateIds.length ||
            !certificateIds.every((id) => available.includes(id))
        )
            return 'Only the company’s shares in the market can be bought back.'
        if (
            this.buyBackPrice(state, companyId, certificateIds) >
            finiteCashOwnedBy(state, { kind: 'company', companyId })
        )
            return 'The company cannot afford these shares.'
        return undefined
    }

    private buyBackPrice(
        state: SizedCompanyState,
        companyId: string,
        certificateIds: readonly string[]
    ): number {
        const shares = state.certificates
            .filter((certificate) => certificateIds.includes(certificate.id))
            .reduce(
                (sum, certificate) => sum + (certificate.kind === 'share' ? certificate.shares : 0),
                0
            )
        return this.rules.market.price(state, companyId) * shares
    }

    /** The companies the player may act for now and what each may do. */
    corporateActionOptions(state: SizedCompanyState, playerId: string): CorporateActionOption[] {
        return state.companies.flatMap((company) => {
            if (
                company.kind === 'private' ||
                !company.started ||
                controllingOwner(state, company.id)?.playerId !== playerId
            )
                return []
            const certificateIds = this.buyBackCertificateIds(state, company.id)
            const certificateId = certificateIds[0]
            const option: CorporateActionOption = {
                companyId: company.id,
                canBorrow: this.canTakeCorporateLoan(state, playerId, company.id),
                ...(certificateId &&
                !this.buyBackReason(state, playerId, company.id, [certificateId])
                    ? {
                          buyBack: {
                              certificateId,
                              price: this.buyBackPrice(state, company.id, [certificateId]),
                              available: certificateIds.length
                          }
                      }
                    : {})
            }
            return option.canBorrow || option.buyBack ? [option] : []
        })
    }

    actions(): ActionDefinition[] {
        return CorporateBuyBacks.actionsOf(this)
    }

    private static actionsOf(buyBacks: CorporateBuyBacks): ActionDefinition[] {
        const { stockRules } = buyBacks.rules
        class HydratedBuyBackShares extends BuyBackSharesAction.Base implements BuyBackShares {
            declare type: 'BuyBackShares'
            declare playerId: string
            declare companyId: string
            declare certificateIds: string[]
            declare metadata?: BuyBackShares['metadata']
            apply(state: HydratedGameState & SizedCompanyState): void {
                const reason = buyBacks.buyBackReason(
                    state,
                    this.playerId,
                    this.companyId,
                    this.certificateIds
                )
                assert(this.source === ActionSource.User && !reason, reason ?? 'Invalid buy-back')
                const company = { kind: 'company' as const, companyId: this.companyId }
                const payment = {
                    from: company,
                    to: { kind: 'bank' as const },
                    amount: buyBacks.buyBackPrice(state, this.companyId, this.certificateIds)
                }
                settleCashPayments(state, [payment])
                for (const certificate of state.certificates)
                    if (this.certificateIds.includes(certificate.id)) {
                        certificate.owner = company
                        certificate.poolId = treasuryPoolId(this.companyId)
                    }
                state.stockRound.turn.corporateAction = {
                    companyId: this.companyId,
                    boughtBack: true
                }
                recordStockAction(state, this.playerId, stockRules.round)
                this.metadata = { payment }
            }
        }
        return [BuyBackSharesAction.define((action) => new HydratedBuyBackShares(action))]
    }

    /**
     * The president's corporate turn: loans, then buy-backs, then any of the title's own company
     * actions; afterwards only finishing the turn remains.
     */
    corporateActionsHandler<S extends HydratedSizedCompanyState>(
        handler: EighteenXXStateHandler<S>,
        titleActions: readonly CorporateStockAction<S>[] = []
    ): EighteenXXStateHandler<S> {
        return new CorporateStockActionsHandler(handler, [
            {
                type: 'TakeLoan',
                available: (state, playerId) =>
                    this.corporateActionOptions(state, playerId).some((option) => option.canBorrow),
                isValid: (action, state) =>
                    isTakeLoan(action) &&
                    this.canTakeCorporateLoan(state, action.playerId, action.companyId)
            },
            {
                type: 'BuyBackShares',
                available: (state, playerId) =>
                    this.corporateActionOptions(state, playerId).some((option) => option.buyBack),
                isValid: (action, state) =>
                    isBuyBackShares(action) &&
                    !this.buyBackReason(
                        state,
                        action.playerId,
                        action.companyId,
                        action.certificateIds
                    )
            },
            ...titleActions
        ])
    }
}
