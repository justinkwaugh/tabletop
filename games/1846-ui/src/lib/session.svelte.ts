import {
    type EighteenFortySixProjectedState,
    type HydratedEighteenFortySixState,
    BuyOpeningCompany,
    PassOpeningPurchase,
    openingPurchaseChoices,
    unboughtOpeningCompanies,
    priceFor,
    canPassOpeningPurchase,
    DeclareBankruptcy,
    bankruptcyShortfall,
    BuyReceiverShare,
    receiverShareChoices,
    type ReceiverShare,
    EmergencyBuyTrain,
    StartEmergencyFunding,
    SellEmergencyShares,
    emergencyFundingStart,
    emergencyFundingChoices,
    emergencyShareSaleChoices,
    emergencyTrainChoices,
    type EmergencyPurchase,
    PrivateConstruction,
    constructionPrivateIds,
    BuildPrivateTrack,
    isBuildPrivateTrack,
    chicagoPrivateStation,
    PlaceCWIStation,
    isPlaceCWIStation,
    type ConstructionPrivateId,
    AssignRevenueMarker,
    isAssignRevenueMarker,
    revenueMarkerChoices,
    type RevenuePrivateId,
    CorporateFinance,
    corporateFinanceChoices,
    type FinanceChoice,
    AssignSteamboat,
    type SteamboatAssignment,
    ChooseDraftCard,
    PassFinalCompany,
    choicesFor
} from '@tabletop/1846'
import { assertExists } from '@tabletop/common'
import { createEighteenXXSessionClass, actionForHistoryStep } from '@tabletop/18xx-ui'
import { type ShareSaleDetails, type TrackLayDetails, type TrackRequest } from '@tabletop/18xx'
import { mapState1846 } from './mapState.js'
import { MapView1846 } from './mapView.js'
import { SessionRules1846 } from './sessionRules.js'
import { Presentation1846 } from './presentation.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<
        typeof EighteenFortySixProjectedState,
        HydratedEighteenFortySixState
    >
> = createEighteenXXSessionClass<
    typeof EighteenFortySixProjectedState,
    HydratedEighteenFortySixState
>(SessionRules1846, MapView1846, Presentation1846)
type ConstructionMode = 'track' | 'stations' | 'finance'
export class EighteenFortySixSession extends BaseSession {
    private manualConstructionMode = $derived.by((): ConstructionMode | undefined => {
        void [this.gameState, this.updatingVisibleState, this.myPlayer?.id, this.isViewingHistory]
        return undefined
    })
    constructionMode = $derived.by(() =>
        this.privateDraft
            ? 'track'
            : (this.manualConstructionMode ??
              (this.validActionTypes.includes('LayTile') ? 'track' : 'stations'))
    )
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register({
            hasManual: () => !!this.privateDraft || this.manualConstructionMode !== undefined,
            undo: () => {
                if (this.privateDraft) {
                    this.backFromPrivateConstruction()
                    return true
                }
                if (this.manualConstructionMode !== undefined) {
                    this.manualConstructionMode = undefined
                    return true
                }
                return false
            },
            clear: () => {
                this.privateDraft = undefined
                this.manualConstructionMode = undefined
            }
        })
    }
    protected override get trackBuildingActive() {
        return this.constructionMode === 'track' && !this.decisions.selection
    }
    protected override get stationPlacementActive() {
        return (
            this.gameState.machineState === 'LayingTrack' &&
            this.constructionMode === 'stations' &&
            !this.privateActions.selection &&
            !this.decisions.selection
        )
    }
    protected override get sharedActionsBlocked() {
        return !!this.privateDraft || !!this.gameState.pendingRevenueMarker
    }
    chooseConstructionMode(mode: ConstructionMode | undefined) {
        this.track.stages.clear()
        this.stations.stages.clear()
        this.manualConstructionMode = mode
    }

    protected override get operatingStepCompletion() {
        if (this.validActionTypes.includes('FinishTrack'))
            return { lastTarget: 1, finish: () => this.finishConstruction() }
        return undefined
    }

    async finishConstruction() {
        await this.track.finish()
    }

    privateDraft = $derived.by(
        (): { privateCompanyId: ConstructionPrivateId; lays: TrackRequest[] } | undefined => {
            void [
                this.gameState,
                this.myPlayer?.id,
                this.isViewingHistory,
                this.updatingVisibleState
            ]
            return undefined
        }
    )
    private readonly interaction = $derived.by(() => {
        if (
            !this.isPlayable ||
            !this.isMyTurn ||
            this.isViewingHistory ||
            this.busy ||
            this.updatingVisibleState
        )
            return 'blocked'
        if (this.gameState.purchaseOffer) return 'purchase-response'
        if (this.gameState.pendingRevenueMarker) return 'revenue-marker'
        if (this.privateDraft) return 'private-construction'
        return 'turn'
    })
    readonly canChooseAction = $derived(
        this.interaction === 'turn' && !this.decisions.selection && !this.privateActions.selection
    )
    readonly canUsePrivateConstruction = $derived(
        this.canChooseAction || this.interaction === 'private-construction'
    )
    readonly canAssignRevenueMarker = $derived(
        (this.canChooseAction || this.interaction === 'revenue-marker') &&
            this.validActionTypes.includes('AssignRevenueMarker')
    )
    readonly constructionPrivateIds = $derived(
        this.myPlayer ? constructionPrivateIds(this.gameState, this.myPlayer.id) : []
    )
    readonly privateConstruction = $derived(
        this.myPlayer && this.privateDraft
            ? new PrivateConstruction(
                  this.gameState,
                  this.myPlayer.id,
                  this.privateDraft.privateCompanyId
              )
            : undefined
    )
    readonly privateTrackChoices = $derived(
        this.privateConstruction?.choices(this.privateDraft?.lays ?? []) ?? []
    )
    readonly privateConstructionPreview = $derived(
        this.privateDraft && !this.updatingVisibleState
            ? this.privateConstruction?.evaluate(this.privateDraft.lays, false)
            : undefined
    )
    readonly privateConstructionResult = $derived(
        this.privateDraft ? this.privateConstruction?.evaluate(this.privateDraft.lays) : undefined
    )
    readonly constructionMapState = $derived(
        this.privateConstructionPreview?.state ?? this.gameState
    )
    readonly chicagoPrivateStation = $derived(
        this.myPlayer ? chicagoPrivateStation(this.gameState, this.myPlayer.id) : undefined
    )
    readonly recordedPrivateTrack = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isBuildPrivateTrack)
            : undefined
    )
    readonly recordedPrivateStation = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isPlaceCWIStation)
                  ?.metadata
            : undefined
    )
    selectPrivateConstruction(privateCompanyId: ConstructionPrivateId): void {
        this.track.stages.clear()
        this.stations.stages.clear()
        this.routes.clear()
        this.privateDraft = { privateCompanyId, lays: [] }
    }
    stagePrivateTrack(choice: TrackLayDetails): void {
        assertExists(this.privateDraft)
        const { companyId, locationId, definitionId, rotation, nodeMapping } = choice
        this.privateDraft = {
            ...this.privateDraft,
            lays: [
                ...this.privateDraft.lays,
                { companyId, locationId, definitionId, rotation, nodeMapping }
            ]
        }
    }
    backFromPrivateConstruction(): void {
        this.privateDraft = this.privateDraft?.lays.length
            ? { ...this.privateDraft, lays: this.privateDraft.lays.slice(0, -1) }
            : undefined
    }
    async confirmPrivateConstruction(): Promise<void> {
        assertExists(this.privateDraft)
        const lays = this.privateConstructionResult?.lays
        assertExists(lays, 'Complete a legal private construction plan')
        await this.applyAction(
            this.createPlayerAction(BuildPrivateTrack, {
                ...this.privateDraft,
                expectedCost: lays.reduce((sum, lay) => sum + lay.cost, 0)
            })
        )
    }
    async placeChicagoPrivateStation(): Promise<void> {
        assertExists(this.chicagoPrivateStation)
        await this.applyAction(
            this.createPlayerAction(PlaceCWIStation, {
                companyId: this.chicagoPrivateStation.companyId
            })
        )
    }
    readonly revenueMarkerChoices = $derived(
        this.myPlayer ? revenueMarkerChoices(this.gameState, this.myPlayer.id) : []
    )
    readonly recordedMarkerChange = $derived(
        !this.updatingVisibleState
            ? actionForHistoryStep(this.actions, this.gameState.actionCount, isAssignRevenueMarker)
                  ?.metadata
            : undefined
    )
    async assignRevenueMarker(
        privateCompanyId: RevenuePrivateId,
        locationId?: string
    ): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AssignRevenueMarker, {
                privateCompanyId,
                ...(locationId ? { locationId } : {})
            })
        )
    }
    readonly bankruptcyShortfall = $derived(bankruptcyShortfall(this.gameState))
    readonly receiverShares = $derived(
        this.myPlayer ? receiverShareChoices(this.gameState, this.myPlayer.id) : []
    )
    async buyReceiverShare(choice: ReceiverShare): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(BuyReceiverShare, {
                companyId: choice.companyId,
                expectedPrice: choice.price
            })
        )
    }
    async declareBankruptcy(): Promise<void> {
        assertExists(this.gameState.emergencyFunding, 'Bankruptcy requires emergency funding')
        await this.applyAction(
            this.createPlayerAction(DeclareBankruptcy, {
                companyId: this.gameState.emergencyFunding.companyId
            })
        )
    }
    readonly fundingStart = $derived(emergencyFundingStart(this.gameState))
    readonly fundingChoices = $derived(emergencyFundingChoices(this.gameState))
    readonly emergencySales = $derived(emergencyShareSaleChoices(this.gameState))
    async startEmergencyFunding(): Promise<void> {
        assertExists(this.fundingStart, 'Emergency funding requires a shortfall')
        await this.applyAction(
            this.createPlayerAction(StartEmergencyFunding, {
                companyId: this.fundingStart.companyId
            })
        )
    }
    async sellEmergencyShares(choice: ShareSaleDetails): Promise<void> {
        const sale = choice.sales[0]
        await this.applyAction(
            this.createPlayerAction(SellEmergencyShares, {
                companyId: sale.companyId,
                shares: sale.shares,
                expectedProceeds: choice.proceeds
            })
        )
    }
    readonly emergencyTrainChoices = $derived(emergencyTrainChoices(this.gameState))
    async emergencyBuyTrain(choice: EmergencyPurchase): Promise<void> {
        await this.applyAction(this.createPlayerAction(EmergencyBuyTrain, choice))
    }
    readonly financeChoices = $derived(corporateFinanceChoices(this.gameState))
    readonly financeLabel = $derived.by(() => {
        const operations = new Set(this.financeChoices.map((choice) => choice.operation))
        if (operations.size > 1) return 'Issue / redeem'
        return operations.has('issue') ? 'Issue shares' : 'Redeem shares'
    })
    async corporateFinance(choice: FinanceChoice): Promise<void> {
        await this.applyAction(this.createPlayerAction(CorporateFinance, choice))
    }
    private openedPacketKey = $state<string>()
    private readonly packetKey = $derived(
        `${this.gameState.id}:${this.gameState.actionCount}:${this.myPlayer?.id}`
    )
    readonly packetVisible = $derived(
        !this.updatingVisibleState && this.openedPacketKey === this.packetKey
    )
    readonly draftChoices = $derived(
        this.myPlayer ? choicesFor(this.gameState, this.myPlayer.id) : []
    )
    readonly openingChoices = $derived(
        this.myPlayer ? openingPurchaseChoices(this.gameState, this.myPlayer.id) : []
    )
    readonly openingCompanies = $derived(
        this.gameState.draft.kind === 'public' && this.gameState.draft.stage === 'buying'
            ? unboughtOpeningCompanies(this.gameState).map((companyId) => ({
                  companyId,
                  expectedPrice: priceFor(this.gameState, companyId)
              }))
            : []
    )
    readonly canPassOpening = $derived(
        this.canChooseAction &&
            !!this.myPlayer &&
            canPassOpeningPurchase(this.gameState, this.myPlayer.id)
    )
    protected override projectMapState(state: HydratedEighteenFortySixState) {
        return mapState1846(state)
    }
    protected override get mapDisplayState() {
        return mapState1846({ ...this.gameState, ...this.constructionMapState })
    }
    async assignSteamboat(assignment?: SteamboatAssignment): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AssignSteamboat, assignment ? { assignment } : {})
        )
    }
    revealPacket(): void {
        this.openedPacketKey = this.packetKey
    }
    hidePacket(): void {
        this.openedPacketKey = undefined
    }
    async choose(cardId: string): Promise<void> {
        this.hidePacket()
        await this.applyAction(this.createPlayerAction(ChooseDraftCard, { cardId }))
    }
    async buyOpeningCompany(choice: (typeof this.openingChoices)[number]): Promise<void> {
        await this.applyAction(this.createPlayerAction(BuyOpeningCompany, choice))
    }
    async passOpeningPurchase(): Promise<void> {
        await this.applyAction(this.createPlayerAction(PassOpeningPurchase))
    }
    async passFinalCompany(): Promise<void> {
        this.hidePacket()
        await this.applyAction(this.createPlayerAction(PassFinalCompany))
    }
    override beforeNewState(): void {
        super.beforeNewState()
        this.hidePacket()
    }
}
