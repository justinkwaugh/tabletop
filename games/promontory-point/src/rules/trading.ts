import { assertExists } from '@tabletop/common'
import { sharePriceAt } from '../components/priceTrack.js'
import type { RailroadId } from '../components/railroads.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { TRADES_PER_TURN, type TurnState } from '../model/turn.js'
import { turnPlayerId } from './turnPlayer.js'

export enum TradeRefusal {
    TradingClosed = 'TradingClosed',
    PlacingUnderWay = 'PlacingUnderWay',
    NotTurnPlayer = 'NotTurnPlayer',
    NoTradesLeft = 'NoTradesLeft',
    EmptyDeck = 'EmptyDeck',
    TooLittleMoney = 'TooLittleMoney',
    NoShareHeld = 'NoShareHeld'
}

// R-2.2, R-2.2-H1: before the first placement or after the last, never between.
const TRADING_STATES: readonly MachineState[] = [
    MachineState.TradingBeforePlacing,
    MachineState.TradingAfterPlacing
]
const PLACING_STATES: readonly MachineState[] = [MachineState.Placing, MachineState.PayingRepairs]

// R-3.1, R-3.2: a trade is at the current price, free or for nothing at 0.
export function sharePrice(
    state: Pick<HydratedPromontoryPointGameState, 'priceIndex'>,
    railroadId: RailroadId
): number {
    return sharePriceAt(state.priceIndex[railroadId])
}

// R-3.1: a deck with a share left, and money for its price.
export function buyShareRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    railroadId: RailroadId
): TradeRefusal | undefined {
    const refusal = tradeRefusal(state, playerId)
    if (refusal !== undefined) {
        return refusal
    }
    if (state.shareDeckCount(railroadId) === 0) {
        return TradeRefusal.EmptyDeck
    }
    if (state.getPlayerState(playerId).money < sharePrice(state, railroadId)) {
        return TradeRefusal.TooLittleMoney
    }
    return undefined
}

// R-3.2, R-3.2-H1: any share held, even at price 0.
export function sellShareRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    railroadId: RailroadId
): TradeRefusal | undefined {
    const refusal = tradeRefusal(state, playerId)
    if (refusal !== undefined) {
        return refusal
    }
    if (state.getPlayerState(playerId).shares[railroadId] === 0) {
        return TradeRefusal.NoShareHeld
    }
    return undefined
}

// R-2.2 step 2: the turn player's two trades.
export function tradingTurn(state: HydratedPromontoryPointGameState): TurnState {
    assertExists(state.turn, 'A turn is under way while trading is open')
    return state.turn
}

// R-2.2, R-2.2-H1
function tradeRefusal(
    state: HydratedPromontoryPointGameState,
    playerId: string
): TradeRefusal | undefined {
    if (PLACING_STATES.includes(state.machineState)) {
        return TradeRefusal.PlacingUnderWay
    }
    if (!TRADING_STATES.includes(state.machineState)) {
        return TradeRefusal.TradingClosed
    }
    if (playerId !== turnPlayerId(state)) {
        return TradeRefusal.NotTurnPlayer
    }
    if (tradingTurn(state).tradesUsed >= TRADES_PER_TURN) {
        return TradeRefusal.NoTradesLeft
    }
    return undefined
}
