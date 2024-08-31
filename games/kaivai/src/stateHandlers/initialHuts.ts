import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedPlaceHut, isPlaceHut } from '../actions/placeHut.js'
import { PhaseName } from '../definition/phases.js'

// Transition from InitialHuts(PlaceHut) -> InitialHuts | PlacingGod
export class InitialHutsStateHandler implements MachineStateHandler<HydratedPlaceHut> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedPlaceHut {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        if (this.isValidActionType(ActionType.PlaceHut, playerId, context)) {
            return [ActionType.PlaceHut]
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

    onAction(action: HydratedPlaceHut, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isPlaceHut(action): {
                if (playerState.initialHutsPlaced < 2) {
                    return MachineState.InitialHuts
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)

                    if (gameState.players.every((player) => player.initialHutsPlaced === 2)) {
                        gameState.phases.endPhase(gameState.actionCount)
                        return MachineState.PlacingGod
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
            actionType === ActionType.PlaceHut &&
            gameState.getPlayerState(playerId).initialHutsPlaced < 2
        )
    }
}
