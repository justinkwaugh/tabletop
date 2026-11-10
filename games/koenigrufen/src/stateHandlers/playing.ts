import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedPlayCard, isPlayCard } from '../actions/playCard.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class PlayingStateHandler implements MachineStateHandler<
    HydratedPlayCard,
    HydratedKoenigrufenGameState
> {
    isValidAction(action: HydratedAction): action is HydratedPlayCard {
        return isPlayCard(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): ActionType[] {
        return playerId === context.gameState.nextToPlay() ? [ActionType.PlayCard] : []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        state.beginTurn(state.nextToPlay())
    }

    onAction(
        _action: HydratedPlayCard,
        context: MachineContext<HydratedKoenigrufenGameState>
    ): MachineState {
        const state = context.gameState
        state.finishTurn()
        return state.isHandOver() ? MachineState.EndingHand : MachineState.Playing
    }
}
