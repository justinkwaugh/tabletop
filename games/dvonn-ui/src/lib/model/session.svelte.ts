import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { Color, sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    ChooseColor,
    DvonnVersion,
    isMoveStack,
    MachineState,
    MoveStack,
    PlacePiece,
    DvonnPreferenceDefinition,
    spaceKey,
    type HydratedDvonnGameState,
    type DvonnGameState,
    type DvonnPreferences,
    type Piece,
    type PieceColor,
    versionFromConfig
} from '@tabletop/dvonn'
import { DvonnStageOrder, setDvonnSelection, type DvonnSelection } from './stagedSelection.js'
import { PIECE_MODEL, type PieceModel } from '$lib/board/pieceGeometry.js'
import { pieceTone, toneOf, type Tone } from '$lib/board/pieceStyle.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<DvonnGameState, HydratedDvonnGameState>
>[0]

export class DvonnGameSession extends GameSession<DvonnGameState, HydratedDvonnGameState> {
    selection: DvonnSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: DvonnSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    // The move your own Undo takes back, whose stack is chosen again as it lands.
    private undoingMove: MoveStack | undefined
    moveInterrupter: MoveInterrupter | undefined
    // Until the state lands: the pieces each player has in hand once a step that places a piece
    // ends, set as it starts, so a piece dropping onto the board is not counted in hand too.
    private landingHands: Map<string, PieceColor[]> | undefined = $derived.by(() => {
        void this.gameState
        return undefined
    })

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                DvonnStageOrder,
                () => this.ownSelection,
                (selection) => this.select(selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof DvonnPreferences> =
        this.createPreferences(DvonnPreferenceDefinition)

    graphBoard: boolean = $derived(this.preferences.values.graphBoard)

    // A move's motion is laid out in the board it started on, so changing how the board or its
    // stacks are drawn lands it.
    toggleGraphBoard() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ graphBoard: !this.graphBoard })
    }

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // The board seen from the far side of the table, so what a stack hides comes in front of it.
    turned: boolean = $derived(this.preferences.values.turned)

    toggleTurned() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    // Stacks past the full height shrink to it unless a player would rather see every piece
    // stacked whole, turning the board to see past a tall one.
    shrinkStacks: boolean = $derived(this.preferences.values.shrinkStacks)

    toggleShrinkStacks() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ shrinkStacks: !this.shrinkStacks })
    }

    // A badge on each stack with its height.
    heightBadges: boolean = $derived(this.preferences.values.heightBadges)

    // A move's badges are gathered when it starts, so a badge added mid-move would wait at the old
    // space; the toggle lands the move first.
    toggleHeightBadges() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ heightBadges: !this.heightBadges })
    }

    pieceModel: PieceModel = $derived(
        this.shrinkStacks ? PIECE_MODEL : { ...PIECE_MODEL, cap: Number.POSITIVE_INFINITY }
    )

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canMove = $derived(this.canAct(ActionType.MoveStack))
    canChooseColor = $derived(this.canAct(ActionType.ChooseColor))

    // I set, you choose: the first player places both colours' pieces, so each placement says
    // whose it is.
    private setsBoth: boolean = $derived(
        versionFromConfig(this.game.config) === DvonnVersion.ISetYouChoose
    )

    // I set, you choose, until the other player takes a colour: neither player has one yet.
    colorsOpen: boolean = $derived(
        this.setsBoth &&
            (this.gameState.machineState === MachineState.PlacingPieces ||
                this.gameState.machineState === MachineState.ChoosingColor)
    )

    // What a card says in place of its pieces while the colours are open. The setter's card holds
    // the pieces still to place.
    cardNote(playerId: string): string | undefined {
        if (!this.colorsOpen) return undefined
        const setter = playerId === this.gameState.firstPlayerId()
        if (this.gameState.machineState === MachineState.PlacingPieces) {
            return setter ? undefined : 'Takes White or Black when the board is set'
        }
        return setter ? 'Set the board, plays the colour left' : 'Taking White or Black'
    }

    placeable: AxialCoordinates[] = $derived(
        this.canPlace ? this.gameState.board.vacantSpaces() : []
    )

    // A placement puts down a DVONN piece until all three are on the board.
    placingDvonn: boolean = $derived(this.canPlace && this.gameState.placesDvonnNext())

    placingColor: PieceColor | undefined = $derived(
        this.canPlace && this.setsBoth && !this.placingDvonn
            ? this.gameState.colorToPlace()
            : undefined
    )

    movable: AxialCoordinates[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canMove) return []
        if (playerId === undefined) throw Error('Only a seated player moves')
        return this.gameState.movableStacks(playerId)
    })

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => spaceKey(coords) === this.ownSelection.from?.value)
    )

    destinations: AxialCoordinates[] = $derived(
        this.chosenFrom ? this.gameState.board.destinationsFrom(this.chosenFrom) : []
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    // Once a move is played, its motion runs on the state it started from, whose choices still
    // show as they fade; taps on them do nothing until the new state lands.
    private get moving(): boolean {
        return this.updatingVisibleState
    }

    toneOfPlayer(playerId: string): Tone {
        return toneOf(this.gameState.getPlayerState(playerId).color)
    }

    toneOfPiece(piece: Piece): Tone {
        return pieceTone(piece, (playerId) => this.toneOfPlayer(playerId))
    }

    // The colours of the pieces a player has still to place, White's first.
    handOf(playerId: string): PieceColor[] {
        return this.landingHands?.get(playerId) ?? this.handIn(this.gameState, playerId)
    }

    // Each player places their own pieces, except in I set, you choose, where the first player
    // holds both colours' pieces and the other player none.
    private handIn(state: HydratedDvonnGameState, playerId: string): PieceColor[] {
        const colors: PieceColor[] = this.setsBoth
            ? playerId === state.firstPlayerId()
                ? [Color.White, Color.Black]
                : []
            : [state.getPlayerState(playerId).color as PieceColor]
        return colors.flatMap((color) =>
            Array.from({ length: state.piecesInHand(state.playerWith(color)) }, () => color)
        )
    }

    // A step that brings pieces onto the board starts: count each hand as it will be.
    landHands(to: HydratedDvonnGameState) {
        this.landingHands = new Map(
            to.players.map((player) => [player.playerId, this.handIn(to, player.playerId)])
        )
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isMoveStack(action) ? action : undefined
    }

    get presentingState(): HydratedDvonnGameState | undefined {
        return this.incomingGameState
    }

    // The move your own Undo takes back from `to`, whose stack is chosen again. None when the
    // view passes to the other player as the Undo lands, as the harness's Non-active view does.
    restagedMove(to: Pick<DvonnGameState, 'actionCount'>): MoveStack | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    // Undoing your move hops the stack home and leaves it chosen; the next Undo puts it down.
    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
        const incoming = this.presentingState
        const move = kind === 'undo' && incoming ? this.restagedMove(incoming) : undefined
        if (move) {
            this.selection = setDvonnSelection({}, 'from', spaceKey(move.from))
            this.selectionOwner = move.playerId
        }
        this.undoingMove = undefined
    }

    // Tapping where there is nothing to choose lets go of a chosen stack.
    letGo() {
        if (this.moving || this.chosenFrom === undefined) return
        this.select(setDvonnSelection(this.ownSelection, 'from', undefined))
    }

    isClickable(coords: AxialCoordinates): boolean {
        return (
            includesCoords(this.placeable, coords) ||
            includesCoords(this.destinations, coords) ||
            includesCoords(this.movable, coords)
        )
    }

    async chooseSpace(coords: AxialCoordinates) {
        if (this.moving) return
        if (includesCoords(this.placeable, coords)) {
            await this.applyAction(this.createPlayerAction(PlacePiece, { coords }))
        } else if (this.chosenFrom && includesCoords(this.destinations, coords)) {
            await this.applyAction(
                this.createPlayerAction(MoveStack, { from: this.chosenFrom, to: coords })
            )
        } else if (includesCoords(this.movable, coords)) {
            const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, coords)
            this.select(
                setDvonnSelection(this.ownSelection, 'from', same ? undefined : spaceKey(coords))
            )
        }
    }

    async chooseColor(color: PieceColor) {
        if (this.moving || !this.canChooseColor) return
        await this.applyAction(this.createPlayerAction(ChooseColor, { color }))
    }

    private select(selection: DvonnSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }
}
