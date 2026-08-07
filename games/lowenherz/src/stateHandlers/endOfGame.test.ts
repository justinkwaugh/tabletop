import { describe, expect, it } from 'vitest'
import { Color, GameResult, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { EndOfGameStateHandler } from './endOfGame.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(
    players: { playerId: string; color: Color; money: number; powerPoints: number }[]
): HydratedLowenherzGameState {
    const playerIds = players.map((p) => p.playerId)
    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players: players.map((p) => ({ ...p, knightsInStock: 12, politicsCards: [] })),
        activePlayerIds: [...playerIds],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.EndOfGame,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: []
    }

    return new HydratedLowenherzGameState(data)
}

describe('EndOfGameStateHandler', () => {
    it('declares a single winner with the most power points and clears activePlayerIds', () => {
        const state = buildState([
            { playerId: 'p1', color: Color.Pink, money: 5, powerPoints: 20 },
            { playerId: 'p2', color: Color.Yellow, money: 5, powerPoints: 15 }
        ])
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        new EndOfGameStateHandler().enter(context)

        expect(state.winningPlayerIds).toEqual(['p1'])
        expect(state.result).toBe(GameResult.Win)
        expect(state.activePlayerIds).toEqual([])
    })

    it('breaks a power-point tie by ducats on hand', () => {
        const state = buildState([
            { playerId: 'p1', color: Color.Pink, money: 3, powerPoints: 20 },
            { playerId: 'p2', color: Color.Yellow, money: 8, powerPoints: 20 },
            { playerId: 'p3', color: Color.Purple, money: 1, powerPoints: 10 }
        ])
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        new EndOfGameStateHandler().enter(context)

        expect(state.winningPlayerIds).toEqual(['p2'])
        expect(state.result).toBe(GameResult.Win)
    })

    it('declares a draw when power points and ducats are both tied', () => {
        const state = buildState([
            { playerId: 'p1', color: Color.Pink, money: 5, powerPoints: 20 },
            { playerId: 'p2', color: Color.Yellow, money: 5, powerPoints: 20 }
        ])
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        new EndOfGameStateHandler().enter(context)

        expect(state.winningPlayerIds.slice().sort()).toEqual(['p1', 'p2'])
        expect(state.result).toBe(GameResult.Draw)
    })

    it("adds each player's held Parchment card values to their power points before determining the winner", () => {
        const state = buildState([
            { playerId: 'p1', color: Color.Pink, money: 5, powerPoints: 10 },
            { playerId: 'p2', color: Color.Yellow, money: 5, powerPoints: 12 }
        ])
        // p1's hand: 4 + 3 = 7 bonus power points, bringing them to 17 - enough to
        // overtake p2's 12 (which has no politics cards, so no bonus).
        state.getPlayerState('p1').politicsCards = [
            { id: 'parch-4', type: PoliticsCardType.Parchment, value: 4 },
            { id: 'parch-3', type: PoliticsCardType.Parchment, value: 3 },
            { id: 'alliance-1', type: PoliticsCardType.Alliance } // non-Parchment, ignored
        ]
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        new EndOfGameStateHandler().enter(context)

        expect(state.getPlayerState('p1').powerPoints).toBe(17)
        expect(state.getPlayerState('p2').powerPoints).toBe(12)
        expect(state.winningPlayerIds).toEqual(['p1'])
    })

    it('counts an unspent Treasure card as ducats in the tiebreak', () => {
        // "in case of a tie, the player (among those tied) with the most ducats wins
        // (treasure cards are included)" - a Treasure card is spendable as money during
        // the game, so it counts at face value here too.
        const state = buildState([
            { playerId: 'p1', color: Color.Pink, money: 5, powerPoints: 40 },
            { playerId: 'p2', color: Color.Yellow, money: 3, powerPoints: 40 }
        ])
        state.getPlayerState('p2').politicsCards = [
            { id: 'treasure-15', type: PoliticsCardType.Treasure, value: 15 }
        ]
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        new EndOfGameStateHandler().enter(context)

        // p2: 3 + 15 = 18 beats p1's 5, despite p1 holding more loose ducats.
        expect(state.winningPlayerIds).toEqual(['p2'])
        expect(state.result).toBe(GameResult.Win)
    })

    it('draws when power points and total wealth including Treasure are both tied', () => {
        const state = buildState([
            { playerId: 'p1', color: Color.Pink, money: 12, powerPoints: 40 },
            { playerId: 'p2', color: Color.Yellow, money: 4, powerPoints: 40 }
        ])
        state.getPlayerState('p2').politicsCards = [
            { id: 'treasure-8', type: PoliticsCardType.Treasure, value: 8 }
        ]
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        new EndOfGameStateHandler().enter(context)

        expect(state.winningPlayerIds).toEqual(['p1', 'p2'])
        expect(state.result).toBe(GameResult.Draw)
    })

    it('rejects any action - EndOfGame is a terminal state', () => {
        const state = buildState([{ playerId: 'p1', color: Color.Pink, money: 5, powerPoints: 20 }])
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new EndOfGameStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toEqual([])
        expect(() => handler.onAction(undefined as never, context)).toThrow()
    })
})
