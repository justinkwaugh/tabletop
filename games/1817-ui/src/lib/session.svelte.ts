import { assert } from '@tabletop/common'
import { PassableBidding, type EighteenXXState, type HydratedEighteenXXState } from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import type { GameSession } from '@tabletop/frontend-components'
import {
    AcquireCompany,
    AcquisitionRoundStates,
    BidToAcquire,
    BuyBackShares,
    CompanyExcessStates,
    DeclineOffer,
    FinishAcquisitionLoans,
    OfferCompany,
    PassOnCompany,
    RepayAcquiredLoan,
    acquirerChoice,
    acquisitionRoundCompanyId,
    activeAcquisitionRound,
    excessCompanyId,
    minimumBid,
    openingBid,
    playerLimit,
    BuyConvertedShare,
    ConvertCompany,
    DiscardMergedTrain,
    EighteenSeventeenTitleRules,
    FinishConversionLoans,
    MergeCompanies,
    PassConvertedShares,
    PassMerger,
    RemoveStation,
    ShortShare,
    activeMergerRound,
    convertedSharePurchase,
    corporateActionOptions,
    discardableTrains,
    mergeTargetIds,
    mergerPrice,
    mergerRoundCompanyId,
    removableStations,
    shortOptions,
    sizeAfterConversion,
    stationPurchase,
    treasuryShareIds
} from '@tabletop/1817'
import { EighteenSeventeenMapView } from './mapView.js'
import { EighteenSeventeenPresentation } from './presentation.js'

const BaseSession = createEighteenXXSessionClass(
    EighteenSeventeenTitleRules,
    EighteenSeventeenMapView,
    EighteenSeventeenPresentation
)

export class EighteenSeventeenSession extends BaseSession {
    corporateActions = $derived.by(() => {
        const playerId = this.gameState.activePlayerIds[0]
        return playerId &&
            (this.validActionTypes.includes('TakeLoan') ||
                this.validActionTypes.includes('BuyBackShares'))
            ? corporateActionOptions(this.gameState, playerId)
            : []
    })
    shorts = $derived.by(() => {
        const playerId = this.gameState.activePlayerIds[0]
        return playerId && this.validActionTypes.includes('ShortShare')
            ? shortOptions(this.gameState, playerId)
            : []
    })
    mergerCompanyId = $derived(mergerRoundCompanyId(this.gameState))
    mergerDecision = $derived.by(() => {
        const companyId = this.mergerCompanyId
        const state = this.gameState
        if (!companyId || !this.validActionTypes.includes('PassMerger')) return undefined
        const round = activeMergerRound(state)
        assert(round, 'A merger round is in progress')
        return {
            convertsTo: this.validActionTypes.includes('ConvertCompany')
                ? sizeAfterConversion(state, companyId)
                : undefined,
            targets: this.validActionTypes.includes('MergeCompanies')
                ? mergeTargetIds(state, companyId, round.convertedIds).map((targetId) => ({
                      companyId: targetId,
                      price: mergerPrice(state, companyId, targetId)
                  }))
                : []
        }
    })
    convertedShareTrading = $derived.by(() => {
        const state = this.gameState
        const conversion = activeMergerRound(state)?.conversion
        if (state.machineState !== 'TradingConvertedShares' || !conversion) return undefined
        const playerId = state.activePlayerIds[0]
        return {
            price: conversion.price,
            remaining: treasuryShareIds(state, conversion.companyId).length,
            purchase:
                playerId && this.validActionTypes.includes('BuyConvertedShare')
                    ? convertedSharePurchase(state, playerId).details
                    : undefined
        }
    })
    conversionStations = $derived.by(() => {
        const state = this.gameState
        const conversion = activeMergerRound(state)?.conversion
        return state.machineState === 'BorrowingAfterConversion' && conversion
            ? stationPurchase(state, conversion.companyId, conversion.stationsOwed)
            : undefined
    })
    companyExcess = $derived.by(() => {
        const state = this.gameState
        const companyId = excessCompanyId(state)
        if (!companyId || !CompanyExcessStates.some((name) => name === state.machineState))
            return undefined
        return {
            companyId,
            stations: removableStations(state, companyId),
            trains: discardableTrains(state, companyId)
        }
    })
    acquisitionCompanyId = $derived(
        AcquisitionRoundStates.some((name) => name === this.gameState.machineState)
            ? acquisitionRoundCompanyId(this.gameState)
            : undefined
    )
    acquisitionOffer = $derived.by(() => {
        const companyId = this.acquisitionCompanyId
        return companyId && this.validActionTypes.includes('OfferCompany')
            ? { companyId, openingBid: openingBid(this.gameState, companyId, 'offered') }
            : undefined
    })
    companySale = $derived.by(() => {
        const state = this.gameState
        const sale = activeAcquisitionRound(state)?.sale
        if (!sale || state.machineState !== 'AcquisitionBidding') return undefined
        const bidding = new PassableBidding(sale.bidding)
        const playerId = state.activePlayerIds[0]
        return {
            kind: sale.kind,
            highBid: bidding.hasBid
                ? { playerId: bidding.highBidderId, amount: bidding.highBid }
                : undefined,
            minimum: minimumBid(state, sale),
            maximum:
                playerId && this.validActionTypes.includes('BidToAcquire')
                    ? playerLimit(state, playerId, sale)
                    : undefined
        }
    })
    acquirerChoice = $derived(
        this.validActionTypes.includes('AcquireCompany')
            ? acquirerChoice(this.gameState)
            : undefined
    )
    acquisitionLoans = $derived(
        this.gameState.machineState === 'AcquisitionLoans'
            ? activeAcquisitionRound(this.gameState)?.acquisition
            : undefined
    )
    private requireAcquisitionCompanyId(): string {
        const companyId = this.acquisitionCompanyId
        assert(companyId, 'An acquisition round is in progress')
        return companyId
    }
    async offerCompany() {
        await this.applyAction(
            this.createPlayerAction(OfferCompany, { companyId: this.requireAcquisitionCompanyId() })
        )
    }
    async declineOffer() {
        await this.applyAction(
            this.createPlayerAction(DeclineOffer, { companyId: this.requireAcquisitionCompanyId() })
        )
    }
    async bidToAcquire(amount: number) {
        await this.applyAction(
            this.createPlayerAction(BidToAcquire, {
                companyId: this.requireAcquisitionCompanyId(),
                amount
            })
        )
    }
    async passOnCompany() {
        await this.applyAction(
            this.createPlayerAction(PassOnCompany, {
                companyId: this.requireAcquisitionCompanyId()
            })
        )
    }
    async acquireCompany(buyerId: string) {
        await this.applyAction(
            this.createPlayerAction(AcquireCompany, {
                companyId: this.requireAcquisitionCompanyId(),
                buyerId
            })
        )
    }
    async repayAcquiredLoan() {
        const acquisition = this.acquisitionLoans
        assert(acquisition, 'A company has been bought')
        await this.applyAction(
            this.createPlayerAction(RepayAcquiredLoan, { companyId: acquisition.buyerId })
        )
    }
    async finishAcquisitionLoans() {
        const acquisition = this.acquisitionLoans
        assert(acquisition, 'A company has been bought')
        await this.applyAction(
            this.createPlayerAction(FinishAcquisitionLoans, { companyId: acquisition.buyerId })
        )
    }
    private requireMergerCompanyId(): string {
        const companyId = this.mergerCompanyId
        assert(companyId, 'A merger round is in progress')
        return companyId
    }
    async convertCompany() {
        await this.applyAction(
            this.createPlayerAction(ConvertCompany, { companyId: this.requireMergerCompanyId() })
        )
    }
    async mergeCompanies(targetId: string) {
        await this.applyAction(
            this.createPlayerAction(MergeCompanies, {
                companyId: this.requireMergerCompanyId(),
                targetId
            })
        )
    }
    async passMerger() {
        await this.applyAction(
            this.createPlayerAction(PassMerger, { companyId: this.requireMergerCompanyId() })
        )
    }
    async buyConvertedShare() {
        const purchase = this.convertedShareTrading?.purchase
        assert(purchase, 'The player cannot buy a converted share now')
        await this.applyAction(
            this.createPlayerAction(BuyConvertedShare, {
                companyId: purchase.companyId,
                expectedPrice: purchase.price
            })
        )
    }
    async passConvertedShares() {
        await this.applyAction(
            this.createPlayerAction(PassConvertedShares, {
                companyId: this.requireMergerCompanyId()
            })
        )
    }
    async finishConversionLoans() {
        await this.applyAction(
            this.createPlayerAction(FinishConversionLoans, {
                companyId: this.requireMergerCompanyId()
            })
        )
    }
    private requireExcessCompanyId(): string {
        const companyId = this.companyExcess?.companyId
        assert(companyId, 'A company is over its limits')
        return companyId
    }
    async removeStation(stationId: string) {
        await this.applyAction(
            this.createPlayerAction(RemoveStation, {
                companyId: this.requireExcessCompanyId(),
                stationId
            })
        )
    }
    async discardMergedTrain(trainId: string) {
        await this.applyAction(
            this.createPlayerAction(DiscardMergedTrain, {
                companyId: this.requireExcessCompanyId(),
                trainId
            })
        )
    }
    async shortShare(companyId: string) {
        const option = this.shorts.find((option) => option.companyId === companyId)
        assert(option, 'This company cannot be shorted now')
        await this.applyAction(
            this.createPlayerAction(ShortShare, { companyId, expectedPrice: option.price })
        )
    }
    async buyBackShare(companyId: string) {
        const buyBack = this.corporateActions.find(
            (option) => option.companyId === companyId
        )?.buyBack
        assert(
            buyBack && this.validActionTypes.includes('BuyBackShares'),
            'The company cannot buy back a share now'
        )
        await this.applyAction(
            this.createPlayerAction(BuyBackShares, {
                companyId,
                certificateIds: [buyBack.certificateId]
            })
        )
    }
}

export function requireEighteenSeventeenSession(
    session: GameSession<EighteenXXState, HydratedEighteenXXState>
): EighteenSeventeenSession {
    assert(session instanceof EighteenSeventeenSession, 'Expected a 1817 session')
    return session
}
