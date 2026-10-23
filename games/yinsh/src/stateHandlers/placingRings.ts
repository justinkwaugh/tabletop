import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceRing, isPlaceRing } from '../actions/placeRing.js'
import { HydratedYinshGameState } from '../model/gameState.js'

export class PlacingRingsStateHandler implements MachineStateHandler<
    HydratedPlaceRing,
    HydratedYinshGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedYinshGameState>
    ): action is HydratedPlaceRing {
        return isPlaceRing(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedYinshGameState>
    ): ActionType[] {
        return [ActionType.PlaceRing]
    }

    enter(context: MachineContext<HydratedYinshGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        gameState.activePlayerIds = playerId === undefined ? [] : [playerId]
    }

    onAction(
        _action: HydratedPlaceRing,
        context: MachineContext<HydratedYinshGameState>
    ): MachineState {
        const { gameState } = context
        gameState.turnManager.endTurn(gameState.actionCount)
        gameState.turnManager.startNextTurn(gameState.actionCount)
        return gameState.allRingsPlaced() ? MachineState.MovingRing : MachineState.PlacingRings
    }
}
