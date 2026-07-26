import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedLookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import { HydratedTakePoliticsCard } from '../actions/takePoliticsCard.js'

type TakingPoliticsCardAction = HydratedLookAtPoliticsPile | HydratedTakePoliticsCard

export class TakingPoliticsCardStateHandler
    implements MachineStateHandler<TakingPoliticsCardAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is TakingPoliticsCardAction {
        if (action instanceof HydratedLookAtPoliticsPile) {
            return action.isValidLookAtPoliticsPile(context.gameState)
        }
        if (action instanceof HydratedTakePoliticsCard) {
            return action.isValidTakePoliticsCard(context.gameState)
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (gameState.politicsTakingPlayerId !== playerId) return []
        // Once a pile has been opened, only the specific pick remains - no switching
        // to the other, unopened pile.
        return gameState.openedPoliticsPile
            ? [ActionType.TakePoliticsCard]
            : [ActionType.LookAtPoliticsPile]
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = gameState.politicsTakingPlayerId
            ? [gameState.politicsTakingPlayerId]
            : []
    }

    onAction(
        action: TakingPoliticsCardAction,
        _context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        // Opening a pile doesn't resolve anything yet - stay put until a specific
        // card is picked.
        if (action instanceof HydratedLookAtPoliticsPile) {
            return MachineState.TakingPoliticsCard
        }
        // Exactly one card, no "remaining" counter to drain - the action itself
        // already cleared politicsTakingPlayerId, so there's nothing left to do here.
        return MachineState.ResolvingActions
    }
}
