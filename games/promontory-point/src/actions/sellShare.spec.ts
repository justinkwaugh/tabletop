import type { Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { sharePriceAt } from '../components/priceTrack.js'
import { RAILROAD_IDS, type RailroadId } from '../components/railroads.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import { TradeRefusal } from '../rules/trading.js'
import { engine, startGame } from '../testing/startGame.js'
import { withPlacingEnded } from '../testing/turnPieces.js'
import {
    action,
    playerOf,
    shareDeckCount,
    edited,
    refusedIn,
    revealedTurn,
    turnPlayer
} from '../testing/turns.js'
import { BuyShare } from './buyShare.js'
import { SellShare } from './sellShare.js'

const CP: RailroadId = 'railroad.cp'
// R-1.2: index 4 is the last 0.
const PRICE_0 = 4

function sell(game: Game, state: PromontoryPointProjectedState, railroadId: RailroadId = CP) {
    return engine.executeCanonicalAction({
        action: action(SellShare, state, { playerId: turnPlayer(state), railroadId }),
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
        const bought = engine.executeCanonicalAction({
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

            expect(() => sell(game, placing)).toThrow(refusedIn(machineState))
        }
        const sold = sell(game, withPlacingEnded(state)).updatedState
        expect(sold.turn?.tradesUsed).toBe(1)
        expect(sold.machineState).toBe(MachineState.TradingAfterPlacing)
    })

    it('R-X.2: is not a barrier; Undo restores the state before it', () => {
        const { game, state } = trading()
        const { processedActions, updatedState } = sell(game, state)

        expect(processedActions[0].revealsInfo).toBeFalsy()
        expect(
            engine.undoProcessedAction({ action: processedActions[0], state: updatedState })
        ).toEqual(state)
    })
})

describe.each(RAILROAD_IDS)('SellShare of %s', (railroadId) => {
    it("R-3.2: is paid that railroad's price and returns a share to its deck alone", () => {
        const { game, state } = trading()
        // A distinct price per railroad, so a price read from another railroad shows.
        const priceIndex = 12 + RAILROAD_IDS.indexOf(railroadId)
        const priced = edited(state, (draft) => {
            draft.priceIndex[railroadId] = priceIndex
        })
        const price = sharePriceAt(priceIndex)
        const playerId = turnPlayer(priced)
        const before = playerOf(priced, playerId)

        const { processedActions, updatedState } = sell(game, priced, railroadId)

        const after = playerOf(updatedState, playerId)
        expect(after.money).toBe(before.money + price)
        for (const other of RAILROAD_IDS) {
            const sold = other === railroadId ? 1 : 0
            expect(after.shares[other]).toBe(before.shares[other] - sold)
            expect(shareDeckCount(updatedState, other)).toBe(shareDeckCount(priced, other) + sold)
        }
        expect(updatedState.priceIndex).toEqual(priced.priceIndex)
        expect(processedActions[0]).toMatchObject({ metadata: { price } })
    })
})
