import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    isPushPiece,
    ALL_POINTS,
    FinishRemoving,
    MachineState,
    PushPiece,
    RemoveRow,
    type Entry,
    type GipfGameState,
    type HydratedGipfGameState,
    type Row
} from '@tabletop/gipf'
import {
    hasManualGipfSelection,
    popGipfSelection,
    restagedGipfSelection,
    setGipfSelection,
    type GipfSelection
} from './stagedSelection.js'
import { coordsKey } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export function rowKey(row: Row): string {
    return `${coordsKey(row.from)}|${coordsKey(row.to)}`
}

const NOTATION = boardNotation(ALL_POINTS)

export class GipfGameSession extends GameSession<GipfGameState, HydratedGipfGameState> {
    selection: GipfSelection = $state({})
    // The push being undone. Undo takes your piece back out onto its dot, staged as you chose it,
    // and a further Undo takes it off the dot.
    undoingPush: PushPiece | undefined
    // The push history last stepped to, whose piece came in from its own dot.
    historyPush: PushPiece | undefined

    readonly notation: BoardNotation = NOTATION

    canPush = $derived(this.canAct(ActionType.PushPiece))
    canRemove = $derived(this.canAct(ActionType.RemoveRow))
    canFinish = $derived(this.canAct(ActionType.FinishRemoving))

    // false is a single piece, true a GIPF-piece.
    pieceTypes: boolean[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (!this.canPush || playerId === undefined) return []
        return [
            ...(this.gameState.canPlaySingle(playerId) ? [false] : []),
            ...(this.gameState.canPlayGipf(playerId) ? [true] : [])
        ]
    })

    // Whether you may choose between a single piece and a GIPF-piece.
    choosesType: boolean = $derived(this.pieceTypes.length > 1)

    // A piece you may choose comes in single until you make it a GIPF-piece.
    chosenGipf: boolean | undefined = $derived.by(() => {
        const manual = this.selection.gipf?.value
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
        const manual = this.selection.dot?.value
        return manual !== undefined && includesCoords(this.entryDots, manual) ? manual : undefined
    })

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
        const manual = this.selection.row?.value
        const found = this.rows.find((row) => rowKey(row) === manual)
        if (found) return found
        const mandatory = this.rows.filter((row) => this.gameState.board.isMandatory(row))
        return mandatory.length === 1 && this.rows.length === 1 ? mandatory[0] : undefined
    })

    // Your own GIPF-pieces in the chosen row, which stay unless you mark them; the opponent's are
    // always taken.
    rowGipfPieces: AxialCoordinates[] = $derived.by(() => {
        const row = this.chosenRow
        if (row === undefined) return []
        return row.reach.filter((coords) => {
            const piece = this.gameState.board.pieceAt(coords)
            return piece?.gipf === true && piece.playerId === this.myPlayer?.id
        })
    })

    keep: AxialCoordinates[] = $derived.by(() => {
        const manual = this.selection.keep?.value
        if (manual !== undefined) {
            return this.rowGipfPieces.filter((coords) => manual.includes(coordsKey(coords)))
        }
        return this.rowGipfPieces
    })

    removing: AxialCoordinates[] = $derived(
        this.chosenRow
            ? this.chosenRow.reach.filter((coords) => !includesCoords(this.keep, coords))
            : []
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    hasManualSelection(): boolean {
        return hasManualGipfSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popGipfSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = {}
    }

    override willUndo(action: GameAction): void {
        this.undoingPush = isPushPiece(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyPush = isPushPiece(action) ? action : undefined
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        const push = kind === 'undo' ? this.undoingPush : undefined
        this.selection = push ? restagedGipfSelection(push, this.hadTypeChoice(push)) : {}
        if (kind !== 'undo') this.undoingPush = undefined
    }

    // Whether the player of a push taken back could have brought in either piece type.
    private hadTypeChoice(push: PushPiece): boolean {
        const state = this.incomingGameState ?? this.gameState
        return state.canPlaySingle(push.playerId) && state.canPlayGipf(push.playerId)
    }

    // Choosing the piece on its dot again makes it a GIPF-piece, or single again.
    toggleGipf() {
        if (!this.choosesType || this.chosenDot === undefined) return
        this.selection = setGipfSelection(
            this.selection,
            'gipf',
            this.chosenGipf ? undefined : true
        )
    }

    chooseDot(dot: AxialCoordinates) {
        if (!includesCoords(this.entryDots, dot)) return
        const same = this.chosenDot !== undefined && sameCoordinates(this.chosenDot, dot)
        if (same && this.choosesType) return this.toggleGipf()
        this.selection = setGipfSelection(this.selection, 'dot', same ? undefined : dot)
    }

    // Tapping where there is nothing to choose lets go of a chosen dot.
    letGo() {
        if (this.chosenDot === undefined) return
        this.selection = setGipfSelection(this.selection, 'dot', undefined)
    }

    // A piece can belong to two crossing rows; choosing it again moves to the next one.
    chooseRowAt(coords: AxialCoordinates) {
        const containing = this.rows.filter((row) => includesCoords(row.reach, coords))
        if (containing.length === 0) return
        const current = this.chosenRow ? containing.findIndex((row) => row === this.chosenRow) : -1
        const next = containing[(current + 1) % containing.length]
        const keepGoing = current < 0 || containing.length > 1
        this.selection = setGipfSelection(
            this.selection,
            'row',
            keepGoing ? rowKey(next) : undefined
        )
    }

    toggleKeep(coords: AxialCoordinates) {
        if (!includesCoords(this.rowGipfPieces, coords)) return
        const keys = this.keep.map(coordsKey)
        const key = coordsKey(coords)
        const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
        this.selection = setGipfSelection(this.selection, 'keep', next)
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
