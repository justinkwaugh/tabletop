import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedKoenigrufenGameState
> {
    isValidAction(_action: HydratedAction): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedKoenigrufenGameState>) {
        const state = context.gameState
        const winners = state.leadingPlayerIds()
        state.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        state.winningPlayerIds = winners
        state.activePlayerIds = []
    }

    onAction(): MachineState {
        throw Error('No actions are valid at the end of the game')
    }
}
