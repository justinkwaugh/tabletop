import { ActionSource, type HydratedAction, type MachineStateHandler } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedEndGame, isEndGame } from '../actions/endGame.js'

export class EndingGameStateHandler implements MachineStateHandler<
    HydratedEndGame,
    HydratedReefEncounterGameState
> {
    isValidAction(action: HydratedAction): action is HydratedEndGame {
        return isEndGame(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter() {}

    onAction(): MachineState {
        return MachineState.EndOfGame
    }
}
