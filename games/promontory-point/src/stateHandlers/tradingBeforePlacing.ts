import {
    assert,
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { isBuyShare, type HydratedBuyShare } from '../actions/buyShare.js'
import { isPlaceTrack, type HydratedPlaceTrack } from '../actions/placeTrack.js'
import { isScrapTrack, type HydratedScrapTrack } from '../actions/scrapTrack.js'
import { isSellShare, type HydratedSellShare } from '../actions/sellShare.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { turnPlayerId } from '../rules/turnPlayer.js'
import {
    activateTurnPlayer,
    availableActions,
    isPlacingStep,
    isTrade,
    placingAvailability,
    stateAfterPlacingAction,
    tradeAvailability
} from './turnActions.js'

type TradingBeforePlacingAction =
    HydratedBuyShare | HydratedSellShare | HydratedPlaceTrack | HydratedScrapTrack

// R-2.2 steps 2–3, R-2.2-H1, R-2.2-H2: trade until the first placement or scrap closes trading.
export class TradingBeforePlacingStateHandler implements MachineStateHandler<
    TradingBeforePlacingAction,
    HydratedPromontoryPointGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedPromontoryPointGameState>
    ): action is TradingBeforePlacingAction {
        return (
            isBuyShare(action) ||
            isSellShare(action) ||
            isPlaceTrack(action) ||
            isScrapTrack(action)
        )
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
            ...placingAvailability(state, playerId)
        ])
    }

    enter(context: MachineContext<HydratedPromontoryPointGameState>) {
        const state = context.gameState
        assert(state.requireTurn().placementsMade === 0, 'Nothing is placed before placing starts')
        activateTurnPlayer(state)
    }

    onAction(
        action: TradingBeforePlacingAction,
        context: MachineContext<HydratedPromontoryPointGameState>
    ): MachineState {
        if (isTrade(action)) {
            return MachineState.TradingBeforePlacing
        }
        assert(isPlacingStep(action), 'Only trades and placing steps are taken before placing')
        return stateAfterPlacingAction(context.gameState)
    }
}
