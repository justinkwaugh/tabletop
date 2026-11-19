import {
    GameSession,
    type PresentedTransition,
    type TitlePreferences
} from '@tabletop/frontend-components'
import { Color } from '@tabletop/common'
import {
    ActionType,
    PlaceStone,
    SwapColors,
    YPreferenceDefinition,
    type HydratedYGameState,
    type StoneColor,
    type YGameState,
    type YPreferences
} from '@tabletop/game-of-y'

// Lets the session stop the move the board animator is playing.
export type MoveInterrupter = {
    // Lands the move at once; the rest of its replay still plays.
    interrupt(): void
    // Lands it and drops the rest of its replay: another state is being shown.
    abandon(): void
}

export class YGameSession extends GameSession<YGameState, HydratedYGameState> {
    moveInterrupter: MoveInterrupter | undefined

    readonly preferences: TitlePreferences<typeof YPreferences> =
        this.createPreferences(YPreferenceDefinition)

    showCoordinates: boolean = $derived(this.preferences.values.showCoordinates)

    toggleCoordinates() {
        this.moveInterrupter?.interrupt()
        this.preferences.set({ showCoordinates: !this.showCoordinates })
    }

    canPlace = $derived(this.canAct(ActionType.PlaceStone))
    canSwap = $derived(this.canAct(ActionType.SwapColors))

    placeable: ReadonlySet<string> = $derived(
        new Set(this.canPlace ? this.gameState.board.vacantPoints() : [])
    )

    private canAct(type: ActionType): boolean {
        return !this.isViewingHistory && this.isMyTurn && this.validActionTypes.includes(type)
    }

    colorOf(playerId: string): StoneColor {
        return this.gameState.getPlayerState(playerId).color === Color.Black
            ? Color.Black
            : Color.White
    }

    get presentingState(): HydratedYGameState | undefined {
        return this.incomingGameState
    }

    override beforeNewState({ kind }: PresentedTransition): void {
        if (kind === 'view-switch') this.moveInterrupter?.abandon()
    }

    async placeStone(point: string) {
        if (this.updatingVisibleState || !this.placeable.has(point)) return
        await this.applyAction(this.createPlayerAction(PlaceStone, { point }))
    }

    async swapColors() {
        if (this.updatingVisibleState || !this.canSwap) return
        await this.applyAction(this.createPlayerAction(SwapColors, {}))
    }
}
