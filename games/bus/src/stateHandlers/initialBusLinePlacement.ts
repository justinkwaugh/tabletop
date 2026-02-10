import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceBusLine, isPlaceBusLine } from '../actions/placeBusLine.js'
import { HydratedBusGameState } from '../model/gameState.js'

type InitialBusLinePlacementAction = HydratedPlaceBusLine

export class InitialBusLinePlacementStateHandler implements MachineStateHandler<
    InitialBusLinePlacementAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is InitialBusLinePlacementAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isPlaceBusLine(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedPlaceBusLine.canPlaceBusLine(gameState, playerId)) {
            validActions.push(ActionType.PlaceBusLine)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const gameState = context.gameState
        let nextPlayerId: string
        if (context.gameState.players.every((p) => p.busLine.length == 2)) {
            nextPlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        }
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: InitialBusLinePlacementAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        switch (true) {
            case isPlaceBusLine(action): {
                if (context.gameState.players.every((p) => p.busLine.length == 2)) {
                    // snake backwards
                    context.gameState.turnManager.reverseTurnOrder()
                    return MachineState.InitialBusLinePlacement
                } else if (context.gameState.players.every((p) => p.busLine.length == 3)) {
                    context.gameState.turnManager.reverseTurnOrder()
                    return MachineState.InitialBusLinePlacement
                } else {
                    context.gameState.turnManager.endTurn(context.gameState.actionCount)
                    return MachineState.InitialBusLinePlacement
                }
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
