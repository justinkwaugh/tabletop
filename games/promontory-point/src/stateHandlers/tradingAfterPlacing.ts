import {
    assert,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isBuyShare, type HydratedBuyShare } from '../actions/buyShare.js'
import { isEndTurn, type HydratedEndTurn } from '../actions/endTurn.js'
import { isSellShare, type HydratedSellShare } from '../actions/sellShare.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { turnPlayerId } from '../rules/turnPlayer.js'
import { gameEndReason } from '../rules/gameEnd.js'
import { placingHasEnded } from '../rules/placing.js'
import {
    activateTurnPlayer,
    availableActions,
    endTurnAvailability,
    isTrade,
    tradeAvailability
} from './turnActions.js'

type TradingAfterPlacingAction = HydratedBuyShare | HydratedSellShare | HydratedEndTurn

// R-2.2 steps 2 and 4, R-2.2-H1: the trades left, then the explicit end of the turn.
export class TradingAfterPlacingStateHandler implements MachineStateHandler<
    TradingAfterPlacingAction,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): action is TradingAfterPlacingAction {
        return isBuyShare(action) || isSellShare(action) || isEndTurn(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): ActionType[] {
        const state = context.gameState
        if (playerId !== turnPlayerId(state)) {
            return []
        }
        return availableActions([
            ...tradeAvailability(state, playerId),
            ...endTurnAvailability(state, playerId, context)
        ])
    }

    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assert(placingHasEnded(state.requireTurn()), 'Trading opens again once placing has ended')
        assert(state.pendingRepairs === undefined, 'Trading waits until every debtor has paid')
        activateTurnPlayer(state)
    }

    // R-6.1, R-6.1-H1, R-6.1-H2: the end test runs once, after the end-of-turn draw.
    onAction(
        action: TradingAfterPlacingAction,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        if (isTrade(action)) {
            return MachineState.TradingAfterPlacing
        }
        const state = context.gameState
        state.turnManager.endTurn(state.actionCount)
        return gameEndReason(state) === undefined
            ? MachineState.StartingTurn
            : MachineState.EndOfGame
    }
}
