import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition
} from '@tabletop/frontend-components'
import {
    EndBuilding,
    HydratedPassJourney,
    MachineState,
    PassJourney,
    PlaceLocomotive,
    RideJourney,
    TakeShare,
    isBuildingTurnOf,
    isRidingPlayer,
    journeyExists,
    usaCity,
    shareableRailroads,
    type HexId,
    type HydratedRideTheRailsGameState,
    type RailroadId,
    type RideTheRailsGameState
} from '@tabletop/ride-the-rails'
import {
    boardOffer,
    hexNeedingRailroadChoice,
    placementOffer,
    type BoardOffer,
    type OfferedHex
} from './boardOffer.js'
import {
    BuildStageOrder,
    pickBuildHex,
    pickedBuildHex,
    unpickBuildHex,
    type BuildStage
} from './buildStage.js'
import { hexChangedBetween } from './hexDetail.js'
import { Flights } from '$lib/animators/flights.svelte.js'
import { hexDetailPlace } from '$lib/utils/pickMarks.js'
import { isPhoneWidth } from '$lib/utils/phoneLayout.svelte.js'
import {
    EMPTY_JOURNEY_OFFER,
    bestRoute,
    heldJourneyStage,
    journeyBoardOffer,
    journeyOffer,
    type JourneyCity,
    type JourneyDraft,
    type JourneyOffer,
    type JourneyPopup,
    type JourneyPreview
} from './journeyOffer.js'
import {
    JourneyStageOrder,
    closeRailroadChoice,
    openRailroadChoice,
    pickJourneyStart,
    pushDraftLink,
    replaceDraftLinks,
    type JourneyStage
} from './journeyStage.js'

type SessionOptions = ConstructorParameters<
    typeof GameSession<RideTheRailsGameState, HydratedRideTheRailsGameState>
>[0]

type RailroadSpotlight = {
    railroadId: RailroadId
    held: boolean
}

export class RideTheRailsGameSession extends GameSession<
    RideTheRailsGameState,
    HydratedRideTheRailsGameState
> {
    private buildStage: BuildStage = $state({})
    private journeyStage: JourneyStage = $state({})
    private shownHexId: HexId | undefined = $state()
    private spotlight: RailroadSpotlight | undefined = $state()
    readonly flights = new Flights()

    constructor(options: SessionOptions) {
        super(options)
        // A selection already sent is no longer one Undo can step back while its action plays:
        // Undo then takes back the action itself.
        this.localSelections.register(
            undoableStagedSelection(
                BuildStageOrder,
                () => (this.updatingVisibleState ? {} : this.buildStage),
                (stage) => (this.buildStage = stage)
            )
        )
        this.localSelections.register(
            undoableStagedSelection(
                JourneyStageOrder,
                () => (this.updatingVisibleState ? {} : this.heldJourney),
                (stage) => (this.journeyStage = stage)
            )
        )
    }

    myPlayerId = $derived(this.myPlayer?.id)

    canAct = $derived(
        this.isMyTurn &&
            !this.isViewingHistory &&
            !this.updatingVisibleState &&
            !this.gameState.result
    )

    // R-3.3.1: the deciding seat's journey; the draft is kept while the visible state updates.
    private journeyRiderId: string | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        return this.isMyTurn &&
            !this.isViewingHistory &&
            !this.gameState.result &&
            playerId !== undefined &&
            isRidingPlayer(this.gameState, playerId)
            ? playerId
            : undefined
    })

    private heldJourney: JourneyStage = $derived(
        this.journeyRiderId ? heldJourneyStage(this.gameState, this.journeyStage) : {}
    )

    private offeredJourney: JourneyOffer = $derived(
        this.journeyRiderId && !this.updatingVisibleState
            ? journeyOffer(this.gameState, this.heldJourney, this.journeyRiderId)
            : EMPTY_JOURNEY_OFFER
    )

    takingShare = $derived(this.canAct && this.gameState.machineState === MachineState.TakingShares)

    // R-3.1, R-1.4, R-1.1-H1
    shareChoices: RailroadId[] = $derived(
        this.takingShare ? shareableRailroads(this.gameState) : []
    )

    async takeShare(railroadId: RailroadId) {
        this.closeHexDetail()
        if (this.shareChoices.includes(railroadId)) {
            await this.applyAction(this.createPlayerAction(TakeShare, { railroadId }))
        }
    }

    building = $derived.by(() => {
        const playerId = this.myPlayerId
        return (
            this.canAct &&
            playerId !== undefined &&
            this.gameState.machineState === MachineState.Building &&
            isBuildingTurnOf(this.gameState, playerId)
        )
    })

    private offeredHexes: OfferedHex[] = $derived.by(() => {
        const playerId = this.myPlayerId
        return this.building && playerId ? placementOffer(this.gameState, playerId) : []
    })

    buildHexId: HexId | undefined = $derived(
        hexNeedingRailroadChoice(this.offeredHexes, pickedBuildHex(this.buildStage))?.hexId
    )

    boardOffer: BoardOffer = $derived(
        this.journeyRiderId
            ? journeyBoardOffer(this.offeredJourney)
            : boardOffer(this.gameState, this.offeredHexes, this.buildHexId)
    )

    // U-1, U-2, U-5: a lit hex places or asks which railroad; any other hex is shown.
    async pressHex(hexId: HexId) {
        if (this.journeyRiderId) {
            this.pressJourneyHex(hexId)
            return
        }
        const offered = this.offeredHexes.find((hex) => hex.hexId === hexId)
        if (!offered) {
            this.shownHexId = this.shownHexId === hexId ? undefined : hexId
            return
        }
        this.closeHexDetail()
        if (offered.placements.length === 1) {
            await this.placeLocomotive(offered.placements[0].railroadId, hexId)
            return
        }
        this.buildStage =
            this.buildHexId === hexId
                ? unpickBuildHex(this.buildStage)
                : pickBuildHex(this.buildStage, hexId)
    }

    async chooseRailroad(railroadId: RailroadId) {
        const hexId = this.buildHexId
        if (hexId) {
            await this.placeLocomotive(railroadId, hexId)
        }
    }

    // R-3.2, R-4.1, R-4.2: only a placement the offer lights is sent.
    async placeLocomotive(railroadId: RailroadId, hexId: HexId) {
        this.closeHexDetail()
        const offered = this.offeredHexes.find((hex) => hex.hexId === hexId)
        if (offered?.placements.some((placement) => placement.railroadId === railroadId)) {
            await this.applyAction(this.createPlayerAction(PlaceLocomotive, { railroadId, hexId }))
        }
    }

    // R-3.2.1: the turn may end after any number of placements, none included.
    async endBuilding() {
        this.closeHexDetail()
        if (this.building) {
            await this.applyAction(this.createPlayerAction(EndBuilding, {}))
        }
    }

    // R-3.3.1-H1
    canPassJourney = $derived.by(() => {
        const playerId = this.myPlayerId
        return (
            this.canAct &&
            playerId !== undefined &&
            HydratedPassJourney.canPass(this.gameState, playerId)
        )
    })

    async passJourney() {
        this.closeHexDetail()
        if (this.canPassJourney) {
            await this.applyAction(this.createPlayerAction(PassJourney, {}))
        }
    }

    journeyDraft: JourneyDraft | undefined = $derived(this.offeredJourney.draft)

    // R-3.3.1, R-3.3.2, R-3.3.3: the passenger cities to start from, then the cities to extend to.
    journeyLit: JourneyCity[] = $derived(this.offeredJourney.lit)

    // R-3.3.2: the railroads that can make the link to a city, with what each pays the seat.
    journeyPopup: JourneyPopup | undefined = $derived(this.offeredJourney.popup)

    // R-3.3.4, R-3.3.5: what RideJourney would pay now.
    journeyPreview: JourneyPreview | undefined = $derived(this.offeredJourney.preview)

    canRideJourney = $derived(this.journeyPreview !== undefined)

    canChooseBestRoute = $derived(this.journeyDraft !== undefined)

    private pressJourneyHex(hexId: HexId) {
        const offer = this.offeredJourney
        if (offer.draft && this.isJourneyStart(offer.draft, hexId)) {
            this.closeHexDetail()
            this.journeyStage = {}
            return
        }
        const city = offer.lit.find((lit) => lit.hexId === hexId)
        if (!city) {
            this.shownHexId = this.shownHexId === hexId ? undefined : hexId
            return
        }
        this.closeHexDetail()
        this.journeyStage = this.journeyStageAfterPress(offer, city)
    }

    private isJourneyStart(draft: JourneyDraft, hexId: HexId): boolean {
        return usaCity(draft.startCityId).hexId === hexId
    }

    private journeyStageAfterPress(offer: JourneyOffer, city: JourneyCity): JourneyStage {
        const held = this.heldJourney
        if (!offer.draft) {
            return pickJourneyStart(held, city.cityId)
        }
        if (city.railroadIds.length === 1) {
            return pushDraftLink(held, { cityId: city.cityId, railroadId: city.railroadIds[0] })
        }
        return offer.popup?.cityId === city.cityId
            ? closeRailroadChoice(held)
            : openRailroadChoice(held, city.cityId)
    }

    chooseLinkRailroad(railroadId: RailroadId) {
        const popup = this.journeyPopup
        if (popup?.chips.some((chip) => chip.railroadId === railroadId)) {
            this.closeHexDetail()
            this.journeyStage = pushDraftLink(this.heldJourney, {
                cityId: popup.cityId,
                railroadId
            })
        }
    }

    // R-3.3, R-X.1: Best route fills the draft; the seat may Undo links from it and extend again.
    chooseBestRoute() {
        const draft = this.journeyDraft
        const riderId = this.journeyRiderId
        if (!draft || !riderId) {
            return
        }
        const links = bestRoute(this.gameState, draft.startCityId, riderId)
        if (links) {
            this.closeHexDetail()
            this.journeyStage = replaceDraftLinks(this.heldJourney, links)
        }
    }

    // R-3.3.1, R-3.3.2, R-X.1: the seat sends the hexes of the route it named.
    async rideJourney() {
        this.closeHexDetail()
        const draft = this.journeyDraft
        if (draft && this.canRideJourney) {
            await this.applyAction(this.createPlayerAction(RideJourney, { links: draft.links }))
        }
    }

    get hexDetailHexId(): HexId | undefined {
        return this.shownHexId
    }

    hexDetailInSidePanel = $derived(
        hexDetailPlace(this.boardOffer, isPhoneWidth()) === 'side-panel'
    )

    closeHexDetail() {
        this.shownHexId = undefined
    }

    spotlightRailroadId: RailroadId | undefined = $derived(this.spotlight?.railroadId)

    pressRailroad(railroadId: RailroadId) {
        const releases = this.spotlight?.held && this.spotlight.railroadId === railroadId
        this.spotlight = releases ? undefined : { railroadId, held: true }
    }

    hoverRailroad(railroadId: RailroadId) {
        if (!this.spotlight?.held) {
            this.spotlight = { railroadId, held: false }
        }
    }

    leaveRailroad() {
        if (!this.spotlight?.held) {
            this.spotlight = undefined
        }
    }

    // Contract, Verification scenario 23: Undo during a flight ends the motion, then undoes.
    // A staged selection pops without waiting; only an action undo ends the flights first.
    override async undoCommittedAction() {
        if (this.updatingVisibleState && !this.isViewingHistory) {
            this.flights.interrupt()
            await this.waitForVisibleTransitionSettled()
        }
        await super.undoCommittedAction()
    }

    override beforeNewState(transition: PresentedTransition) {
        this.flights.settle()
        const hexId = this.shownHexId
        const incoming = this.incomingGameState
        if (
            hexId &&
            incoming &&
            transition.kind !== 'history' &&
            hexChangedBetween(this.gameState, incoming, hexId)
        ) {
            this.closeHexDetail()
        }
    }

    // R-3.3.1, R-3.3.1-H1: the deciding seat chooses a journey; with none possible it may only pass.
    journeyPossible = $derived(
        this.gameState.machineState === MachineState.Riding && journeyExists(this.gameState)
    )
}
