import { assertExists } from '@tabletop/common'
import * as Type from 'typebox'
import { CashPayment, settleCashPayments } from '../finance/cashPayments.js'
import { corporateIssueLimit } from '../finance/corporateFinance.js'
import {
    certificatesOwnedBy,
    controllingOwner,
    finiteCashOwnedBy,
    sameOwner,
    sharesOwned
} from '../finance/finance.js'
import type { PlayerOwner, ReceivershipRules } from '../finance/receivership.js'
import { reorderPendingOperatingCompanies, type OperatingState } from '../operating/operatingSet.js'
import { cheapestAffordableTrain } from '../operating/receivershipHandler.js'
import {
    PresidencyChange,
    applyPresidencyChange,
    evaluatePresidency,
    playersAfterPresident
} from '../stock/presidency.js'
import type { StockMarketChart } from '../stock/stockMarket.js'
import { marketSaleTerms, type StockRules } from '../stock/stockRules.js'
import type { EliminationRules } from './elimination.js'
import type { FundingState, TrainFundingRules } from './trainFunding.js'

/** The market and pools of a title that issues treasury shares to fund trains: 1846's kin. */
export type IssuingCorporations = {
    market: StockMarketChart
    marketPoolId: string
    /** The lowest price an issued share may push the marker to. */
    issuanceFloor: number
}

type Issuance = { shares: number; unitPrice: number; proceeds: number }

/**
 * The treasury shares a corporation issues toward a price: as few as cover it, or all it may,
 * each sold one space below the marker's destination, which may not fall below the floor.
 */
export function slidingIssuance(
    { market, marketPoolId, issuanceFloor }: IssuingCorporations,
    state: FundingState,
    companyId: string,
    price: number
): Issuance | undefined {
    const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
    const space = market.companySpace(state.stockMarket, companyId)
    const issuances = Array.from(
        { length: corporateIssueLimit(state, companyId, marketPoolId) },
        (_, i) => {
            const shares = i + 1
            const destination = market.move(space.id, 'left', shares)
            const unitPrice = market.move(destination.id, 'left', 1).price
            return { shares, unitPrice, proceeds: shares * unitPrice, floor: destination.price }
        }
    ).filter((issuance) => issuance.floor >= issuanceFloor && issuance.proceeds > 0)
    return issuances.find((issuance) => treasury + issuance.proceeds >= price) ?? issuances.at(-1)
}

/**
 * A corporation without a train issues shares before its president pays; the president pays
 * only when no train is otherwise affordable, sells one block per corporation, and keeps the
 * operating corporation open and under their presidency (1846 and 1833NE §§6.86–6.89).
 */
export function issueFirstTrainFunding(
    issuing: IssuingCorporations,
    {
        stockRules,
        companyOrder,
        elimination
    }: {
        stockRules: StockRules
        companyOrder: (state: OperatingState) => readonly string[]
        elimination: EliminationRules
    }
): TrainFundingRules {
    const { market, marketPoolId } = issuing
    return {
        includeMarketTrains: true,
        sellInBlocks: true,
        contributors(state, companyId) {
            const president = controllingOwner(state, companyId)
            assertExists(president, 'Emergency funding requires a president')
            return [president]
        },
        fundablePurchases(state, companyId, offers) {
            const treasury = finiteCashOwnedBy(state, { kind: 'company', companyId })
            const cheapest = Math.min(...offers.map((offer) => offer.price))
            const cheapestAffordable =
                treasury >= cheapest ||
                (slidingIssuance(issuing, state, companyId, cheapest)?.proceeds ?? 0) + treasury >=
                    cheapest
            return offers.filter((offer) => {
                const proceeds =
                    slidingIssuance(issuing, state, companyId, offer.price)?.proceeds ?? 0
                const contribution = Math.max(0, offer.price - treasury - proceeds)
                return !(contribution && cheapestAffordable)
            })
        },
        issuanceTerms(state, companyId) {
            const funding = state.trainFunding
            assertExists(funding, 'Issuance belongs to a train funding')
            const issuance = slidingIssuance(issuing, state, companyId, funding.purchase.price)
            if (!issuance) return undefined
            return {
                ...marketSaleTerms(market, state, companyId, {
                    destinationPoolId: marketPoolId,
                    marketLimit: 100,
                    maximumShares: issuance.shares,
                    movement: issuance.shares
                }),
                price: issuance.unitPrice
            }
        },
        saleTerms: (state, companyId, shares, seller) =>
            stockRules.saleTerms(state, companyId, shares, seller),
        protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
        permitsSale(state, details) {
            const [sale] = details.sales
            return !(
                sale.companyId === state.trainFunding?.purchase.companyId &&
                market.space(sale.toMarketSpaceId).price === 0
            )
        },
        requiredSaleShares: () => 0,
        afterShareSale(state) {
            reorderPendingOperatingCompanies(state, companyOrder(state))
        },
        elimination
    }
}

/**
 * A receiver run by every player in turn, withholding and buying the cheapest train it can,
 * whose presidency a 10% holder takes back by buying half the president's certificate from the
 * market when no other share is there (1846 §8, 1833NE §7.3).
 */
export function marketReceivership({
    market,
    marketPoolId
}: Pick<IssuingCorporations, 'market' | 'marketPoolId'>): ReceivershipRules {
    return {
        operators: (state) => [...state.turnManager.turnOrder],
        earningsChoice: () => 'withhold',
        trainPurchase: cheapestAffordableTrain,
        presidencyClaim(state, companyId, buyer) {
            const certificates = state.certificates.filter(
                (certificate) => certificate.companyId === companyId
            )
            if (
                certificates.some(
                    (certificate) =>
                        certificate.kind === 'share' &&
                        !certificate.president &&
                        certificate.poolId === marketPoolId
                )
            )
                return undefined
            const president = certificates.find(
                (certificate) => certificate.kind === 'share' && certificate.president
            )
            const ordinary = certificates.filter(
                (certificate) =>
                    certificate.kind === 'share' &&
                    !certificate.president &&
                    sameOwner(certificate.owner, buyer)
            )
            if (!president || ordinary.length !== 1) return undefined
            const price = market.companySpace(state.stockMarket, companyId).price
            if (price <= 0) return undefined
            return {
                price,
                claim: {
                    companyId,
                    next: buyer,
                    presidentCertificateId: president.id,
                    exchangedCertificateIds: [ordinary[0].id],
                    poolId: marketPoolId
                }
            }
        }
    }
}

export const ForcedSale = Type.Object(
    {
        companyId: Type.String(),
        certificateIds: Type.Array(Type.String()),
        shares: Type.Integer({ minimum: 1 }),
        price: Type.Integer({ minimum: 0 }),
        proceeds: Type.Integer({ minimum: 0 }),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
export type ForcedSale = Type.Static<typeof ForcedSale>

/**
 * A bankrupt player's stock goes to the market at its price, without moving it and beyond the
 * market limit; each presidency passes to the next largest holder or leaves the corporation in
 * receivership (1846 and 1833NE §7.1).
 */
export function sellBankruptHoldings(
    { market, marketPoolId }: Pick<IssuingCorporations, 'market' | 'marketPoolId'>,
    state: FundingState & { turnManager: { turnOrder: string[] } },
    playerId: string
): { forcedSales: ForcedSale[]; payments: CashPayment[] } {
    const player: PlayerOwner = { kind: 'player', playerId }
    const forcedSales: ForcedSale[] = []
    const payments: CashPayment[] = []
    for (const company of state.companies) {
        if (company.kind !== 'major' || company.closed || !company.started) continue
        const shares = sharesOwned(state, company.id, player)
        if (!shares) continue
        const presidency = evaluatePresidency(
            state,
            company.id,
            playersAfterPresident(state, company.id, state.turnManager.turnOrder).filter(
                (owner) => owner.kind !== 'player' || owner.playerId !== playerId
            ),
            { owner: player, shares: 0 }
        )
        if (presidency.change) applyPresidencyChange(state, presidency.change)
        const certificates = certificatesOwnedBy(state, player).filter(
            (certificate) => certificate.companyId === company.id
        )
        const price = market.companySpace(state.stockMarket, company.id).price
        forcedSales.push({
            companyId: company.id,
            shares,
            price,
            proceeds: shares * price,
            certificateIds: certificates.map((certificate) => certificate.id),
            ...(presidency.change ? { presidency: presidency.change } : {})
        })
        if (shares * price)
            payments.push({ from: { kind: 'bank' }, to: player, amount: shares * price })
        for (const certificate of certificates) {
            certificate.owner = { kind: 'bank' }
            certificate.poolId = marketPoolId
        }
        if (company.president?.kind === 'player' && company.president.playerId === playerId)
            delete company.president
    }
    settleCashPayments(state, payments)
    return { forcedSales, payments }
}
