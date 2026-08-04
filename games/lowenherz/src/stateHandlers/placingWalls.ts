import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedPlaceWall } from '../actions/placeWall.js'
import { HydratedPass } from '../actions/pass.js'
import { HydratedCancelAlliance } from '../actions/cancelAlliance.js'
import { canCancelAnAlliance } from '../util/allianceCancellation.js'

type PlacingWallsAction = HydratedPlaceWall | HydratedPass | HydratedCancelAlliance

export class PlacingWallsStateHandler
    implements MachineStateHandler<PlacingWallsAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is PlacingWallsAction {
        if (action instanceof HydratedPlaceWall) return action.isValidPlaceWall(context.gameState)
        // A Pass is only meaningful if it's actually this player's turn to place a
        // wall - same "whose turn" gate PlaceWall itself checks.
        if (action instanceof HydratedPass) {
            return context.gameState.wallPlacingPlayerId === action.playerId
        }
        // Cancelling an alliance is available any time it's this player's turn to act -
        // see the note on HydratedCancelAlliance.
        if (action instanceof HydratedCancelAlliance) {
            return action.isValidCancelAlliance(context.gameState)
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (gameState.wallPlacingPlayerId !== playerId) return []
        if (!gameState.wallsRemaining || gameState.wallsRemaining <= 0) return []
        const validActions = [ActionType.PlaceWall, ActionType.Pass]
        if (canCancelAnAlliance(gameState, playerId)) validActions.push(ActionType.CancelAlliance)
        return validActions
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = gameState.wallPlacingPlayerId ? [gameState.wallPlacingPlayerId] : []
    }

    onAction(
        action: PlacingWallsAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState

        // Paying to end an alliance costs ducats, not walls - the allotment and whose turn
        // it is are untouched.
        if (action instanceof HydratedCancelAlliance) {
            return MachineState.PlacingWalls
        }

        // A Pass ends the phase immediately, regardless of how many walls remain -
        // the player is voluntarily declining the rest of their allotment.
        // Otherwise, the action already placed the wall (and any newly-sealed
        // regions) before onAction runs, so wallsRemaining already reflects it.
        if (action instanceof HydratedPass || (gameState.wallsRemaining ?? 0) <= 0) {
            gameState.wallsRemaining = undefined
            gameState.wallPlacingPlayerId = undefined
            return MachineState.ResolvingActions
        }

        return MachineState.PlacingWalls
    }
}
