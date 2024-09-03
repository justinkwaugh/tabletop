import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedPass } from '../actions/pass.js'
import { InfluenceableAction } from 'src/definition/playerActions.js'

// Transition from TakingActions(Build) -> TakingActions
//                 TakingActions(Pass) -> TakingActions
//                 TakingActions(Pass) -> LosingValue

type TakingActionsAction = HydratedBuild | HydratedPass

export class TakingActionsStateHandler implements MachineStateHandler<TakingActionsAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is TakingActionsAction {
        if (!action.playerId) return false
        return action.type === ActionType.Build || action.type === ActionType.Pass
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(playerId)

        // First figure out which are affordable by influence as that is an easy filter
        const actions = [ActionType.Build]
        const affordableActions = actions.filter(
            (action) =>
                action === ActionType.Pass ||
                playerState.influence >= gameState.influence[InfluenceableAction.Build]
        )

        return [ActionType.Build || ActionType.Pass]
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState

        gameState.phases.startPhase(PhaseName.TakingActions, gameState.actionCount)
        const nextPlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: TakingActionsAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState

        switch (true) {
            case isBuild(action): {
                return MachineState.TakingActions
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
