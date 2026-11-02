import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    dotsOf,
    EndReason,
    isMovePiece,
    isPlacePiece,
    MovePiece,
    PIECE_KINDS,
    PieceKind,
    PlacePiece,
    PunctPreferenceDefinition,
    type HydratedPunctGameState,
    type PlacedPiece,
    type Placement,
    type PunctGameState,
    type PunctPreferences
} from '@tabletop/punct'
import {
    hasManualPunctSelection,
    popPunctSelection,
    setPunctSelection,
    type PunctSelection
} from './stagedSelection.js'
import { coordsKey } from '$lib/board/geometry.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

// A piece standing where the player has put it but not yet committed: brought in from the
// reserve, or moved from where it stood.
export type StagedPiece = {
    kind: PieceKind
    playerId: string
    id: number
    punct: AxialCoordinates
    rotation: number
    level: number
    // The PÜNCT's space before a move, where the rulebook's marker stands meanwhile.
    from?: AxialCoordinates
}

// The moves Undo walks back through one choice at a time: undone, a piece stands staged where
// it was put, as it was turned.
type StepBack = PlacePiece | MovePiece

function isStepBack(action: GameAction): action is StepBack {
    return isPlacePiece(action) || isMovePiece(action)
}

function uniqueCoords(placements: readonly Placement[]): AxialCoordinates[] {
    const seen = new Set<string>()
    const out: AxialCoordinates[] = []
    for (const { punct } of placements) {
        if (seen.has(coordsKey(punct))) continue
        seen.add(coordsKey(punct))
        out.push(punct)
    }
    return out
}

export class PunctGameSession extends GameSession<PunctGameState, HydratedPunctGameState> {
    selection: PunctSelection = $state({})
    // The kind you last chose to bring in, and how you last turned a new piece, kept from turn
    // to turn.
    preferredKind: PieceKind | undefined = $state()
    preferredRotation: number | undefined = $state()
    // The move being undone, and the move history last stepped to.
    undoingMove: StepBack | undefined
    historyMove: StepBack | undefined

    readonly preferences: TitlePreferences<typeof PunctPreferences> =
        this.createPreferences(PunctPreferenceDefinition)
    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canMovePiece = $derived(this.canAct(ActionType.MovePiece))

    placeKinds: PieceKind[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canPlace || playerId === undefined) return []
        return this.gameState.getPlayerState(playerId).kindsInReserve()
    })

    chosenKind: PieceKind | undefined = $derived(
        this.preferredKind !== undefined && this.placeKinds.includes(this.preferredKind)
            ? this.preferredKind
            : this.placeKinds[0]
    )

    entries: Placement[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        const kind = this.chosenKind
        if (playerId === undefined || kind === undefined) return []
        return this.gameState.entriesOf(playerId, kind)
    })

    entryCells: AxialCoordinates[] = $derived(uniqueCoords(this.entries))

    movablePieces: PlacedPiece[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canMovePiece || playerId === undefined) return []
        return this.gameState.board.movablePieces(playerId)
    })

    chosenPiece: PlacedPiece | undefined = $derived.by(() => {
        const from = this.selection.from?.value
        if (from === undefined) return undefined
        return this.movablePieces.find((piece) => sameCoordinates(piece.punct, from))
    })

    moves: Placement[] = $derived(
        this.chosenPiece ? this.gameState.board.movesOf(this.chosenPiece) : []
    )

    destinations: AxialCoordinates[] = $derived(uniqueCoords(this.moves))

    chosenAt: AxialCoordinates | undefined = $derived.by(() => {
        const at = this.selection.at?.value
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

    chosenOption: Placement | undefined = $derived.by(() => {
        const options = this.options
        const manual = this.selection.rotation?.value
        const preferred = manual ?? this.chosenPiece?.rotation ?? this.preferredRotation
        return options.find((option) => option.rotation === preferred) ?? options[0]
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
        return { ...option, kind, playerId, id: this.gameState.nextPieceId }
    })

    stagedCells: AxialCoordinates[] = $derived(
        this.staged ? dotsOf(this.staged.kind, this.staged.punct, this.staged.rotation) : []
    )

    // The chain of spaces that won, once a connection has ended the game.
    winningConnection: AxialCoordinates[] | undefined = $derived.by(() => {
        const state = this.gameState
        if (state.endReason !== EndReason.Connection) return undefined
        const [winnerId] = state.winningPlayerIds
        return winnerId === undefined ? undefined : state.board.connection(winnerId)
    })

    // How many of a kind a player has in reserve, less a new piece standing staged.
    inReserve(playerId: string, kind: PieceKind): number {
        const staged =
            playerId === this.myPlayer?.id &&
            this.staged &&
            !this.chosenPiece &&
            this.staged.kind === kind
                ? 1
                : 0
        return this.gameState.getPlayerState(playerId).reserve[kind] - staged
    }

    reserveTotal(playerId: string): number {
        return PIECE_KINDS.reduce((total, kind) => total + this.inReserve(playerId, kind), 0)
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    hasManualSelection(): boolean {
        return hasManualPunctSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popPunctSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = {}
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isStepBack(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyMove = action !== undefined && isStepBack(action) ? action : undefined
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        const move = kind === 'undo' ? this.undoingMove : undefined
        this.selection = move ? this.restaged(move) : {}
        if (kind !== 'undo') this.undoingMove = undefined
    }

    // Your choices for a move taken back, as you made them.
    private restaged(move: StepBack): PunctSelection {
        if (isPlacePiece(move)) {
            this.preferredKind = move.kind
            const at = setPunctSelection({}, 'at', move.punct)
            return setPunctSelection(at, 'rotation', move.rotation)
        }
        const from = setPunctSelection({}, 'from', move.from)
        const at = setPunctSelection(from, 'at', move.to)
        return setPunctSelection(at, 'rotation', move.rotation)
    }

    // A new kind keeps the chosen space if it can stand there.
    chooseKind(kind: PieceKind) {
        if (!this.placeKinds.includes(kind)) return
        this.preferredKind = kind
        if (this.chosenPiece) {
            this.selection = {}
            return
        }
        this.selection = setPunctSelection(this.selection, 'rotation', undefined)
    }

    // Choosing your piece picks it up to move; choosing it again lets it go.
    choosePiece(piece: PlacedPiece) {
        if (!this.movablePieces.some((movable) => movable.id === piece.id)) return
        const same = this.chosenPiece?.id === piece.id
        this.selection = same ? {} : setPunctSelection({}, 'from', piece.punct)
    }

    // A space for the chosen piece's PÜNCT, or for a new piece's.
    chooseSpace(coords: AxialCoordinates) {
        if (this.chosenPiece) {
            if (!includesCoords(this.destinations, coords)) return
            this.selection = setPunctSelection(this.selection, 'at', coords)
            return
        }
        if (!includesCoords(this.entryCells, coords)) return
        this.selection = setPunctSelection({}, 'at', coords)
    }

    isChoosableSpace(coords: AxialCoordinates): boolean {
        return this.chosenPiece
            ? includesCoords(this.destinations, coords)
            : includesCoords(this.entryCells, coords)
    }

    // Tapping the staged piece turns it to its next way of lying there, clockwise.
    turnStaged() {
        const current = this.chosenOption
        if (current === undefined || this.options.length < 2) return
        const ordered = this.options.toSorted(
            (a, b) =>
                ((a.rotation - current.rotation + 6) % 6) -
                ((b.rotation - current.rotation + 6) % 6)
        )
        const next = ordered[1]
        if (!this.chosenPiece) this.preferredRotation = next.rotation
        this.selection = setPunctSelection(this.selection, 'rotation', next.rotation)
    }

    // Tapping where there is nothing to choose lets go of a chosen piece or space.
    letGo() {
        if (this.selection.from === undefined && this.selection.at === undefined) return
        this.selection = {}
    }

    async confirm() {
        const staged = this.staged
        if (staged === undefined) return
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
        this.preferredRotation = staged.rotation
        await this.applyAction(
            this.createPlayerAction(PlacePiece, {
                kind: staged.kind,
                punct: staged.punct,
                rotation: staged.rotation
            })
        )
    }
}
