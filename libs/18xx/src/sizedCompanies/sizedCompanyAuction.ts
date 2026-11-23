import { assertExists } from '@tabletop/common'
import { settleCashPayments, type CashPayment } from '../finance/cashPayments.js'
import {
    finiteCashOwnedBy,
    getCompany,
    issueShareCertificates,
    privateOwner,
    treasuryPoolId
} from '../finance/finance.js'
import type { StationPosition } from '../map/station.js'
import type {
    CompanyAuctionRules,
    CompanyAuctionState,
    CompanyFormation
} from '../stock/companyAuction.js'
import type { StockMarketSpace } from '../stock/stockMarket.js'
import type { StockState } from '../stock/stockState.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import type { SizedCompanyStations } from './sizedCompanyStations.js'

/**
 * A title's terms for starting a sized company by auction: the winner chooses its size, pays
 * the bid in cash and privates at face value, and the company starts at half the bid.
 */
export type StartPrices = { minimum: number; maximum: number }

export interface SizedCompanyAuctionRules {
    market: SizedCompanyMarket
    stations: SizedCompanyStations
    openingBid: number
    increment: number
    /** The highest bid allowed, where the title caps bids, as 1817's $400. */
    bidCap?: number
    /**
     * The prices a company may start at, half the bid rounded down to a space between them; by
     * the state where they change, as 18USA's $300 variant from phase 5.
     */
    startPrices?: StartPrices | ((state: CompanyAuctionState) => StartPrices)
    privateFaceValue(privateId: string): number
    /** The sizes a company may be formed with now. */
    shareCounts(state: CompanyAuctionState): readonly number[]
    homes(state: CompanyAuctionState, companyId: string): StationPosition[]
    /** Whether the player holds as many certificates as they may, which bars their bids. */
    atCertificateLimit(state: CompanyAuctionState, playerId: string): boolean
    /**
     * The treasury a winning bid gives the company before the privates contributed, the bid itself
     * unless given; 18USA's company receives twice its start price (§11.6).
     */
    capital?(price: number, startPrice: number): number
    /** What a company's home adds to its winner's means, as 18USA's cash subsidies (§11.6.1). */
    homeEquity?(state: CompanyAuctionState, home: StationPosition): number
    /** The title's own consequences of a formation, before the company buys its stations. */
    formed?(state: CompanyAuctionState, formation: CompanyFormation): void
}

/** The company auction of a title whose companies start at a chosen size. */
export class SizedCompanyAuction implements CompanyAuctionRules {
    constructor(readonly rules: SizedCompanyAuctionRules) {}

    get openingBid(): number {
        return this.rules.openingBid
    }

    get increment(): number {
        return this.rules.increment
    }

    playerPrivateIds(state: StockState, playerId: string): string[] {
        return state.companies
            .filter((company) => {
                if (company.kind !== 'private' || company.closed) return false
                const owner = privateOwner(state, company.id)
                return owner?.kind === 'player' && owner.playerId === playerId
            })
            .map((company) => company.id)
    }

    contributionValue(privateIds: readonly string[]): number {
        return privateIds.reduce((sum, id) => sum + this.rules.privateFaceValue(id), 0)
    }

    subsidy(state: CompanyAuctionState, home: StationPosition): number {
        return this.rules.homeEquity?.(state, home) ?? 0
    }

    private homeEquity(state: CompanyAuctionState, offered?: StationPosition): number {
        const home = offered ?? state.companyAuction?.home
        return home ? this.subsidy(state, home) : 0
    }

    biddingPower(state: CompanyAuctionState, playerId: string, home?: StationPosition): number {
        return (
            finiteCashOwnedBy(state, { kind: 'player', playerId }) +
            this.contributionValue(this.playerPrivateIds(state, playerId)) +
            this.homeEquity(state, home)
        )
    }

    maximumBid(state: CompanyAuctionState, playerId: string, home?: StationPosition): number {
        if (this.rules.atCertificateLimit(state, playerId)) return 0
        const power = this.biddingPower(state, playerId, home)
        return this.rules.bidCap === undefined ? power : Math.min(this.rules.bidCap, power)
    }

    // A winning bid is paid in the winner's cash and privates at face value, up to the whole bid.
    private contributionRange(
        state: CompanyAuctionState,
        playerId: string,
        price: number,
        home?: StationPosition
    ): { minimum: number; maximum: number } {
        const cash = finiteCashOwnedBy(state, { kind: 'player', playerId })
        return { minimum: price - cash - this.homeEquity(state, home), maximum: price }
    }

    private subsetSums(privateIds: readonly string[]): number[] {
        return [
            ...new Set(
                privateIds.reduce<number[]>(
                    (sums, id) => [
                        ...sums,
                        ...sums.map((sum) => sum + this.contributionValue([id]))
                    ],
                    [0]
                )
            )
        ]
    }

    private someContributionFits(
        state: CompanyAuctionState,
        playerId: string,
        price: number,
        privateIds: readonly string[],
        included: number,
        home?: StationPosition
    ): boolean {
        const range = this.contributionRange(state, playerId, price, home)
        return this.subsetSums(privateIds).some(
            (sum) => sum + included >= range.minimum && sum + included <= range.maximum
        )
    }

    formable(
        state: CompanyAuctionState,
        playerId: string,
        amount: number,
        home?: StationPosition
    ): boolean {
        return this.someContributionFits(
            state,
            playerId,
            amount,
            this.playerPrivateIds(state, playerId),
            0,
            home
        )
    }

    homes(state: CompanyAuctionState, companyId: string): StationPosition[] {
        return this.rules.homes(state, companyId)
    }

    /** The highest space at or below half the winning bid, within the start prices. */
    startSpace(state: CompanyAuctionState, price: number): string {
        const half = Math.floor(price / 2)
        const prices = this.rules.startPrices
        const { minimum, maximum } = (typeof prices === 'function' ? prices(state) : prices) ?? {
            minimum: 1,
            maximum: Number.POSITIVE_INFINITY
        }
        const within = this.rules.market.chart.spaces.filter(
            (space) => space.price >= minimum && space.price <= maximum
        )
        const highestAtOrBelowHalf = within
            .filter((space) => space.price <= half)
            .reduce<StockMarketSpace | undefined>(
                (best, space) => (!best || space.price > best.price ? space : best),
                undefined
            )
        const lowest = within.reduce<StockMarketSpace | undefined>(
            (best, space) => (!best || space.price < best.price ? space : best),
            undefined
        )
        const space = highestAtOrBelowHalf ?? lowest
        assertExists(space, 'The market has a start space')
        return space.id
    }

    shareCounts(state: CompanyAuctionState): readonly number[] {
        return this.rules.shareCounts(state)
    }

    /** A private is offered when some contribution that includes it would form the company. */
    contributions(state: CompanyAuctionState, playerId: string, price: number): string[] {
        const owned = this.playerPrivateIds(state, playerId)
        return owned.filter((id) =>
            this.someContributionFits(
                state,
                playerId,
                price,
                owned.filter((other) => other !== id),
                this.contributionValue([id])
            )
        )
    }

    formationReason(state: CompanyAuctionState, formation: CompanyFormation): string | undefined {
        if (!this.shareCounts(state).includes(formation.shareCount))
            return 'This size is not available in this phase.'
        const owned = this.playerPrivateIds(state, formation.playerId)
        if (!formation.privateIds.every((id) => owned.includes(id)))
            return 'Only the winner’s own privates can be contributed.'
        const contributed = this.contributionValue(formation.privateIds)
        const range = this.contributionRange(state, formation.playerId, formation.price)
        if (contributed < range.minimum) return 'Contribute enough privates to pay the winning bid.'
        if (contributed > range.maximum) return 'The privates are worth more than the winning bid.'
        return undefined
    }

    form(state: CompanyAuctionState, formation: CompanyFormation): void {
        const { rules } = this
        const company = { kind: 'company' as const, companyId: formation.companyId }
        const contributed = this.contributionValue(formation.privateIds)
        settleCashPayments(state, this.formationPayments(state, formation, contributed))
        for (const certificate of state.certificates)
            if (
                certificate.kind === 'private' &&
                formation.privateIds.includes(certificate.companyId)
            ) {
                certificate.owner = company
                delete certificate.poolId
            }
        rules.formed?.(state, formation)
        getCompany(state, formation.companyId).shareCount = formation.shareCount
        issueShareCertificates(
            state,
            formation.companyId,
            formation.shareCount - rules.market.rules.charterShareCount,
            { owner: company, poolId: treasuryPoolId(formation.companyId) }
        )
        rules.stations.buyOwedStations(state, formation.companyId)
    }

    // Without the title's capital, the winner pays the bid into the company, which pays the
    // privates' face value back; with it, the winner pays the bank and the bank the company.
    private formationPayments(
        state: CompanyAuctionState,
        formation: CompanyFormation,
        contributed: number
    ): CashPayment[] {
        const company = { kind: 'company' as const, companyId: formation.companyId }
        const player = { kind: 'player' as const, playerId: formation.playerId }
        const bank = { kind: 'bank' as const }
        const equity = this.homeEquity(state)
        const { capital, market } = this.rules
        const startPrice = market.chart.space(this.startSpace(state, formation.price)).price
        const payments: CashPayment[] = capital
            ? [
                  { from: player, to: bank, amount: formation.price - contributed - equity },
                  {
                      from: bank,
                      to: company,
                      amount: capital(formation.price, startPrice) - contributed
                  }
              ]
            : [
                  { from: player, to: company, amount: formation.price - equity },
                  { from: company, to: player, amount: contributed },
                  { from: bank, to: company, amount: equity }
              ]
        return payments.filter((payment) => payment.amount > 0)
    }
}
