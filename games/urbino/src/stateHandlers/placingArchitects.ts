import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceArchitect, isPlaceArchitect } from '../actions/placeArchitect.js'
import { HydratedUrbinoGameState } from '../model/gameState.js'

type PlacingArchitectsAction = HydratedPlaceArchitect

export class PlacingArchitectsStateHandler
    implements MachineStateHandler<PlacingArchitectsAction, HydratedUrbinoGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedUrbinoGameState>
    ): action is PlacingArchitectsAction {
        return isPlaceArchitect(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedUrbinoGameState>
    ): ActionType[] {
        const { gameState } = context
        const expectedPlayerId = gameState.turnManager.turnOrder[gameState.architectsPlaced]
        if (playerId !== expectedPlayerId) return []
        return [ActionType.PlaceArchitect]
    }

    enter(context: MachineContext<HydratedUrbinoGameState>) {
        const { gameState } = context
        // Active player is determined by how many architects have been placed
        const activePlayerId = gameState.turnManager.turnOrder[gameState.architectsPlaced]
        gameState.activePlayerIds = [activePlayerId]
    }

    onAction(
        action: PlacingArchitectsAction,
        context: MachineContext<HydratedUrbinoGameState>
    ): MachineState {
        const { gameState } = context
        // apply() has already set architects[architectsPlaced] and incremented architectsPlaced
        if (gameState.architectsPlaced >= 2) {
            return MachineState.ChoosingFirstPlayer
        }
        return MachineState.PlacingArchitects
    }
}
