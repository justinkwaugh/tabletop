import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedLoseValue, isLoseValue } from '../actions/loseValue.js'

// Transition from LosingValue(LoseValue) -> Bidding
export class LosingValueStateHandler implements MachineStateHandler<HydratedLoseValue> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is HydratedLoseValue {
        if (!action.playerId) return false
        return action.type === ActionType.MoveGod
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext): ActionType[] {
        return [ActionType.MoveGod]
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState

        gameState.phases.startPhase(PhaseName.LosingValue, gameState.actionCount)
        gameState.activePlayerIds = []
    }

    onAction(action: HydratedLoseValue, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState

        switch (true) {
            case isLoseValue(action): {
                gameState.phases.endPhase(gameState.actionCount)
                gameState.rounds.endRound(gameState.actionCount)

                return MachineState.Bidding
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
