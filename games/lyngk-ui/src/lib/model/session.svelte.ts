import {
    GameSession,
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
    POINTS,
    type LyngkGameState,
    type LyngkPreferences,
    type HydratedLyngkGameState,
    type MovePath,
    type PieceColor
} from '@tabletop/lyngk'
import {
    hasManualLyngkSelection,
    popLyngkSelection,
    setLyngkSelection,
    type LyngkSelection
} from './stagedSelection.js'
import { coordsKey } from '$lib/board/geometry.js'
import { boardNotation, type BoardNotation } from '$lib/board/coordinates.js'
import { lyngkConnections, shortestRoute } from '$lib/board/route.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

function uniqueCoords(list: readonly AxialCoordinates[]): AxialCoordinates[] {
    const unique: AxialCoordinates[] = []
    for (const coords of list) {
        if (!includesCoords(unique, coords)) unique.push(coords)
    }
    return unique
}

const NOTATION = boardNotation(POINTS)

export class LyngkGameSession extends GameSession<LyngkGameState, HydratedLyngkGameState> {
    selection: LyngkSelection = $state({})

    readonly notation: BoardNotation = NOTATION

    readonly preferences: TitlePreferences<typeof LyngkPreferences> =
        this.createPreferences(LyngkPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // The move being taken back, and the one history last stepped to: the boards alone cannot
    // tell which LYNGK-points a chain went through.
    undoingMove: MoveStack | undefined
    historyMove: MoveStack | undefined

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

    movable: AxialCoordinates[] = $derived(uniqueCoords(this.paths.map((path) => path.from)))

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => coordsKey(coords) === this.selection.from?.value)
    )

    private pathsFromChosen: MovePath[] = $derived(
        this.chosenFrom === undefined
            ? []
            : this.paths.filter(
                  (path) => this.chosenFrom && sameCoordinates(path.from, this.chosenFrom)
              )
    )

    // Every point the chosen stack can land on, directly or through LYNGK-points: the route
    // never changes the outcome, so one tap on the destination is the whole move.
    landings: AxialCoordinates[] = $derived(
        uniqueCoords(this.pathsFromChosen.map((path) => path.to))
    )

    // The LYNGK connections from the chosen stack, shown whether or not a move goes through them,
    // and the LYNGK-points they reach, marked so the reach makes sense.
    chainLinks: [AxialCoordinates, AxialCoordinates][] = $derived.by(() => {
        const playerId = this.myPlayer?.id
        return this.chosenFrom === undefined || playerId === undefined
            ? []
            : lyngkConnections(
                  this.gameState.board,
                  this.chosenFrom,
                  this.gameState.rightsOf(playerId).owned
              )
    })

    links: AxialCoordinates[] = $derived(
        uniqueCoords(this.chainLinks.flat()).filter(
            (coords) => this.chosenFrom && !sameCoordinates(coords, this.chosenFrom)
        )
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    hasManualSelection(): boolean {
        return hasManualLyngkSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popLyngkSelection(this.selection)
            return
        }
        await super.undo()
    }

    resetAction() {
        this.selection = {}
    }

    override willUndo(action: GameAction): void {
        this.undoingMove = isMoveStack(action) ? action : undefined
    }

    override onHistoryAction(action?: GameAction): void {
        this.historyMove = isMoveStack(action) ? action : undefined
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        this.resetAction()
        if (kind !== 'undo') this.undoingMove = undefined
    }

    // A tap lands the chosen stack, or picks up (or puts back) a stack.
    async choosePoint(coords: AxialCoordinates) {
        if (includesCoords(this.landings, coords)) {
            await this.land(coords)
        } else if (includesCoords(this.movable, coords)) {
            const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, coords)
            this.selection = setLyngkSelection(
                this.selection,
                'from',
                same ? undefined : coordsKey(coords)
            )
        }
    }

    // Tapping where there is nothing to choose lets go of a chosen stack.
    letGo() {
        if (this.chosenFrom === undefined) return
        this.selection = setLyngkSelection(this.selection, 'from', undefined)
    }

    private async land(to: AxialCoordinates) {
        const from = this.chosenFrom
        const route = from === undefined ? undefined : shortestRoute(this.gameState, from, to)
        if (route === undefined) return
        await this.applyAction(
            this.createPlayerAction(MoveStack, { from: route.from, via: route.via, to })
        )
    }

    async claim(color: PieceColor) {
        if (!this.claimable.includes(color)) return
        await this.applyAction(this.createPlayerAction(ClaimColor, { color }))
    }
}
