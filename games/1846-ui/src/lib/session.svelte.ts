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
    TrackRules1846,
    BuildPrivateTrack,
    chicagoPrivateStation,
    PlaceCWIStation,
    draftCompany,
    type ConstructionPrivateId,
    AssignRevenueMarker,
    revenueMarkerChoices,
    type RevenuePrivateId,
    CorporateFinance,
    corporateFinanceChoices,
    type FinanceChoice,
    AssignSteamboat,
    PortSymbols,
    type SteamboatAssignment,
    ChooseDraftCard,
    PassFinalCompany,
    choicesFor
} from '@tabletop/1846'
import { assertExists } from '@tabletop/common'
import {
    createEighteenXXSessionClass,
    actionForHistoryStep,
    type MapLocationChoice,
    type TitlePrivatePower
} from '@tabletop/18xx-ui'
import {
    isOfferPurchase,
    isRespondToPurchaseOffer,
    nextOperatingCompany,
    type OfferPurchase,
    type RespondToPurchaseOffer,
    type ShareSaleDetails,
    type TrackRequest
} from '@tabletop/18xx'
import { mapState1846 } from './mapState.js'
import { MapView1846 } from './mapView.js'
import { SessionRules1846 } from './sessionRules.js'
import { Presentation1846 } from './presentation.js'

const PrivateTrackPrompts: Readonly<Record<ConstructionPrivateId, string>> = {
    MC: 'Lay up to two connected yellow tiles for free',
    'O&I': 'Lay up to two connected yellow tiles for free',
    LSL: 'Upgrade Cleveland or Toledo to green for free',
    LM: 'Lay or upgrade tiles to connect Cincinnati and Dayton'
}
const ConstructionPrivateIds = Object.keys(PrivateTrackPrompts) as ConstructionPrivateId[]
function isConstructionPrivateId(id: string): id is ConstructionPrivateId {
    return id in PrivateTrackPrompts
}

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
    private readonly constructionModeScope = $derived(
        [
            this.gameState.machineState,
            nextOperatingCompany(this.gameState),
            this.myPlayer?.id,
            this.isViewingHistory
        ].join(':')
    )
    private manualConstructionMode = $derived.by((): ConstructionMode | undefined => {
        void this.constructionModeScope
        return undefined
    })
    constructionMode = $derived.by((): ConstructionMode => {
        if (this.privateDraft) return 'track'
        const manual = this.manualConstructionMode
        if (manual && this.constructionModeAvailable(manual)) return manual
        if (this.validActionTypes.includes('LayTile')) return 'track'
        if (this.validActionTypes.includes('PlaceStation')) return 'stations'
        return this.gameState.machineState === 'LayingTrack' && this.financeChoices.length
            ? 'finance'
            : 'stations'
    })
    // The railroad chosen for the Steamboat before its port is picked on the map; a new state
    // clears it.
    steamboatCompanyId = $derived.by((): string | undefined => {
        void this.gameState.machineState
        void this.gameState.actionCount
        return undefined
    })
    readonly choosingSteamboat = $derived(
        this.gameState.machineState === 'AssigningSteamboat' &&
            !!this.myPlayer &&
            this.validActionTypes.includes('AssignSteamboat')
    )
    override get mapLocationChoice(): MapLocationChoice | undefined {
        const companyId = this.steamboatCompanyId
        if (this.choosingSteamboat && companyId && this.canChooseAction)
            return {
                locationIds: Object.keys(PortSymbols),
                choose: (locationId) => void this.assignSteamboat({ companyId, locationId })
            }
        const pending = this.gameState.pendingRevenueMarker
        if (pending && this.canAssignRevenueMarker)
            return {
                locationIds: this.revenueMarkerChoices.map((choice) => choice.locationId),
                choose: (locationId) =>
                    void this.assignRevenueMarker(pending.privateCompanyId, locationId)
            }
        return super.mapLocationChoice
    }
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        this.localSelections.register({
            hasManual: () => !!this.steamboatCompanyId,
            undo: () => {
                if (!this.steamboatCompanyId) return false
                this.steamboatCompanyId = undefined
                return true
            },
            clear: () => {
                this.steamboatCompanyId = undefined
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
        return !!this.gameState.pendingRevenueMarker
    }
    private constructionModeAvailable(mode: ConstructionMode): boolean {
        if (mode === 'finance') return this.financeChoices.length > 0
        return this.validActionTypes.includes(mode === 'track' ? 'LayTile' : 'PlaceStation')
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

    // Lays staged for a private construction power until its combined action is submitted. They
    // name their power, which may have been chosen automatically; a new state or any change to
    // the private action choices clears them.
    private stagedPrivateLays = $derived.by(
        (): { privateCompanyId: ConstructionPrivateId; lays: TrackRequest[] } | undefined => {
            void [
                this.gameState,
                this.privateActions.stages.state,
                this.myPlayer?.id,
                this.isViewingHistory,
                this.updatingVisibleState
            ]
            return undefined
        }
    )
    private stagedLaysFor(privateCompanyId: ConstructionPrivateId): TrackRequest[] {
        const staged = this.stagedPrivateLays
        return staged?.privateCompanyId === privateCompanyId ? staged.lays : []
    }
    privateDraft = $derived.by(() => {
        const power = this.privateActions.titlePower
        return power?.kind === 'track' && isConstructionPrivateId(power.privateCompanyId)
            ? {
                  privateCompanyId: power.privateCompanyId,
                  lays: this.stagedLaysFor(power.privateCompanyId)
              }
            : undefined
    })
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
        return 'turn'
    })
    readonly canChooseAction = $derived(
        this.interaction === 'turn' && !this.decisions.selection && !this.privateActions.selection
    )
    readonly canAssignRevenueMarker = $derived(
        (this.canChooseAction || this.interaction === 'revenue-marker') &&
            this.validActionTypes.includes('AssignRevenueMarker')
    )
    private readonly privateConstructionPreview = $derived.by(() => {
        const draft = this.privateDraft
        const playerId = this.myPlayer?.id
        if (!draft?.lays.length || !playerId || this.updatingVisibleState) return undefined
        return new PrivateConstruction(this.gameState, playerId, draft.privateCompanyId).evaluate(
            draft.lays,
            false
        )
    })
    readonly constructionMapState = $derived(
        this.privateConstructionPreview?.state ?? this.gameState
    )
    private readonly constructionPowers = $derived.by((): TitlePrivatePower[] => {
        const playerId = this.myPlayer?.id
        if (!playerId || this.isViewingHistory) return []
        return ConstructionPrivateIds.flatMap((privateCompanyId): TitlePrivatePower[] => {
            const plan = new PrivateConstruction(this.gameState, playerId, privateCompanyId)
            const lays = this.stagedLaysFor(privateCompanyId)
            const choices = plan.choices(lays)
            if (!lays.length && !choices.length) return []
            const submit = (requests: TrackRequest[]) => this.buildPrivateTrack(plan, requests)
            const inventory = (lays.length && plan.evaluate(lays, false).state) || this.gameState
            return [
                {
                    kind: 'track',
                    privateCompanyId,
                    playerId,
                    label: draftCompany(privateCompanyId).name,
                    prompt: lays.length
                        ? 'Lay a second tile connected to the first'
                        : PrivateTrackPrompts[privateCompanyId],
                    construction: {
                        choices: (locationId) =>
                            choices.filter((choice) => choice.locationId === locationId),
                        canReach: (locationId) =>
                            choices.some((choice) => choice.locationId === locationId),
                        evaluate: (request) => {
                            const result = plan.evaluate([...lays, request], lays.length > 0)
                            const details = result.lays?.at(-1)
                            return details
                                ? { details }
                                : { reason: result.reason ?? 'Choose a permitted tile lay.' }
                        },
                        inventoryAfter: (details) =>
                            TrackRules1846.tileSet.replace(inventory.tileInventory, {
                                locationId: details.locationId,
                                placement: details.placement,
                                returnPrevious: true
                            })
                    },
                    commit: async (details) => {
                        const { companyId, locationId, definitionId, rotation, nodeMapping } =
                            details
                        const next = [
                            ...lays,
                            { companyId, locationId, definitionId, rotation, nodeMapping }
                        ]
                        if (
                            next.length >= plan.maximumLays ||
                            (!plan.choices(next).length && plan.evaluate(next).lays)
                        )
                            await submit(next)
                        else this.stagedPrivateLays = { privateCompanyId, lays: next }
                    },
                    ...(lays.length && plan.evaluate(lays).lays
                        ? { finish: { label: 'done', run: () => submit(lays) } }
                        : {}),
                    undo: () => {
                        if (!lays.length) return false
                        this.stagedPrivateLays = { privateCompanyId, lays: lays.slice(0, -1) }
                        return true
                    }
                }
            ]
        })
    })
    private readonly stationPowers = $derived.by((): TitlePrivatePower[] => {
        const playerId = this.myPlayer?.id
        const station = playerId ? chicagoPrivateStation(this.gameState, playerId) : undefined
        if (!playerId || !station || this.isViewingHistory) return []
        const { locationId, nodeId } = station.position
        return [
            {
                kind: 'confirm',
                privateCompanyId: 'C&WI',
                playerId,
                label: draftCompany('C&WI').name,
                prompt: 'Place your reserved token in Chicago?',
                confirmLabel: 'yes',
                // The token can only go in the C&WI's own city, shown as it will be placed.
                reservations: [{ companyId: station.companyId, locationId, nodeId }],
                run: () => this.placeChicagoPrivateStation(station.companyId)
            }
        ]
    })
    private readonly markerPowers = $derived.by((): TitlePrivatePower[] => {
        const playerId = this.myPlayer?.id
        if (
            !playerId ||
            this.isViewingHistory ||
            this.gameState.pendingRevenueMarker ||
            !this.validActionTypes.includes('AssignRevenueMarker')
        )
            return []
        const choices = revenueMarkerChoices(this.gameState, playerId)
        return [...new Set(choices.map((choice) => choice.privateCompanyId))].map(
            (privateCompanyId) => {
                const name = draftCompany(privateCompanyId).name
                const placed = this.gameState.revenueMarkers.some(
                    (marker) => marker.privateCompanyId === privateCompanyId
                )
                return {
                    kind: 'location',
                    privateCompanyId,
                    playerId,
                    label: placed ? `Move ${name}` : name,
                    prompt: `Choose a hex for ${name}`,
                    locationIds: choices
                        .filter((choice) => choice.privateCompanyId === privateCompanyId)
                        .map((choice) => choice.locationId),
                    choose: (locationId) => this.assignRevenueMarker(privateCompanyId, locationId)
                }
            }
        )
    })
    // Companies removed at setup keep blocked homes, drawn as solid discs of their colour. The
    // key keeps the overrides, and so the map view, stable from one state to the next.
    private readonly removedCorporationKey = $derived(
        this.gameState.removedCorporationIds.join(' ')
    )
    private readonly removedStations = $derived.by(() =>
        Object.fromEntries(
            this.removedCorporationKey
                .split(' ')
                .filter(Boolean)
                .map((companyId) => [
                    companyId,
                    { ...MapView1846.stations[companyId], solid: true as const }
                ])
        )
    )
    protected override get stationAppearanceOverrides() {
        return this.removedStations
    }
    // A private the operating company has just bought opens its power straight away.
    private readonly purchasedPrivateId = $derived.by(() => {
        if (this.updatingVisibleState) return undefined
        const purchase = actionForHistoryStep(
            this.actions,
            this.gameState.actionCount,
            (action): action is OfferPurchase | RespondToPurchaseOffer =>
                isOfferPurchase(action) || isRespondToPurchaseOffer(action)
        )
        const asset = purchase?.metadata?.accepted ? purchase.metadata.offer.asset : undefined
        return asset?.kind === 'private' ? asset.privateCompanyId : undefined
    })
    protected override get offeredPrivatePower() {
        const privateCompanyId = this.purchasedPrivateId
        const playerId = this.myPlayer?.id
        return privateCompanyId && playerId ? { privateCompanyId, playerId } : undefined
    }
    protected override get titlePrivatePowers(): readonly TitlePrivatePower[] {
        return [...this.constructionPowers, ...this.stationPowers, ...this.markerPowers]
    }
    private async buildPrivateTrack(plan: PrivateConstruction, lays: TrackRequest[]) {
        const result = plan.evaluate(lays)
        assertExists(result.lays, 'Complete a legal private construction plan')
        await this.applyAction(
            this.createPlayerAction(BuildPrivateTrack, {
                privateCompanyId: plan.privateId,
                lays,
                expectedCost: result.lays.reduce((sum, lay) => sum + lay.cost, 0)
            })
        )
    }
    async placeChicagoPrivateStation(companyId: string): Promise<void> {
        await this.applyAction(this.createPlayerAction(PlaceCWIStation, { companyId }))
    }
    readonly revenueMarkerChoices = $derived(
        this.myPlayer ? revenueMarkerChoices(this.gameState, this.myPlayer.id) : []
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
    readonly financePrompt = $derived(
        this.financeLabel === 'Issue / redeem' ? 'Issue or redeem shares' : this.financeLabel
    )
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
