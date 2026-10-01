import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { HydratedStartAuction, isStartAuction } from '../actions/startAuction.js'

type ChoosingActionAction = HydratedStartAuction

export class ChoosingActionStateHandler implements MachineStateHandler<
    ChoosingActionAction,
    HydratedMarracashGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMarracashGameState>
    ): action is ChoosingActionAction {
        return isStartAuction(action) && context.gameState.canStartAuction(action.playerId)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMarracashGameState>
    ): ActionType[] {
        return context.gameState.canStartAuction(playerId) ? [ActionType.StartAuction] : []
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        const gameState = context.gameState
        const currentTurn = gameState.turnManager.currentTurn()
        gameState.activePlayerIds = [
            currentTurn?.playerId ?? gameState.turnManager.startNextTurn(gameState.actionCount)
        ]
    }

    onAction(
        action: ChoosingActionAction,
        _context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        switch (true) {
            case isStartAuction(action): {
                return MachineState.Bidding
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
