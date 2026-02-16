import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

type EndOfGameAction = HydratedAction

export class EndOfGameStateHandler implements MachineStateHandler<
    EndOfGameAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is EndOfGameAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {}

    onAction(
        action: EndOfGameAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        switch (true) {
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
