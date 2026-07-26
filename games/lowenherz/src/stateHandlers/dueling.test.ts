import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { HydratedSubmitDuelBid } from '../actions/submitDuelBid.js'
import { DuelingStateHandler } from './dueling.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

const card: ActionCard = {
    id: 'card-1',
    back: CardBack.B,
    type: ActionCardType.Standard,
    top: { kind: 'income', value: 4 },
    middle: { kind: 'border', count: 2 },
    bottom: { kind: 'knight', count: 1 }
}

function buildState(overrides: Partial<LowenherzGameState> = {}): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow][index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 12,
        politicsCards: []
    }))

    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players,
        activePlayerIds: ['p1', 'p2'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.Dueling,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: card,
        decisions: [],
        resolvedSlots: [],
        duel: { slot: 2, playerIds: ['p1', 'p2'], bids: [], tieCount: 0 },
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeBid(playerId: string, amount: number, treasureCardId?: string): HydratedSubmitDuelBid {
    return new HydratedSubmitDuelBid({
        id: `bid-${playerId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.SubmitDuelBid,
        playerId,
        amount,
        ...(treasureCardId ? { treasureCardId } : {})
    })
}

describe('DuelingStateHandler', () => {
    it('keeps every duelist active for the whole duel, even after some have bid', () => {
        const state = buildState({
            duel: { slot: 2, playerIds: ['p1', 'p2'], bids: [{ playerId: 'p1', amount: 3 }], tieCount: 0 }
        })
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        handler.enter(context)

        expect(state.activePlayerIds).toEqual(['p1', 'p2'])
    })

    it('lets a lower ducat bid win via a Treasure card that pushes its total higher', () => {
        const state = buildState()
        state.getPlayerState('p2').politicsCards = [
            { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }
        ]
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        // p1 bids 8 ducats alone; p2 bids 2 ducats + a 10-value Treasure card (total
        // 12) - p2 should win despite the lower ducat amount.
        const bid1 = makeBid('p1', 8)
        bid1.apply(state, context)
        expect(handler.onAction(bid1, context)).toBe(MachineState.Dueling)

        const bid2 = makeBid('p2', 2, 'treasure-10')
        bid2.apply(state, context)
        const nextState = handler.onAction(bid2, context)

        expect(nextState).not.toBe(MachineState.Dueling)
        expect(state.resolvedSlots).toEqual([{ slot: 2, winnerPlayerId: 'p2' }])
        // p2 pays only the ducat portion; the Treasure card is discarded, not cashed in.
        expect(state.getPlayerState('p2').money).toBe(12 - 2)
        expect(state.getPlayerState('p2').politicsCards).toEqual([])
        // p1 lost the duel - keeps all their money untouched.
        expect(state.getPlayerState('p1').money).toBe(12)
    })

    it('lets the losing bidder keep their unused Treasure card', () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-8', type: PoliticsCardType.Treasure, value: 8 }
        ]
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        // p1 bids 1 + an 8-value Treasure card (total 9); p2 bids 10 ducats outright -
        // p2 wins, p1's card and money are untouched.
        const bid1 = makeBid('p1', 1, 'treasure-8')
        bid1.apply(state, context)
        handler.onAction(bid1, context)

        const bid2 = makeBid('p2', 10)
        bid2.apply(state, context)
        handler.onAction(bid2, context)

        expect(state.resolvedSlots).toEqual([{ slot: 2, winnerPlayerId: 'p2' }])
        expect(state.getPlayerState('p1').money).toBe(12)
        expect(state.getPlayerState('p1').politicsCards).toEqual([
            { id: 'treasure-8', type: PoliticsCardType.Treasure, value: 8 }
        ])
    })
})
