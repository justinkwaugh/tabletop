import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import {
    ActionType,
    PlaceStone,
    SwapColors,
    HexPreferenceDefinition,
    type HydratedHexGameState,
    type StoneColor,
    type HexGameState,
    type HexPreferences
} from '@tabletop/hex'

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

export class HexGameSession extends GameSession<HexGameState, HydratedHexGameState> {
    moveInterrupter: MoveInterrupter | undefined

    readonly preferences: TitlePreferences<typeof HexPreferences> =
        this.createPreferences(HexPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    // The board turned a quarter, standing upright.
    upright: boolean = $derived(this.preferences.values.upright)

    toggleUpright() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ upright: !this.upright })
    }

    canPlace = $derived(this.canAct(ActionType.PlaceStone))
    canSwap = $derived(this.canAct(ActionType.SwapColors))

    placeable: ReadonlySet<string> = $derived(
        new Set(this.canPlace ? this.gameState.board.vacantCells() : [])
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    colorOf(playerId: string): StoneColor {
        return this.gameState.colorOf(playerId)
    }

    get presentingState(): HydratedHexGameState | undefined {
        return this.incomingGameState
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
    }

    async placeStone(cell: string) {
        if (this.updatingVisibleState || !this.placeable.has(cell)) return
        await this.applyAction(this.createPlayerAction(PlaceStone, { cell }))
    }

    async swapColors() {
        if (this.updatingVisibleState || !this.canSwap) return
        await this.applyAction(this.createPlayerAction(SwapColors, {}))
    }
}
