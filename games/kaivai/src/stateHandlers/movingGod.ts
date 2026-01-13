import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedMoveGod, isMoveGod } from '../actions/moveGod.js'

// Transition from MovingGod(MoveGod) -> Actions?
export class MovingGodStateHandler implements MachineStateHandler<HydratedMoveGod, HydratedKaivaiGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedKaivaiGameState>): action is HydratedMoveGod {
        if (!action.playerId) return false
        return action.type === ActionType.MoveGod
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext<HydratedKaivaiGameState>): ActionType[] {
        return [ActionType.MoveGod]
    }

    enter(context: MachineContext<HydratedKaivaiGameState>) {
        const gameState = context.gameState

        gameState.phases.startPhase(PhaseName.MoveGod, gameState.actionCount)
        const nextPlayerId =
            gameState.turnManager.turnOrder[gameState.turnManager.turnOrder.length - 1]

        gameState.turnManager.startTurn(nextPlayerId, gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: HydratedMoveGod, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isMoveGod(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                gameState.phases.endPhase(gameState.actionCount)

                return MachineState.TakingActions
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
