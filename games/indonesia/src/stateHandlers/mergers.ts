import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedProposeMerger, isProposeMerger } from '../actions/proposeMerger.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'

type MergersAction = HydratedProposeMerger

export class MergersStateHandler implements MachineStateHandler<MergersAction, HydratedIndonesiaGameState> {

    isValidAction(action: HydratedAction, context: MachineContext<HydratedIndonesiaGameState>): action is MergersAction {
        // Leave this comment if you want the template to generate code for valid actions
        return false
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedIndonesiaGameState>): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []


        if (HydratedProposeMerger.canProposeMerger(gameState, playerId)) {

            validActions.push(ActionType.ProposeMerger)

        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {

    }

    onAction(action: MergersAction, context: MachineContext<HydratedIndonesiaGameState>): MachineState {
        switch (true) {
            case isProposeMerger(action): {
                return MachineState.Mergers
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
