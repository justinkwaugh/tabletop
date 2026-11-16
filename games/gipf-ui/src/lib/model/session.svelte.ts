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
    isPushPiece,
    ALL_POINTS,
    FinishRemoving,
    GipfPreferenceDefinition,
    MachineState,
    piecesIn,
    PushPiece,
    RemoveRow,
    type Entry,
    type GipfGameState,
    type GipfPreferences,
    type HydratedGipfGameState,
    type Row
} from '@tabletop/gipf'
import {
    GipfStageOrder,
    pushGipfKeep,
    restagedGipfSelection,
    setGipfSelection,
    type GipfSelection
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
    typeof GameSession<GipfGameState, HydratedGipfGameState>
>[0]

export class GipfGameSession extends GameSession<GipfGameState, HydratedGipfGameState> {
    selection: GipfSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: GipfSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    undoingPush: PushPiece | undefined
    // A staged piece lifts off only when the player lets it go, never when history, a new state or
    // another viewer's perspective clears it.
    private changedByPlayer = false
    historyPush: PushPiece | undefined
    moveInterrupter: MoveInterrupter | undefined
    // Until the state lands: the reserves a step leads to, set as it starts when it brings a piece
    // in, so a piece entering the board is not counted in its reserve too.
    landingReserves: Map<string, number> | undefined = $derived.by(() => {
        void this.gameState
        return undefined
    })

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                GipfStageOrder,
                () => this.ownSelection,
                (selection) => {
                    this.selection = selection
                    this.changedByPlayer = true
                }
            )
        )
    }

    readonly preferences: TitlePreferences<typeof GipfPreferences> =
        this.createPreferences(GipfPreferenceDefinition)
    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    turned: boolean = $derived(this.preferences.values.turned)

    // A move's motion is laid out in the view it started in, so turning the board lands it.
    toggleTurned() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    view: BoardView = $derived(viewOf(this.turned))
    notation: BoardNotation = $derived(boardNotation(ALL_POINTS, this.view))

    canPush = $derived(this.canAct(ActionType.PushPiece))
    canRemove = $derived(this.canAct(ActionType.RemoveRow))
    canFinish = $derived(this.canAct(ActionType.FinishRemoving))

    // false is a single piece, true a GIPF-piece. The first is the one a chosen dot starts with.
    pieceTypes: boolean[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canPush || playerId === undefined) return []
        return [
            ...(this.gameState.canPlayGipf(playerId) ? [true] : []),
            ...(this.gameState.canPlaySingle(playerId) ? [false] : [])
        ]
    })

    choosesType: boolean = $derived(this.pieceTypes.length > 1)

    chosenGipf: boolean | undefined = $derived.by(() => {
        const manual = this.ownSelection.gipf?.value
        if (manual !== undefined && this.pieceTypes.includes(manual)) return manual
        return this.pieceTypes[0]
    })

    entries: Entry[] = $derived(
        this.chosenGipf === undefined ? [] : this.gameState.board.legalEntries()
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

    reserveLeft(playerId: string): number {
        const landing = this.landingReserves?.get(playerId)
        if (landing !== undefined) return landing
        const staged =
            playerId === this.myPlayer?.id &&
            this.chosenDot !== undefined &&
            this.chosenGipf !== undefined
                ? piecesIn(this.chosenGipf)
                : 0
        return this.gameState.getPlayerState(playerId).reserve - staged
    }

    targets: Entry[] = $derived(
        this.chosenDot === undefined
            ? []
            : this.entries.filter(
                  (entry) => this.chosenDot && sameCoordinates(entry.dot, this.chosenDot)
              )
    )

    // Rows the viewer may take now: every row while resolving, only rows of GIPF-pieces before a move.
    rows: Row[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canRemove || playerId === undefined) return []
        const { board } = this.gameState
        const rows = board.rowsOf(playerId)
        return this.gameState.machineState === MachineState.ResolvingRows
            ? rows
            : rows.filter((row) => !board.isMandatory(row))
    })

    chosenRow: Row | undefined = $derived.by(() => {
        const manual = this.ownSelection.row?.value
        const found = this.rows.find((row) => this.rowKey(row) === manual)
        if (found) return found
        const mandatory = this.rows.filter((row) => this.gameState.board.isMandatory(row))
        return mandatory.length === 1 && this.rows.length === 1 ? mandatory[0] : undefined
    })

    rowGipfPieces: AxialCoordinates[] = $derived.by(() => {
        const row = this.chosenRow
        if (row === undefined) return []
        return row.reach.filter((coords) => this.gameState.board.pieceAt(coords)?.gipf === true)
    })

    ownRowGipfPieces: AxialCoordinates[] = $derived(
        this.rowGipfPieces.filter(
            (coords) => this.gameState.board.pieceAt(coords)?.playerId === this.myPlayer?.id
        )
    )

    // Your own GIPF-pieces stay and the opponent's go, unless you choose otherwise.
    keep: AxialCoordinates[] = $derived.by(() => {
        const manual = this.ownSelection.keep?.value
        if (manual !== undefined) {
            return this.rowGipfPieces.filter((coords) =>
                manual.includes(coordinatesToNumber(coords))
            )
        }
        return this.ownRowGipfPieces
    })

    removing: AxialCoordinates[] = $derived(
        this.chosenRow
            ? this.chosenRow.reach.filter((coords) => !includesCoords(this.keep, coords))
            : []
    )

    private rowKey(row: Row): string {
        return `${coordinatesToNumber(row.from)}|${coordinatesToNumber(row.to)}`
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    override willUndo(action: GameAction): void {
        this.undoingPush = isPushPiece(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyPush = isPushPiece(action) ? action : undefined
    }

    get presentingState(): HydratedGipfGameState | undefined {
        return this.incomingGameState
    }

    undonePush(to: Pick<GipfGameState, 'actionCount'>): PushPiece | undefined {
        const action = this.actions.find((candidate) => candidate.index === to.actionCount)
        return isPushPiece(action) ? action : undefined
    }

    // None when the view passes to the other player as the Undo lands, as the harness's
    // Non-active view does.
    restagedPush(to: Pick<GipfGameState, 'actionCount'>): PushPiece | undefined {
        const push = this.undoingPush
        if (push === undefined || push.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : push
    }

    get releasedByPlayer(): boolean {
        return (
            this.changedByPlayer &&
            !this.isViewingHistory &&
            this.selectionOwner === this.myPlayer?.id
        )
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        this.changedByPlayer = false
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
        const incoming = this.presentingState
        const push = kind === 'undo' && incoming ? this.restagedPush(incoming) : undefined
        if (incoming && push) {
            this.selection = restagedGipfSelection(push, this.hadTypeChoice(push, incoming))
            this.selectionOwner = push.playerId
        }
        if (kind !== 'undo') this.undoingPush = undefined
    }

    private hadTypeChoice(push: PushPiece, state: HydratedGipfGameState): boolean {
        return state.canPlaySingle(push.playerId) && state.canPlayGipf(push.playerId)
    }

    toggleGipf() {
        if (!this.choosesType || this.chosenDot === undefined) return
        this.select(
            setGipfSelection(this.ownSelection, 'gipf', this.chosenGipf ? false : undefined)
        )
    }

    chooseDot(dot: AxialCoordinates) {
        if (!includesCoords(this.entryDots, dot)) return
        const same = this.chosenDot !== undefined && sameCoordinates(this.chosenDot, dot)
        if (same && this.choosesType) return this.toggleGipf()
        this.select(setGipfSelection(this.ownSelection, 'dot', same ? undefined : dot))
    }

    letGo() {
        if (this.chosenDot === undefined) return
        this.select(setGipfSelection(this.ownSelection, 'dot', undefined))
    }

    // A piece can belong to two crossing rows; choosing it again moves to the next one.
    chooseRowAt(coords: AxialCoordinates) {
        const containing = this.rows.filter((row) => includesCoords(row.reach, coords))
        if (containing.length === 0) return
        const current = this.chosenRow ? containing.findIndex((row) => row === this.chosenRow) : -1
        const next = containing[(current + 1) % containing.length]
        const keepGoing = current < 0 || containing.length > 1
        this.select(
            setGipfSelection(this.ownSelection, 'row', keepGoing ? this.rowKey(next) : undefined)
        )
    }

    toggleKeep(coords: AxialCoordinates) {
        if (!includesCoords(this.rowGipfPieces, coords)) return
        const keys = this.keep.map((kept) => coordinatesToNumber(kept))
        const key = coordinatesToNumber(coords)
        const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
        this.select(pushGipfKeep(this.ownSelection, next))
    }

    private select(selection: GipfSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
        this.changedByPlayer = true
    }

    async push(target: AxialCoordinates) {
        const entry = this.targets.find((candidate) => sameCoordinates(candidate.line[0], target))
        const gipf = this.chosenGipf
        if (entry === undefined || gipf === undefined) return
        await this.applyAction(
            this.createPlayerAction(PushPiece, { dot: entry.dot, to: entry.line[0], gipf })
        )
    }

    async removeChosenRow() {
        const row = this.chosenRow
        if (row === undefined || this.removing.length === 0) return
        await this.applyAction(
            this.createPlayerAction(RemoveRow, { from: row.from, to: row.to, keep: this.keep })
        )
    }

    async finishRemoving() {
        if (!this.canFinish) return
        await this.applyAction(this.createPlayerAction(FinishRemoving, {}))
    }
}
