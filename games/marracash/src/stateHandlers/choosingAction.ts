import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedMarracashGameState } from '../model/gameState.js'
import { HydratedStartAuction, isStartAuction } from '../actions/startAuction.js'
import { HydratedMoveVisitors, isMoveVisitors } from '../actions/moveVisitors.js'
import {
    HydratedCompleteAntiqueSet,
    isCompleteAntiqueSet,
    isNextAntiqueSetCompletion
} from '../actions/completeAntiqueSet.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import {
    queueAntiqueSetCompletions,
    queueAutomaticPasses,
    queueEndTurn
} from '../util/automaticActions.js'
import { finishTurn, stateAfterTurnAction } from '../util/turns.js'

type ChoosingActionAction =
    HydratedStartAuction | HydratedMoveVisitors | HydratedCompleteAntiqueSet | HydratedEndTurn

export class ChoosingActionStateHandler implements MachineStateHandler<
    ChoosingActionAction,
    HydratedMarracashGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedMarracashGameState>
    ): action is ChoosingActionAction {
        if (isEndTurn(action)) {
            return action.source === ActionSource.System
        }
        if (isCompleteAntiqueSet(action)) {
            return isNextAntiqueSetCompletion(action, context.gameState)
        }
        const gameState = context.gameState
        if (isStartAuction(action)) {
            return (
                this.availableActions(gameState, action.playerId).includes(action.type) &&
                gameState.canAuctionShop(action.playerId, action.shopId)
            )
        }
        if (isMoveVisitors(action)) {
            return (
                this.availableActions(gameState, action.playerId).includes(action.type) &&
                gameState.canMoveVisitorsFrom(action.fountainId, action.direction)
            )
        }
        return false
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMarracashGameState>
    ): ActionType[] {
        return this.availableActions(context.gameState, playerId)
    }

    enter(context: MachineContext<HydratedMarracashGameState>) {
        const gameState = context.gameState
        if (context.getPendingActions().length > 0) {
            return
        }

        const playerId =
            gameState.turnManager.currentTurn()?.playerId ??
            gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [playerId]
        if (!gameState.canAct(playerId)) {
            queueEndTurn(context)
        }
    }

    onAction(
        action: ChoosingActionAction,
        context: MachineContext<HydratedMarracashGameState>
    ): MachineState {
        switch (true) {
            case isStartAuction(action): {
                queueAntiqueSetCompletions(context)
                queueAutomaticPasses(context)
                return MachineState.Bidding
            }
            case isMoveVisitors(action): {
                return stateAfterTurnAction(context)
            }
            case isCompleteAntiqueSet(action): {
                return context.gameState.pendingAntiqueSets.length > 0
                    ? MachineState.ChoosingAction
                    : stateAfterTurnAction(context)
            }
            case isEndTurn(action): {
                return finishTurn(context.gameState)
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private availableActions(
        gameState: HydratedMarracashGameState,
        playerId: string
    ): ActionType[] {
        if (!gameState.activePlayerIds.includes(playerId)) {
            return []
        }
        const actions: ActionType[] = []
        if (gameState.canMoveVisitors()) {
            actions.push(ActionType.MoveVisitors)
        }
        if (gameState.canStartAuction(playerId)) {
            actions.push(ActionType.StartAuction)
        }
        return actions
    }
}
