import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { HydratedChooseDemand, isChooseDemand } from '../actions/chooseDemand.js'
import { HydratedEndPhase, isEndPhase } from '../actions/endPhase.js'
import { HydratedScrapShip, isScrapShip } from '../actions/scrapShip.js'
import { HydratedSellGoods, isSellGoods } from '../actions/sellGoods.js'
import { HydratedSkipPhase, SkipPhase, isSkipPhase } from '../actions/skipPhase.js'
import { HydratedTransferCargo, isTransferCargo } from '../actions/transferCargo.js'
import { HydratedTransferGoods, isTransferGoods } from '../actions/transferGoods.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { canTransferAnyCargo } from '../model/cargoTransfer.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { isIdleInPhase } from '../model/idlePhases.js'
import { canTransferAnyGoods, saleOptions } from '../model/trade.js'
import { TurnPhase } from '../model/turn.js'
import { type ConversionAction, conversionActions, isConversion } from './conversions.js'
import { stateAfterAnomaly, stateAfterPhase } from './transitions.js'

type TradingAction =
    | HydratedTransferCargo
    | HydratedTransferGoods
    | HydratedSellGoods
    | HydratedScrapShip
    | HydratedEndPhase
    | HydratedSkipPhase
    | ConversionAction

// The campaign's cargo and trade phase (rulebook 1.8 and 1.9): each Player in initiative order
// loads, unloads, buys settlements and sells in any order, then ends their turn.
export class TradingStateHandler implements MachineStateHandler<
    TradingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is TradingAction {
        return (
            isTransferCargo(action) ||
            isTransferGoods(action) ||
            isSellGoods(action) ||
            isScrapShip(action) ||
            isSkipPhase(action) ||
            isConversion(action) ||
            (isEndPhase(action) && action.phase === TurnPhase.Cargo)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [
            ...(canTransferAnyCargo(state, playerId) ? [ActionType.TransferCargo] : []),
            ...(canTransferAnyGoods(state, playerId) ? [ActionType.TransferGoods] : []),
            ...(saleOptions(state, playerId).length > 0 ? [ActionType.SellGoods] : []),
            ...(state.shipsOf(playerId).length > 0 ? [ActionType.ScrapShip] : []),
            ...conversionActions(state, playerId),
            ActionType.EndPhase
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const playerId = state.traders.at(0)
        assertExists(playerId, 'Trading needs a Player to take their turn')
        state.activePlayerIds = [playerId]
        if (isIdleInPhase(state, playerId, TurnPhase.Cargo)) {
            context.addSystemAction(SkipPhase, { playerId })
        }
    }

    onAction(
        action: TradingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (state.demandDraws.length > 0) {
            return MachineState.ChoosingDemand
        }
        if (!isEndPhase(action) && !isSkipPhase(action)) {
            return MachineState.Trading
        }
        state.traders = state.traders.slice(1)
        return state.traders.length > 0
            ? MachineState.Trading
            : stateAfterPhase(state, TurnPhase.Cargo)
    }
}

// Rulebook 1.9: the Player who drew demand markers keeps one; play goes back to where it was,
// the trading turn or the settling of the exploration phase.
export class ChoosingDemandStateHandler implements MachineStateHandler<
    HydratedChooseDemand,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedChooseDemand {
        return isChooseDemand(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.ChooseDemand] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const draw = context.gameState.demandDraws.at(0)
        assertExists(draw, 'Choosing a demand marker requires a draw')
        context.gameState.activePlayerIds = [draw.playerId]
    }

    onAction(
        _action: HydratedChooseDemand,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (state.demandDraws.length > 0) {
            return MachineState.ChoosingDemand
        }
        return state.traders.length > 0 ? MachineState.Trading : stateAfterAnomaly(state)
    }
}
