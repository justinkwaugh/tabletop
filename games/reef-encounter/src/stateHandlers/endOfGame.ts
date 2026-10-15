import {
    GameResult,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedReefEncounterGameState
> {
    isValidAction(_action: HydratedAction): _action is HydratedAction {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        const gameState = context.gameState
        const winners = gameState.leadingPlayerIds()
        gameState.result = winners.length === 1 ? GameResult.Win : GameResult.Draw
        gameState.winningPlayerIds = winners
        gameState.activePlayerIds = []
    }

    onAction(): MachineState {
        throw Error('No actions are valid at the end of the game')
    }
}
