import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

type BiddingForTurnOrderAction = HydratedPass

export class BiddingForTurnOrderStateHandler implements MachineStateHandler<BiddingForTurnOrderAction, HydratedIndonesiaGameState> {

    isValidAction(action: HydratedAction, context: MachineContext<HydratedIndonesiaGameState>): action is BiddingForTurnOrderAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedIndonesiaGameState>): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []


        if (HydratedPass.canPass(gameState, playerId)) {

            validActions.push(ActionType.Pass)

        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {

    }

    onAction(action: BiddingForTurnOrderAction, context: MachineContext<HydratedIndonesiaGameState>): MachineState {
        switch (true) {
            case isPass(action): {
                return MachineState.BiddingForTurnOrder
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
