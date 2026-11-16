import {
    GameSession,
    undoableStagedSelection,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    ClaimColor,
    isMoveStack,
    LyngkPreferenceDefinition,
    MoveStack,
    pointKey,
    POINTS,
    type LyngkGameState,
    type LyngkPreferences,
    type HydratedLyngkGameState,
    type MovePath,
    type PieceColor
} from '@tabletop/lyngk'
import { LyngkStageOrder, setLyngkSelection, type LyngkSelection } from './stagedSelection.js'
import { viewOf, type BoardView } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

// Lets the session stop the motion an animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

type SessionOptions = ConstructorParameters<
    typeof GameSession<LyngkGameState, HydratedLyngkGameState>
>[0]

export class LyngkGameSession extends GameSession<LyngkGameState, HydratedLyngkGameState> {
    selection: LyngkSelection = $state({})
    // Anyone but the selection's owner, as the harness's Non-active view can be after an Undo,
    // sees none of it, and Undo passes it by.
    private selectionOwner: string | undefined = $state()
    private ownSelection: LyngkSelection = $derived(
        this.selectionOwner !== undefined && this.selectionOwner === this.myPlayer?.id
            ? this.selection
            : {}
    )
    // The move your own Undo takes back, whose stack is picked up again as it lands.
    private undoingMove: MoveStack | undefined
    readonly moveInterrupters = new Set<MoveInterrupter>()
    // Until the state lands: the stacks each player has scored once a step that scores or
    // unscores one ends, set as it starts, so a stack is never drawn on the board and on a card.
    private landingScores: Map<string, number[][]> | undefined = $derived.by(() => {
        void this.gameState
        return undefined
    })

    constructor(options: SessionOptions) {
        super(options)
        this.localSelections.register(
            undoableStagedSelection(
                LyngkStageOrder,
                () => this.ownSelection,
                (selection) => this.select(selection)
            )
        )
    }

    readonly preferences: TitlePreferences<typeof LyngkPreferences> =
        this.createPreferences(LyngkPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // The board seen from the far side, half a turn round, to see behind tall stacks.
    turned: boolean = $derived(this.preferences.values.turned)

    // A move's motion is laid out in the view it started in, so turning the board lands it.
    toggleTurned() {
        for (const interrupter of this.moveInterrupters) interrupter.interrupt()
        this.preferences.set({ turned: !this.turned })
    }

    view: BoardView = $derived(viewOf(this.turned))
    notation: BoardNotation = $derived(boardNotation(POINTS, this.view))

    canMove = $derived(this.canAct(ActionType.MoveStack))
    canClaim = $derived(this.canAct(ActionType.ClaimColor))

    claimable: PieceColor[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canClaim && playerId !== undefined
            ? this.gameState.claimableColors(playerId)
            : []
    })

    paths: MovePath[] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.canMove && playerId !== undefined ? this.gameState.pathsFor(playerId) : []
    })

    movable: AxialCoordinates[] = $derived(this.uniqueCoords(this.paths.map((path) => path.from)))

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => pointKey(coords) === this.ownSelection.from?.value)
    )

    // Every point the chosen stack can land on, directly or through LYNGK-points: the route
    // never changes the outcome, so one tap on the destination is the whole move.
    landings: AxialCoordinates[] = $derived(
        this.chosenFrom === undefined ? [] : this.landingsFrom(this.paths, this.chosenFrom)
    )

    // The LYNGK connections from the chosen stack, shown whether or not a move goes through them,
    // and the LYNGK-points they reach, marked so the reach makes sense.
    chainLinks: [AxialCoordinates, AxialCoordinates][] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.chosenFrom === undefined || playerId === undefined
            ? []
            : this.gameState.board.lyngkConnections(
                  this.chosenFrom,
                  this.gameState.rightsOf(playerId).owned
              )
    })

    links: AxialCoordinates[] = $derived(
        this.uniqueCoords(this.chainLinks.flat()).filter(
            (coords) => this.chosenFrom && !sameCoordinates(coords, this.chosenFrom)
        )
    )

    // Where a stack can land among the moves given, each point once.
    private landingsFrom(paths: readonly MovePath[], from: AxialCoordinates): AxialCoordinates[] {
        return this.uniqueCoords(
            paths.filter((path) => sameCoordinates(path.from, from)).map((path) => path.to)
        )
    }

    private uniqueCoords(list: readonly AxialCoordinates[]): AxialCoordinates[] {
        const unique: AxialCoordinates[] = []
        for (const coords of list) {
            if (!includesCoords(unique, coords)) unique.push(coords)
        }
        return unique
    }

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    // Once a move is played, its motion runs on the state it started from, whose choices still
    // show as they fade; taps on them do nothing until the new state lands.
    private get moving(): boolean {
        return this.updatingVisibleState
    }

    // The stacks a player has scored, as the cards show them.
    scoredOf(playerId: string): number[][] {
        return this.landingScores?.get(playerId) ?? this.gameState.getPlayerState(playerId).scored
    }

    // A step that scores or unscores a stack starts: show each player's scored stacks as they
    // will be.
    landScores(to: HydratedLyngkGameState) {
        this.landingScores = new Map(to.players.map((player) => [player.playerId, player.scored]))
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isMoveStack(action) ? action : undefined
    }

    get presentingState(): HydratedLyngkGameState | undefined {
        return this.incomingGameState
    }

    // The move your own Undo takes back from `to`. None when the view passes to the other player
    // as the Undo lands, as the harness's Non-active view does.
    restagedMove(to: Pick<LyngkGameState, 'actionCount'>): MoveStack | undefined {
        const move = this.undoingMove
        if (move === undefined || move.index !== to.actionCount) return undefined
        return this.isViewingAsNonActivePlayer ? undefined : move
    }

    // The move a step back to `to` takes back, from the actions on screen, whose route the boards
    // alone cannot tell.
    undoneMove(to: Pick<LyngkGameState, 'actionCount'>): MoveStack | undefined {
        const action = this.actions.find((candidate) => candidate.index === to.actionCount)
        return isMoveStack(action) ? action : undefined
    }

    // Taking your move back picks its stack up again, as it was held just before it landed, so
    // another place can be tapped; unless it had only the one place to go. A further Undo lets go
    // of it.
    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') {
            for (const interrupter of this.moveInterrupters) interrupter.abandon()
        }
        if (kind === 'undo') {
            const incoming = this.presentingState
            if (incoming === undefined) throw Error('An Undo presents the state it leads to')
            const move = this.restagedMove(incoming)
            if (move && this.landingsFrom(incoming.pathsFor(move.playerId), move.from).length > 1) {
                this.selection = setLyngkSelection({}, 'from', pointKey(move.from))
                this.selectionOwner = move.playerId
            }
        }
        this.undoingMove = undefined
    }

    // A tap lands the chosen stack, or picks up (or puts back) a stack.
    async choosePoint(coords: AxialCoordinates) {
        if (this.moving) return
        if (includesCoords(this.landings, coords)) {
            await this.land(coords)
        } else if (includesCoords(this.movable, coords)) {
            const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, coords)
            this.select(
                setLyngkSelection(this.ownSelection, 'from', same ? undefined : pointKey(coords))
            )
        }
    }

    // Tapping where there is nothing to choose lets go of a chosen stack.
    letGo() {
        if (this.moving || this.chosenFrom === undefined) return
        this.select(setLyngkSelection(this.ownSelection, 'from', undefined))
    }

    private select(selection: LyngkSelection) {
        this.selection = selection
        this.selectionOwner = this.myPlayer?.id
    }

    private async land(to: AxialCoordinates) {
        const from = this.chosenFrom
        const playerId = this.myPlayer?.id
        if (from === undefined || playerId === undefined) throw Error('Only a chosen stack lands')
        const route = this.gameState.board.shortestPath(
            from,
            to,
            this.gameState.rightsOf(playerId),
            this.gameState.rules.maxHeight
        )
        if (route === undefined) throw Error('A landing has a route')
        await this.applyAction(
            this.createPlayerAction(MoveStack, { from: route.from, via: route.via, to })
        )
    }

    async claim(color: PieceColor) {
        if (this.moving || !this.claimable.includes(color)) return
        await this.applyAction(this.createPlayerAction(ClaimColor, { color }))
    }
}
