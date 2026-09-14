import * as Type from 'typebox'
import { assert } from '@tabletop/common'
import {
    Owner,
    cashOwnedBy,
    controllingOwner,
    getCompany,
    sameOwner,
    type Certificate,
    type FinancialState
} from '../finance/finance.js'
import { CashPayment } from '../finance/cashPayments.js'
import { StockMarketMove, type StockMarket } from '../stock/stockMarket.js'
import type { TrainRunningState } from '../routes/route.js'
export const EarningsChoice = Type.Union([
    Type.Literal('pay'),
    Type.Literal('withhold'),
    Type.Literal('half-pay')
])
export type EarningsChoice = Type.Static<typeof EarningsChoice>
export const EarningsDetails = Type.Object(
    {
        companyId: Type.String(),
        choice: EarningsChoice,
        revenue: Type.Integer({ minimum: 0 }),
        retained: Type.Integer({ minimum: 0 }),
        dividendPerShare: Type.Integer({ minimum: 0 }),
        bonusPerShare: Type.Integer({ minimum: 0 }),
        bankAdjustment: Type.Integer(),
        payments: Type.Array(CashPayment),
        marketMove: Type.Optional(StockMarketMove)
    },
    { additionalProperties: false }
)
export type EarningsDetails = Type.Static<typeof EarningsDetails>
export const EarningsFields = { earningsDistribution: Type.Optional(EarningsDetails) }
export type EarningsState = Type.Static<Type.TObject<typeof EarningsFields>>
export type DistributionState = TrainRunningState & EarningsState & { stockMarket: StockMarket }
export type DividendEntitlement = { owner: Owner; shares: number }
export interface EarningsRules {
    choices(state: DistributionState, companyId: string): EarningsChoice[]
    shareCount(state: DistributionState, companyId: string): number
    entitlements(state: DistributionState, companyId: string): DividendEntitlement[]
    retainedRevenue(
        state: DistributionState,
        companyId: string,
        choice: EarningsChoice,
        revenue: number
    ): number
    roundDividend(state: DistributionState, companyId: string, amount: number): number
    marketEffect(
        state: DistributionState,
        companyId: string,
        paying: boolean
    ): { move?: StockMarketMove; bonusPerShare: number }
}
export function dividendEntitlements(
    state: FinancialState,
    companyId: string,
    recipient: (
        certificate: Extract<Certificate, { retired: false; kind: 'share' }>
    ) => Owner | undefined
): DividendEntitlement[] {
    const result: DividendEntitlement[] = []
    for (const certificate of state.certificates) {
        if (
            certificate.retired ||
            certificate.kind !== 'share' ||
            certificate.companyId !== companyId
        )
            continue
        const owner = recipient(certificate)
        if (!owner) continue
        const previous = result.find((entry) => sameOwner(entry.owner, owner))
        if (previous) previous.shares += certificate.shares
        else result.push({ owner: { ...owner }, shares: certificate.shares })
    }
    return result
}
export class EarningsDistribution {
    constructor(
        private readonly state: DistributionState,
        readonly rules: EarningsRules
    ) {}
    automaticChoice(companyId: string): EarningsChoice | undefined {
        return this.state.routeStep?.result?.revenue === 0 &&
            this.state.routeStep.result.routes.length === 0 &&
            this.rules.choices(this.state, companyId).includes('withhold')
            ? 'withhold' : undefined
    }
    canAct(playerId: string, companyId: string): boolean {
        return (
            this.state.routeStep?.companyId === companyId &&
            !!this.state.routeStep.result &&
            !this.state.earningsDistribution &&
            !getCompany(this.state, companyId).closed &&
            controllingOwner(this.state, companyId)?.playerId === playerId
        )
    }
    evaluate(
        companyId: string,
        choice: EarningsChoice
    ): { details: EarningsDetails; reason?: never } | { details?: never; reason: string } {
        const result = this.state.routeStep?.result
        if (
            !result ||
            result.companyId !== companyId ||
            this.state.earningsDistribution ||
            getCompany(this.state, companyId).closed
        )
            return { reason: 'This company is not distributing earnings.' }
        if (!this.rules.choices(this.state, companyId).includes(choice))
            return { reason: 'This distribution choice is not available.' }
        const revenue = result.revenue,
            retained = this.rules.retainedRevenue(this.state, companyId, choice, revenue)
        const count = this.rules.shareCount(this.state, companyId)
        assert(count > 0 && Number.isInteger(count), 'Dividends require a positive share count')
        assert(
            Number.isInteger(retained) && retained >= 0 && retained <= revenue,
            'Invalid retained revenue'
        )
        const base = this.rules.roundDividend(this.state, companyId, (revenue - retained) / count)
        const effect = this.rules.marketEffect(this.state, companyId, base > 0)
        const dividendPerShare = base + effect.bonusPerShare
        assert(
            Number.isInteger(dividendPerShare) && dividendPerShare >= 0,
            'Dividends must be whole currency units'
        )
        const payments: CashPayment[] = []
        this.addPayment(payments, { kind: 'company', companyId }, retained)
        for (const entitlement of this.rules.entitlements(this.state, companyId))
            this.addPayment(payments, entitlement.owner, entitlement.shares * dividendPerShare)
        const total = payments.reduce((sum, payment) => sum + payment.amount, 0),
            bank = cashOwnedBy(this.state, { kind: 'bank' })
        if (
            bank !== 'unlimited' &&
            !this.state.bank.unlimitedAfterExhaustion &&
            (bank === undefined || bank < total)
        )
            return {
                reason: 'The Bank cannot fund this payment.'
            }
        return {
            details: {
                companyId,
                choice,
                revenue,
                retained,
                dividendPerShare,
                bonusPerShare: effect.bonusPerShare,
                bankAdjustment: total - revenue,
                payments,
                ...(effect.move ? { marketMove: effect.move } : {})
            }
        }
    }
    private addPayment(payments: CashPayment[], owner: Owner, amount: number): void {
        if (!amount || owner.kind === 'bank') return
        const previous = payments.find((payment) => sameOwner(payment.to, owner))
        if (previous) previous.amount += amount
        else payments.push({ from: { kind: 'bank' }, to: { ...owner }, amount })
    }
}
