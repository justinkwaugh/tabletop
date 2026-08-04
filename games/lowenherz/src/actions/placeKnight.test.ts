import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { HydratedPlaceKnight } from './placeKnight.js'

function blankBoard(): { squares: BoardSquare[][]; walls: { col: number; row: number; edge: WallEdge }[] } {
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
        activePlayerIds: ['p1'],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.PlacingKnights,
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
        knightsRemaining: 2,
        knightPlacingPlayerId: 'p1',
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makePlaceKnight(
    playerId: string,
    col: number,
    row: number,
    treasureCardId?: string
): HydratedPlaceKnight {
    return new HydratedPlaceKnight({
        id: `knight-${col}-${row}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceKnight,
        playerId,
        col,
        row,
        ...(treasureCardId ? { treasureCardId } : {})
    })
}

describe('HydratedPlaceKnight', () => {
    it('places a knight adjacent to an own castle on a blank square', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        const state = buildState({ board })

        const action = makePlaceKnight('p1', 1, 0)
        expect(action.isValidPlaceKnight(state)).toBe(true)
        action.apply(state)

        expect(state.board.squares[0][1].knightColor).toBe(Color.Pink)
        expect(state.knightsRemaining).toBe(1)
        expect(state.getPlayerState('p1').knightsInStock).toBe(11)
        expect(action.metadata).toEqual({})
    })

    it('places a knight adjacent to an own existing knight', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, knightColor: Color.Pink }
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(true)
    })

    it('charges 5 ducats and records it in metadata when placed in the woods', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Forest }
        const state = buildState({ board })

        const action = makePlaceKnight('p1', 1, 0)
        expect(action.isValidPlaceKnight(state)).toBe(true)
        action.apply(state)

        expect(state.getPlayerState('p1').money).toBe(12 - 5)
        expect(action.metadata).toEqual({ woodedCostPaid: 5 })
    })

    it('rejects a wooded placement the player cannot afford', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Forest }
        const state = buildState({ board })
        state.getPlayerState('p1').money = 4

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('pays the wooded cost with a Treasure card instead of ducats, losing the excess value', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Forest }
        const state = buildState({ board })
        state.getPlayerState('p1').money = 0 // can't afford it in ducats at all
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }
        ]

        const action = makePlaceKnight('p1', 1, 0, 'treasure-10')
        expect(action.isValidPlaceKnight(state)).toBe(true)
        action.apply(state)

        expect(state.getPlayerState('p1').money).toBe(0) // untouched - paid with the card, not ducats
        expect(state.getPlayerState('p1').politicsCards).toEqual([])
        expect(action.metadata).toEqual({
            woodedCostPaid: 5,
            paidWithTreasureCard: { id: 'treasure-10', type: PoliticsCardType.Treasure, value: 10 }
        })
    })

    it('rejects a Treasure card that is not actually in the player\'s hand', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Forest }
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0, 'nonexistent').isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects using a Treasure card on a non-wooded square', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        const state = buildState({ board })
        state.getPlayerState('p1').politicsCards = [
            { id: 'treasure-8', type: PoliticsCardType.Treasure, value: 8 }
        ]

        expect(makePlaceKnight('p1', 1, 0, 'treasure-8').isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects a placement from anyone other than the designated knight-placing player', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        const state = buildState({ board })

        expect(makePlaceKnight('p2', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects placement once knightsRemaining is exhausted', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        const state = buildState({ board, knightsRemaining: 0 })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects placement when the knight stock is empty, even with a sword left', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        // knightsRemaining counts the action's swords and isn't capped by stock (the
        // spare one is spendable on a region expansion instead - see
        // resolveBandForWinner), so PlaceKnight is where "if he has no more knights, he
        // may place no more" gets enforced.
        const state = buildState({ board, knightsRemaining: 2 })
        state.getPlayerState('p1').knightsInStock = 0

        const action = makePlaceKnight('p1', 1, 0)
        expect(action.isValidPlaceKnight(state)).toBe(false)
        expect(action.invalidPlaceKnightReason(state)).toBe('You have no knights left in your stock.')
    })

    it('rejects a hill space', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Hill }
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects a village space', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Village }
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects an already-occupied square', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Yellow }
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects a square only adjacent to an opposing knight/castle', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Yellow }
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects a square with no adjacent knight or castle of any kind', () => {
        const state = buildState()
        expect(makePlaceKnight('p1', 5, 5).isValidPlaceKnight(state)).toBe(false)
    })

    it('rejects when the only adjacency is blocked by a wall', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.walls = [{ col: 1, row: 0, edge: WallEdge.West }] // between (0,0) and (1,0)
        const state = buildState({ board })

        expect(makePlaceKnight('p1', 1, 0).isValidPlaceKnight(state)).toBe(false)
    })
})
