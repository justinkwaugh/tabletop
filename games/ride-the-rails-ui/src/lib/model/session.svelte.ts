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
    TakeShare,
    isBuildingTurnOf,
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
    private shownHexId: HexId | undefined = $state()
    private spotlight: RailroadSpotlight | undefined = $state()

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                BuildStageOrder,
                () => this.buildStage,
                (stage) => (this.buildStage = stage)
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
        boardOffer(this.gameState, this.offeredHexes, this.buildHexId)
    )

    // U-1, U-2, U-5: a lit hex places or asks which railroad; any other hex is shown.
    async pressHex(hexId: HexId) {
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
            this.gameState.machineState === MachineState.Riding &&
            HydratedPassJourney.canPass(this.gameState, playerId)
        )
    })

    async passJourney() {
        this.closeHexDetail()
        if (this.canPassJourney) {
            await this.applyAction(this.createPlayerAction(PassJourney, {}))
        }
    }

    get hexDetailHexId(): HexId | undefined {
        return this.shownHexId
    }

    hexDetailInSidePanel = $derived(this.boardOffer.scrim !== undefined)

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

    override beforeNewState(transition: PresentedTransition) {
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
}
