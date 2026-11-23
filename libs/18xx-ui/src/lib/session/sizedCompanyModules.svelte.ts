import {
    AcquireCompany,
    AcquisitionRoundStates,
    BidToAcquire,
    BuyBackShares,
    BuyConvertedShare,
    CompanyExcessStates,
    ConvertCompany,
    DeclineOffer,
    DiscardMergedTrain,
    FinishAcquisitionLoans,
    FinishConversionLoans,
    MergeCompanies,
    OfferCompany,
    PassConversion,
    PassConvertedShares,
    PassOnCompany,
    RemoveStation,
    RemoveStationMarker,
    RepayAcquiredLoan,
    SellConvertedShares,
    ShortShare,
    activeAcquisitionRound,
    activeConversionRound,
    type AcquisitionRounds,
    type CompanyExcess,
    type ConversionRounds,
    type CorporateBuyBacks,
    type HydratedEighteenXXState,
    type PlacedStation,
    type ShortSelling,
    type SizedCompanyRecords
} from '@tabletop/18xx'
import { PassableBidding, assert } from '@tabletop/common'
import type { MapLocationChoice } from './eighteenXXSession.svelte.js'
import type { ModuleSession } from './moduleSession.js'

type SizedCompanyTitleState = HydratedEighteenXXState & SizedCompanyRecords
export type SizedCompanyModuleSession = ModuleSession<SizedCompanyTitleState, unknown>

/** The player whose turn the state awaits, who decides for the round's company. */
function actingPlayer(session: SizedCompanyModuleSession): string | undefined {
    return session.state.activePlayerIds[0]
}

/**
 * The merger and conversion round's choices: the deciding company's conversion and merger
 * partners, the trading of its new treasury shares, and its loans and stations after.
 */
export class ConversionRoundModule {
    constructor(
        private readonly session: SizedCompanyModuleSession,
        readonly rounds: ConversionRounds
    ) {}

    private get conversions() {
        return this.rounds.rules.conversions
    }

    readonly companyId = $derived.by(() => this.rounds.companyId(this.session.state))
    readonly decision = $derived.by(() => {
        const companyId = this.companyId
        const { state, validActionTypes } = this.session
        if (!companyId || !validActionTypes.includes('PassMerger')) return undefined
        const round = activeConversionRound(state)
        assert(round, 'A merger round is in progress')
        return {
            conversion: validActionTypes.includes('ConvertCompany')
                ? this.conversions.conversionPreview(state, companyId)
                : undefined,
            targets: validActionTypes.includes('MergeCompanies')
                ? this.conversions
                      .mergeTargetIds(state, companyId, round.convertedIds)
                      .map((targetId) => ({
                          companyId: targetId,
                          preview: this.conversions.mergerPreview(state, companyId, targetId)
                      }))
                : []
        }
    })
    readonly trading = $derived.by(() => {
        const { state, validActionTypes } = this.session
        const conversion = activeConversionRound(state)?.conversion
        if (state.machineState !== 'TradingConvertedShares' || !conversion) return undefined
        const playerId = actingPlayer(this.session)
        return {
            price: conversion.price,
            remaining: this.conversions.treasuryShareIds(state, conversion.companyId).length,
            traderIds: conversion.traderIds,
            sales:
                playerId && validActionTypes.includes('SellConvertedShares')
                    ? this.rounds.convertedShareSales(state, playerId)
                    : [],
            purchase:
                playerId && validActionTypes.includes('BuyConvertedShare')
                    ? this.rounds.convertedSharePurchase(state, playerId).details
                    : undefined
        }
    })
    readonly stations = $derived.by(() => {
        const state = this.session.state
        const conversion = activeConversionRound(state)?.conversion
        return state.machineState === 'BorrowingAfterConversion' && conversion
            ? this.conversions.rules.stations.stationPurchase(
                  state,
                  conversion.companyId,
                  conversion.stationsOwed
              )
            : undefined
    })

    private requireCompanyId(): string {
        const companyId = this.companyId
        assert(companyId, 'A merger round is in progress')
        return companyId
    }
    async convert(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(ConvertCompany, { companyId: this.requireCompanyId() })
        )
    }
    async merge(targetId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(MergeCompanies, {
                companyId: this.requireCompanyId(),
                targetId
            })
        )
    }
    async pass(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(PassConversion, { companyId: this.requireCompanyId() })
        )
    }
    async buyShare(): Promise<void> {
        const purchase = this.trading?.purchase
        assert(purchase, 'The player cannot buy a converted share now')
        await this.session.applyAction(
            this.session.createPlayerAction(BuyConvertedShare, {
                companyId: purchase.companyId,
                expectedPrice: purchase.price
            })
        )
    }
    async sellShares(shares: number): Promise<void> {
        const sale = this.trading?.sales.find((sale) => sale.sales[0].shares === shares)
        assert(sale, 'The player cannot sell this block now')
        await this.session.applyAction(
            this.session.createPlayerAction(SellConvertedShares, {
                companyId: sale.sales[0].companyId,
                shares,
                expectedProceeds: sale.proceeds
            })
        )
    }
    async passShares(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(PassConvertedShares, {
                companyId: this.requireCompanyId()
            })
        )
    }
    async finishLoans(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(FinishConversionLoans, {
                companyId: this.requireCompanyId()
            })
        )
    }
}

/**
 * The acquisition round's choices: offering the company whose turn it is, bidding for a sale,
 * naming the buyer, and the buyer's loans after.
 */
export class AcquisitionRoundModule {
    constructor(
        private readonly session: SizedCompanyModuleSession,
        readonly rounds: AcquisitionRounds
    ) {}

    private get sales() {
        return this.rounds.sales
    }

    readonly companyId = $derived.by(() =>
        AcquisitionRoundStates.some((name) => name === this.session.state.machineState)
            ? this.rounds.companyId(this.session.state)
            : undefined
    )
    /** The companies the acquisition round has still to offer after the current one. */
    readonly queue = $derived.by(() => {
        const companyId = this.companyId
        if (!companyId) return []
        const round = activeAcquisitionRound(this.session.state)
        assert(round, 'An acquisition round is in progress')
        return round.companyIds.filter((id) => id !== companyId)
    })
    readonly offer = $derived.by(() => {
        const companyId = this.companyId
        return companyId && this.session.validActionTypes.includes('OfferCompany')
            ? { openingBid: this.sales.openingBid(this.session.state, companyId, 'offered') }
            : undefined
    })
    readonly sale = $derived.by(() => {
        const { state, validActionTypes } = this.session
        const sale = activeAcquisitionRound(state)?.sale
        if (!sale || state.machineState !== 'AcquisitionBidding') return undefined
        const bidding = new PassableBidding(sale.bidding)
        const playerId = actingPlayer(this.session)
        return {
            kind: sale.kind,
            highBid: bidding.hasBid
                ? { playerId: bidding.highBidderId, amount: bidding.highBid }
                : undefined,
            minimum: this.sales.minimumBid(state, sale),
            maximum:
                playerId && validActionTypes.includes('BidToAcquire')
                    ? this.sales.bidCeiling(state, sale, playerId)
                    : undefined,
            /** The bidder's companies that could pay this amount. */
            payers: (amount: number) =>
                playerId ? this.sales.buyersFor(state, playerId, sale, amount) : [],
            allows: (amount: number) =>
                !!playerId && !this.sales.bidRejection(state, sale, playerId, amount)
        }
    })
    readonly acquirerChoice = $derived.by(() =>
        this.session.validActionTypes.includes('AcquireCompany')
            ? this.rounds.acquirerChoice(this.session.state)
            : undefined
    )
    readonly buyerLoans = $derived.by(() => {
        const state = this.session.state
        const acquisition = activeAcquisitionRound(state)?.acquisition
        if (state.machineState !== 'AcquisitionLoans' || !acquisition) return undefined
        const { buyerId, price, inheritedLoans, repaidLoans } = acquisition
        return { buyerId, price, inheritedLoans, repaidLoans }
    })
    /** Bids rise in steps of this. */
    get increment(): number {
        return this.sales.rules.increment
    }
    /** What repaying one of the loans the buyer took on costs. */
    get loanValue(): number {
        return this.sales.rules.loanRules.value
    }

    private requireCompanyId(): string {
        const companyId = this.companyId
        assert(companyId, 'An acquisition round is in progress')
        return companyId
    }
    private requireBuyerId(): string {
        const buyerId = this.buyerLoans?.buyerId
        assert(buyerId, 'A company has been bought')
        return buyerId
    }
    async offerCompany(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(OfferCompany, { companyId: this.requireCompanyId() })
        )
    }
    async declineOffer(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(DeclineOffer, { companyId: this.requireCompanyId() })
        )
    }
    async bid(amount: number): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(BidToAcquire, {
                companyId: this.requireCompanyId(),
                amount
            })
        )
    }
    async passOnCompany(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(PassOnCompany, { companyId: this.requireCompanyId() })
        )
    }
    async acquire(buyerId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(AcquireCompany, {
                companyId: this.requireCompanyId(),
                buyerId
            })
        )
    }
    async repayLoan(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(RepayAcquiredLoan, { companyId: this.requireBuyerId() })
        )
    }
    async finishLoans(): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(FinishAcquisitionLoans, {
                companyId: this.requireBuyerId()
            })
        )
    }
}

/** A merged or acquiring company's stations and trains over its limits, for its president. */
export class CompanyExcessModule {
    constructor(
        private readonly session: SizedCompanyModuleSession,
        readonly excess: CompanyExcess
    ) {}

    readonly current = $derived.by(() => {
        const state = this.session.state
        const companyId = this.excess.companyId(state)
        if (!companyId || !CompanyExcessStates.some((name) => name === state.machineState))
            return undefined
        return {
            companyId,
            stations: this.excess.removableStations(state, companyId),
            markers: this.excess.removableMarkers(state, companyId),
            trains: this.excess.rules.conversions.discardableTrains(state, companyId)
        }
    })

    /** The stations and station markers a company over its limit may give up, chosen on the map. */
    readonly mapChoice = $derived.by((): MapLocationChoice | undefined => {
        const current = this.current
        if (!current) return undefined
        const valid = this.session.validActionTypes
        return excessMapChoice(
            valid.includes('RemoveStation') ? current.stations : [],
            valid.includes('RemoveStationMarker') ? current.markers : [],
            {
                station: (stationId) => void this.removeStation(stationId),
                marker: (marker) => void this.removeMarker(marker)
            }
        )
    })

    private requireCompanyId(): string {
        const companyId = this.current?.companyId
        assert(companyId, 'A company is over its limits')
        return companyId
    }
    async removeStation(stationId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(RemoveStation, {
                companyId: this.requireCompanyId(),
                stationId
            })
        )
    }
    async removeMarker(marker: { locationId: string; kind: string }): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(RemoveStationMarker, {
                companyId: this.requireCompanyId(),
                locationId: marker.locationId,
                kind: marker.kind
            })
        )
    }
    async discardTrain(trainId: string): Promise<void> {
        await this.session.applyAction(
            this.session.createPlayerAction(DiscardMergedTrain, {
                companyId: this.requireCompanyId(),
                trainId
            })
        )
    }
}

type ExcessMarker = { locationId: string; kind: string }

/**
 * Where the company's stations and station markers may be given up, and which a tap takes: the
 * station in the hex, or the city tapped where a hex holds the company's stations in two.
 */
export function excessMapChoice(
    stations: readonly PlacedStation[],
    markers: readonly ExcessMarker[],
    remove: { station(stationId: string): void; marker(marker: ExcessMarker): void }
): MapLocationChoice | undefined {
    if (!stations.length && !markers.length) return undefined
    return {
        locationIds: [
            ...new Set([
                ...stations.map((station) => station.position.locationId),
                ...markers.map((marker) => marker.locationId)
            ])
        ],
        choose: (locationId, nodeId) => {
            const here = stations.filter((station) => station.position.locationId === locationId)
            const cities = new Set(here.map((station) => station.position.nodeId))
            const station =
                cities.size > 1 ? here.find((entry) => entry.position.nodeId === nodeId) : here[0]
            if (station) return remove.station(station.id)
            const marker = markers.find((entry) => entry.locationId === locationId)
            if (marker) remove.marker(marker)
        }
    }
}

/** The companies the player may short on their stock turn. */
export class ShortSellingModule {
    constructor(
        private readonly session: SizedCompanyModuleSession,
        readonly selling: ShortSelling
    ) {}

    readonly options = $derived.by(() => {
        const playerId = actingPlayer(this.session)
        return playerId && this.session.validActionTypes.includes('ShortShare')
            ? this.selling.shortOptions(this.session.state, playerId)
            : []
    })

    async short(companyId: string): Promise<void> {
        const option = this.options.find((option) => option.companyId === companyId)
        assert(option, 'This company cannot be shorted now')
        await this.session.applyAction(
            this.session.createPlayerAction(ShortShare, { companyId, expectedPrice: option.price })
        )
    }
}

/** The companies the player may act for on their stock turn: loans and buy-backs. */
export class CorporateBuyBackModule {
    constructor(
        private readonly session: SizedCompanyModuleSession,
        readonly buyBacks: CorporateBuyBacks
    ) {}

    readonly options = $derived.by(() => {
        const playerId = actingPlayer(this.session)
        const valid = this.session.validActionTypes
        return playerId && (valid.includes('TakeLoan') || valid.includes('BuyBackShares'))
            ? this.buyBacks.corporateActionOptions(this.session.state, playerId)
            : []
    })

    async buyBack(companyId: string): Promise<void> {
        const buyBack = this.options.find((option) => option.companyId === companyId)?.buyBack
        assert(
            buyBack && this.session.validActionTypes.includes('BuyBackShares'),
            'The company cannot buy back a share now'
        )
        await this.session.applyAction(
            this.session.createPlayerAction(BuyBackShares, {
                companyId,
                certificateIds: [buyBack.certificateId]
            })
        )
    }
}
