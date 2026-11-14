import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Capture,
    isPlaceMarble,
    PlaceMarble,
    ZertzPreferenceDefinition,
    type HydratedZertzGameState,
    type ZertzPreferences,
    type MarbleColor,
    type ZertzGameState
} from '@tabletop/zertz'
import {
    restagedZertzSelection,
    setZertzSelection,
    ZertzStageOrder,
    type ZertzSelection
} from './stagedSelection.js'
import { includesCoords, viewOf, type BoardView } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<ZertzGameState, HydratedZertzGameState>
>[0]

export class ZertzGameSession extends GameSession<ZertzGameState, HydratedZertzGameState> {
    selection: ZertzSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: ZertzSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    // The move being undone. Undo takes your marble back onto its ring, staged as you chose it,
    // and a further Undo takes it off the ring.
    undoingMove: PlaceMarble | undefined
    moveInterrupter: MoveInterrupter | undefined

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                ZertzStageOrder,
                () => this.ownSelection,
                (selection) => (this.selection = selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof ZertzPreferences> =
        this.createPreferences(ZertzPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)
    // The board seen from the far side, half a turn round.
    turned: boolean = $derived(this.preferences.values.turned)
    view: BoardView = $derived(viewOf(this.turned))

    notation: BoardNotation = $derived(
        boardNotation(this.view.frame(this.gameState.setup).positions, this.view)
    )

    canPlace = $derived(this.canAct(ActionType.PlaceMarble))
    canCapture = $derived(this.canAct(ActionType.Capture))

    placeableColors: MarbleColor[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canPlace && playerId ? this.gameState.placeableColors(playerId) : []
    })

    chosenColor: MarbleColor | undefined = $derived.by(() => {
        const manual = this.ownSelection.color?.value
        if (manual !== undefined && this.placeableColors.includes(manual)) {
            return manual
        }
        return this.placeableColors.length === 1 ? this.placeableColors[0] : undefined
    })

    jumpers: AxialCoordinates[] = $derived.by(() => {
        if (!this.canCapture) {
            return []
        }
        const froms: AxialCoordinates[] = []
        for (const jump of this.gameState.openJumps()) {
            if (!includesCoords(froms, jump.from)) {
                froms.push(jump.from)
            }
        }
        return froms
    })

    chosenJumper: AxialCoordinates | undefined = $derived.by(() => {
        const manual = this.ownSelection.jumper?.value
        if (manual !== undefined && includesCoords(this.jumpers, manual)) {
            return manual
        }
        return this.jumpers.length === 1 ? this.jumpers[0] : undefined
    })

    landingRings: AxialCoordinates[] = $derived(
        this.chosenJumper
            ? this.gameState.board.jumpsFrom(this.chosenJumper).map((jump) => jump.to)
            : []
    )

    private vacantRings: AxialCoordinates[] = $derived(
        this.gameState.board.vacantRings().map((ring) => ring.coords)
    )

    // The ring your marble stands on, staged until you choose a ring to remove.
    chosenPlace: AxialCoordinates | undefined = $derived.by(() => {
        const place = this.ownSelection.place?.value
        if (place === undefined || this.chosenColor === undefined) return undefined
        return includesCoords(this.vacantRings, place) ? place : undefined
    })

    placementRings: AxialCoordinates[] = $derived(
        this.chosenColor && !this.chosenPlace ? this.vacantRings : []
    )

    removableRings: AxialCoordinates[] = $derived.by(() => {
        const place = this.chosenPlace
        const color = this.chosenColor
        if (place === undefined || color === undefined) return []
        return this.removableAfterPlacing(color, place)
    })

    // Choosing the staged marble again changes its colour, when there is another to place.
    canChangeStagedColor: boolean = $derived(
        this.chosenPlace !== undefined && this.placeableColors.length > 1
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // A move's motion is laid out in the view it started in, so turning the board lands it.
    toggleTurned() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    // Only a placement that removed a ring stood staged before it went in, so only it restages.
    override willUndo(action: GameAction): void {
        this.undoingMove = isPlaceMarble(action) && action.remove !== undefined ? action : undefined
    }

    get presentingState(): HydratedZertzGameState | undefined {
        return this.incomingGameState
    }

    // The action a step back to `to` takes back.
    undoneAction(to: Pick<ZertzGameState, 'actionCount'>): GameAction | undefined {
        return this.actions.find((candidate) => candidate.index === to.actionCount)
    }

    // None when the view passes to the other player as the Undo lands, as the harness's
    // Non-active view does.
    restagedMove(to: Pick<ZertzGameState, 'actionCount'>): PlaceMarble | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
        const incoming = this.presentingState
        const move = kind === 'undo' && incoming ? this.restagedMove(incoming) : undefined
        if (move) {
            this.selection = restagedZertzSelection(move, this.hadColorChoice(move))
            this.selectionOwner = move.playerId
        }
        if (kind !== 'undo') this.undoingMove = undefined
    }

    // Whether the player of a move taken back could have placed another colour.
    private hadColorChoice(move: PlaceMarble): boolean {
        const state = this.incomingGameState ?? this.gameState
        return state.placeableColors(move.playerId).length > 1
    }

    // A move's motion runs on the state it started from, whose choices still show as they fade.
    private get moving(): boolean {
        return this.updatingVisibleState
    }

    chooseColor(color: MarbleColor) {
        if (this.moving || !this.placeableColors.includes(color)) {
            return
        }
        const toggledOff = this.ownSelection.color?.value === color
        const place = this.chosenPlace
        if (toggledOff || place === undefined) {
            this.select(
                setZertzSelection(this.ownSelection, 'color', toggledOff ? undefined : color)
            )
            return
        }
        // A marble already staged in its ring changes to the colour chosen.
        void this.stagePlacement(setZertzSelection(this.ownSelection, 'color', color), place)
    }

    chooseJumper(coords: AxialCoordinates) {
        if (this.moving || !includesCoords(this.jumpers, coords)) {
            return
        }
        const current = this.ownSelection.jumper?.value
        const toggledOff = current !== undefined && sameCoordinates(current, coords)
        this.select(setZertzSelection(this.ownSelection, 'jumper', toggledOff ? undefined : coords))
    }

    // Tapping where there is nothing to choose takes a staged marble off its ring, or else lets go
    // of a chosen colour or jumper.
    letGo() {
        if (this.moving) return
        if (this.ownSelection.place !== undefined) {
            this.select(setZertzSelection(this.ownSelection, 'place', undefined))
        } else if (this.hasLocalSelection) {
            this.select(setZertzSelection(this.ownSelection, 'color', undefined))
        }
    }

    // A placement that leaves a ring to remove stands staged on its ring; one that ends the move
    // goes straight in, as does the removal that completes a staged one.
    async chooseRing(coords: AxialCoordinates) {
        if (this.moving) return
        if (includesCoords(this.removableRings, coords)) {
            await this.placeMarble(coords)
        } else if (includesCoords(this.landingRings, coords)) {
            await this.capture(coords)
        } else if (includesCoords(this.placementRings, coords)) {
            await this.stagePlacement(this.ownSelection, coords)
        }
    }

    // The next colour takes the staged marble's place.
    async changeStagedColor() {
        const place = this.chosenPlace
        const color = this.chosenColor
        if (this.moving || place === undefined || color === undefined) return
        if (!this.canChangeStagedColor) return
        const colors = this.placeableColors
        const next = colors[(colors.indexOf(color) + 1) % colors.length]
        await this.stagePlacement(setZertzSelection(this.ownSelection, 'color', next), place)
    }

    private select(selection: ZertzSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }

    private async stagePlacement(selection: ZertzSelection, place: AxialCoordinates) {
        this.select(setZertzSelection(selection, 'place', place))
        const color = this.chosenColor
        if (color !== undefined && this.removableAfterPlacing(color, place).length === 0) {
            await this.placeMarble()
        }
    }

    private removableAfterPlacing(color: MarbleColor, place: AxialCoordinates) {
        const playerId = this.myPlayer?.id
        if (playerId === undefined) return []
        return this.gameState.removableAfterPlacing(playerId, color, place)
    }

    private async placeMarble(remove?: AxialCoordinates) {
        const color = this.chosenColor
        const coords = this.chosenPlace
        if (color === undefined || coords === undefined) {
            return
        }
        await this.applyAction(
            this.createPlayerAction(PlaceMarble, {
                color,
                coords,
                ...(remove === undefined ? {} : { remove })
            })
        )
    }

    private async capture(to: AxialCoordinates) {
        const from = this.chosenJumper
        if (from === undefined) {
            return
        }
        await this.applyAction(this.createPlayerAction(Capture, { from, to }))
    }
}
