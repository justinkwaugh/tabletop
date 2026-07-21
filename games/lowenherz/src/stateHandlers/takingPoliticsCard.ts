import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedTakePoliticsCard } from '../actions/takePoliticsCard.js'

type TakingPoliticsCardAction = HydratedTakePoliticsCard

export class TakingPoliticsCardStateHandler
    implements MachineStateHandler<TakingPoliticsCardAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is TakingPoliticsCardAction {
        return (
            action instanceof HydratedTakePoliticsCard &&
            action.isValidTakePoliticsCard(context.gameState)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        if (context.gameState.politicsTakingPlayerId !== playerId) return []
        return [ActionType.TakePoliticsCard]
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        gameState.activePlayerIds = gameState.politicsTakingPlayerId
            ? [gameState.politicsTakingPlayerId]
            : []
    }

    onAction(
        _action: TakingPoliticsCardAction,
        _context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        // Exactly one card, no "remaining" counter to drain - the action itself
        // already cleared politicsTakingPlayerId, so there's nothing left to do here.
        return MachineState.ResolvingActions
    }
}
