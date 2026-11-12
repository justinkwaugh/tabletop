import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    coordinatesToNumber,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    CENTRE,
    discsIn,
    ExtraMove,
    isPotentialKind,
    isExtraMove,
    isMovePotential,
    isPushPiece,
    MatrxPreferenceDefinition,
    MovePotential,
    PieceKind,
    PushPiece,
    RemoveRow,
    SkipExtraMove,
    type Entry,
    type HydratedMatrxGameState,
    type MatrxGameState,
    type MatrxPreferences,
    type PotentialKind,
    type Row
} from '@tabletop/matrx'
import {
    MatrxStageOrder,
    pushMatrxKeep,
    setMatrxSelection,
    type MatrxSelection
} from './stagedSelection.js'
import { viewOf, type BoardView } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'
import { discsOf, type BoardDisc } from '$lib/board/boardChange.js'

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

// Moves Undo restages: a push returns to its dot, a potential's move to its stack.
type StepBack = PushPiece | ExtraMove | MovePotential

function isStepBack(action: GameAction): action is StepBack {
    return isPushPiece(action) || isExtraMove(action) || isMovePotential(action)
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<MatrxGameState, HydratedMatrxGameState>
>[0]

export class MatrxGameSession extends GameSession<MatrxGameState, HydratedMatrxGameState> {
    selection: MatrxSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: MatrxSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    // The kind you last chose to bring in, kept from turn to turn.
    preferredKind: PieceKind | undefined = $state()
    undoingMove: StepBack | undefined
    historyMove: StepBack | undefined
    moveInterrupter: MoveInterrupter | undefined

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                MatrxStageOrder,
                () => this.ownSelection,
                (selection) => (this.selection = selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof MatrxPreferences> =
        this.createPreferences(MatrxPreferenceDefinition)
    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    centreMark: boolean = $derived(this.preferences.values.centreMark)

    toggleCentreMark() {
        this.preferences.set({ centreMark: !this.centreMark })
    }

    turned: boolean = $derived(this.preferences.values.turned)

    // A move's motion is laid out in the view it started in, so turning the board lands it.
    toggleTurned() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    view: BoardView = $derived(viewOf(this.gameState.board.shape, this.turned))
    notation: BoardNotation = $derived(boardNotation(this.view))

    canPush = $derived(this.canAct(ActionType.PushPiece))
    canMovePotential = $derived(this.canAct(ActionType.MovePotential))
    canExtraMove = $derived(this.canAct(ActionType.ExtraMove))
    canSkipExtraMove = $derived(this.canAct(ActionType.SkipExtraMove))
    canRemove = $derived(this.canAct(ActionType.RemoveRow))

    pushKinds: PieceKind[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canPush && playerId !== undefined ? this.gameState.pushableKinds(playerId) : []
    })

    chosenKind: PieceKind | undefined = $derived(
        this.preferredKind !== undefined && this.pushKinds.includes(this.preferredKind)
            ? this.preferredKind
            : this.pushKinds[0]
    )

    // With the ids its discs will have, so they lie the same way round once in.
    stagedDiscs: BoardDisc[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (playerId === undefined) return []
        if (this.canExtraMove) {
            const centre = this.gameState.board.topAt(CENTRE)
            return [(centre && discsOf([centre])[1]) ?? { playerId, kind: PieceKind.Tamsk }]
        }
        const kind = this.chosenKind
        if (kind === undefined) return []
        const first = this.gameState.nextDiscId
        return Array.from({ length: discsIn({ paired: isPotentialKind(kind) }) }, (_, index) => ({
            playerId,
            kind,
            id: first + index
        }))
    })

    entries: Entry[] = $derived(
        this.stagedDiscs.length > 0 && (this.canExtraMove || this.chosenKind !== undefined)
            ? this.gameState.board.legalEntries()
            : []
    )

    entryDots: AxialCoordinates[] = $derived.by(() => {
        const dots: AxialCoordinates[] = []
        for (const entry of this.entries) {
            if (!includesCoords(dots, entry.dot)) dots.push(entry.dot)
        }
        return dots
    })

    chosenDot: AxialCoordinates | undefined = $derived.by(() => {
        const manual = this.ownSelection.dot?.value
        return manual !== undefined && includesCoords(this.entryDots, manual) ? manual : undefined
    })

    // Not an extra move's TAMSK piece, which comes from the board.
    stagedKind: PieceKind | undefined = $derived(
        this.chosenDot !== undefined && !this.canExtraMove ? this.chosenKind : undefined
    )

    inReserve(playerId: string, kind: PotentialKind): number {
        const staged =
            playerId === this.myPlayer?.id && this.stagedKind === kind
                ? discsIn({ paired: true })
                : 0
        return this.gameState.getPlayerState(playerId).potentials[kind] - staged
    }

    targets: Entry[] = $derived.by(() => {
        const dot = this.chosenDot
        return dot === undefined
            ? []
            : this.entries.filter((entry) => sameCoordinates(entry.dot, dot))
    })

    potentialMoves: { from: AxialCoordinates; to: AxialCoordinates }[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canMovePotential && playerId !== undefined
            ? this.gameState.potentialMoves(playerId)
            : []
    })

    movable: AxialCoordinates[] = $derived.by(() => {
        const froms: AxialCoordinates[] = []
        for (const move of this.potentialMoves) {
            if (!includesCoords(froms, move.from)) froms.push(move.from)
        }
        return froms
    })

    chosenFrom: AxialCoordinates | undefined = $derived.by(() => {
        const manual = this.ownSelection.from?.value
        return manual !== undefined && includesCoords(this.movable, manual) ? manual : undefined
    })

    moveTargets: AxialCoordinates[] = $derived.by(() => {
        const from = this.chosenFrom
        return from === undefined
            ? []
            : this.potentialMoves
                  .filter((move) => sameCoordinates(move.from, from))
                  .map((move) => move.to)
    })

    rows: Row[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canRemove && playerId !== undefined ? this.gameState.board.rowsOf(playerId) : []
    })

    chosenRow: Row | undefined = $derived.by(() => {
        const manual = this.ownSelection.row?.value
        const found = this.rows.find((row) => this.rowKey(row) === manual)
        if (found) return found
        return this.rows.length === 1 ? this.rows[0] : undefined
    })

    rowPairs: AxialCoordinates[] = $derived.by(() => {
        const row = this.chosenRow
        if (row === undefined) return []
        return row.reach.filter((coords) => this.gameState.board.topAt(coords)?.paired === true)
    })

    // Your own stacks stay and the opponent's go unless you mark them otherwise.
    keep: AxialCoordinates[] = $derived.by(() => {
        const manual = this.ownSelection.keep?.value
        if (manual === undefined) {
            const playerId = this.myPlayer?.id
            return this.rowPairs.filter(
                (coords) => this.gameState.board.topAt(coords)?.playerId === playerId
            )
        }
        return this.rowPairs.filter((coords) => manual.includes(coordinatesToNumber(coords)))
    })

    removing: AxialCoordinates[] = $derived(
        this.chosenRow
            ? this.chosenRow.reach.filter((coords) => !includesCoords(this.keep, coords))
            : []
    )

    // Rule E1: the row of four must be broken.
    breaksRow: boolean = $derived(
        this.chosenRow !== undefined &&
            this.chosenRow.run.some((coords) => includesCoords(this.removing, coords))
    )

    private rowKey(row: Row): string {
        return `${coordinatesToNumber(row.from)}|${coordinatesToNumber(row.to)}`
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isStepBack(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyMove = action !== undefined && isStepBack(action) ? action : undefined
    }

    get presentingState(): HydratedMatrxGameState | undefined {
        return this.incomingGameState
    }

    undoneMove(to: Pick<MatrxGameState, 'actionCount'>): StepBack | undefined {
        const action = this.actions.find((candidate) => candidate.index === to.actionCount)
        return action !== undefined && isStepBack(action) ? action : undefined
    }

    // None when the view passes to the other player as the Undo lands, as the harness's
    // Non-active view does.
    restagedMove(to: Pick<MatrxGameState, 'actionCount'>): StepBack | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
        const incoming = this.presentingState
        const move = kind === 'undo' && incoming ? this.restagedMove(incoming) : undefined
        if (move) {
            this.selection = this.restaged(move)
            this.selectionOwner = move.playerId
        }
        if (kind !== 'undo') this.undoingMove = undefined
    }

    private restaged(move: StepBack): MatrxSelection {
        if (isMovePotential(move)) return setMatrxSelection({}, 'from', move.from)
        if (isPushPiece(move)) this.preferredKind = move.kind
        return setMatrxSelection({}, 'dot', move.dot)
    }

    chooseKind(kind: PieceKind) {
        if (!this.pushKinds.includes(kind)) return
        this.preferredKind = kind
    }

    // Choosing the chosen dot again brings in the next potential you hold instead; with only one
    // to choose from, or a GIPF piece or extra move standing there, it lets go.
    chooseDot(dot: AxialCoordinates) {
        if (!includesCoords(this.entryDots, dot)) return
        const same = this.chosenDot !== undefined && sameCoordinates(this.chosenDot, dot)
        if (same && this.nextPotential()) return
        this.select(setMatrxSelection({}, 'dot', same ? undefined : dot))
    }

    private nextPotential(): boolean {
        // A GIPF piece comes in only when it must, so it is then the only kind.
        const kinds = this.pushKinds
        const at = kinds.findIndex((kind) => kind === this.stagedKind)
        if (at < 0 || kinds.length < 2) return false
        this.chooseKind(kinds[(at + 1) % kinds.length])
        return true
    }

    chooseFrom(from: AxialCoordinates) {
        if (!includesCoords(this.movable, from)) return
        const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, from)
        this.select(setMatrxSelection({}, 'from', same ? undefined : from))
    }

    letGo() {
        if (this.chosenFrom === undefined && this.chosenDot === undefined) return
        this.select(setMatrxSelection(this.ownSelection, 'from', undefined))
    }

    // A piece can belong to two crossing rows; choosing it again moves to the next one.
    chooseRowAt(coords: AxialCoordinates) {
        const containing = this.rows.filter((row) => includesCoords(row.reach, coords))
        if (containing.length === 0) return
        const current = this.chosenRow ? containing.findIndex((row) => row === this.chosenRow) : -1
        const next = containing[(current + 1) % containing.length]
        const keepGoing = current < 0 || containing.length > 1
        this.select(
            setMatrxSelection(this.ownSelection, 'row', keepGoing ? this.rowKey(next) : undefined)
        )
    }

    toggleKeep(coords: AxialCoordinates) {
        if (!includesCoords(this.rowPairs, coords)) return
        const keys = this.keep.map((kept) => coordinatesToNumber(kept))
        const key = coordinatesToNumber(coords)
        const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
        this.select(pushMatrxKeep(this.ownSelection, next))
    }

    private select(selection: MatrxSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }

    async push(target: AxialCoordinates) {
        const entry = this.targets.find((candidate) => sameCoordinates(candidate.line[0], target))
        if (entry === undefined) return
        const placement = { dot: entry.dot, to: entry.line[0] }
        if (this.canExtraMove) {
            await this.applyAction(this.createPlayerAction(ExtraMove, placement))
            return
        }
        const kind = this.chosenKind
        if (kind === undefined) return
        await this.applyAction(this.createPlayerAction(PushPiece, { ...placement, kind }))
    }

    async skipExtraMove() {
        if (!this.canSkipExtraMove) return
        await this.applyAction(this.createPlayerAction(SkipExtraMove, {}))
    }

    async movePotential(to: AxialCoordinates) {
        const from = this.chosenFrom
        if (from === undefined || !includesCoords(this.moveTargets, to)) return
        await this.applyAction(this.createPlayerAction(MovePotential, { from, to }))
    }

    async removeChosenRow() {
        const row = this.chosenRow
        if (row === undefined || !this.breaksRow) return
        await this.applyAction(
            this.createPlayerAction(RemoveRow, { from: row.from, to: row.to, keep: this.keep })
        )
    }
}
