import type { Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import { TradeRefusal } from '../rules/trading.js'
import { startGame } from '../testing/startGame.js'
import {
    action,
    actionEngine,
    playerOf,
    shareDeckCount,
    edited,
    revealedTurn,
    turnPlayer
} from '../testing/turns.js'
import { BuyShare } from './buyShare.js'
import { SellShare } from './sellShare.js'

const CP = 'railroad.cp'
// R-1.2: index 4 is the last 0.
const PRICE_0 = 4

function sell(game: Game, state: PromontoryPointProjectedState) {
    return actionEngine.executeCanonicalAction({
        action: action(SellShare, state, { playerId: turnPlayer(state), railroadId: CP }),
        state,
        game
    })
}

function trading() {
    const { game, state } = startGame()
    return { game, state: revealedTurn(game, state) }
}

describe('SellShare', () => {
    it('R-3.2: returns a share to its deck for the price and uses a trade; no price moves', () => {
        const { game, state } = trading()
        const playerId = turnPlayer(state)
        const before = playerOf(state, playerId)

        const { processedActions, updatedState } = sell(game, state)

        const after = playerOf(updatedState, playerId)
        expect(after.money).toBe(before.money + 5)
        expect(after.shares[CP]).toBe(before.shares[CP] - 1)
        expect(shareDeckCount(updatedState, CP)).toBe(shareDeckCount(state, CP) + 1)
        expect(updatedState.turn?.tradesUsed).toBe(1)
        expect(updatedState.priceIndex).toEqual(state.priceIndex)
        expect(updatedState.turn?.pieces).toEqual(state.turn?.pieces)
        expect(updatedState.machineState).toBe(MachineState.TradingBeforePlacing)
        expect(processedActions).toHaveLength(1)
        expect(processedActions[0]).toMatchObject({ metadata: { price: 5 } })
    })

    it('R-3.2-H1: sells for nothing at price 0 and still uses a trade', () => {
        const { game, state } = trading()
        const atZero = edited(state, (draft) => {
            draft.priceIndex[CP] = PRICE_0
        })
        const playerId = turnPlayer(atZero)

        const { processedActions, updatedState } = sell(game, atZero)

        expect(playerOf(updatedState, playerId).money).toBe(playerOf(atZero, playerId).money)
        expect(playerOf(updatedState, playerId).shares[CP]).toBe(0)
        expect(updatedState.turn?.tradesUsed).toBe(1)
        expect(processedActions[0]).toMatchObject({ metadata: { price: 0 } })
    })

    it('R-3.2: is refused with no share of the railroad held', () => {
        const { game, state } = trading()
        const none = edited(state, (draft) => {
            playerOf(draft, turnPlayer(draft)).shares[CP] = 0
        })

        expect(() => sell(game, none)).toThrow(TradeRefusal.NoShareHeld)
    })

    it('R-2.2 step 2: a buy and a sale use both trades, and a third is refused', () => {
        const { game, state } = trading()
        const bought = actionEngine.executeCanonicalAction({
            action: action(BuyShare, state, { playerId: turnPlayer(state), railroadId: CP }),
            state,
            game
        })
        const sold = sell(game, bought.updatedState)

        expect(sold.updatedState.turn?.tradesUsed).toBe(2)
        expect(() => sell(game, sold.updatedState)).toThrow(TradeRefusal.NoTradesLeft)
    })

    it('R-2.2-H1: is refused between placements and while Repairs are paid, legal after placing', () => {
        const { game, state } = trading()
        for (const machineState of [MachineState.Placing, MachineState.PayingRepairs]) {
            const placing = edited(state, (draft) => {
                draft.machineState = machineState
            })

            expect(() => sell(game, placing)).toThrow(TradeRefusal.PlacingUnderWay)
        }
        const afterPlacing = edited(state, (draft) => {
            draft.machineState = MachineState.TradingAfterPlacing
        })
        expect(sell(game, afterPlacing).updatedState.turn?.tradesUsed).toBe(1)
    })

    it('R-X.2: is not a barrier; Undo restores the state before it', () => {
        const { game, state } = trading()
        const { processedActions, updatedState } = sell(game, state)

        expect(processedActions[0].revealsInfo).toBeFalsy()
        expect(
            actionEngine.undoProcessedAction({ action: processedActions[0], state: updatedState })
        ).toEqual(state)
    })
})
