import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    isMoveRing,
    MoveRing,
    PlaceRing,
    pointKey,
    POINTS,
    RemoveRing,
    RemoveRow,
    YinshPreferenceDefinition,
    type HydratedYinshGameState,
    type RingMove,
    type YinshGameState,
    type YinshPreferences
} from '@tabletop/yinsh'
import { setYinshSelection, YinshStageOrder, type YinshSelection } from './stagedSelection.js'
import { includesCoords, rowChoice, rowsThrough, type Row, type RowChoice } from './rowChoice.js'
import { toneOf, type Tone } from '$lib/board/pieceStyle.js'
import { STAGED_DROP } from '$lib/board/dropIn.js'
import { viewOf, type BoardView } from '$lib/board/geometry.js'

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once and drops the rest of its replay: another state is being shown.
    abandon(): void
    // Lands the move at once: its motion was laid out in a view no longer shown.
    interrupt(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<YinshGameState, HydratedYinshGameState>
>[0]

export class YinshGameSession extends GameSession<YinshGameState, HydratedYinshGameState> {
    selection: YinshSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: YinshSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    // The move being taken back: your own Undo puts its ring back chosen, the marker still in it.
    private undoingMove: MoveRing | undefined
    // Whether the chosen ring is one Undo put back, so its marker is already in it.
    restaged: boolean = $state(false)
    // A ring just put down, whose staged marker is lifting back out of it.
    lifting: AxialCoordinates | undefined = $state()
    moveInterrupter: MoveInterrupter | undefined
    // When the staged marker began to drop into the chosen ring, in ms.
    private stagedAt = -Infinity

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                YinshStageOrder,
                () => this.ownSelection,
                (selection) => this.select(selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof YinshPreferences> =
        this.createPreferences(YinshPreferenceDefinition)
    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // The board seen from the far side, half a turn round, ring spaces and all.
    turned: boolean = $derived(this.preferences.values.turned)

    toggleTurned() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    view: BoardView = $derived(viewOf(this.turned))

    // Like the board, the ring spaces stay put whoever is watching. The starting player, White,
    // has theirs at the top, as their card is above the other in the players panel.
    topPlayerId: string = $derived(this.gameState.turnManager.turnOrder[0])

    canPlace = $derived(this.canAct(ActionType.PlaceRing))
    canMove = $derived(this.canAct(ActionType.MoveRing))
    canRemoveRow = $derived(this.canAct(ActionType.RemoveRow))
    canRemoveRing = $derived(this.canAct(ActionType.RemoveRing))

    private actorId: string | undefined = $derived(this.myPlayer?.id)

    placeable: AxialCoordinates[] = $derived(
        this.canPlace ? POINTS.filter((coords) => this.gameState.board.isVacant(coords)) : []
    )

    private ringMoves: { from: AxialCoordinates; moves: RingMove[] }[] = $derived(
        this.canMove && this.actorId !== undefined ? this.gameState.movesFor(this.actorId) : []
    )

    movable: AxialCoordinates[] = $derived(this.ringMoves.map((ring) => ring.from))

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => pointKey(coords) === this.ownSelection.from?.value)
    )

    destinations: RingMove[] = $derived(
        this.ringMoves.find(
            (ring) => this.chosenFrom && sameCoordinates(ring.from, this.chosenFrom)
        )?.moves ?? []
    )

    private rows: Row[] = $derived(
        this.canRemoveRow && this.actorId !== undefined
            ? this.gameState.board.rowsOf(this.actorId)
            : []
    )

    anchor: AxialCoordinates | undefined = $derived(
        this.rows.flat().find((coords) => pointKey(coords) === this.ownSelection.anchor?.value)
    )

    rowOptions: RowChoice = $derived(rowChoice(this.rows, this.anchor))

    removableRings: AxialCoordinates[] = $derived(
        this.canRemoveRing && this.actorId !== undefined
            ? this.gameState.board.ringsOf(this.actorId)
            : []
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

    override willUndo(action: GameAction): void {
        this.undoingMove = isMoveRing(action) ? action : undefined
    }

    get presentingState(): HydratedYinshGameState | undefined {
        return this.incomingGameState
    }

    // The move your own Undo takes back from `to`, whose ring is chosen again. None when the
    // view passes to the other player as the Undo lands, as the harness's Non-active view does.
    restagedMove(to: Pick<YinshGameState, 'actionCount'>): MoveRing | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    // Whether the Undo leading to `to` leaves the marker at `coords` in its ring, to be chosen
    // again.
    keepsMarker(to: Pick<YinshGameState, 'actionCount'>, coords: AxialCoordinates): boolean {
        const move = this.restagedMove(to)
        return move !== undefined && sameCoordinates(move.from, coords)
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
        const incoming = this.presentingState
        const move = kind === 'undo' && incoming ? this.restagedMove(incoming) : undefined
        if (move) {
            this.selection = setYinshSelection({}, 'from', pointKey(move.from))
            this.selectionOwner = move.playerId
        }
        this.restaged = move !== undefined
        this.lifting = undefined
        this.undoingMove = undefined
    }

    liftedOut() {
        this.lifting = undefined
    }

    // The staged marker's drop has begun to play.
    stagedDropStarted() {
        this.stagedAt = performance.now()
    }

    // How much of the staged marker's drop is still to play, in seconds: a move made while it is
    // still falling carries it the rest of the way.
    stagedDropLeft(): number {
        if (this.restaged) return 0
        return Math.max(0, STAGED_DROP - (performance.now() - this.stagedAt) / 1000)
    }

    isClickable(coords: AxialCoordinates): boolean {
        return (
            includesCoords(this.placeable, coords) ||
            this.destinations.some((move) => sameCoordinates(move.to, coords)) ||
            includesCoords(this.movable, coords) ||
            includesCoords(this.rowOptions.markers, coords) ||
            includesCoords(this.removableRings, coords)
        )
    }

    async choosePoint(coords: AxialCoordinates) {
        if (this.moving) return
        if (includesCoords(this.placeable, coords)) {
            await this.applyAction(this.createPlayerAction(PlaceRing, { coords }))
        } else if (
            this.chosenFrom &&
            this.destinations.some((m) => sameCoordinates(m.to, coords))
        ) {
            await this.applyAction(
                this.createPlayerAction(MoveRing, { from: this.chosenFrom, to: coords })
            )
        } else if (includesCoords(this.movable, coords)) {
            this.chooseRing(coords)
        } else if (includesCoords(this.rowOptions.markers, coords)) {
            await this.chooseMarker(coords)
        } else if (includesCoords(this.removableRings, coords)) {
            await this.applyAction(this.createPlayerAction(RemoveRing, { coords }))
        }
    }

    // Tapping where there is nothing to choose lets go of a chosen ring or row end.
    letGo() {
        if (this.moving) return
        if (this.chosenFrom) this.chooseRing(this.chosenFrom)
        else if (this.anchor) this.select(setYinshSelection(this.ownSelection, 'anchor', undefined))
    }

    private chooseRing(coords: AxialCoordinates) {
        const chosen = this.chosenFrom
        const same = chosen !== undefined && sameCoordinates(chosen, coords)
        // Choosing again the ring whose marker is lifting out drops a marker in afresh.
        if (chosen === undefined && this.lifting && sameCoordinates(this.lifting, coords)) {
            this.lifting = undefined
        }
        this.select(
            setYinshSelection(this.ownSelection, 'from', same ? undefined : pointKey(coords))
        )
    }

    private async chooseMarker(coords: AxialCoordinates) {
        if (this.anchor && sameCoordinates(this.anchor, coords)) {
            this.select(setYinshSelection(this.ownSelection, 'anchor', undefined))
            return
        }
        if (includesCoords(this.rowOptions.settling, coords)) {
            const through = this.anchor === undefined ? [coords] : [this.anchor, coords]
            const [row] = rowsThrough(this.rows, ...through)
            await this.applyAction(
                this.createPlayerAction(RemoveRow, { from: row[0], to: row[row.length - 1] })
            )
            return
        }
        this.select(setYinshSelection(this.ownSelection, 'anchor', pointKey(coords)))
    }

    // Every change of selection the player makes, by a tap or Undo. A ring let go lifts its
    // staged marker back out; a new state clears the selection without one, as the next
    // beforeNewState puts `lifting` back.
    private select(selection: YinshSelection) {
        const chosen = this.chosenFrom
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
        this.restaged = false
        const now = this.chosenFrom
        if (chosen && !(now && sameCoordinates(now, chosen))) this.lifting = chosen
    }
}
