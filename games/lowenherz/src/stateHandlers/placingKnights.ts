import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedPlaceKnight } from '../actions/placeKnight.js'
import { HydratedExpandRegion } from '../actions/expandRegion.js'
import { HydratedPass } from '../actions/pass.js'

type PlacingKnightsAction = HydratedPlaceKnight | HydratedExpandRegion | HydratedPass

export class PlacingKnightsStateHandler
    implements MachineStateHandler<PlacingKnightsAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is PlacingKnightsAction {
        if (action instanceof HydratedPlaceKnight) return action.isValidPlaceKnight(context.gameState)
        if (action instanceof HydratedExpandRegion) return action.isValidExpandRegion(context.gameState)
        // A Pass is only meaningful if it's actually this player's turn to place a
        // knight - same "whose turn" gate PlaceKnight/ExpandRegion themselves check.
        if (action instanceof HydratedPass) {
            return context.gameState.knightPlacingPlayerId === action.playerId
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (gameState.knightPlacingPlayerId !== playerId) return []
        if (!gameState.knightsRemaining || gameState.knightsRemaining <= 0) return []

        const validActions: ActionType[] = [ActionType.PlaceKnight, ActionType.Pass]
        const playerColor = gameState.getPlayerState(playerId).color
        if (gameState.regions.some((r) => r.ownerColor === playerColor)) {
            validActions.push(ActionType.ExpandRegion)
        }
        return validActions
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = gameState.knightPlacingPlayerId ? [gameState.knightPlacingPlayerId] : []
    }

    onAction(
        action: PlacingKnightsAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        const gameState = context.gameState

        // A Pass ends the phase immediately, regardless of how many knights remain -
        // the player is voluntarily declining the rest of their allotment.
        // Otherwise, the action already placed the knight before onAction runs, so
        // knightsRemaining already reflects it. Expanding a region always consumes
        // the whole action too (see ExpandRegion.apply), so it falls into this same
        // branch once knightsRemaining hits 0.
        if (action instanceof HydratedPass || (gameState.knightsRemaining ?? 0) <= 0) {
            gameState.knightsRemaining = undefined
            gameState.knightPlacingPlayerId = undefined
            return MachineState.ResolvingActions
        }

        return MachineState.PlacingKnights
    }
}
