import { settleCashPayments } from '../finance/cashPayments.js'
import { copyStockState } from '../stock/stockState.js'
import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    Owner,
    cashOwnedBy,
    controllingOwner,
    getCompany,
    sameOwner,
    sharesOwned
} from '../finance/finance.js'
import { TrainPurchase, TrainPurchaseDetails, type TrainRules } from '../trains/trainPurchase.js'
import { trainsOwnedBy } from '../trains/train.js'
import { evaluateShareDisposal, applyShareSale, type ShareSaleDetails } from '../stock/shareSale.js'
import type { StockRules, ShareSaleTerms } from '../stock/stockRules.js'
import type { CompanyDecisionState } from '../privates/companyDecision.js'

export const TrainFunding = Type.Object(
    {
        purchase: TrainPurchaseDetails,
        playerId: Type.String(),
        contributors: Type.Array(Owner),
        sales: Type.Array(
            Type.Object({
                seller: Owner,
                companyId: Type.String(),
                shares: Type.Integer({ minimum: 1 })
            })
        )
    },
    { additionalProperties: false }
)
export type TrainFunding = Type.Static<typeof TrainFunding>
export const Bankruptcy = Type.Object(
    { companyId: Type.String(), playerId: Type.String(), shortfall: Type.Integer({ minimum: 1 }) },
    { additionalProperties: false }
)
export type Bankruptcy = Type.Static<typeof Bankruptcy>
export const FundingFields = {
    trainFunding: Type.Optional(TrainFunding),
    bankruptcy: Type.Optional(Bankruptcy)
}
export type FundingState = CompanyDecisionState & Type.Static<Type.TObject<typeof FundingFields>>
export interface TrainFundingRules {
    afterShareSale?(state: FundingState): void
    includeMarketTrains: boolean
    contributors(state: FundingState, companyId: string): Owner[]
    issuanceTerms(
        state: FundingState,
        companyId: string,
        shares: number
    ): ShareSaleTerms | undefined
    saleTerms(state: FundingState, companyId: string, shares: number, seller: Owner): ShareSaleTerms | string
    protectsPresidency(companyId: string, operatingCompanyId: string): boolean
    requiredSaleShares(state: FundingState, seller: Owner, companyId: string): number
}
export type FundingChoice =
    | { kind: 'issue'; details: ShareSaleDetails }
    | { kind: 'contribute'; owner: Owner; amount: number }
    | { kind: 'sell'; owner: Owner; sales: ShareSaleDetails[] }
    | { kind: 'buy'; purchase: TrainPurchaseDetails }
    | { kind: 'bankrupt'; shortfall: number }

export class EmergencyTrainFunding {
    constructor(
        private readonly state: FundingState,
        private readonly rules: TrainFundingRules,
        private readonly stocks: StockRules,
        private readonly trains: TrainRules
    ) {}
    canAct(playerId: string): boolean {
        return (
            this.state.machineState === 'FundingTrain' &&
            this.state.trainFunding?.playerId === playerId &&
            this.state.activePlayerIds.includes(playerId)
        )
    }
    applySale(details: ShareSaleDetails): void {
        assertExists(this.state.trainFunding, 'Funding sale requires active train funding')
        applyShareSale(this.state, details)
        this.rules.afterShareSale?.(this.state)
        for (const sale of details.sales)
            this.state.trainFunding.sales.push({
                seller: details.seller,
                companyId: sale.companyId,
                shares: sale.shares
            })
    }
    purchases(): TrainPurchaseDetails[] {
        const companyId = this.state.trainPurchaseStep?.companyId
        if (
            !companyId ||
            getCompany(this.state, companyId).closed ||
            trainsOwnedBy(this.state, { kind: 'company', companyId }).length ||
            !this.trains.requiresTrain(this.state, companyId)
        )
            return []
        const projected = {
            ...this.state,
            cash: this.state.cash.map((cash) =>
                sameOwner(cash.owner, { kind: 'company', companyId })
                    ? { ...cash, amount: 'unlimited' as const }
                    : cash
            )
        }
        const purchase = new TrainPurchase(projected, this.trains)
        const offers = [
            ...purchase
                .offers()
                .flatMap((offer) => (offer.evaluation.details ? [offer.evaluation.details] : [])),
            ...(this.rules.includeMarketTrains
                ? purchase.marketOffers().flatMap((offer) => (offer.details ? [offer.details] : []))
                : [])
        ]
        const price = Math.min(...offers.map((offer) => offer.price))
        if (this.cash({ kind: 'company', companyId }) >= price) return []
        return offers.filter((offer) => offer.price === price)
    }
    preview(purchase: TrainPurchaseDetails) {
        const state: FundingState = {
            ...this.state,
            ...copyStockState(this.state),
            operatingSet: this.state.operatingSet
                ? structuredClone(this.state.operatingSet)
                : undefined,
            trainFunding: this.state.trainFunding
                ? structuredClone(this.state.trainFunding)
                : this.begin(purchase)
        }
        const funding = new EmergencyTrainFunding(state, this.rules, this.stocks, this.trains)
        const contributions: { owner: Owner; amount: number }[] = []
        let treasuryProceeds = 0
        while (true) {
            const next = funding.next()
            if (next.kind === 'issue') {
                treasuryProceeds += next.details.proceeds
                funding.applySale(next.details)
            } else if (next.kind === 'contribute') {
                contributions.push({ owner: next.owner, amount: next.amount })
                settleCashPayments(state, [
                    {
                        from: next.owner,
                        to: { kind: 'company', companyId: purchase.companyId },
                        amount: next.amount
                    }
                ])
            } else {
                return {
                    contributions,
                    treasuryProceeds,
                    requiresSales: next.kind === 'sell',
                    choice: next,
                    amountToRaise:
                        next.kind === 'sell'
                            ? Math.max(0, funding.shortfall() - funding.cash(next.owner))
                            : funding.shortfall()
                }
            }
        }
    }
    begin(purchase: TrainPurchaseDetails): TrainFunding {
        const player = controllingOwner(this.state, purchase.companyId)
        assertExists(player, 'Train funding requires a controlling owner')
        const contributors = this.rules.contributors(this.state, purchase.companyId)
        assert(
            contributors.length > 0 &&
                contributors.every(
                    (owner, index) =>
                        owner.kind !== 'bank' &&
                        !sameOwner(owner, { kind: 'company', companyId: purchase.companyId }) &&
                        !contributors.slice(0, index).some((other) => sameOwner(owner, other))
                ),
            'Funding owners must be distinct'
        )
        return { purchase, playerId: player.playerId, contributors, sales: [] }
    }
    shortfall(): number {
        const funding = this.state.trainFunding
        assertExists(funding, 'Train funding is not active')
        return Math.max(
            0,
            funding.purchase.price -
                this.cash({ kind: 'company', companyId: funding.purchase.companyId })
        )
    }
    next(): FundingChoice {
        const funding = this.state.trainFunding
        assertExists(funding, 'Train funding is not active')
        const companyId = funding.purchase.companyId
        const treasury: Owner = { kind: 'company', companyId }
        const shortfall = this.shortfall()
        if (shortfall) {
            const shares = sharesOwned(this.state, companyId, treasury)
            const terms = shares
                ? this.rules.issuanceTerms(this.state, companyId, shares)
                : undefined
            if (terms) {
                const result = evaluateShareDisposal(
                    this.state,
                    treasury,
                    [{ companyId, shares }],
                    { ...this.stocks, saleTerms: () => terms }
                )
                assert(result.details, result.reason ?? 'Required treasury issuance is unavailable')
                return { kind: 'issue', details: result.details }
            }
        }
        for (const owner of funding.contributors) {
            const required = this.sales(owner, true)
            if (required.length) return { kind: 'sell', owner, sales: required }
            if (!shortfall) continue
            const cash = this.cash(owner)
            if (cash < shortfall) {
                const sales = this.sales(owner, false)
                if (sales.length) return { kind: 'sell', owner, sales }
            }
            const amount = Math.min(shortfall, cash)
            if (amount) return { kind: 'contribute', owner, amount }
        }
        return shortfall
            ? { kind: 'bankrupt', shortfall }
            : { kind: 'buy', purchase: funding.purchase }
    }
    private cash(owner: Owner): number {
        const amount = cashOwnedBy(this.state, owner)
        assert(typeof amount === 'number', 'Funding requires a finite balance sheet')
        return amount
    }
    private sales(owner: Owner, requiredOnly: boolean): ShareSaleDetails[] {
        const funding = this.state.trainFunding!
        const shortfall = this.shortfall()
        return this.state.companies.flatMap((company) => {
            const required = this.rules.requiredSaleShares(this.state, owner, company.id)
            if (requiredOnly && !required) return []
            if (
                funding.sales.some(
                    (sale) => sameOwner(sale.seller, owner) && sale.companyId === company.id
                )
            )
                return []
            const owned = sharesOwned(this.state, company.id, owner)
            const results: ShareSaleDetails[] = []
            for (let shares = 1; shares <= owned; shares++) {
                const result = evaluateShareDisposal(
                    this.state,
                    owner,
                    [{ companyId: company.id, shares }],
                    {
                        presidencyCandidates: this.stocks.presidencyCandidates,
                        saleTerms: (_state, id, count, seller) =>
                            this.rules.saleTerms(this.state, id, count, seller)
                    }
                )
                if (
                    !result.details ||
                    result.details.sales.some(
                        (sale) =>
                            sale.presidency &&
                            this.rules.protectsPresidency(
                                sale.companyId,
                                funding.purchase.companyId
                            )
                    )
                )
                    continue
                if (required) {
                    const projected = { ...this.state, ...copyStockState(this.state) }
                    applyShareSale(projected, result.details)
                    if (this.rules.requiredSaleShares(projected, owner, company.id)) continue
                }
                if (
                    results.some(
                        (smaller) => smaller.proceeds >= Math.max(0, shortfall - this.cash(owner))
                    )
                )
                    continue
                results.push(result.details)
            }
            return results
        })
    }
}

export function validateTrainFunding(state: {
    machineState: string
    trainFunding?: TrainFunding
    bankruptcy?: Bankruptcy
    trainPurchaseStep?: { companyId: string }
    players: readonly { playerId: string }[]
}): void {
    const funding = state.trainFunding
    if (funding) {
        assert(
            ['FundingTrain', 'Bankrupt', 'GameOver'].includes(state.machineState) &&
                funding.purchase.companyId === state.trainPurchaseStep?.companyId,
            'Funding must belong to the operating train purchase'
        )
        assert(
            state.players.some((player) => player.playerId === funding.playerId),
            'Unknown funding player'
        )
        assert(
            funding.contributors.every(
                (owner, index, owners) =>
                    !owners.slice(0, index).some((other) => sameOwner(owner, other))
            ),
            'Duplicate funding owner'
        )
    }
    assert(
        state.machineState === 'GameOver' ||
            (state.machineState === 'Bankrupt') === Boolean(state.bankruptcy),
        'Bankruptcy must match the terminal state'
    )
    assert(state.machineState !== 'FundingTrain' || funding, 'Missing train funding')
}
