import {
    AcquireMinor,
    AcquirePrivate,
    AnswerAcquisition,
    AnswerPrivateOffer,
    BuyLocalTrain,
    DeclareCash,
    LondonLocationId,
    LondonNodeIds,
    MetropolitanHomeCost1822,
    MetropolitanId,
    MoveStackCard,
    PlaceMetropolitanHome,
    RepayPlayerLoan,
    SwapStationToken,
    TitleRules1822,
    TrainRules1822,
    UseDiscountToken,
    acquirablePrivates1822,
    acquisitionChoices1822,
    cashDeclarationDue1822,
    firstTrainOffer1822,
    marketChart1822,
    metropolitanHomeDue1822,
    metropolitanHomeSlot1822,
    minorAcquisitions1822,
    movableStackCards1822,
    offeredPayment1822,
    playerLoan1822,
    privateAgreementPlayerId1822,
    repayableLoan1822,
    stationSwaps1822,
    usableDiscountTokens1822,
    PrivateTrains1822,
    type DiscountTokenKind,
    type HydratedState1822,
    type MinorAcquisition1822,
    type State1822
} from '@tabletop/1822'
import {
    finiteCashOwnedBy,
    homeStationId,
    placeReference,
    nextOperatingCompany,
    trainsCountingForLimit,
    type Train
} from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import {
    createEighteenXXSessionClass,
    type AwaitedDecision,
    type HistoricalMapState,
    type MapLocationChoice,
    type TitleOperatingMode
} from '@tabletop/18xx-ui'
import { destinationMarkers1822 } from './destinationMarkers.js'
import {
    StagedChoices1822,
    type MinorTerms,
    type PrivateOffer,
    type PrivateTerms
} from './stagedChoices.svelte.js'
import { MapView1822 } from './mapView.js'
import { Presentation1822 } from './presentation.js'
import { createRouteWorker } from './routeWorker.js'

const BaseSession: ReturnType<
    typeof createEighteenXXSessionClass<typeof State1822, HydratedState1822>
> = createEighteenXXSessionClass<typeof State1822, HydratedState1822>(
    TitleRules1822,
    MapView1822,
    Presentation1822,
    createRouteWorker
)

export type { MinorTerms, PrivateOffer, PrivateTerms } from './stagedChoices.svelte.js'

export class Session1822 extends BaseSession {
    private readonly choices = new StagedChoices1822()
    constructor(options: ConstructorParameters<typeof BaseSession>[0]) {
        super(options)
        for (const selection of this.choices.selections) this.localSelections.register(selection)
    }
    readonly canChooseAction = $derived(
        this.isPlayable &&
            this.isMyTurn &&
            !this.isViewingHistory &&
            !this.busy &&
            !this.updatingVisibleState
    )
    private readonly me = $derived(this.canChooseAction ? this.myPlayer?.id : undefined)
    private can(type: string): boolean {
        return this.canChooseAction && this.validActionTypes.includes(type)
    }
    private operatingCompanyId(): string {
        const companyId = nextOperatingCompany(this.gameState)
        assertExists(companyId, 'A company is operating')
        return companyId
    }

    // The stock round: bids, loans and P9's declaration (§4.1.3, §4.9, §3.1.9).
    readonly cashDeclarer = $derived(cashDeclarationDue1822(this.gameState))
    readonly canDeclareCash = $derived(this.can('DeclareCash'))
    readonly stockPanels = this.titleStockPanels<'bids'>([
        {
            id: 'bids',
            label: 'Bid',
            available: () => this.gameState.machineState === 'StockRound' && !this.cashDeclarer,
            held: () => true
        }
    ])
    /** What the player on turn owes and could pay towards it now. */
    readonly loanRepayment = $derived.by(() => {
        const playerId = this.me
        if (!playerId || !this.can('RepayPlayerLoan')) return undefined
        return {
            owed: playerLoan1822(this.gameState, playerId),
            most: repayableLoan1822(this.gameState, playerId)
        }
    })
    async repayLoan(amount: number): Promise<void> {
        await this.applyAction(this.createPlayerAction(RepayPlayerLoan, { amount }))
    }
    async declareCash(doubled: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(DeclareCash, { doubled }))
    }
    playerCash(playerId: string): number {
        return finiteCashOwnedBy(this.gameState, { kind: 'player', playerId })
    }

    // As a company's turn begins (§5.6.5, §5.6.7, §5.7, Table 3).
    readonly firstTrain = $derived(
        this.me && this.can('BuyLocalTrain')
            ? firstTrainOffer1822(this.gameState, this.me)
            : undefined
    )
    async buyLocalTrain(): Promise<void> {
        const offer = this.firstTrain
        assertExists(offer, 'The minor has an L train to buy')
        await this.applyAction(
            this.createPlayerAction(BuyLocalTrain, {
                companyId: offer.companyId,
                trainId: offer.trainId,
                expectedPrice: offer.price
            })
        )
    }
    readonly metropolitanHomeDue = $derived(
        this.gameState.machineState === 'LayingTrack' && metropolitanHomeDue1822(this.gameState)
    )
    readonly canPlaceMetropolitanHome = $derived(this.can('PlaceMetropolitanHome'))
    readonly metropolitanHomeCost = MetropolitanHomeCost1822
    /** The London station chosen for the Metropolitan Railway's home while that is its to place. */
    readonly metropolitanStation = $derived(
        this.metropolitanHomeDue && this.canPlaceMetropolitanHome
            ? this.choices.metropolitanStation.value('choice')
            : undefined
    )
    async placeMetropolitanHome(): Promise<void> {
        const nodeId = this.metropolitanStation
        assertExists(nodeId, 'Choose the London station the home stands beside')
        await this.applyAction(
            this.createPlayerAction(PlaceMetropolitanHome, { companyId: MetropolitanId, nodeId })
        )
        this.choices.metropolitanStation.clear()
    }
    // A scenario's market marks its own game end spaces (§6.2.1).
    override get stockMarketChart() {
        return marketChart1822(this.gameState.variants.scenario)
    }
    // The Metropolitan Railway's home is chosen on the map: a tap on one of London's six stations.
    override get mapLocationChoice(): MapLocationChoice | undefined {
        if (!this.metropolitanHomeDue || !this.canPlaceMetropolitanHome)
            return super.mapLocationChoice
        return {
            locationIds: [LondonLocationId],
            choose: (_locationId, nodeId) => {
                const station = LondonNodeIds.find((id) => id === nodeId)
                if (station) this.choices.metropolitanStation.choose('choice', station)
            }
        }
    }
    protected override projectMapState(state: HydratedState1822): HistoricalMapState {
        return { ...state, locationMarkers: destinationMarkers1822(state) }
    }
    protected override get mapDisplayState() {
        const state = super.mapDisplayState
        const nodeId = this.metropolitanStation
        if (!nodeId) return state
        const homeId = homeStationId(MetropolitanId)
        return {
            ...state,
            stations: state.stations.map((station) =>
                station.id === homeId
                    ? {
                          id: homeId,
                          companyId: MetropolitanId,
                          status: 'placed' as const,
                          position: {
                              locationId: LondonLocationId,
                              nodeId,
                              slot: metropolitanHomeSlot1822(this.gameState, nodeId)
                          }
                      }
                    : station
            )
        }
    }
    readonly privateOffers = $derived.by((): readonly PrivateOffer[] => {
        const playerId = this.me
        if (!playerId || !this.can('AcquirePrivate')) return []
        const companyId = this.operatingCompanyId()
        const state = this.gameState
        const full =
            trainsCountingForLimit(state, TrainRules1822, companyId).length >=
            TrainRules1822.trainLimit(state, companyId)
        return acquirablePrivates1822(state, playerId).map(({ id }) => {
            const train = PrivateTrains1822[id]
            const counts =
                !!train &&
                TrainRules1822.countsForLimit?.(state, { ...train, status: 'market' }) !== false
            const agreementPlayerId = privateAgreementPlayerId1822(state, companyId, id)
            return {
                privateCompanyId: id,
                choices: acquisitionChoices1822(state, companyId, id),
                needsDiscard: counts && full,
                ...(agreementPlayerId ? { agreementPlayerId } : {})
            }
        })
    })
    /** The operating company's trains that count towards its limit, one of which a discard names. */
    readonly limitedTrains = $derived.by((): readonly Train[] =>
        this.gameState.operatingSet && nextOperatingCompany(this.gameState)
            ? trainsCountingForLimit(this.gameState, TrainRules1822, this.operatingCompanyId())
            : []
    )
    /** The private company chosen to acquire and how it is taken up, while that is being decided. */
    readonly privateDraft = $derived.by(() => this.choices.privateDraft())
    async choosePrivate(offer: PrivateOffer): Promise<void> {
        if (!this.choices.choosePrivate(offer, this.limitedTrains[0]?.id))
            await this.acquirePrivate(offer.privateCompanyId, {})
    }
    changePrivateTerms(change: PrivateTerms): void {
        this.choices.changePrivateTerms(change)
    }
    async acquireChosenPrivate(): Promise<void> {
        const draft = this.privateDraft
        assertExists(draft, 'Choose the private company to acquire')
        const { privateCompanyId, ...terms } = draft
        await this.acquirePrivate(privateCompanyId, terms)
    }
    private async acquirePrivate(privateCompanyId: string, terms: PrivateTerms): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(AcquirePrivate, {
                companyId: this.operatingCompanyId(),
                privateCompanyId,
                ...terms
            })
        )
        this.choices.private.clear()
    }
    readonly discountTokens = $derived.by((): readonly DiscountTokenKind[] =>
        this.me && this.can('UseDiscountToken')
            ? usableDiscountTokens1822(this.gameState, this.me)
            : []
    )
    async useDiscountToken(kind: DiscountTokenKind): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(UseDiscountToken, {
                companyId: this.operatingCompanyId(),
                kind
            })
        )
    }
    readonly movableStackCards = $derived.by((): readonly string[] =>
        this.me && this.can('MoveStackCard') ? movableStackCards1822(this.gameState, this.me) : []
    )
    /** The certificate chosen to move within its stack with P17. */
    readonly stackCard = $derived(this.choices.stackCard.value('choice'))
    chooseStackCard(lotId: string): void {
        this.choices.stackCard.choose('choice', lotId)
    }
    async moveStackCard(to: 'top' | 'bottom'): Promise<void> {
        const lotId = this.stackCard
        assertExists(lotId, 'Choose the certificate to move')
        await this.applyAction(
            this.createPlayerAction(MoveStackCard, {
                companyId: this.operatingCompanyId(),
                lotId,
                to
            })
        )
        this.choices.stackCard.clear()
    }
    readonly stationSwaps = $derived(
        this.me && this.can('SwapStationToken') ? stationSwaps1822(this.gameState, this.me) : []
    )
    async swapStationToken(direction: 'to-available' | 'to-exchange'): Promise<void> {
        await this.applyAction(
            this.createPlayerAction(SwapStationToken, {
                companyId: this.operatingCompanyId(),
                direction
            })
        )
    }

    // After its trains a major company acquires a minor (§5.18, §5.19).
    readonly minorAcquisitions = $derived.by((): readonly MinorAcquisition1822[] =>
        this.me && this.can('AcquireMinor') ? minorAcquisitions1822(this.gameState, this.me) : []
    )
    /** The minor company chosen to acquire and how it is taken, while that is being decided. */
    readonly minorDraft = $derived.by(() => this.choices.minorDraft())
    readonly draftedAcquisition = $derived(
        this.minorAcquisitions.find((offer) => offer.minorId === this.minorDraft?.minorId)
    )
    chooseMinor(offer: MinorAcquisition1822): void {
        this.choices.chooseMinor(offer)
    }
    changeMinorTerms(change: Partial<MinorTerms>): void {
        this.choices.changeMinorTerms(change)
    }
    /** Marks a train to discard or keeps it after all, never more than the acquisition must discard. */
    toggleMinorDiscard(trainId: string): void {
        const offer = this.draftedAcquisition
        assertExists(offer, 'Choose the minor company to acquire')
        this.choices.toggleMinorDiscard(trainId, offer.excessTrains)
    }
    /** The trains of the major and the minor it is acquiring that count towards the limit. */
    readonly acquisitionTrains = $derived.by((): readonly Train[] => {
        const offer = this.draftedAcquisition
        if (!offer) return []
        return [
            ...trainsCountingForLimit(this.gameState, TrainRules1822, offer.companyId),
            ...trainsCountingForLimit(this.gameState, TrainRules1822, offer.minorId)
        ]
    })
    readonly canAcquireMinor = $derived.by(() => {
        const offer = this.draftedAcquisition
        const draft = this.minorDraft
        return !!offer && !!draft && draft.discardTrainIds.length === offer.excessTrains
    })
    async acquireMinor(): Promise<void> {
        const offer = this.draftedAcquisition
        const draft = this.minorDraft
        assertExists(offer, 'Choose the minor company to acquire')
        assertExists(draft, 'Choose the minor company to acquire')
        await this.applyAction(
            this.createPlayerAction(AcquireMinor, { companyId: offer.companyId, ...draft })
        )
        this.choices.minor.clear()
    }

    /**
     * A major's offer for a minor company another player directs, waiting on that director's
     * answer, with what the major pays them on its terms (§5.18.1, §5.18.3).
     */
    readonly acquisitionOffer = $derived.by(() => {
        const offer = this.gameState.acquisitionOffer
        return offer ? { ...offer, payment: offeredPayment1822(this.gameState) } : undefined
    })
    readonly canAnswerAcquisition = $derived(this.can('AnswerAcquisition'))
    /** A company's request for a private company another player holds, awaiting their answer (§3.1.2). */
    readonly privateOffer = $derived(this.gameState.privateOffer)
    readonly canAnswerPrivateOffer = $derived(this.can('AnswerPrivateOffer'))
    async answerPrivateOffer(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerPrivateOffer, { accept }))
    }
    async answerAcquisition(accept: boolean): Promise<void> {
        await this.applyAction(this.createPlayerAction(AnswerAcquisition, { accept }))
    }

    override get titleOperatingModes(): readonly TitleOperatingMode[] {
        const { machineState } = this.gameState
        if (machineState === 'LayingTrack') {
            if (this.metropolitanHomeDue)
                return [{ id: 'metropolitan', label: 'Metropolitan home', shortLabel: 'Home' }]
            return [
                ...(this.firstTrain
                    ? [{ id: 'first-train', label: 'Buy an L train', shortLabel: 'L train' }]
                    : []),
                ...(this.privateOffers.length ||
                this.discountTokens.length ||
                this.movableStackCards.length ||
                this.stationSwaps.length
                    ? [{ id: 'privates', label: 'Private companies', shortLabel: 'Privates' }]
                    : [])
            ]
        }
        if (machineState === 'BuyingTrains' && this.minorAcquisitions.length)
            return [{ id: 'acquire-minor', label: 'Acquire a minor', shortLabel: 'Acquire' }]
        return []
    }

    protected override titleAwaitedDecision(state: HydratedState1822): AwaitedDecision | undefined {
        const declarer = cashDeclarationDue1822(state)
        if (declarer)
            return {
                title: 'Cash declaration',
                text: `${this.getPlayerName(declarer)} declares their cash for the next stock round’s order`
            }
        if (state.acquisitionOffer)
            return {
                title: 'Offer for a minor company',
                companyId: state.acquisitionOffer.minorId,
                text: `${this.getPlayerName(state.acquisitionOffer.playerId)} answers ${this.companyName(state.acquisitionOffer.companyId)}’s offer for ${this.companyName(state.acquisitionOffer.minorId)}`
            }
        if (state.privateOffer)
            return {
                title: 'Request for a private company',
                companyId: state.privateOffer.companyId,
                text: `${this.getPlayerName(state.privateOffer.playerId)} answers ${this.companyName(state.privateOffer.companyId)}’s request for ${state.privateOffer.privateCompanyId}`
            }
        if (state.machineState === 'LayingTrack' && metropolitanHomeDue1822(state))
            return {
                title: 'Metropolitan Railway',
                companyId: MetropolitanId,
                text: `The Metropolitan Railway chooses its ${placeReference(LondonLocationId)} station`
            }
        return undefined
    }
}
