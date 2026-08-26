import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { HydratedSubmitDuelBid } from './submitDuelBid.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
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
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        duel: { slot: 2, playerIds: ['p1', 'p2'], bids: [], tieCount: 0 },
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeBid(playerId: string, amount: number, treasureCardIds?: string[]): HydratedSubmitDuelBid {
    return new HydratedSubmitDuelBid({
        id: `bid-${playerId}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.SubmitDuelBid,
        playerId,
        amount,
        ...(treasureCardIds && treasureCardIds.length > 0 ? { treasureCardIds } : {})
    })
}

describe('HydratedSubmitDuelBid', () => {
    it('accepts a plain ducat bid within the bidder\'s money', () => {
        const state = buildState()
        expect(makeBid('p1', 5).isValidSubmitDuelBid(state)).toBe(true)
    })

    it('accepts a bid backed by a Treasure card, recording it in metadata', () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }
        ]

        const action = makeBid('p1', 2, ['treasure-10'])
        expect(action.isValidSubmitDuelBid(state)).toBe(true)
        action.apply(state)

        expect(state.duel!.bids).toEqual([
            { playerId: 'p1', amount: 2, treasureCardIds: ['treasure-10'] }
        ])
        expect(action.metadata).toEqual({
            treasureCardsUsed: [{ id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }]
        })
        // Not spent yet - only a winning bid actually discards the cards (see dueling.ts).
        expect(state.getPlayerState('p1').politicsCards).toEqual([
            { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }
        ])
    })

    it('accepts a bid backed by more than one Treasure card - the rulebook does not cap it at one', () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 },
            { id: 'treasure-4', type: PoliticsCardType.Treasure, value: 4 }
        ]

        const action = makeBid('p1', 1, ['treasure-10', 'treasure-4'])
        expect(action.isValidSubmitDuelBid(state)).toBe(true)
        action.apply(state)

        expect(state.duel!.bids).toEqual([
            { playerId: 'p1', amount: 1, treasureCardIds: ['treasure-10', 'treasure-4'] }
        ])
        expect(action.metadata).toEqual({
            treasureCardsUsed: [
                { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 },
                { id: 'treasure-4', type: PoliticsCardType.Treasure, value: 4 }
            ]
        })
    })

    it('rejects the same Treasure card listed twice in one bid', () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }
        ]
        expect(makeBid('p1', 1, ['treasure-10', 'treasure-10']).isValidSubmitDuelBid(state)).toBe(false)
    })

    it('rejects a Treasure card that is not in the bidder\'s hand', () => {
        const state = buildState()
        expect(makeBid('p1', 2, ['nonexistent']).isValidSubmitDuelBid(state)).toBe(false)
    })

    it('rejects a non-Treasure politics card used as a bid backer', () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = [{ id: 'alliance-1', type: PoliticsCardType.Alliance }]
        expect(makeBid('p1', 2, ['alliance-1']).isValidSubmitDuelBid(state)).toBe(false)
    })

    it('rejects a ducat amount beyond the bidder\'s money, even with a Treasure card attached', () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-8', type: PoliticsCardType.Treasure, value: 8 }
        ]
        expect(makeBid('p1', 999, ['treasure-8']).isValidSubmitDuelBid(state)).toBe(false)
    })

    it('rejects a second bid from the same player', () => {
        const state = buildState({
            duel: { slot: 2, playerIds: ['p1', 'p2'], bids: [{ playerId: 'p1', amount: 3 }], tieCount: 0 }
        })
        expect(makeBid('p1', 5).isValidSubmitDuelBid(state)).toBe(false)
    })
})
