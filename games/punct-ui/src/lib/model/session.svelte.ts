import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    assertExists,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    dotsOf,
    EndReason,
    isMovePiece,
    isPlacePiece,
    MovePiece,
    PieceKind,
    PlacePiece,
    PunctPreferenceDefinition,
    sameOrientation,
    samePlacementPeriod,
    spaceKey,
    type HydratedPunctBoard,
    type HydratedPunctGameState,
    type PlacedPiece,
    type Placement,
    type PunctGameState,
    type PunctPreferences
} from '@tabletop/punct'
import { PunctStageOrder, setPunctSelection, type PunctSelection } from './stagedSelection.js'
import { includesCoords, viewOf, type BoardView } from '$lib/board/geometry.js'
import { wrapRotation } from '$lib/board/rotation.js'

// A piece standing where the player has put it but not yet committed: brought in from the reserve,
// or moved from where it stood, its PÜNCT's space before the move being `from`.
export type StagedPiece = PlacedPiece & { from?: AxialCoordinates }

// Lets the session stop the motion an animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

// Follows the staged piece as it changes; `released` when its player let it go.
export type StagedFollower = (
    staged: StagedPiece | undefined,
    board: HydratedPunctBoard,
    released: boolean
) => void

// The moves an Undo of your own stages again, as you chose them.
type StepBack = PlacePiece | MovePiece

type SessionOptions = ConstructorParameters<
    typeof GameSession<PunctGameState, HydratedPunctGameState>
>[0]

export class PunctGameSession extends GameSession<PunctGameState, HydratedPunctGameState> {
    selection: PunctSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: PunctSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    // The kind you last chose to bring in, kept from turn to turn.
    preferredKind: PieceKind | undefined = $state()
    // A staged piece lifts off only when its player lets it go, never when history, a new state or
    // another viewer's perspective clears it.
    private changedByPlayer = false
    // The move your own Undo takes back, staged again as the Undo lands.
    private undoingMove: StepBack | undefined
    readonly moveInterrupters = new Set<MoveInterrupter>()
    readonly stagedFollowers = new Set<StagedFollower>()
    private followPending = false
    // Until the state lands: the state a step that brings pieces in leads to, set as it starts,
    // so a piece dropping onto the board is not counted in its reserve too.
    private landingState: HydratedPunctGameState | undefined = $derived.by(() => {
        void this.gameState
        return undefined
    })

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                PunctStageOrder,
                () => (this.moving ? {} : this.ownSelection),
                (selection) => {
                    this.selection = selection
                    this.changedByPlayer = true
                    this.followStaged()
                }
            )
        )
    }

    readonly preferences: TitlePreferences<typeof PunctPreferences> =
        this.createPreferences(PunctPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    showLevels: boolean = $derived(this.preferences.values.showLevels)

    toggleLevels() {
        this.preferences.set({ showLevels: !this.showLevels })
    }

    // A move's motion is laid out in the view it started in, so turning the board lands it.
    rotatedBoard: boolean = $derived(this.preferences.values.rotatedBoard)

    toggleRotatedBoard() {
        this.interruptMoves()
        this.preferences.set({ rotatedBoard: !this.rotatedBoard })
    }

    turned: boolean = $derived(this.preferences.values.turned)

    toggleTurned() {
        this.interruptMoves()
        this.preferences.set({ turned: !this.turned })
    }

    view: BoardView = $derived(viewOf(this.rotatedBoard, this.turned))

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canMovePiece = $derived(this.canAct(ActionType.MovePiece))

    placeKinds: PieceKind[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canPlace || playerId === undefined) return []
        return this.gameState.kindsInReserve(playerId)
    })

    chosenKind: PieceKind | undefined = $derived(
        this.preferredKind !== undefined && this.placeKinds.includes(this.preferredKind)
            ? this.preferredKind
            : this.placeKinds[0]
    )

    // How you last put a new piece, which the next one is turned to, if it fits that way.
    preferredRotation: number | undefined = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return playerId === undefined ? undefined : this.placedRotation(playerId, this.actions)
    })

    entries: Placement[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        const kind = this.chosenKind
        if (playerId === undefined || kind === undefined) return []
        return this.gameState.entriesOf(playerId, kind)
    })

    entryCells: AxialCoordinates[] = $derived(this.uniqueCoords(this.entries))

    movablePieces: PlacedPiece[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canMovePiece || playerId === undefined) return []
        return this.gameState.board.movablePieces(playerId)
    })

    chosenPiece: PlacedPiece | undefined = $derived.by(() => {
        const from = this.ownSelection.from?.value
        if (from === undefined) return undefined
        return this.movablePieces.find((piece) => sameCoordinates(piece.punct, from))
    })

    moves: Placement[] = $derived(
        this.chosenPiece ? this.gameState.board.movesOf(this.chosenPiece) : []
    )

    destinations: AxialCoordinates[] = $derived(this.uniqueCoords(this.moves))

    chosenAt: AxialCoordinates | undefined = $derived.by(() => {
        const at = this.ownSelection.at?.value
        if (at === undefined) return undefined
        const cells = this.chosenPiece ? this.destinations : this.entryCells
        return includesCoords(cells, at) ? at : undefined
    })

    // The ways the piece can lie with its PÜNCT on the chosen space.
    options: Placement[] = $derived.by(() => {
        const at = this.chosenAt
        if (at === undefined) return []
        const placements = this.chosenPiece ? this.moves : this.entries
        return placements.filter((placement) => sameCoordinates(placement.punct, at))
    })

    // The way the piece lies there: as turned, else as it lay or as you last put one.
    chosenOption: Placement | undefined = $derived.by(() => {
        const kind = this.chosenPiece?.kind ?? this.chosenKind
        if (kind === undefined) return undefined
        const turned = this.ownSelection.rotation?.value
        return this.wayRound(this.options, kind, turned ?? this.unturnedRotation())
    })

    staged: StagedPiece | undefined = $derived.by(() => {
        const option = this.chosenOption
        const playerId = this.myPlayer?.id
        if (option === undefined || playerId === undefined) return undefined
        const piece = this.chosenPiece
        if (piece) {
            return { ...option, kind: piece.kind, playerId, id: piece.id, from: piece.punct }
        }
        const kind = this.chosenKind
        if (kind === undefined) return undefined
        return { ...option, kind, playerId, id: this.gameState.board.nextPieceId() }
    })

    stagedCells: AxialCoordinates[] = $derived(
        this.staged ? dotsOf(this.staged.kind, this.staged.punct, this.staged.rotation) : []
    )

    private choosableKeys: Set<number> = $derived(
        new Set((this.chosenPiece ? this.destinations : this.entryCells).map(spaceKey))
    )

    // The chain of spaces that won, once a connection has ended the game.
    winningConnection: AxialCoordinates[] | undefined = $derived.by(() => {
        const state = this.gameState
        if (state.endReason !== EndReason.Connection) return undefined
        const [winnerId] = state.winningPlayerIds
        assertExists(winnerId, 'A connection has a winner')
        const connection = state.board.connection(winnerId)
        assertExists(connection, 'A game won by a connection shows it')
        return connection
    })

    // Once a move is played, its motion runs on the state it started from, whose choices still
    // show as they fade; taps on them do nothing until the new state lands.
    private get moving(): boolean {
        return this.updatingVisibleState
    }

    get releasedByPlayer(): boolean {
        return (
            this.changedByPlayer &&
            !this.isViewingHistory &&
            this.selectionOwner === this.myPlayer?.id
        )
    }

    get presentingState(): HydratedPunctGameState | undefined {
        return this.incomingGameState
    }

    isChoosableSpace(coords: AxialCoordinates): boolean {
        return this.choosableKeys.has(spaceKey(coords))
    }

    // How many of a kind a player has in reserve, less a new piece standing staged.
    inReserve(playerId: string, kind: PieceKind): number {
        const landing = this.landingState
        if (landing) return landing.reserveCount(playerId, kind)
        const staged = this.staged
        const holding =
            staged !== undefined &&
            staged.from === undefined &&
            staged.playerId === playerId &&
            staged.kind === kind
        return this.gameState.reserveCount(playerId, kind) - (holding ? 1 : 0)
    }

    centreCount(playerId: string): number {
        return (this.landingState ?? this.gameState).board.centreCount(playerId)
    }

    // A step that brings pieces in starts: show the reserves as they will be.
    landReserves(to: HydratedPunctGameState) {
        this.landingState = to
    }

    // The move your own Undo takes back from `to`. None when the view passes to the other player
    // as the Undo lands, as the harness's Non-active view does.
    restagedMove(to: Pick<PunctGameState, 'actionCount'>): StepBack | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    override setViewingAsNonActivePlayer(enabled: boolean) {
        super.setViewingAsNonActivePlayer(enabled)
        this.followStaged()
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isPlacePiece(action) || isMovePiece(action) ? action : undefined
    }

    // Taking your move back stands its piece where you put it, turned as you turned it, so another
    // place or way round can be chosen.
    override beforeNewState({ kind }: PresentedTransition): void {
        this.changedByPlayer = false
        if (kind === 'view-switch') {
            for (const interrupter of this.moveInterrupters) interrupter.abandon()
        }
        if (kind === 'undo') {
            const incoming = this.presentingState
            assertExists(incoming, 'An Undo presents the state it leads to')
            const move = this.restagedMove(incoming)
            if (move) {
                this.selection = this.restagedSelection(move, incoming)
                this.selectionOwner = move.playerId
            }
        }
        this.undoingMove = undefined
        this.followStaged()
    }

    // A new kind keeps the chosen space if it can stand there.
    chooseKind(kind: PieceKind) {
        if (this.moving || !this.placeKinds.includes(kind)) return
        this.preferredKind = kind
        const at = this.chosenPiece ? undefined : this.chosenAt
        const playerId = this.myPlayer?.id
        const fits =
            at !== undefined &&
            playerId !== undefined &&
            this.gameState
                .entriesOf(playerId, kind)
                .some((entry) => sameCoordinates(entry.punct, at))
        this.select(fits ? setPunctSelection({}, 'at', at) : {})
    }

    // Choosing your piece picks it up to move; choosing it again lets it go.
    choosePiece(piece: PlacedPiece) {
        if (this.moving || !this.movablePieces.some((movable) => movable.id === piece.id)) return
        const same = this.chosenPiece?.id === piece.id
        this.select(same ? {} : setPunctSelection({}, 'from', piece.punct))
    }

    // A space for the chosen piece's PÜNCT, or for a new piece's, which keeps how you turned it.
    chooseSpace(coords: AxialCoordinates) {
        if (this.moving) return
        if (this.chosenPiece) {
            if (!includesCoords(this.destinations, coords)) return
            this.select(setPunctSelection(this.ownSelection, 'at', coords))
            return
        }
        const kind = this.chosenKind
        if (kind === undefined || !includesCoords(this.entryCells, coords)) return
        const options = this.entries.filter((entry) => sameCoordinates(entry.punct, coords))
        const at = setPunctSelection({}, 'at', coords)
        this.select(this.turnedTo(at, options, kind, this.preferredRotation, this.turnedRotation()))
    }

    // Tapping the staged piece turns it to its next way of lying there, clockwise.
    turnStaged() {
        const current = this.chosenOption
        const kind = this.staged?.kind
        if (this.moving || current === undefined || kind === undefined) return
        if (this.options.length < 2) return
        const period = samePlacementPeriod(kind)
        const steps = Math.min(
            ...this.options
                .map((option) => wrapRotation(option.rotation - current.rotation, period))
                .filter((step) => step > 0)
        )
        const next = wrapRotation(current.rotation + steps)
        const unturned = setPunctSelection(this.ownSelection, 'rotation', undefined)
        this.select(this.turnedTo(unturned, this.options, kind, this.unturnedRotation(), next))
    }

    // Tapping where there is nothing to choose lets go of a chosen piece or space.
    letGo() {
        if (this.moving) return
        if (this.ownSelection.from === undefined && this.ownSelection.at === undefined) return
        this.select({})
    }

    async confirm() {
        const staged = this.staged
        if (this.moving || staged === undefined) return
        if (staged.from !== undefined) {
            await this.applyAction(
                this.createPlayerAction(MovePiece, {
                    from: staged.from,
                    to: staged.punct,
                    rotation: staged.rotation
                })
            )
            return
        }
        await this.applyAction(
            this.createPlayerAction(PlacePiece, {
                kind: staged.kind,
                punct: staged.punct,
                rotation: staged.rotation
            })
        )
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    private select(selection: PunctSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
        this.changedByPlayer = true
        this.followStaged()
    }

    private interruptMoves() {
        for (const interrupter of this.moveInterrupters) interrupter.interrupt()
    }

    // The staged piece reads the state shown, which a new state replaces only after
    // beforeNewState, so its followers hear of a change once the change is done.
    private followStaged() {
        if (this.followPending) return
        this.followPending = true
        queueMicrotask(() => {
            this.followPending = false
            const staged = this.staged
            const board = this.gameState.board
            const released = this.releasedByPlayer
            for (const follow of this.stagedFollowers) follow(staged, board, released)
        })
    }

    // The rotation chosen by turning the staged piece, if any.
    private turnedRotation(): number | undefined {
        return this.ownSelection.rotation?.value
    }

    // The way round a piece lies before it is turned: as it lay, or as you last put a new one.
    private unturnedRotation(): number | undefined {
        return this.chosenPiece?.rotation ?? this.preferredRotation
    }

    // The option a piece takes for a rotation: the one lying the same way, keeping the rotation
    // itself, as a piece whose dots match half a turn round still lies one way; else the first.
    private wayRound(
        options: readonly Placement[],
        kind: PieceKind,
        rotation: number | undefined
    ): Placement | undefined {
        if (rotation === undefined) return options[0]
        const match = options.find((option) => sameOrientation(kind, option.rotation, rotation))
        return match ? { ...match, rotation } : options[0]
    }

    // A rotation is a stage of its own only where it fits and turns the piece from how it would
    // lie unturned, so every Undo of it shows.
    private turnedTo(
        selection: PunctSelection,
        options: readonly Placement[],
        kind: PieceKind,
        unturned: number | undefined,
        rotation: number | undefined
    ): PunctSelection {
        if (rotation === undefined) return selection
        const turned = this.wayRound(options, kind, rotation)
        const fits = turned !== undefined && turned.rotation === rotation
        const changes = this.wayRound(options, kind, unturned)?.rotation !== rotation
        return fits && changes ? setPunctSelection(selection, 'rotation', rotation) : selection
    }

    // How a player last put a new piece among these actions.
    private placedRotation(playerId: string, actions: readonly GameAction[]): number | undefined {
        return actions.findLast(
            (action): action is PlacePiece => isPlacePiece(action) && action.playerId === playerId
        )?.rotation
    }

    // Your choices for a move taken back, as you made them: the way round only if you turned it.
    private restagedSelection(move: StepBack, state: HydratedPunctGameState): PunctSelection {
        const earlier = this.actions.filter((action) => {
            assertExists(action.index, 'A recorded action has its place in the game')
            return action.index < state.actionCount
        })
        if (isPlacePiece(move)) {
            this.preferredKind = move.kind
            const options = state
                .entriesOf(move.playerId, move.kind)
                .filter((entry) => sameCoordinates(entry.punct, move.punct))
            const unturned = this.placedRotation(move.playerId, earlier)
            const at = setPunctSelection({}, 'at', move.punct)
            return this.turnedTo(at, options, move.kind, unturned, move.rotation)
        }
        const piece = state.pieceWithPunctAt(move.playerId, move.from)
        assertExists(piece, 'A move taken back stands its piece where it was')
        const options = state.board
            .movesOf(piece)
            .filter((option) => sameCoordinates(option.punct, move.to))
        const from = setPunctSelection({}, 'from', move.from)
        const at = setPunctSelection(from, 'at', move.to)
        return this.turnedTo(at, options, piece.kind, piece.rotation, move.rotation)
    }

    private uniqueCoords(placements: readonly Placement[]): AxialCoordinates[] {
        const seen = new Set<number>()
        const unique: AxialCoordinates[] = []
        for (const { punct } of placements) {
            if (seen.has(spaceKey(punct))) continue
            seen.add(spaceKey(punct))
            unique.push(punct)
        }
        return unique
    }
}
