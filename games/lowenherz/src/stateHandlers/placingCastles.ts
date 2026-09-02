import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { totalCastlesPlaced } from '../model/board.js'
import { HydratedPlaceCastle } from '../actions/placeCastle.js'
import { buildPlacementPlan, currentPlacementSlot, isSetupComplete } from '../util/placementPlan.js'

type PlacingCastlesAction = HydratedPlaceCastle

function planFor(state: HydratedLowenherzGameState) {
    return buildPlacementPlan(state.turnOrder, state.neutralColor !== undefined)
}

export class PlacingCastlesStateHandler
    implements MachineStateHandler<PlacingCastlesAction, HydratedLowenherzGameState>
{
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): action is PlacingCastlesAction {
        return action instanceof HydratedPlaceCastle && action.isValidPlaceCastle(context.gameState)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedLowenherzGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        const plan = planFor(gameState)
        const slot = currentPlacementSlot(plan, totalCastlesPlaced(gameState.board))
        if (slot?.playerId === playerId) {
            validActions.push(ActionType.PlaceCastle)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        const plan = planFor(gameState)
        const slot = currentPlacementSlot(plan, totalCastlesPlaced(gameState.board))
        // slot should always be defined here - if setup were complete, onAction would
        // have already transitioned away from PlacingCastles before this state's
        // enter() runs again.
        gameState.activePlayerIds = slot ? [slot.playerId] : []
    }

    onAction(
        action: PlacingCastlesAction,
        context: MachineContext<HydratedLowenherzGameState>
    ): MachineState {
        switch (true) {
            case action instanceof HydratedPlaceCastle: {
                // Always the knight half next, including after the last castle: setup is
                // not complete until that castle has its knight, so the check that ends
                // setup lives in PlacingSetupKnight rather than here.
                return MachineState.PlacingSetupKnight
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
