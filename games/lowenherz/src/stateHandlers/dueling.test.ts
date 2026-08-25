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
    it('drops a duelist from active as soon as their bid lands', () => {
        const state = buildState({
            duel: { slot: 2, playerIds: ['p1', 'p2'], bids: [{ playerId: 'p1', amount: 3 }], tieCount: 0 }
        })
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        handler.enter(context)

        expect(state.activePlayerIds).toEqual(['p2'])
    })

    it('brings every tied player back to active once a re-duel starts fresh', () => {
        const state = buildState({
            duel: { slot: 2, playerIds: ['p1', 'p2'], bids: [], tieCount: 1 }
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

    it('flags only the bid that completes the round as revealing info, not earlier ones', () => {
        const state = buildState()
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        const bid1 = makeBid('p1', 8)
        bid1.apply(state, context)
        handler.onAction(bid1, context)
        expect(bid1.revealsInfo).toBeUndefined()

        const bid2 = makeBid('p2', 3)
        bid2.apply(state, context)
        handler.onAction(bid2, context)
        expect(bid2.revealsInfo).toBe(true)
    })

    it('flags the completing bid as revealing info even when it only produces a tied re-duel', () => {
        const state = buildState()
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        const bid1 = makeBid('p1', 5)
        bid1.apply(state, context)
        handler.onAction(bid1, context)

        const bid2 = makeBid('p2', 5)
        bid2.apply(state, context)
        const nextState = handler.onAction(bid2, context)

        expect(nextState).toBe(MachineState.Dueling)
        expect(state.duel?.tieCount).toBe(1)
        expect(bid2.revealsInfo).toBe(true)
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

    it('in a 3-way duel, only the players tied for the top bid re-duel; the lower bidder is dropped', () => {
        const playerIds = ['p1', 'p2', 'p3']
        const state = buildState({
            players: playerIds.map((playerId, index) => ({
                playerId,
                color: [Color.Pink, Color.Yellow, Color.Purple][index],
                money: 12,
                powerPoints: 0,
                knightsInStock: 12,
                politicsCards: []
            })),
            activePlayerIds: playerIds,
            duel: { slot: 2, playerIds, bids: [], tieCount: 0 }
        })
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        // p1 and p2 both bid 5 (tied for the top); p3 bids 2 and loses outright.
        const bid1 = makeBid('p1', 5)
        bid1.apply(state, context)
        expect(handler.onAction(bid1, context)).toBe(MachineState.Dueling)

        const bid2 = makeBid('p2', 5)
        bid2.apply(state, context)
        expect(handler.onAction(bid2, context)).toBe(MachineState.Dueling)

        const bid3 = makeBid('p3', 2)
        bid3.apply(state, context)
        const nextState = handler.onAction(bid3, context)

        // Tie for the top bid -> a second duel, but only between the two tied players;
        // p3 (the lower bidder) is dropped and does not participate.
        expect(nextState).toBe(MachineState.Dueling)
        expect(state.duel).toEqual({ slot: 2, playerIds: ['p1', 'p2'], bids: [], tieCount: 1 })
        // The completing bid records the re-duel and exactly who advances, for history.
        expect(bid3.metadata?.duelResult).toBe('reduel')
        expect(bid3.metadata?.reduelPlayerIds).toEqual(['p1', 'p2'])
        // No one has paid yet - a tie means everyone takes their money back.
        for (const playerId of playerIds) {
            expect(state.getPlayerState(playerId).money).toBe(12)
        }
    })

    it('records a giveUp result (and no winner) when the second duel also ties', () => {
        const playerIds = ['p1', 'p2', 'p3']
        const state = buildState({
            players: playerIds.map((playerId, index) => ({
                playerId,
                color: [Color.Pink, Color.Yellow, Color.Purple][index],
                money: 12,
                powerPoints: 0,
                knightsInStock: 12,
                politicsCards: []
            })),
            activePlayerIds: playerIds,
            duel: { slot: 2, playerIds, bids: [], tieCount: 0 }
        })
        const handler = new DuelingStateHandler()
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        // First duel: p1 & p2 tie at 5, p3 drops out at 2 -> re-duel between p1 & p2.
        for (const [playerId, amount] of [
            ['p1', 5],
            ['p2', 5],
            ['p3', 2]
        ] as const) {
            const bid = makeBid(playerId, amount)
            bid.apply(state, context)
            handler.onAction(bid, context)
        }
        expect(state.duel?.playerIds).toEqual(['p1', 'p2'])

        // Second duel: p1 & p2 tie again -> give up, no one performs the action.
        const reBid1 = makeBid('p1', 7)
        reBid1.apply(state, context)
        expect(handler.onAction(reBid1, context)).toBe(MachineState.Dueling)

        const reBid2 = makeBid('p2', 7)
        reBid2.apply(state, context)
        handler.onAction(reBid2, context)

        expect(reBid2.metadata?.duelResult).toBe('giveUp')
        expect(state.resolvedSlots).toEqual([{ slot: 2, winnerPlayerId: undefined }])
        expect(state.duel).toBeUndefined()
        // A give-up means nobody paid anything.
        for (const playerId of playerIds) {
            expect(state.getPlayerState(playerId).money).toBe(12)
        }
    })
})
