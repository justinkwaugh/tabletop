import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { HydratedPlaceCastle } from '../actions/placeCastle.js'
import { buildPlacementPlan, currentPlacementSlot, isSetupComplete } from '../util/placementPlan.js'

type PlacingCastlesAction = HydratedPlaceCastle

function totalCastlesPlaced(state: HydratedLowenherzGameState): number {
    let count = 0
    for (const row of state.board.squares) {
        for (const square of row) {
            if (square.castleColor) count++
        }
    }
    return count
}

function planFor(state: HydratedLowenherzGameState) {
    return buildPlacementPlan(
        state.turnOrder,
        (playerId) => state.getPlayerState(playerId).color,
        state.neutralColor
    )
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
        const slot = currentPlacementSlot(plan, totalCastlesPlaced(gameState))
        if (slot?.playerId === playerId) {
            validActions.push(ActionType.PlaceCastle)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedLowenherzGameState>) {
        const gameState = context.gameState
        const plan = planFor(gameState)
        const slot = currentPlacementSlot(plan, totalCastlesPlaced(gameState))
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
                const gameState = context.gameState
                const plan = planFor(gameState)
                // The action already applied the placement before onAction runs, so
                // totalCastlesPlaced now reflects the placement this action just made.
                return isSetupComplete(plan, totalCastlesPlaced(gameState))
                    ? MachineState.StartOfTurn
                    : MachineState.PlacingCastles
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
