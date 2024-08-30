import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedPlaceHut } from '../actions/placeHut.js'

// Transition from InitialHuts(PlaceHut) -> InitialHuts | Actions
export class InitialHutsStateHandler implements MachineStateHandler<HydratedPlaceHut> {
    isValidAction(action: HydratedAction, context: MachineContext): action is HydratedPlaceHut {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(_playerId: string, _context: MachineContext): ActionType[] {
        return []
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState

        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(_action: HydratedPlaceHut, _context: MachineContext): MachineState {
        // const gameState = context.gameState as HydratedKaivaiGameState

        switch (true) {
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        _playerId: string,
        _context: MachineContext
    ): boolean {
        // const gameState = context.gameState as HydratedKaivaiGameState
        // const playerState = gameState.getPlayerState(playerId)

        switch (actionType) {
            default:
                return false
        }
        return false
    }
}
