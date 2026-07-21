import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { isKnightSafeToRemove } from './knightConnectivity.js'

function blankBoard(): { squares: BoardSquare[][]; walls: { col: number; row: number; edge: WallEdge }[] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(board: ReturnType<typeof blankBoard>): HydratedLowenherzGameState {
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
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.ChoosingActions,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board,
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
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

describe('isKnightSafeToRemove', () => {
    it('allows removing a "leaf" knight that nothing else depends on', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][2] = { type: SquareType.Blank, knightColor: Color.Pink }
        const state = buildState(board)

        expect(isKnightSafeToRemove(state, Color.Pink, 2, 0)).toBe(true)
    })

    it('rejects removing a knight that is the sole connector to the castle', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][2] = { type: SquareType.Blank, knightColor: Color.Pink }
        const state = buildState(board)

        // Removing (1,0) would strand (2,0) - it has no other path to the castle.
        expect(isKnightSafeToRemove(state, Color.Pink, 1, 0)).toBe(false)
    })

    it('allows removing the only knight a color has, leaving just the castle', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        const state = buildState(board)

        expect(isKnightSafeToRemove(state, Color.Pink, 1, 0)).toBe(true)
    })

    it('allows removing a knight when an alternate path to the castle still exists', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[1][0] = { type: SquareType.Blank, knightColor: Color.Pink } // (0,1)
        board.squares[1][1] = { type: SquareType.Blank, knightColor: Color.Pink } // (1,1) - reachable via (0,1) too
        const state = buildState(board)

        // (1,0) and (0,1) both connect (1,1) back to the castle - removing (1,0)
        // still leaves the (0,1) -> (1,1) path.
        expect(isKnightSafeToRemove(state, Color.Pink, 1, 0)).toBe(true)
    })

    it('treats a wall between two knights as breaking the connection', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][2] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.walls = [{ col: 2, row: 0, edge: WallEdge.West }] // between (1,0) and (2,0)
        const state = buildState(board)

        // (2,0) was already unreachable (wall-blocked) even before considering
        // removal - removing (1,0) doesn't change that, so this should report
        // whatever's left as still disconnected either way (false).
        expect(isKnightSafeToRemove(state, Color.Pink, 1, 0)).toBe(false)
    })

    it('is unaffected by a different color\'s knights', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[5][5] = { type: SquareType.Blank, castleColor: Color.Yellow }
        board.squares[5][6] = { type: SquareType.Blank, knightColor: Color.Yellow }
        const state = buildState(board)

        expect(isKnightSafeToRemove(state, Color.Pink, 1, 0)).toBe(true)
    })
})
