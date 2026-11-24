import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    assertExists,
    Color,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    Capture,
    ChooseColor,
    isCapture,
    isStack,
    MachineState,
    Pass,
    PIECE_KINDS,
    PieceKind,
    PlacePiece,
    spaceKey,
    Stack,
    TzaarPreferenceDefinition,
    TzaarVersion,
    versionFromConfig,
    type HydratedTzaarGameState,
    type Piece,
    type PieceColor,
    type TzaarGameState,
    type TzaarPreferences
} from '@tabletop/tzaar'
import { setTzaarSelection, TzaarStageOrder, type TzaarSelection } from './stagedSelection.js'
import { toneOf, type ShapePiece, type Tone } from '$lib/board/pieceStyle.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export type KnownMove = Capture | Stack

// Lets the session stop the motion an animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<TzaarGameState, HydratedTzaarGameState>
>[0]

export class TzaarGameSession extends GameSession<TzaarGameState, HydratedTzaarGameState> {
    selection: TzaarSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: TzaarSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )

    // The type the next placement puts down: a tool kept from one placement to the next, so
    // Undo neither takes it back nor clears it.
    private chosenKind: PieceKind = $state(PieceKind.Tott)

    // The move your own Undo takes back, whose stack is chosen again as it lands.
    private undoingMove: KnownMove | undefined
    readonly moveInterrupters = new Set<MoveInterrupter>()

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                TzaarStageOrder,
                () => this.ownSelection,
                (selection) => this.select(selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof TzaarPreferences> =
        this.createPreferences(TzaarPreferenceDefinition)

    rotatedBoard: boolean = $derived(this.preferences.values.rotatedBoard)

    // A move's motion is laid out in the view it started in, so changing the view lands it.
    toggleRotatedBoard() {
        this.interruptMoves()
        this.preferences.set({ rotatedBoard: !this.rotatedBoard })
    }

    // The board seen from the far side, half a turn round, to see behind tall stacks.
    turned: boolean = $derived(this.preferences.values.turned)

    toggleTurned() {
        this.interruptMoves()
        this.preferences.set({ turned: !this.turned })
    }

    shrinkStacks: boolean = $derived(this.preferences.values.shrinkStacks)

    toggleShrinkStacks() {
        this.interruptMoves()
        this.preferences.set({ shrinkStacks: !this.shrinkStacks })
    }

    heightBadges: boolean = $derived(this.preferences.values.heightBadges)

    toggleHeightBadges() {
        this.preferences.set({ heightBadges: !this.heightBadges })
    }

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canCapture = $derived(this.canAct(ActionType.Capture))
    canStack = $derived(this.canAct(ActionType.Stack))
    canPass = $derived(this.canAct(ActionType.Pass))
    canChooseColor = $derived(this.canAct(ActionType.ChooseColor))

    // Whose pieces the next placement puts down: the placer's own, unless the first player is
    // setting an I set, you choose board for both.
    private placingFor: string | undefined = $derived(
        this.canPlace ? this.gameState.ownerOfNextPiece() : undefined
    )

    private setsBoth: boolean = $derived(
        versionFromConfig(this.game.config) === TzaarVersion.ISetYouChoose
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

    placingColor: PieceColor | undefined = $derived(
        this.canPlace && this.setsBoth ? this.gameState.colorToPlace() : undefined
    )

    kindsInHand: PieceKind[] = $derived(
        this.placingFor === undefined ? [] : this.gameState.kindsInHand(this.placingFor)
    )

    // The chosen type while the player still has one; otherwise the next they have.
    placingKind: PieceKind | undefined = $derived(
        this.kindsInHand.includes(this.chosenKind)
            ? this.chosenKind
            : PIECE_KINDS.find((kind) => this.kindsInHand.includes(kind))
    )

    placeable: AxialCoordinates[] = $derived(
        this.canPlace ? this.gameState.board.vacantSpaces() : []
    )

    private captureMoves = $derived(this.canCapture ? this.gameState.captures(this.actorId()) : [])
    private stackMoves = $derived(this.canStack ? this.gameState.stackings(this.actorId()) : [])

    movable: AxialCoordinates[] = $derived(
        [...this.captureMoves, ...this.stackMoves]
            .map((move) => move.from)
            .filter(
                (from, index, all) =>
                    all.findIndex((other) => sameCoordinates(other, from)) === index
            )
    )

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => spaceKey(coords) === this.ownSelection.from?.value)
    )

    captureTargets: AxialCoordinates[] = $derived(this.targetsFrom(this.captureMoves))
    stackTargets: AxialCoordinates[] = $derived(this.targetsFrom(this.stackMoves))

    private targetsFrom(moves: readonly { from: AxialCoordinates; to: AxialCoordinates }[]) {
        const from = this.chosenFrom
        return from
            ? moves.filter((move) => sameCoordinates(move.from, from)).map((move) => move.to)
            : []
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    // Only the player whose turn it is gets choices, so whoever the choices are for is a player.
    private actorId(): string {
        const playerId = this.myPlayer?.id
        assertExists(playerId, 'Only a player has choices')
        return playerId
    }

    // Once a move is played, its motion runs on the state it started from, whose choices still
    // show as they fade; taps on them do nothing until the new state lands.
    private get moving(): boolean {
        return this.updatingVisibleState
    }

    private interruptMoves() {
        for (const interrupter of this.moveInterrupters) interrupter.interrupt()
    }

    toneOfPlayer(playerId: string): Tone {
        return toneOf(this.gameState.getPlayerState(playerId).color)
    }

    shapeOf(piece: Piece): ShapePiece {
        return { tone: this.toneOfPlayer(piece.playerId), kind: piece.kind, seedKey: `${piece.id}` }
    }

    // The tone of the pieces being placed, and how many of a type are left to place.
    placingTone(): Tone {
        return this.toneOfPlayer(this.placingOwner())
    }

    piecesInHand(kind: PieceKind): number {
        return this.gameState.piecesInHand(this.placingOwner(), kind)
    }

    // Whose pieces a player's card counts. While an I set, you choose board is set the setter
    // holds both colours', White's first, and the other player none.
    handOwners(playerId: string): string[] {
        const state = this.gameState
        if (!this.setsBoth || state.machineState !== MachineState.PlacingPieces) return [playerId]
        if (playerId !== state.firstPlayerId()) return []
        return [state.playerWith(Color.White), state.playerWith(Color.Black)]
    }

    private placingOwner(): string {
        assertExists(this.placingFor, 'Only a placement has pieces to place')
        return this.placingFor
    }

    chooseKind(kind: PieceKind) {
        this.chosenKind = kind
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isCapture(action) || isStack(action) ? action : undefined
    }

    get presentingState(): HydratedTzaarGameState | undefined {
        return this.incomingGameState
    }

    // The move your own Undo takes back to `to`. None when the view passes to the other player
    // as the Undo lands, as the harness's Non-active view does.
    restagedMove(to: Pick<TzaarGameState, 'actionCount'>): KnownMove | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    // Undoing your move takes the stack home and leaves it chosen; the next Undo lets go of it.
    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') {
            for (const interrupter of this.moveInterrupters) interrupter.abandon()
        }
        if (kind === 'undo') {
            const incoming = this.presentingState
            assertExists(incoming, 'An Undo presents the state it leads to')
            const move = this.restagedMove(incoming)
            if (move) {
                this.selection = setTzaarSelection({}, 'from', spaceKey(move.from))
                this.selectionOwner = move.playerId
            }
        }
        this.undoingMove = undefined
    }

    isClickable(coords: AxialCoordinates): boolean {
        return (
            includesCoords(this.placeable, coords) ||
            includesCoords(this.captureTargets, coords) ||
            includesCoords(this.stackTargets, coords) ||
            includesCoords(this.movable, coords)
        )
    }

    async chooseSpace(coords: AxialCoordinates) {
        if (this.moving) return
        const from = this.chosenFrom
        if (includesCoords(this.placeable, coords) && this.placingKind !== undefined) {
            await this.applyAction(
                this.createPlayerAction(PlacePiece, { coords, kind: this.placingKind })
            )
        } else if (from && includesCoords(this.captureTargets, coords)) {
            await this.applyAction(this.createPlayerAction(Capture, { from, to: coords }))
        } else if (from && includesCoords(this.stackTargets, coords)) {
            await this.applyAction(this.createPlayerAction(Stack, { from, to: coords }))
        } else if (includesCoords(this.movable, coords)) {
            const same = from !== undefined && sameCoordinates(from, coords)
            this.select(
                setTzaarSelection(this.ownSelection, 'from', same ? undefined : spaceKey(coords))
            )
        }
    }

    // Tapping where there is nothing to choose lets go of a chosen stack; the type chosen for
    // placing stays.
    letGo() {
        if (this.moving || this.chosenFrom === undefined) return
        this.select(setTzaarSelection(this.ownSelection, 'from', undefined))
    }

    async chooseColor(color: PieceColor) {
        if (this.moving || !this.canChooseColor) return
        await this.applyAction(this.createPlayerAction(ChooseColor, { color }))
    }

    async pass() {
        if (this.moving) return
        await this.applyAction(this.createPlayerAction(Pass, {}))
    }

    private select(selection: TzaarSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }
}
