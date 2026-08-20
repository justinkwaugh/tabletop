import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedPlaceKnight } from '../actions/placeKnight.js'
import { HydratedExpandRegion } from '../actions/expandRegion.js'
import { HydratedPass } from '../actions/pass.js'
import { HydratedCancelAlliance } from '../actions/cancelAlliance.js'
import { hasKnightActionOptions, knightActionOptions } from '../util/knightActionHelpers.js'
import { canCancelAnAlliance } from '../util/allianceCancellation.js'

type PlacingKnightsAction =
    | HydratedPlaceKnight
    | HydratedExpandRegion
    | HydratedPass
    | HydratedCancelAlliance

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
        // An alliance blocks expansion between its two regions, so ending one has to be
        // possible right here, mid-knight-action, for the rulebook's "pay ten ducats and
        // is then free to expand into either region" to be reachable at all.
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
        if (gameState.knightPlacingPlayerId !== playerId) return []

        // Both halves of the action can be live at once now (a two-sword card is "place
        // one knight and expand one of his regions", in either order), so this is a
        // union rather than a chain of either/ors - including mid-expansion, where the
        // optional 2nd space and a leftover sword's knight are both on the table.
        const options = knightActionOptions(gameState, playerId)
        const validActions: ActionType[] = []
        if (options.canPlaceKnight) validActions.push(ActionType.PlaceKnight)
        if (options.canStartExpansion || options.canContinueExpansion) {
            validActions.push(ActionType.ExpandRegion)
        }
        // Stopping early is always allowed while anything else is - "may either place a
        // knight... or extend a region" is never a must. With nothing left to do the
        // phase ends on its own (see onAction), so no Pass is offered either.
        if (validActions.length > 0) validActions.push(ActionType.Pass)
        // Deliberately after the Pass line above: cancelling an alliance isn't part of
        // the knight action, so having one to cancel mustn't be what keeps a spent
        // action's Pass on offer.
        if (canCancelAnAlliance(gameState, playerId)) validActions.push(ActionType.CancelAlliance)
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

        // Cancelling an alliance spends ducats, not the knight action - nothing about the
        // phase changes, and the player still owes whatever swords they had left. Checked
        // before anything below so it can't be mistaken for the action running dry.
        if (action instanceof HydratedCancelAlliance) {
            return MachineState.PlacingKnights
        }

        // Placing a knight abandons any in-progress expansion's optional 2nd space -
        // the player has visibly moved on to the action's other half, and that 2nd
        // space was never owed to them.
        if (action instanceof HydratedPlaceKnight) {
            gameState.expandingRegionId = undefined
            gameState.expansionStrandings = undefined
        }

        // A Pass ends the phase immediately, however much of the action is left - the
        // player is voluntarily declining the rest, including stopping an expansion
        // after just its 1st space. Otherwise the action already applied before
        // onAction runs, so knightsRemaining/expandingRegionId/expansionUsed already
        // reflect it, and the phase ends only once nothing legal remains: a leftover
        // sword after an expansion keeps it alive for the knight that sword still owes
        // (and vice versa).
        if (
            action instanceof HydratedPass ||
            !hasKnightActionOptions(gameState, action.playerId)
        ) {
            gameState.expandingRegionId = undefined
            gameState.expansionStrandings = undefined
            gameState.expansionUsed = undefined
            gameState.knightsRemaining = undefined
            gameState.knightPlacingPlayerId = undefined
            return MachineState.ResolvingActions
        }

        return MachineState.PlacingKnights
    }
}
