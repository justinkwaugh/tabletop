import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    assertExists,
    coordinatesToNumber,
    sameCoordinates,
    type AxialCoordinates,
    type GameAction
} from '@tabletop/common'
import {
    ActionType,
    CENTRE,
    ExtraMove,
    FinishRemoving,
    GIPF_PIECE_SIZE,
    isExtraMove,
    isMovePotential,
    MachineState,
    isPushPiece,
    POTENTIAL_KINDS,
    potentialsFromConfig,
    GipfPotentialsPreferenceDefinition,
    MovePotential,
    PieceKind,
    PushPiece,
    pushedUnit,
    RemoveRow,
    SkipExtraMove,
    type Entry,
    type HydratedGipfPotentialsGameState,
    type GipfPotentialsGameState,
    type GipfPotentialsPreferences,
    type PotentialKind,
    type Row
} from '@tabletop/gipf-potentials'
import {
    GipfPotentialsStageOrder,
    pushGipfPotentialsKeep,
    setGipfPotentialsSelection,
    type GipfPotentialsSelection
} from './stagedSelection.js'
import { includesCoords, TURNED_VIEW, VIEW, type BoardView } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'
import { discsOf, type BoardDisc } from '$lib/board/boardChange.js'

export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

// Moves Undo restages: a push or extra move returns to its dot, a potential's move to its piece.
type StepBack = PushPiece | ExtraMove | MovePotential

type SessionOptions = ConstructorParameters<
    typeof GameSession<GipfPotentialsGameState, HydratedGipfPotentialsGameState>
>[0]

export class GipfPotentialsGameSession extends GameSession<
    GipfPotentialsGameState,
    HydratedGipfPotentialsGameState
> {
    selection: GipfPotentialsSelection = $state({})
    // Anyone but its owner, as the Non-active view after an Undo, sees none of it; Undo passes by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: GipfPotentialsSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    preferredKind: PieceKind | undefined = $state()
    undoingMove: StepBack | undefined
    historyMove: StepBack | undefined
    moveInterrupter: MoveInterrupter | undefined

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                GipfPotentialsStageOrder,
                () => this.ownSelection,
                (selection) => (this.selection = selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof GipfPotentialsPreferences> =
        this.createPreferences(GipfPotentialsPreferenceDefinition)
    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    centreMark: boolean = $derived(this.preferences.values.centreMark)

    toggleCentreMark() {
        this.preferences.set({ centreMark: !this.centreMark })
    }

    kindsInPlay: PotentialKind[] = $derived.by(() => {
        const counts = potentialsFromConfig(this.game.config)
        return POTENTIAL_KINDS.filter((kind) => counts[kind] > 0)
    })

    turned: boolean = $derived(this.preferences.values.turned)

    // A move's motion is laid out in the view it started in, so turning the board lands it.
    toggleTurned() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    view: BoardView = $derived(this.turned ? TURNED_VIEW : VIEW)
    notation: BoardNotation = $derived(boardNotation(this.view))

    canPush = $derived(this.canAct(ActionType.PushPiece))
    canMovePotential = $derived(this.canAct(ActionType.MovePotential))
    canExtraMove = $derived(this.canAct(ActionType.ExtraMove))
    canSkipExtraMove = $derived(this.canAct(ActionType.SkipExtraMove))
    canRemove = $derived(this.canAct(ActionType.RemoveRow))
    canLeaveRows = $derived(this.canAct(ActionType.FinishRemoving))
    resolving = $derived(this.gameState.machineState === MachineState.ResolvingRows)

    pushKinds: PieceKind[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canPush && playerId !== undefined ? this.gameState.pushableKinds(playerId) : []
    })

    chosenKind: PieceKind | undefined = $derived(
        this.preferredKind !== undefined && this.pushKinds.includes(this.preferredKind)
            ? this.preferredKind
            : this.pushKinds[0]
    )

    forfeits: boolean = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return (
            this.chosenKind === PieceKind.Basic &&
            playerId !== undefined &&
            this.gameState.getPlayerState(playerId).potentialsInHand() > 0
        )
    })

    // With the ids its discs will have, so they lie the same way round once in.
    stagedDiscs: BoardDisc[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (playerId === undefined) return []
        if (this.canExtraMove) {
            const centre = this.gameState.board.topAt(CENTRE)
            assertExists(centre, 'An extra move has its TAMSK-loaded piece on the centre')
            return discsOf([centre]).slice(1)
        }
        const kind = this.chosenKind
        if (kind === undefined) return []
        return discsOf([pushedUnit(playerId, kind, this.gameState.nextDiscId)])
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

    private staging(playerId: string): PieceKind | undefined {
        return playerId === this.myPlayer?.id ? this.stagedKind : undefined
    }

    inHand(playerId: string, kind: PotentialKind): number {
        const staged = this.staging(playerId) === kind ? 1 : 0
        return this.gameState.getPlayerState(playerId).potentials[kind] - staged
    }

    reserveLeft(playerId: string): number {
        const staged = this.staging(playerId)
        const onDot = staged === undefined ? 0 : staged === PieceKind.Gipf ? GIPF_PIECE_SIZE : 1
        const covering = playerId === this.myPlayer?.id && this.chosenTo !== undefined ? 1 : 0
        return this.gameState.getPlayerState(playerId).reserve - onDot - covering
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

    chosenTo: AxialCoordinates | undefined = $derived.by(() => {
        const manual = this.ownSelection.to?.value
        return manual !== undefined && includesCoords(this.moveTargets, manual) ? manual : undefined
    })

    canCoverWithGipf: boolean = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return playerId !== undefined && this.gameState.getPlayerState(playerId).reserve >= 2
    })

    rows: Row[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canRemove || playerId === undefined) return []
        const { board } = this.gameState
        const rows = board.rowsOf(playerId)
        return this.resolving ? rows : rows.filter((row) => !board.isMandatory(row))
    })

    chosenRow: Row | undefined = $derived.by(() => {
        const manual = this.ownSelection.row?.value
        const found = this.rows.find((row) => this.rowKey(row) === manual)
        if (found) return found
        return this.resolving && this.rows.length === 1 ? this.rows[0] : undefined
    })

    rowKeepable: AxialCoordinates[] = $derived(
        this.chosenRow ? this.gameState.board.keepableIn(this.chosenRow) : []
    )

    keep: AxialCoordinates[] = $derived.by(() => {
        const manual = this.ownSelection.keep?.value
        if (manual === undefined) {
            const playerId = this.myPlayer?.id
            return this.rowKeepable.filter(
                (coords) => this.gameState.board.topAt(coords)?.playerId === playerId
            )
        }
        return this.rowKeepable.filter((coords) => manual.includes(coordinatesToNumber(coords)))
    })

    removing: AxialCoordinates[] = $derived(
        this.chosenRow
            ? this.chosenRow.reach.filter((coords) => !includesCoords(this.keep, coords))
            : []
    )

    mustBreak: boolean = $derived(
        this.chosenRow !== undefined && this.gameState.board.mustBreak(this.chosenRow)
    )

    breaksRow: boolean = $derived(
        this.chosenRow !== undefined &&
            this.gameState.board.isValidRemoval(this.chosenRow, this.keep)
    )

    private isStepBack(action: GameAction): action is StepBack {
        return isPushPiece(action) || isExtraMove(action) || isMovePotential(action)
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    private rowKey(row: Row): string {
        return `${coordinatesToNumber(row.from)}|${coordinatesToNumber(row.to)}`
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = this.isStepBack(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyMove = action !== undefined && this.isStepBack(action) ? action : undefined
    }

    get presentingState(): HydratedGipfPotentialsGameState | undefined {
        return this.incomingGameState
    }

    undoneMove(to: Pick<GipfPotentialsGameState, 'actionCount'>): StepBack | undefined {
        const action = this.actions.find((candidate) => candidate.index === to.actionCount)
        return action !== undefined && this.isStepBack(action) ? action : undefined
    }

    // None when the view passes to the other player as the Undo lands (the Non-active view).
    restagedMove(to: Pick<GipfPotentialsGameState, 'actionCount'>): StepBack | undefined {
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

    private restaged(move: StepBack): GipfPotentialsSelection {
        if (isMovePotential(move)) {
            const from = setGipfPotentialsSelection({}, 'from', move.from)
            return move.cover === undefined ? from : setGipfPotentialsSelection(from, 'to', move.to)
        }
        if (isPushPiece(move)) this.preferredKind = move.kind
        return setGipfPotentialsSelection({}, 'dot', move.dot)
    }

    // A move's motion runs on the state it started from, whose choices still show as they fade.
    private get moving(): boolean {
        return this.updatingVisibleState
    }

    chooseKind(kind: PieceKind) {
        if (this.moving) return
        if (!this.pushKinds.includes(kind)) return
        this.preferredKind = kind
    }

    chooseDot(dot: AxialCoordinates) {
        if (this.moving) return
        if (!includesCoords(this.entryDots, dot)) return
        const same = this.chosenDot !== undefined && sameCoordinates(this.chosenDot, dot)
        if (same && this.nextPotential()) return
        this.select(setGipfPotentialsSelection({}, 'dot', same ? undefined : dot))
    }

    private nextPotential(): boolean {
        const kinds = this.pushKinds
        const at = kinds.findIndex((kind) => kind === this.stagedKind)
        if (at < 0 || kinds.length < 2) return false
        this.chooseKind(kinds[(at + 1) % kinds.length])
        return true
    }

    chooseFrom(from: AxialCoordinates) {
        if (this.moving) return
        if (!includesCoords(this.movable, from)) return
        const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, from)
        this.select(setGipfPotentialsSelection({}, 'from', same ? undefined : from))
    }

    letGo() {
        if (this.moving) return
        const optionalRow = !this.resolving && this.ownSelection.row !== undefined
        if (this.chosenFrom === undefined && this.chosenDot === undefined && !optionalRow) return
        this.select(setGipfPotentialsSelection(this.ownSelection, 'from', undefined))
    }

    // A piece can belong to two crossing rows; choosing it again moves to the next one.
    chooseRowAt(coords: AxialCoordinates) {
        if (this.moving) return
        const containing = this.rows.filter((row) => includesCoords(row.reach, coords))
        if (containing.length === 0) return
        const current = this.chosenRow ? containing.findIndex((row) => row === this.chosenRow) : -1
        const next = containing[(current + 1) % containing.length]
        const keepGoing = current < 0 || containing.length > 1
        this.select(
            setGipfPotentialsSelection(
                this.ownSelection,
                'row',
                keepGoing ? this.rowKey(next) : undefined
            )
        )
    }

    toggleKeep(coords: AxialCoordinates) {
        if (this.moving) return
        if (!includesCoords(this.rowKeepable, coords)) return
        const keys = this.keep.map(coordinatesToNumber)
        const key = coordinatesToNumber(coords)
        const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
        this.select(pushGipfPotentialsKeep(this.ownSelection, next))
    }

    private select(selection: GipfPotentialsSelection) {
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
        if (this.moving) return
        const from = this.chosenFrom
        if (from === undefined || !includesCoords(this.moveTargets, to)) return
        const coversGipf = this.gameState.board.topAt(to)?.kind === PieceKind.Gipf
        if (!coversGipf) {
            await this.applyAction(this.createPlayerAction(MovePotential, { from, to }))
        } else if (this.canCoverWithGipf) {
            const same = this.chosenTo !== undefined && sameCoordinates(this.chosenTo, to)
            this.select(setGipfPotentialsSelection(this.ownSelection, 'to', same ? undefined : to))
        } else {
            await this.cover(to, 1)
        }
    }

    async coverWith(count: number) {
        if (this.chosenTo !== undefined) await this.cover(this.chosenTo, count)
    }

    private async cover(to: AxialCoordinates, cover: number) {
        const from = this.chosenFrom
        if (from === undefined) return
        await this.applyAction(this.createPlayerAction(MovePotential, { from, to, cover }))
    }

    async leaveRows() {
        if (!this.canLeaveRows) return
        await this.applyAction(this.createPlayerAction(FinishRemoving, {}))
    }

    async removeChosenRow() {
        const row = this.chosenRow
        if (row === undefined || !this.breaksRow) return
        await this.applyAction(
            this.createPlayerAction(RemoveRow, { from: row.from, to: row.to, keep: this.keep })
        )
    }
}
