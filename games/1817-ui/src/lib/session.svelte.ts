import { assert } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import type { GameSession } from '@tabletop/frontend-components'
import {
    BuyBackShares,
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
    mergeTargetIds,
    mergerPrice,
    mergerRoundSubject,
    shortOptions
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
    /** The company the merger round deals with, and what the local player may do with it. */
    mergerRound = $derived.by(() => {
        const state = this.gameState
        const round = activeMergerRound(state)
        const companyId = mergerRoundSubject(state)
        if (!round || !companyId) return undefined
        const playerId = state.activePlayerIds[0]
        const purchase =
            playerId && this.validActionTypes.includes('BuyConvertedShare')
                ? convertedSharePurchase(state, playerId).details
                : undefined
        const targets = this.validActionTypes.includes('MergeCompanies')
            ? mergeTargetIds(state, companyId, round.convertedIds).map((targetId) => ({
                  companyId: targetId,
                  price: mergerPrice(state, companyId, targetId)
              }))
            : []
        return { companyId, conversion: round.conversion, purchase, targets }
    })
    private mergerCompanyId(): string {
        const companyId = this.mergerRound?.companyId
        assert(companyId, 'A merger round is in progress')
        return companyId
    }
    async convertCompany() {
        await this.applyAction(
            this.createPlayerAction(ConvertCompany, { companyId: this.mergerCompanyId() })
        )
    }
    async mergeCompanies(targetId: string) {
        await this.applyAction(
            this.createPlayerAction(MergeCompanies, { companyId: this.mergerCompanyId(), targetId })
        )
    }
    async passMerger() {
        await this.applyAction(
            this.createPlayerAction(PassMerger, { companyId: this.mergerCompanyId() })
        )
    }
    async buyConvertedShare() {
        const purchase = this.mergerRound?.purchase
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
            this.createPlayerAction(PassConvertedShares, { companyId: this.mergerCompanyId() })
        )
    }
    async finishConversionLoans() {
        await this.applyAction(
            this.createPlayerAction(FinishConversionLoans, { companyId: this.mergerCompanyId() })
        )
    }
    async removeStation(stationId: string) {
        await this.applyAction(
            this.createPlayerAction(RemoveStation, {
                companyId: this.mergerCompanyId(),
                stationId
            })
        )
    }
    async discardMergedTrain(trainId: string) {
        await this.applyAction(
            this.createPlayerAction(DiscardMergedTrain, {
                companyId: this.mergerCompanyId(),
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
