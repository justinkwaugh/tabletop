import { TheOldPrincePresentation } from './presentation.js'
import { getCompany } from '@tabletop/18xx'
import UnknownToken from './images/tokens/unknown.svg'
import StraightTile from './images/tokens/straight-tile.svg'
import { TheOldPrinceTitleRules, theOldPrinceRole } from '@tabletop/the-old-prince'
import { TheOldPrinceMapView } from './mapView.js'
import { createEighteenXXSessionClass } from '@tabletop/18xx-ui'
import { type GameSession } from '@tabletop/frontend-components'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'

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

const BaseSession = createEighteenXXSessionClass(
    TheOldPrinceTitleRules,
    TheOldPrinceMapView,
    TheOldPrincePresentation
)

export class TheOldPrinceSession extends BaseSession {
    override privateCompanyTokens = $derived({
        MC: this.mapView.stations[theOldPrinceRole(this.gameState, 'shortline')],
        VR: this.mapView.stations[theOldPrinceRole(this.gameState, 'shortline')],
        SB: this.mapView.stations[theOldPrinceRole(this.gameState, 'shortline')],
        IB: { label: '?', color: 'transparent', imageUrl: UnknownToken },
        SBC: { label: '9', color: 'transparent', imageUrl: StraightTile },
        RA: this.mapView.stations[theOldPrinceRole(this.gameState, 'mainline')],
        RF: this.mapView.stations[theOldPrinceRole(this.gameState, 'mainline')],
        MLC: this.mapView.stations[theOldPrinceRole(this.gameState, 'mainline')],
        SLC: this.mapView.stations[theOldPrinceRole(this.gameState, 'shortline')]
    })
    private splitStages: BranchSplitSelection = $state({})
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register(
            {
                hasManual: () => hasSplitSelection(this.splitStages),
                undo: () => {
                    if (!hasSplitSelection(this.splitStages)) return false
                    this.splitStages = backSplitSelection(this.splitStages)
                    return true
                },
                clear: () => {
                    this.splitStages = {}
                }
            },
            'first'
        )
    }
    splitModel = $derived(new TheOldPrinceBranchSplit(this.gameState))
    canPreviewSplit = $derived(
        !this.busy &&
            !this.updatingVisibleState &&
            !this.isViewingHistory &&
            this.gameState.machineState === 'StockRound' &&
            !!this.myPlayer &&
            this.gameState.activePlayerIds.includes(this.myPlayer.id) &&
            !this.gameState.stockRound.turn.bought &&
            this.validActionTypes.includes('SplitCompany')
    )
    splitSelection = $derived(this.canPreviewSplit ? this.splitStages : {})
    splitInProgress = $derived(hasSplitSelection(this.splitSelection))
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
    setSplitAllocation(allocation: BranchSplitAllocation) {
        assert(this.canPreviewSplit && this.splitSelection.allocation, 'Choose a split price first')
        this.splitStages = chooseSplitAllocation(this.splitStages, allocation)
    }
    setSplitCash(cash: number) {
        const allocation = this.splitSelection.allocation?.value
        const preview = this.splitPreview?.details
        assert(allocation && preview && Number.isFinite(cash), 'Choose a valid cash allocation')
        this.setSplitAllocation({
            ...allocation,
            cash: Math.max(0, Math.min(preview.parentCash, Math.round(cash)))
        })
    }
    transferSplitStation(stationId: string) {
        const allocation = this.splitSelection.allocation?.value
        const station = this.splitPreview?.details?.stations.find(
            (entry) => entry.station.id === stationId
        )
        assert(allocation && station && !station.protectedHome, 'Choose a transferable station')
        const stationIds = allocation.stationIds.includes(stationId)
            ? allocation.stationIds.filter((id) => id !== stationId)
            : [...allocation.stationIds, stationId]
        this.setSplitAllocation({
            ...allocation,
            stationIds,
            homeStationId: stationIds.includes(allocation.homeStationId)
                ? allocation.homeStationId
                : (stationIds[0] ?? '')
        })
    }
    transferSplitTrain(trainId: string) {
        const allocation = this.splitSelection.allocation?.value
        assert(allocation, 'Choose a split price first')
        this.setSplitAllocation({
            ...allocation,
            trainIds: allocation.trainIds.includes(trainId)
                ? allocation.trainIds.filter((id) => id !== trainId)
                : [...allocation.trainIds, trainId]
        })
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
    protected override onStockSelectionCancelled() {
        this.splitStages = {}
    }
    override stockCompanyName(companyId: string) {
        return companyId === 'PEIR' ? 'PEIR' : super.stockCompanyName(companyId)
    }
    override get stockCompanies() {
        return [
            ...super.stockCompanies.filter((company) => company.id !== 'PEIR'),
            getCompany(this.gameState, 'PEIR')
        ]
    }
    chooseSplit() {
        assert(this.canPreviewSplit, 'Split selection is unavailable')
        this.stock.chooseMenu(undefined)
        this.splitStages = chooseSplitAction()
    }
    selectSplitParent(parentId: string) {
        assert(this.canPreviewSplit && this.myPlayer, 'Split selection is unavailable')
        assert(
            !this.splitModel.parentReason(this.myPlayer.id, parentId),
            'Choose an eligible parent'
        )
        this.splitStages = chooseSplitParent(this.splitStages, parentId)
    }
    selectSplitBranch(branchId: string) {
        assert(this.canPreviewSplit && this.splitSelection.parentId, 'Select a parent first')
        assert(
            this.splitModel.branches().some((branch) => branch.id === branchId),
            'Choose an available branch'
        )
        this.splitStages = chooseSplitBranch(this.splitStages, branchId)
    }
    selectSplitPrice(marketSpaceId: string) {
        assert(this.canPreviewSplit && this.splitSelection.branchId, 'Select a branch first')
        assert(
            this.splitModel.prices().some((price) => price.id === marketSpaceId),
            'Choose an available price'
        )
        this.splitStages = chooseSplitPrice(this.splitStages, marketSpaceId)
    }
    backSplit() {
        if (this.canPreviewSplit) this.splitStages = backSplitSelection(this.splitStages)
    }
    override async undo() {
        if (this.updatingVisibleState) return
        await super.undo()
    }
}
export function requireTheOldPrinceSession(
    session: GameSession<EighteenXXState, HydratedEighteenXXState>
): TheOldPrinceSession {
    assert(session instanceof TheOldPrinceSession, 'Expected a TOP session')
    return session
}
