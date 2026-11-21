import { assert, assertExists } from '@tabletop/common'
import {
    moveCompanyStations,
    transferCompanyAssets,
    type AssetTransfer,
    type StationTransfer
} from '../company/companyMerger.js'
import { resetCompany } from '../company/companyReset.js'
import { settleCashPayments, type CashPayment } from '../finance/cashPayments.js'
import {
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    issueShareCertificates,
    sameOwner,
    sharesOwned,
    treasuryPoolId,
    type Owner
} from '../finance/finance.js'
import {
    applyPresidencyChange,
    evaluatePresidency,
    playersAfterPresident
} from '../stock/presidency.js'
import { addShort, cancelShorts, openShorts, ordinaryShares } from '../stock/shorts.js'
import { placeStockMarker, type StockMarketSpace } from '../stock/stockMarket.js'
import { trainsOwnedBy, type Train } from '../trains/train.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { SizedCompanyMarket } from './sizedCompanyMarket.js'
import type { StationPurchase, SizedCompanyStations } from './sizedCompanyStations.js'
import type { SizedCompanyState } from './sizedCompanyState.js'

type State = SizedCompanyState

export interface CompanyConversionRules {
    market: SizedCompanyMarket
    stations: SizedCompanyStations
    trainRules: Pick<TrainRules, 'trainLimit'>
    /** The size each size converts or merges into: 1817's 2 to 5 and 5 to 10. */
    conversions: Readonly<Record<number, number>>
    /**
     * The percent of the merged company some player must hold across both companies before two
     * of a size larger than a charter merge, enough for its president's certificate.
     */
    mergerPresidencyPercent: number
}

export type ConversionPreview = {
    shareCount: number
    /** Shares the conversion adds to the treasury. */
    newShares: number
    stations: StationPurchase
}

export type CompanyMergerPreview = {
    price: number
    shareCount: number
    /** Shares the merged company holds in its treasury. */
    treasuryShares: number
    /** Stations the merged company holds, before any over the limit are removed. */
    stations: number
}

export type MergerRecord = {
    price: number
    assets: AssetTransfer
    stations: StationTransfer
    payments: CashPayment[]
}

/**
 * Growing a sized company: converting it to its next size, or merging another of its size into
 * it. Two charter-sized companies merge at the sum of their prices, the initiating president
 * buying the extra share where the two have different presidents; larger ones at their average,
 * their holders' shares exchanged one for one.
 */
export class CompanyConversions {
    constructor(readonly rules: CompanyConversionRules) {}

    presidentId(state: State, companyId: string): string {
        const president = controllingOwner(state, companyId)
        assertExists(president, 'The company has a president')
        return president.playerId
    }

    canConvert(state: State, companyId: string): boolean {
        return this.rules.conversions[this.rules.market.shareCount(state, companyId)] !== undefined
    }

    sizeAfterConversion(state: State, companyId: string): number {
        const size = this.rules.conversions[this.rules.market.shareCount(state, companyId)]
        assertExists(size, 'Only a company with a larger size converts')
        return size
    }

    private sizeBefore(size: number): number {
        const before = Object.entries(this.rules.conversions).find(([, after]) => after === size)
        assertExists(before, 'A converted size grew from a smaller one')
        return Number(before[0])
    }

    /** Stations a converted company must buy. */
    stationsForConversion(state: State, companyId: string): number {
        const size = this.rules.market.shareCount(state, companyId)
        return this.rules.stations.stationsForGrowth(state, companyId, this.sizeBefore(size), size)
    }

    /** What converting would make of the company, for its president to weigh. */
    conversionPreview(state: State, companyId: string): ConversionPreview {
        const { market, stations } = this.rules
        const size = market.shareCount(state, companyId)
        const shareCount = this.sizeAfterConversion(state, companyId)
        return {
            shareCount,
            newShares: shareCount - size,
            stations: stations.stationPurchase(
                state,
                companyId,
                stations.stationsForGrowth(state, companyId, size, shareCount)
            )
        }
    }

    /** Grows the company to its next size, adding the new shares to its treasury. */
    convertCompany(state: State, companyId: string): string[] {
        const before = this.rules.market.shareCount(state, companyId)
        const after = this.sizeAfterConversion(state, companyId)
        getCompany(state, companyId).shareCount = after
        return issueShareCertificates(state, companyId, after - before, {
            owner: { kind: 'company', companyId },
            poolId: treasuryPoolId(companyId)
        })
    }

    private largestCombinedPercent(state: State, companyId: string, targetId: string): number {
        const percentPerShare = 100 / this.rules.market.shareCount(state, companyId)
        return Math.max(
            0,
            ...state.players.map(({ playerId }) => {
                const player = { kind: 'player' as const, playerId }
                return (
                    (sharesOwned(state, companyId, player) + sharesOwned(state, targetId, player)) *
                    percentPerShare
                )
            })
        )
    }

    private mergesAsCharters(state: State, companyId: string): boolean {
        return (
            this.rules.market.shareCount(state, companyId) ===
            this.rules.market.rules.charterShareCount
        )
    }

    /** The merged company's price: the sum of two charter-sized prices, or the average of larger. */
    mergerPrice(state: State, companyId: string, targetId: string): number {
        const { market } = this.rules
        const a = market.price(state, companyId)
        const b = market.price(state, targetId)
        const value = this.mergesAsCharters(state, companyId) ? a + b : Math.floor((a + b) / 2)
        return this.mergerSpace(value).price
    }

    /**
     * What merging the target in would make of the company, for its president to weigh. Two
     * charter-sized companies' new shares stay in the treasury but for one the president sells to
     * the target's president; larger companies' holders swap share for share, so the treasury
     * gains only the target's treasury shares.
     */
    mergerPreview(state: State, companyId: string, targetId: string): CompanyMergerPreview {
        const { market, stations } = this.rules
        const shareCount = this.sizeAfterConversion(state, companyId)
        const president = controllingOwner(state, companyId)
        const targetPresident = controllingOwner(state, targetId)
        assertExists(president, 'A merging company has a president')
        assertExists(targetPresident, 'A merged company has a president')
        const size = market.shareCount(state, companyId)
        const added = this.mergesAsCharters(state, companyId)
            ? shareCount - size - (sameOwner(president, targetPresident) ? 0 : 1)
            : this.treasuryShareIds(state, targetId).length
        return {
            price: this.mergerPrice(state, companyId, targetId),
            shareCount,
            treasuryShares: this.treasuryShareIds(state, companyId).length + added,
            stations:
                stations.limitedStations(state, companyId) +
                stations.limitedStations(state, targetId)
        }
    }

    private mergerSpace(value: number): StockMarketSpace {
        const space = this.rules.market.chart.spaces
            .filter((space) => space.price > 0 && space.price <= value)
            .reduce<StockMarketSpace | undefined>(
                (best, space) => (!best || space.price > best.price ? space : best),
                undefined
            )
        assertExists(space, 'A merged company has a market space')
        return space
    }

    mergeReason(
        state: State,
        companyId: string,
        targetId: string,
        convertedIds: readonly string[]
    ): string | undefined {
        const { market } = this.rules
        const target = getCompany(state, targetId)
        if (targetId === companyId || !target.floated || target.kind === 'private')
            return 'Choose another floated company.'
        if (convertedIds.includes(targetId)) return 'This company has already converted this round.'
        if (market.inClosingZone(state.stockMarket, targetId))
            return 'Companies in the acquisition or liquidation zone cannot merge.'
        const size = market.shareCount(state, companyId)
        if (market.shareCount(state, targetId) !== size || !this.canConvert(state, companyId))
            return 'Only two 2-share or two 5-share companies can merge.'
        if (
            !this.mergesAsCharters(state, companyId) &&
            this.largestCombinedPercent(state, companyId, targetId) <
                this.rules.mergerPresidencyPercent
        )
            return `Some player must hold ${this.rules.mergerPresidencyPercent}% of the two companies together.`
        const president = controllingOwner(state, companyId)
        const targetPresident = controllingOwner(state, targetId)
        assertExists(president, 'A merging company has a president')
        if (
            this.mergesAsCharters(state, companyId) &&
            !sameOwner(president, targetPresident ?? president) &&
            finiteCashOwnedBy(state, president) < this.mergerPrice(state, companyId, targetId)
        )
            return 'The president cannot pay for the merged company’s new share.'
        return undefined
    }

    mergeTargetIds(state: State, companyId: string, convertedIds: readonly string[]): string[] {
        return state.companies
            .filter((company) => !this.mergeReason(state, companyId, company.id, convertedIds))
            .map((company) => company.id)
    }

    /**
     * Merges the target into the company: its assets and stations move over, the company grows
     * to its next size, the target's holders receive its shares, and the target's charter resets.
     */
    mergeCompanies(state: State, companyId: string, targetId: string): MergerRecord {
        const { market } = this.rules
        const price = this.mergerPrice(state, companyId, targetId)
        const asCharters = this.mergesAsCharters(state, companyId)
        const president = controllingOwner(state, companyId)
        const targetPresident = controllingOwner(state, targetId)
        assertExists(president, 'A merging company has a president')
        assertExists(targetPresident, 'A merged company has a president')
        const assets = transferCompanyAssets(state, targetId, companyId, { loans: true })
        const stations = moveCompanyStations(state, targetId, companyId)
        placeStockMarker(state.stockMarket, companyId, this.mergerSpace(price).id)
        const newShareIds = this.convertCompany(state, companyId)
        const payments: CashPayment[] = []
        if (asCharters) {
            if (!sameOwner(president, targetPresident)) {
                const payment = {
                    from: { ...president },
                    to: { kind: 'company' as const, companyId },
                    amount: price
                }
                settleCashPayments(state, [payment])
                payments.push(payment)
                this.giveShare(state, newShareIds[0], targetPresident)
            }
        } else this.migrateHoldings(state, companyId, targetId, newShareIds)
        resetCompany(state, targetId, market.rules.charterShareCount)
        return { price, assets, stations, payments }
    }

    private giveShare(state: State, certificateId: string | undefined, owner: Owner): void {
        const certificate = state.certificates.find(
            (certificate) => certificate.id === certificateId
        )
        assert(certificate, 'A merger gives an issued share')
        certificate.owner = { ...owner }
        delete certificate.poolId
    }

    // Each share and short of the target becomes one of the company's for the same holder: the
    // target's treasury shares stay in the company's treasury, the market's go to the market.
    private migrateHoldings(
        state: State,
        companyId: string,
        targetId: string,
        newShareIds: string[]
    ): void {
        const { marketPoolId } = this.rules.market.rules
        const unused = [...newShareIds]
        for (const certificate of state.certificates) {
            if (certificate.companyId !== targetId) continue
            if (certificate.kind === 'short') {
                addShort(state, companyId, certificate.owner, certificate.poolId)
                continue
            }
            if (certificate.kind !== 'share') continue
            for (let share = 0; share < certificate.shares; share++) {
                const id =
                    unused.shift() ??
                    issueShareCertificates(state, companyId, 1, {
                        owner: { kind: 'company', companyId },
                        poolId: treasuryPoolId(companyId)
                    })[0]
                if (certificate.poolId === treasuryPoolId(targetId)) continue
                const share = state.certificates.find((item) => item.id === id)
                assert(share, 'A migrated share is issued')
                share.owner = { ...certificate.owner }
                if (certificate.poolId === marketPoolId) share.poolId = marketPoolId
                else delete share.poolId
            }
        }
        const presidency = evaluatePresidency(
            state,
            companyId,
            playersAfterPresident(state, companyId, state.turnManager.turnOrder)
        )
        assert(!presidency.reason, presidency.reason ?? 'The merged company has a president')
        if (presidency.change) applyPresidencyChange(state, presidency.change)
        const holders = openShorts(state, companyId).map((short) => short.owner)
        for (const owner of holders) cancelShorts(state, companyId, owner)
    }

    trainsOverLimit(state: State, companyId: string): number {
        return Math.max(
            0,
            trainsOwnedBy(state, { kind: 'company', companyId }).length -
                this.rules.trainRules.trainLimit(state, companyId)
        )
    }

    discardableTrains(state: State, companyId: string): Train[] {
        return this.trainsOverLimit(state, companyId)
            ? trainsOwnedBy(state, { kind: 'company', companyId })
            : []
    }

    treasuryShareIds(state: State, companyId: string): string[] {
        return ordinaryShares(state, companyId)
            .filter((share) => share.poolId === treasuryPoolId(companyId))
            .map((share) => share.id)
    }
}
