import { assertExists, playerUndoReach, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RAILROAD_IDS } from '../components/railroads.js'
import { SHARES_PER_RAILROAD } from '../components/shares.js'
import { MachineState } from '../definition/states.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import { TRADES_PER_TURN } from '../model/turn.js'
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

const CP = 'railroad.cp'
// R-1.2: index 4 is the last 0.
const PRICE_0 = 4

function buy(game: Game, state: PromontoryPointProjectedState, playerId = turnPlayer(state)) {
    return engine.executeCanonicalAction({
        action: action(BuyShare, state, { playerId, railroadId: CP }),
        state,
        game
    })
}

function trading() {
    const { game, state } = startGame()
    return { game, state: revealedTurn(game, state) }
}

describe('BuyShare', () => {
    it('R-3.1: pays the price for a share from the deck and uses a trade; no price moves (R-3.2)', () => {
        const { game, state } = trading()
        const playerId = turnPlayer(state)
        const before = playerOf(state, playerId)

        const { processedActions, updatedState } = buy(game, state)

        const after = playerOf(updatedState, playerId)
        expect(after.money).toBe(before.money - 5)
        expect(after.shares[CP]).toBe(before.shares[CP] + 1)
        expect(shareDeckCount(updatedState, CP)).toBe(shareDeckCount(state, CP) - 1)
        expect(updatedState.turn?.tradesUsed).toBe(1)
        expect(updatedState.priceIndex).toEqual(state.priceIndex)
        expect(updatedState.turn?.pieces).toEqual(state.turn?.pieces)
        expect(updatedState.machineState).toBe(MachineState.TradingBeforePlacing)
        expect(processedActions).toHaveLength(1)
        expect(processedActions[0]).toMatchObject({ metadata: { price: 5 } })
    })

    it('R-3.1: is free at price 0', () => {
        const { game, state } = trading()
        const atZero = edited(state, (draft) => {
            draft.priceIndex[CP] = PRICE_0
        })
        const playerId = turnPlayer(atZero)

        const { processedActions, updatedState } = buy(game, atZero)

        expect(playerOf(updatedState, playerId).money).toBe(playerOf(atZero, playerId).money)
        expect(playerOf(updatedState, playerId).shares[CP]).toBe(2)
        expect(processedActions[0]).toMatchObject({ metadata: { price: 0 } })
    })

    it('R-3.1: is legal with money exactly the price', () => {
        const { game, state } = trading()
        const exact = edited(state, (draft) => {
            playerOf(draft, turnPlayer(draft)).money = 5
        })

        const { updatedState } = buy(game, exact)

        expect(playerOf(updatedState, turnPlayer(exact)).money).toBe(0)
    })

    it('R-3.1: is refused with too little money', () => {
        const { game, state } = trading()
        const short = edited(state, (draft) => {
            playerOf(draft, turnPlayer(draft)).money = 4
        })

        expect(() => buy(game, short)).toThrow(TradeRefusal.TooLittleMoney)
    })

    it('R-3.1: is refused from an empty deck', () => {
        const { game, state } = trading()
        const emptyDeck = edited(state, (draft) => {
            const others = draft.players.length - 1
            playerOf(draft, turnPlayer(draft)).shares[CP] = SHARES_PER_RAILROAD - others
        })
        expect(shareDeckCount(emptyDeck, CP)).toBe(0)

        expect(() => buy(game, emptyDeck)).toThrow(TradeRefusal.EmptyDeck)
    })

    it('R-2.2 step 2: is refused once two trades are used', () => {
        const { game, state } = trading()
        const spent = edited(state, (draft) => {
            assertExists(draft.turn, 'The turn is under way')
            draft.turn.tradesUsed = TRADES_PER_TURN
        })

        expect(() => buy(game, spent)).toThrow(TradeRefusal.NoTradesLeft)
    })

    it('R-2.2-H1: is refused between placements and while Repairs are paid', () => {
        const { game, state } = trading()
        for (const machineState of [MachineState.Placing, MachineState.PayingRepairs]) {
            const placing = edited(state, (draft) => {
                draft.machineState = machineState
            })

            expect(() => buy(game, placing)).toThrow(refusedIn(machineState))
        }
    })

    it('R-2.2-H1: is legal after the last placement', () => {
        const { game, state } = trading()
        const { updatedState } = buy(game, withPlacingEnded(state))

        expect(updatedState.turn?.tradesUsed).toBe(1)
    })

    it('R-2.2: is refused before the hand is revealed and for a seat whose turn it is not', () => {
        const { game, state } = trading()
        const notRevealed = edited(state, (draft) => {
            draft.machineState = MachineState.StartingTurn
        })
        const allActive = edited(state, (draft) => {
            draft.activePlayerIds = draft.turnManager.turnOrder
        })

        expect(() => buy(game, notRevealed)).toThrow(refusedIn(MachineState.StartingTurn))
        expect(() => buy(game, allActive, allActive.turnManager.turnOrder[1])).toThrow(
            TradeRefusal.NotTurnPlayer
        )
    })

    it('R-X.2: is not a barrier; Undo restores the state before it, back to the reveal', () => {
        const { game, state } = startGame()
        const revealed = revealedTurn(game, state)
        const bought = buy(game, revealed)
        const sold = engine.executeCanonicalAction({
            action: action(SellShare, bought.updatedState, {
                playerId: turnPlayer(revealed),
                railroadId: RAILROAD_IDS[1]
            }),
            state: bought.updatedState,
            game
        })
        const boughtAction = bought.processedActions[0]

        expect(boughtAction.revealsInfo).toBeFalsy()
        expect(
            engine.undoProcessedAction({ action: boughtAction, state: bought.updatedState })
        ).toEqual(revealed)
        expect(
            playerUndoReach(
                [...bought.processedActions, ...sold.processedActions],
                turnPlayer(revealed)
            )
        ).toBe(boughtAction.index)
    })
})
