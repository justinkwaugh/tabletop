import { getCompany } from '@tabletop/18xx'
import { TheOldPrinceAuctionRules } from '@tabletop/the-old-prince'
import { TheOldPrinceTrainFundingRules } from '@tabletop/the-old-prince'
import { TheOldPrinceTransferRules, TheOldPrincePrivatePowerRules } from '@tabletop/the-old-prince'
import { TheOldPrincePrivateRules } from '@tabletop/the-old-prince'
import { TheOldPrinceEarningsRules } from '@tabletop/the-old-prince'
import { TheOldPrinceRouteRules } from '@tabletop/the-old-prince'
import { TheOldPrinceTrainRules } from '@tabletop/the-old-prince'
import { TheOldPrinceStationRules } from '@tabletop/the-old-prince'
import { TheOldPrinceMapView } from './mapView.js'
import { createFinanceExampleSessionClass } from '@tabletop/18xx-ui'
import {
    TheOldPrinceStockRules,
    TheOldPrinceCompanyRules,
    TheOldPrinceTrackRules
} from '@tabletop/the-old-prince'
import { type GameSession } from '@tabletop/frontend-components'
import type { GameState, HydratedGameState } from '@tabletop/common'

import { assert } from '@tabletop/common'
import {
    TheOldPrinceBranchSplit,
    SplitCompany,
    isSplitCompany,
    type BranchSplitAllocation
} from '@tabletop/the-old-prince'
import {
    chooseSplitParent,
    chooseSplitBranch,
    chooseSplitPrice,
    chooseSplitAllocation,
    backSplitSelection,
    chooseSplitAction,
    hasSplitSelection,
    splitRequest,
    type BranchSplitSelection
} from './branchSplitSelection.js'

const BaseSession = createFinanceExampleSessionClass(
    TheOldPrinceStockRules,
    TheOldPrinceCompanyRules,
    TheOldPrinceMapView,
    TheOldPrinceTrackRules,
    TheOldPrinceStationRules,
    TheOldPrinceTrainRules,
    TheOldPrinceRouteRules,
    TheOldPrinceEarningsRules,
    TheOldPrincePrivateRules,
    TheOldPrinceTransferRules,
    TheOldPrincePrivatePowerRules,
    TheOldPrinceTrainFundingRules,
    undefined,
    TheOldPrinceAuctionRules
)

export class TheOldPrinceSession extends BaseSession {
    private splitDraft: BranchSplitSelection = $state({})
    splitModel = $derived(new TheOldPrinceBranchSplit(this.financialState))
    canPreviewSplit = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.financialState.machineState === 'StockRound' &&
            !!this.myPlayer &&
            this.financialState.activePlayerIds.includes(this.myPlayer.id) &&
            !this.financialState.stockRound.turn.bought &&
            this.validActionTypes.includes('SplitCompany')
    )
    splitSelection = $derived(this.canPreviewSplit ? this.splitDraft : {})
    hasSplitDraft = $derived(hasSplitSelection(this.splitSelection))
    splitPreview = $derived.by(() => {
        const request = this.myPlayer
            ? splitRequest(this.splitSelection, this.myPlayer.id)
            : undefined
        return request ? this.splitModel.evaluate(request) : undefined
    })
    splitSettlement = $derived.by(() => {
        const preview = this.splitPreview?.details
        const allocation = this.splitSelection.allocation?.value
        return preview && allocation
            ? this.splitModel.allocate(preview.request, allocation)
            : undefined
    })
    latestSplit = $derived(this.actions.filter(isSplitCompany).at(-1))
    beginSplitAllocation() {
        assert(this.canPreviewSplit && this.splitPreview?.details, 'Choose a split first')
        this.splitDraft = chooseSplitAllocation(this.splitDraft, {
            stationIds: [],
            homeStationId: '',
            trainIds: [],
            cash: 0,
            hunslet: false
        })
    }
    setSplitAllocation(allocation: BranchSplitAllocation) {
        assert(
            this.canPreviewSplit && this.splitSelection.allocation,
            'Begin allocating assets first'
        )
        this.splitDraft = chooseSplitAllocation(this.splitDraft, allocation)
    }
    async confirmSplit() {
        const preview = this.splitPreview?.details
        const allocation = this.splitSelection.allocation?.value
        assert(
            this.canPreviewSplit && preview && allocation && this.splitSettlement?.details,
            'Complete a valid split allocation'
        )
        await this.applyAction(
            this.createPlayerAction(SplitCompany, {
                parentId: preview.request.parentId,
                branchId: preview.request.branchId,
                marketSpaceId: preview.request.marketSpaceId,
                allocation,
                expectedFunding: preview.childFunding
            })
        )
    }
    override cancelSelection() {
        this.splitDraft = {}
        super.cancelSelection()
    }
    override get privatePurchaseHeading(): string | undefined { return undefined }
    override stockCompanyName(companyId: string) {
        return companyId === 'PEIR' ? 'PEIR' : super.stockCompanyName(companyId)
    }
    override get stockCompanies() {
        return [...super.stockCompanies.filter((company) => company.id !== 'PEIR'),
            getCompany(this.financialState, 'PEIR')]
    }
    chooseSplit() {
        assert(this.canPreviewSplit, 'Split selection is unavailable')
        this.chooseStockMenu(undefined)
        this.splitDraft = chooseSplitAction()
    }
    selectSplitParent(parentId: string) {
        assert(this.canPreviewSplit && this.myPlayer, 'Split selection is unavailable')
        assert(
            !this.splitModel.parentReason(this.myPlayer.id, parentId),
            'Choose an eligible parent'
        )
        this.splitDraft = chooseSplitParent(this.splitDraft, parentId)
    }
    selectSplitBranch(branchId: string) {
        assert(this.canPreviewSplit && this.splitSelection.parentId, 'Select a parent first')
        assert(
            this.splitModel.branches().some((branch) => branch.id === branchId),
            'Choose an available branch'
        )
        this.splitDraft = chooseSplitBranch(this.splitDraft, branchId)
    }
    selectSplitPrice(marketSpaceId: string) {
        assert(this.canPreviewSplit && this.splitSelection.branchId, 'Select a branch first')
        assert(
            this.splitModel.prices().some((price) => price.id === marketSpaceId),
            'Choose an available price'
        )
        this.splitDraft = chooseSplitPrice(this.splitDraft, marketSpaceId)
    }
    backSplit() {
        if (this.canPreviewSplit) this.splitDraft = backSplitSelection(this.splitDraft)
    }
    override beforeNewState() {
        this.splitDraft = {}
        super.beforeNewState()
    }
    override get hasActionDraft(): boolean {
        return hasSplitSelection(this.splitDraft) || super.hasActionDraft
    }
    override async undo() {
        if (this.busy || this.updatingVisibleState || this.isViewingHistory) return
        if (hasSplitSelection(this.splitDraft)) {
            this.splitDraft = backSplitSelection(this.splitDraft)
            return
        }
        await super.undo()
    }
}
export function requireTheOldPrinceSession(
    session: GameSession<GameState, HydratedGameState>
): TheOldPrinceSession {
    assert(session instanceof TheOldPrinceSession, 'Expected a TOP session')
    return session
}
