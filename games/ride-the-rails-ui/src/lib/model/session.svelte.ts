import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition
} from '@tabletop/frontend-components'
import {
    cityIn,
    EndBuilding,
    MachineState,
    PlaceLocomotive,
    RideJourney,
    TakeShare,
    isBuildingTurnOf,
    isRidingPlayer,
    shareableRailroads,
    type BonusId,
    type HexId,
    type HydratedRideTheRailsGameState,
    type Link,
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
import { Flights } from '$lib/animators/flights.svelte.js'
import { boardGeometry, type BoardGeometry } from '$lib/utils/boardGeometry.js'
import { lastJourneyLinks } from '$lib/utils/boardPieces.js'
import { MAP_LAYOUTS, type MapLayout } from '$lib/utils/mapLayouts.js'
import {
    EMPTY_JOURNEY_OFFER,
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
    cutDraftLinks,
    linksKeptAt,
    openRailroadChoice,
    pickJourneyStart,
    pushDraftLink,
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

    /** The displayed state's board: its map's hexes, extents and fitted scale (R-8). */
    boardFrame: BoardGeometry = $derived(boardGeometry(this.gameState.mapId))

    /** What the displayed map's sea holds: its title and legend. */
    mapLayout: MapLayout = $derived(MAP_LAYOUTS[this.gameState.mapId])

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

    // R-3.1, R-1.4, R-1.1
    shareChoices: RailroadId[] = $derived(
        this.takingShare ? shareableRailroads(this.gameState) : []
    )

    async takeShare(railroadId: RailroadId) {
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

    // Contract, Build: the deciding seat's building turn, named by the action it began at, so its
    // view's zoom tells a new turn from the next placement of the same one.
    buildingTurn: string | undefined = $derived.by(() => {
        const playerId = this.myPlayerId
        const state = this.gameState
        if (
            playerId === undefined ||
            state.result ||
            state.machineState !== MachineState.Building ||
            !isBuildingTurnOf(state, playerId)
        ) {
            return undefined
        }
        return `${playerId} from ${state.turnManager.currentTurn()?.start}`
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
        // A bonus's description never stays over the offer a press opens.
        this.closeBonusDescription()
        if (this.journeyRiderId) {
            this.pressJourneyHex(hexId)
            return
        }
        const offered = this.offeredHexes.find((hex) => hex.hexId === hexId)
        if (!offered) {
            return
        }
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
        const offered = this.offeredHexes.find((hex) => hex.hexId === hexId)
        if (offered?.placements.some((placement) => placement.railroadId === railroadId)) {
            await this.applyAction(this.createPlayerAction(PlaceLocomotive, { railroadId, hexId }))
        }
    }

    // R-3.2.1: the turn may end after any number of placements, none included.
    async endBuilding() {
        if (this.building) {
            await this.applyAction(this.createPlayerAction(EndBuilding, {}))
        }
    }

    journeyDraft: JourneyDraft | undefined = $derived(this.offeredJourney.draft)

    // R-3.3.1, R-3.3.2, R-3.3.3: the passenger cities to start from, then the cities to extend to.
    journeyLit: JourneyCity[] = $derived(this.offeredJourney.lit)

    // R-3.3.2: the railroads that can make the link to a city, with what each pays the seat.
    journeyPopup: JourneyPopup | undefined = $derived(this.offeredJourney.popup)

    // R-3.3.4, R-3.3.5: what RideJourney would pay now.
    journeyPreview: JourneyPreview | undefined = $derived(this.offeredJourney.preview)

    // U-7: the last journey, as this viewer's board draws it.
    lastJourney: readonly Link[] = $derived(
        this.flights.drawnJourney ??
            lastJourneyLinks(this.actions, {
                isMyTurn: this.isMyTurn,
                isViewingHistory: this.isViewingHistory
            })
    )

    canRideJourney = $derived(this.journeyPreview !== undefined)

    private pressJourneyHex(hexId: HexId) {
        const offer = this.offeredJourney
        // A press on a city the route already reaches cuts it back to there; on the start, back
        // to the start alone, and a second press on the start drops the draft.
        const pressed = cityIn(hexId)
        const kept =
            offer.draft && pressed
                ? linksKeptAt(offer.draft.startCityId, offer.draft.draftLinks, pressed.id)
                : undefined
        if (offer.draft && kept !== undefined) {
            const links = offer.draft.draftLinks
            if (links.length === 0) {
                this.journeyStage = {}
            } else if (kept < links.length) {
                this.journeyStage = cutDraftLinks(this.heldJourney, kept)
            }
            return
        }
        const city = offer.lit.find((lit) => lit.hexId === hexId)
        if (!city) {
            return
        }
        this.journeyStage = this.journeyStageAfterPress(offer, city)
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
            this.journeyStage = pushDraftLink(this.heldJourney, {
                cityId: popup.cityId,
                railroadId
            })
        }
    }

    /**
     * The journey just sent. Its draft is put away at once so the passenger can travel on the
     * flight layer, but the action panel keeps showing it until the new Game State is shown.
     */
    sentJourney: { draft: JourneyDraft; preview: JourneyPreview } | undefined = $state.raw()

    // R-3.3.1, R-3.3.2, R-X.1: the seat sends the hexes of the route it named.
    async rideJourney() {
        const draft = this.journeyDraft
        const preview = this.journeyPreview
        if (draft && preview && this.canRideJourney) {
            this.sentJourney = { draft, preview }
            await this.applyAction(this.createPlayerAction(RideJourney, { links: draft.links }))
        }
    }

    spotlightRailroadId: RailroadId | undefined = $derived(this.spotlight?.railroadId)

    // Contract, Build: a pressed spotlight narrows the building zoom; a hover never moves the view.
    heldRailroadId: RailroadId | undefined = $derived(
        this.spotlight?.held ? this.spotlight.railroadId : undefined
    )

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

    // Contract, Turn header: this viewer's own choice to see the claimed Transcontinental line,
    // hidden until asked for. It is kept from turn to turn and in History View.
    private transcontinentalLineWanted = $state(false)

    /** The viewer's choice, which the claim's animator reads while the shown line is still open. */
    get wantsTranscontinentalLine(): boolean {
        return this.transcontinentalLineWanted
    }

    /** The Transcontinental chip's toggle once the line is claimed; none while it is open. */
    transcontinentalLineToggle: { shown: boolean } | undefined = $derived(
        this.gameState.transcontinental ? { shown: this.transcontinentalLineWanted } : undefined
    )

    /** R-4.3.3: whether the board draws the claimed line. */
    showsTranscontinentalLine: boolean = $derived(this.transcontinentalLineToggle?.shown === true)

    toggleTranscontinentalLine() {
        if (this.transcontinentalLineToggle) {
            this.transcontinentalLineWanted = !this.transcontinentalLineWanted
        }
    }

    // Contract, Turn header: the bonus chip's description, this viewer's own, one open at a time.
    // It closes when the turn changes or the board is pressed, so it never stays over the deciding
    // seat's controls.
    private bonusDescriptionOpen: BonusId | undefined = $state()

    /** The bonus whose description is open, if any. */
    get openBonusDescription(): BonusId | undefined {
        return this.bonusDescriptionOpen
    }

    toggleBonusDescription(bonusId: BonusId) {
        this.bonusDescriptionOpen = this.bonusDescriptionOpen === bonusId ? undefined : bonusId
    }

    closeBonusDescription() {
        this.bonusDescriptionOpen = undefined
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

    override beforeNewState(_transition: PresentedTransition) {
        this.flights.settle()
        this.sentJourney = undefined
        // A state with no transition behind it is a change of view (another seat's perspective),
        // which closes it as a new turn does.
        const incoming = this.incomingGameState
        if (!incoming || turnOf(incoming) !== turnOf(this.gameState)) {
            this.closeBonusDescription()
        }
    }
}

/** The turn under way: its seat and the action it began at, or the game's end. */
function turnOf(state: HydratedRideTheRailsGameState): string {
    const turn = state.turnManager.currentTurn()
    return state.result ? 'end' : `${turn?.playerId} from ${turn?.start}`
}
