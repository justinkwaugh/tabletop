import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { Region } from '../model/region.js'
import { HydratedCancelAlliance } from './cancelAlliance.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function ownRegion(): Region {
    return { id: 'own', ownerColor: Color.Pink, squareKeys: ['0,0'], castleSquareKey: '0,0' }
}

function enemyRegion(): Region {
    return { id: 'enemy', ownerColor: Color.Yellow, squareKeys: ['0,1'], castleSquareKey: '0,1' }
}

function buildState(overrides: Partial<LowenherzGameState> = {}): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow][index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 5,
        politicsCards: []
    }))

    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players,
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.ChoosingActions,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [ownRegion(), enemyRegion()],
        alliances: [{ id: 'alliance-1', regionAId: 'own', regionBId: 'enemy' }],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: [],
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makeCancelAlliance(playerId: string, allianceId = 'alliance-1'): HydratedCancelAlliance {
    return new HydratedCancelAlliance({
        id: 'cancel-1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.CancelAlliance,
        playerId,
        allianceId
    })
}

describe('HydratedCancelAlliance', () => {
    it('removes the alliance and charges the canceling player 10 ducats', () => {
        const state = buildState()
        const action = makeCancelAlliance('p1')

        expect(action.isValidCancelAlliance(state)).toBe(true)
        action.apply(state)

        expect(state.alliances).toEqual([])
        expect(state.getPlayerState('p1').money).toBe(2)
        expect(action.metadata).toEqual({ otherColor: Color.Yellow })
    })

    it('can be cancelled by the OTHER participant instead, at their own turn', () => {
        const state = buildState({
            activePlayerIds: ['p2'],
            decisions: [{ playerId: 'p1', slot: 1 }, { playerId: 'p1', slot: 2 }]
        })
        const action = makeCancelAlliance('p2')

        expect(action.isValidCancelAlliance(state)).toBe(true)
        action.apply(state)

        expect(state.alliances).toEqual([])
        expect(state.getPlayerState('p2').money).toBe(2)
        expect(action.metadata).toEqual({ otherColor: Color.Pink })
    })

    it("rejects cancellation while it isn't the player's turn to act at all", () => {
        const state = buildState({
            activePlayerIds: ['p2'],
            decisions: [{ playerId: 'p1', slot: 1 }, { playerId: 'p1', slot: 2 }]
        })
        // p1 is a participant and can afford it, but p2 is the one acting - and the
        // platform (GameEngine.isPlayerAllowed) wouldn't accept an action from a
        // non-active player anyway, so this mirrors that rather than inventing a
        // second, looser rule.
        expect(makeCancelAlliance('p1').isValidCancelAlliance(state)).toBe(false)
    })

    it('allows cancelling mid-knight-action, which is what unblocks expanding into the ex-ally', () => {
        // The rulebook's own example of why you'd pay: "If gold pays 10 ducats to the
        // bank, he may cancel the alliance and is then free to expand into either
        // region." Expansion happens during the knight action, long after this player's
        // decision-laying turn - so gating cancellation on that turn made the sequence
        // impossible to perform.
        const state = buildState({
            machineState: MachineState.PlacingKnights,
            activePlayerIds: ['p1'],
            knightsRemaining: 2,
            knightPlacingPlayerId: 'p1',
            decisions: [{ playerId: 'p1', slot: 1 }, { playerId: 'p1', slot: 2 }, { playerId: 'p2', slot: 3 }],
            resolvedSlots: [{ slot: 1, winnerPlayerId: 'p1' }]
        })
        const action = makeCancelAlliance('p1')

        expect(action.isValidCancelAlliance(state)).toBe(true)
        action.apply(state)

        expect(state.alliances).toEqual([])
        expect(state.getPlayerState('p1').money).toBe(2)
        // The knight action itself is untouched - the ducats are the only cost.
        expect(state.knightsRemaining).toBe(2)
        expect(state.knightPlacingPlayerId).toBe('p1')
    })

    it("rejects cancellation from a player who isn't one of the two alliance participants", () => {
        const state = buildState({
            players: [
                { playerId: 'p1', color: Color.Pink, money: 12, powerPoints: 0, knightsInStock: 5, politicsCards: [] },
                { playerId: 'p2', color: Color.Yellow, money: 12, powerPoints: 0, knightsInStock: 5, politicsCards: [] },
                { playerId: 'p3', color: Color.Purple, money: 12, powerPoints: 0, knightsInStock: 5, politicsCards: [] }
            ],
            turnOrder: ['p1', 'p2', 'p3'],
            activePlayerIds: ['p3']
        })
        // p3's decision-laying turn is 3rd in a 3-player round (p1, p1, p2, p3), so
        // put 3 decisions in first to make it actually p3's turn.
        state.decisions = [
            { playerId: 'p1', slot: 1 },
            { playerId: 'p1', slot: 2 },
            { playerId: 'p2', slot: 3 }
        ]
        expect(makeCancelAlliance('p3').isValidCancelAlliance(state)).toBe(false)
    })

    it("rejects cancelling an alliance that doesn't exist", () => {
        const state = buildState()
        expect(makeCancelAlliance('p1', 'nonexistent').isValidCancelAlliance(state)).toBe(false)
    })

    it('rejects cancellation when the player cannot afford the 10-ducat cost', () => {
        const state = buildState()
        state.getPlayerState('p1').money = 9
        expect(makeCancelAlliance('p1').isValidCancelAlliance(state)).toBe(false)
    })
})
