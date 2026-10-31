import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    Capture,
    isCapture,
    isStack,
    Pass,
    PIECE_KINDS,
    PieceKind,
    PlacePiece,
    Stack,
    TzaarPreferenceDefinition,
    type HydratedTzaarGameState,
    type Piece,
    type TzaarGameState,
    type TzaarPreferences
} from '@tabletop/tzaar'
import {
    hasManualTzaarSelection,
    popTzaarSelection,
    setTzaarSelection,
    type TzaarSelection
} from './stagedSelection.js'
import { coordsKey } from '$lib/board/geometry.js'
import { toneOf, type ShapePiece, type Tone } from '$lib/board/pieceStyle.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export type KnownMove = Capture | Stack

export class TzaarGameSession extends GameSession<TzaarGameState, HydratedTzaarGameState> {
    selection: TzaarSelection = $state({})

    // The type of piece the next placement puts down. It stays chosen from one placement to the
    // next, like a tool, so it is not a step Undo takes back.
    private chosenKind: PieceKind = $state(PieceKind.Tott)

    // The move an Undo under way takes back, and the move history last stepped to: the board
    // animator follows them where the two boards alone cannot say which stack moved.
    undoingMove: KnownMove | undefined
    historyMove: KnownMove | undefined

    readonly preferences: TitlePreferences<typeof TzaarPreferences> =
        this.createPreferences(TzaarPreferenceDefinition)

    rotatedBoard: boolean = $derived(this.preferences.values.rotatedBoard)

    toggleRotatedBoard() {
        this.preferences.set({ rotatedBoard: !this.rotatedBoard })
    }

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canCapture = $derived(this.canAct(ActionType.Capture))
    canStack = $derived(this.canAct(ActionType.Stack))
    canPass = $derived(this.canAct(ActionType.Pass))

    private actorId: string | undefined = $derived(this.myPlayer?.id)

    kindsInHand: PieceKind[] = $derived(
        this.canPlace && this.actorId !== undefined ? this.gameState.kindsInHand(this.actorId) : []
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

    private captureMoves = $derived(
        this.canCapture && this.actorId !== undefined ? this.gameState.captures(this.actorId) : []
    )
    private stackMoves = $derived(
        this.canStack && this.actorId !== undefined ? this.gameState.stackings(this.actorId) : []
    )

    movable: AxialCoordinates[] = $derived(
        [...this.captureMoves, ...this.stackMoves]
            .map((move) => move.from)
            .filter(
                (from, index, all) =>
                    all.findIndex((other) => sameCoordinates(other, from)) === index
            )
    )

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => coordsKey(coords) === this.selection.from?.value)
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

    toneOfPlayer(playerId: string): Tone {
        return toneOf(this.gameState.getPlayerState(playerId).color)
    }

    shapeOf(piece: Piece): ShapePiece {
        return { tone: this.toneOfPlayer(piece.playerId), kind: piece.kind, seedKey: `${piece.id}` }
    }

    chooseKind(kind: PieceKind) {
        this.chosenKind = kind
    }

    hasManualSelection(): boolean {
        return hasManualTzaarSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popTzaarSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = {}
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isCapture(action) || isStack(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyMove = isCapture(action) || isStack(action) ? action : undefined
    }

    // Undoing a move takes the stack home and leaves it chosen; the next Undo puts it down.
    override beforeNewState({ kind }: PresentedTransition): void {
        const move = kind === 'undo' ? this.undoingMove : undefined
        this.selection = move ? setTzaarSelection({}, 'from', coordsKey(move.from)) : {}
        if (kind !== 'undo') this.undoingMove = undefined
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
            this.selection = setTzaarSelection(
                this.selection,
                'from',
                same ? undefined : coordsKey(coords)
            )
        }
    }

    // Tapping where there is nothing to choose lets go of a chosen stack. The piece type chosen for
    // placing stays, as it is not a step.
    letGo() {
        if (this.chosenFrom === undefined) return
        this.selection = setTzaarSelection(this.selection, 'from', undefined)
    }

    async pass() {
        await this.applyAction(this.createPlayerAction(Pass, {}))
    }
}
