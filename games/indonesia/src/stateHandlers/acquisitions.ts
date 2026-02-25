import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedStartCompany, isStartCompany } from '../actions/startCompany.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

type AcquisitionsAction = HydratedStartCompany

export class AcquisitionsStateHandler implements MachineStateHandler<AcquisitionsAction, HydratedIndonesiaGameState> {

    isValidAction(action: HydratedAction, context: MachineContext<HydratedIndonesiaGameState>): action is AcquisitionsAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isStartCompany(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedIndonesiaGameState>): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []


        if (HydratedStartCompany.canStartCompany(gameState, playerId)) {

            validActions.push(ActionType.StartCompany)

        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {

    }

    onAction(action: AcquisitionsAction, context: MachineContext<HydratedIndonesiaGameState>): MachineState {
        switch (true) {
            case isStartCompany(action): {
                return MachineState.Acquisitions
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
