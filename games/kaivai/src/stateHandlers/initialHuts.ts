import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { PhaseName } from '../definition/phases.js'

// Transition from InitialHuts(Build) -> InitialHuts | PlacingGod
export class InitialHutsStateHandler implements MachineStateHandler<HydratedBuild> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedBuild {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        if (this.isValidActionType(ActionType.Build, playerId, context)) {
            return [ActionType.Build]
        } else {
            return []
        }
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState
        let nextPlayerId
        if (!gameState.phases.currentPhase) {
            gameState.phases.startPhase(PhaseName.InitialHuts, gameState.actionCount)
            nextPlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        }
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: HydratedBuild, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isBuild(action): {
                if (playerState.initialHutsPlaced < 2) {
                    return MachineState.InitialHuts
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)

                    if (gameState.players.every((player) => player.initialHutsPlaced === 2)) {
                        gameState.phases.endPhase(gameState.actionCount)
                        return MachineState.MovingGod
                    } else {
                        return MachineState.InitialHuts
                    }
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext
    ): boolean {
        const gameState = context.gameState as HydratedKaivaiGameState
        return (
            actionType === ActionType.Build &&
            gameState.getPlayerState(playerId).initialHutsPlaced < 2
        )
    }
}
