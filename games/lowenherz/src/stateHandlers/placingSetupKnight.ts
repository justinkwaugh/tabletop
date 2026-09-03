import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedPlaceSetupKnight } from '../actions/placeSetupKnight.js'
import { buildPlacementPlan, isSetupComplete } from '../util/placementPlan.js'
import { totalCastlesPlaced } from '../model/board.js'

type PlacingSetupKnightAction = HydratedPlaceSetupKnight

function planFor(state: HydratedLowenherzGameState) {
    return buildPlacementPlan(state.turnOrder, state.neutralColor !== undefined)
}

export class PlacingSetupKnightStateHandler
    implements MachineStateHandler<PlacingSetupKnightAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is PlacingSetupKnightAction {
        return (
            action instanceof HydratedPlaceSetupKnight &&
            action.isValidPlaceSetupKnight(context.gameState)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        return HydratedPlaceSetupKnight.canPlaceSetupKnight(context.gameState, playerId)
            ? [ActionType.PlaceSetupKnight]
            : []
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        // The player who placed the castle is the one who owes it a knight - not the next
        // player in the placement plan, which the castle already advanced past.
        const pending = gameState.pendingSetupCastle
        gameState.activePlayerIds = pending ? [pending.playerId] : []
    }

    onAction(
        action: PlacingSetupKnightAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        switch (true) {
            case action instanceof HydratedPlaceSetupKnight: {
                const gameState = context.gameState
                // Setup is only finished once the last castle has its knight, so this is
                // where the check belongs rather than on the castle half.
                return isSetupComplete(planFor(gameState), totalCastlesPlaced(gameState.board))
                    ? MachineState.StartOfTurn
                    : MachineState.PlacingCastles
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
