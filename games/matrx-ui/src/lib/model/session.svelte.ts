import { GameSession, type PresentedTransition } from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    CENTRE,
    ExtraMove,
    isExtraMove,
    isMovePotential,
    isPushPiece,
    MovePotential,
    PieceKind,
    PushPiece,
    RemoveRow,
    SkipExtraMove,
    type Entry,
    type HydratedMatrxGameState,
    type MatrxGameState,
    type PotentialKind,
    type Row
} from '@tabletop/matrx'
import {
    hasManualMatrxSelection,
    popMatrxSelection,
    setMatrxSelection,
    type MatrxSelection
} from './stagedSelection.js'
import { coordsKey, viewOf, type BoardView } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'
import { discsOf, type BoardDisc } from '$lib/board/boardChange.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export function rowKey(row: Row): string {
    return `${coordsKey(row.from)}|${coordsKey(row.to)}`
}

// The moves Undo walks back through one choice at a time: a push or extra move returns its piece
// to its dot, a potential's move returns it to its stack, still chosen.
type StepBack = PushPiece | ExtraMove | MovePotential

function isStepBack(action: GameAction): action is StepBack {
    return isPushPiece(action) || isExtraMove(action) || isMovePotential(action)
}

export class MatrxGameSession extends GameSession<MatrxGameState, HydratedMatrxGameState> {
    selection: MatrxSelection = $state({})
    // The kind you last chose to bring in, kept from turn to turn.
    preferredKind: PieceKind | undefined = $state()
    // The move being undone, and the move history last stepped to.
    undoingMove: StepBack | undefined
    historyMove: StepBack | undefined

    view: BoardView = $derived(viewOf(this.gameState.board.shape))
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

    // What goes onto the chosen dot: the TAMSK piece of an extra move, or the chosen kind, with
    // the ids its discs will have, so they lie the same way round once in.
    stagedDiscs: BoardDisc[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        if (playerId === undefined) return []
        if (this.canExtraMove) {
            const centre = this.gameState.board.topAt(CENTRE)
            return [(centre && discsOf([centre])[1]) ?? { playerId, kind: PieceKind.Tamsk }]
        }
        const kind = this.chosenKind
        if (kind === undefined) return []
        // As the logic numbers them, from 0 in a game from before ids.
        const first = this.gameState.nextDiscId ?? 0
        return Array.from({ length: kind === PieceKind.Gipf ? 1 : 2 }, (_, index) => ({
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
        const manual = this.selection.dot?.value
        return manual !== undefined && includesCoords(this.entryDots, manual) ? manual : undefined
    })

    // The kind of the stack standing on the chosen dot, out of your reserve until it goes in or
    // comes back off; not the TAMSK piece of an extra move, which comes from the board.
    stagedKind: PieceKind | undefined = $derived(
        this.chosenDot !== undefined && !this.canExtraMove ? this.chosenKind : undefined
    )

    // How many of a kind a player has in reserve, less the stack standing on the chosen dot.
    inReserve(playerId: string, kind: PotentialKind): number {
        const staged = playerId === this.myPlayer?.id && this.stagedKind === kind ? 2 : 0
        return this.gameState.getPlayerState(playerId).potentials[kind] - staged
    }

    targets: Entry[] = $derived.by(() => {
        const dot = this.chosenDot
        return dot === undefined
            ? []
            : this.entries.filter((entry) => sameCoordinates(entry.dot, dot))
    })

    // Your stacks of two that can move now, each with where it can go.
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
        const manual = this.selection.from?.value
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
        const manual = this.selection.row?.value
        const found = this.rows.find((row) => rowKey(row) === manual)
        if (found) return found
        return this.rows.length === 1 ? this.rows[0] : undefined
    })

    // Stacks of two in the chosen row, which may stay; every single piece goes.
    rowPairs: AxialCoordinates[] = $derived.by(() => {
        const row = this.chosenRow
        if (row === undefined) return []
        return row.reach.filter((coords) => this.gameState.board.topAt(coords)?.paired === true)
    })

    // Your own stacks stay and the opponent's go unless you mark them otherwise.
    keep: AxialCoordinates[] = $derived.by(() => {
        const manual = this.selection.keep?.value
        if (manual === undefined) {
            const playerId = this.myPlayer?.id
            return this.rowPairs.filter(
                (coords) => this.gameState.board.topAt(coords)?.playerId === playerId
            )
        }
        return this.rowPairs.filter((coords) => manual.includes(coordsKey(coords)))
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

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    hasManualSelection(): boolean {
        return hasManualMatrxSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popMatrxSelection(this.selection)
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
        this.selection = setMatrxSelection({}, 'dot', same ? undefined : dot)
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
        this.selection = setMatrxSelection({}, 'from', same ? undefined : from)
    }

    // Tapping where there is nothing to choose lets go of a chosen stack or dot.
    letGo() {
        if (this.chosenFrom === undefined && this.chosenDot === undefined) return
        this.selection = setMatrxSelection(this.selection, 'from', undefined)
    }

    // A piece can belong to two crossing rows; choosing it again moves to the next one.
    chooseRowAt(coords: AxialCoordinates) {
        const containing = this.rows.filter((row) => includesCoords(row.reach, coords))
        if (containing.length === 0) return
        const current = this.chosenRow ? containing.findIndex((row) => row === this.chosenRow) : -1
        const next = containing[(current + 1) % containing.length]
        const keepGoing = current < 0 || containing.length > 1
        this.selection = setMatrxSelection(
            this.selection,
            'row',
            keepGoing ? rowKey(next) : undefined
        )
    }

    toggleKeep(coords: AxialCoordinates) {
        if (!includesCoords(this.rowPairs, coords)) return
        const keys = this.keep.map(coordsKey)
        const key = coordsKey(coords)
        const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
        this.selection = setMatrxSelection(this.selection, 'keep', next)
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
