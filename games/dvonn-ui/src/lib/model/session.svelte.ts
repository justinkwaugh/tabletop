import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { sameCoordinates, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    isMoveStack,
    MoveStack,
    PlacePiece,
    DvonnPreferenceDefinition,
    type HydratedDvonnGameState,
    type DvonnGameState,
    type DvonnPreferences,
    type Piece
} from '@tabletop/dvonn'
import {
    hasManualDvonnSelection,
    popDvonnSelection,
    setDvonnSelection,
    type DvonnSelection
} from './stagedSelection.js'
import { coordsKey } from '$lib/board/geometry.js'
import { pieceTone, toneOf, type Tone } from '$lib/board/pieceStyle.js'

export function includesCoords(list: readonly AxialCoordinates[], coords: AxialCoordinates) {
    return list.some((candidate) => sameCoordinates(candidate, coords))
}

export class DvonnGameSession extends GameSession<DvonnGameState, HydratedDvonnGameState> {
    selection: DvonnSelection = $state({})

    // The move an Undo under way takes back, and the move history last stepped to: the board
    // animator follows them where the two boards alone cannot say which stack moved.
    undoingMove: MoveStack | undefined
    historyMove: MoveStack | undefined

    readonly preferences: TitlePreferences<typeof DvonnPreferences> =
        this.createPreferences(DvonnPreferenceDefinition)

    graphBoard: boolean = $derived(this.preferences.values.graphBoard)

    toggleGraphBoard() {
        this.preferences.set({ graphBoard: !this.graphBoard })
    }

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    canPlace = $derived(this.canAct(ActionType.PlacePiece))
    canMove = $derived(this.canAct(ActionType.MoveStack))

    private actorId: string | undefined = $derived(this.myPlayer?.id)

    placeable: AxialCoordinates[] = $derived(
        this.canPlace ? this.gameState.board.vacantSpaces() : []
    )

    // A placement puts down a DVONN piece until all three are on the board.
    placingDvonn: boolean = $derived(this.canPlace && this.gameState.placesDvonnNext())

    movable: AxialCoordinates[] = $derived(
        this.canMove && this.actorId !== undefined ? this.gameState.movableStacks(this.actorId) : []
    )

    chosenFrom: AxialCoordinates | undefined = $derived(
        this.movable.find((coords) => coordsKey(coords) === this.selection.from?.value)
    )

    destinations: AxialCoordinates[] = $derived(
        this.chosenFrom ? this.gameState.board.destinationsFrom(this.chosenFrom) : []
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    toneOfPlayer(playerId: string): Tone {
        return toneOf(this.gameState.getPlayerState(playerId).color)
    }

    toneOfPiece(piece: Piece): Tone {
        return pieceTone(piece, (playerId) => this.toneOfPlayer(playerId))
    }

    hasManualSelection(): boolean {
        return hasManualDvonnSelection(this.selection)
    }

    override async undo() {
        if (this.hasManualSelection()) {
            this.selection = popDvonnSelection(this.selection)
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

    // Undoing a move hops the stack home and leaves it chosen; the next Undo puts it down.
    override beforeNewState({ kind }: PresentedTransition): void {
        const move = kind === 'undo' ? this.undoingMove : undefined
        this.selection = move ? setDvonnSelection({}, 'from', coordsKey(move.from)) : {}
        if (kind !== 'undo') this.undoingMove = undefined
    }

    // Tapping where there is nothing to choose lets go of a chosen stack.
    letGo() {
        if (this.chosenFrom === undefined) return
        this.selection = setDvonnSelection(this.selection, 'from', undefined)
    }

    isClickable(coords: AxialCoordinates): boolean {
        return (
            includesCoords(this.placeable, coords) ||
            includesCoords(this.destinations, coords) ||
            includesCoords(this.movable, coords)
        )
    }

    async chooseSpace(coords: AxialCoordinates) {
        if (includesCoords(this.placeable, coords)) {
            await this.applyAction(this.createPlayerAction(PlacePiece, { coords }))
        } else if (this.chosenFrom && includesCoords(this.destinations, coords)) {
            await this.applyAction(
                this.createPlayerAction(MoveStack, { from: this.chosenFrom, to: coords })
            )
        } else if (includesCoords(this.movable, coords)) {
            const same = this.chosenFrom !== undefined && sameCoordinates(this.chosenFrom, coords)
            this.selection = setDvonnSelection(
                this.selection,
                'from',
                same ? undefined : coordsKey(coords)
            )
        }
    }
}
