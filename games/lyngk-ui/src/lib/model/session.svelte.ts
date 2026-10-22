import { GameSession, type TitlePreferences } from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates } from '@tabletop/common'
import {
    ActionType,
    ClaimColor,
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
import { chainLinks, shortestRoute } from '$lib/board/route.js'

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

    lightBoard: boolean = $derived(this.preferences.values.lightBoard)

    toggleLightBoard() {
        this.preferences.set({ lightBoard: !this.lightBoard })
    }

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

    // The LYNGK-points the chosen stack can pass through, marked so the reach makes sense.
    links: AxialCoordinates[] = $derived(
        uniqueCoords(this.pathsFromChosen.flatMap((path) => path.via))
    )

    chainLinks: [AxialCoordinates, AxialCoordinates][] = $derived(chainLinks(this.pathsFromChosen))

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

    override beforeNewState(): void {
        this.resetAction()
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
