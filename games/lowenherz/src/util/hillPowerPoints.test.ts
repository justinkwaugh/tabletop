import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { Region } from '../model/region.js'
import { awardHillPowerPoints } from './hillPowerPoints.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(
    board: ReturnType<typeof blankBoard>,
    regions: Region[],
    playerCount = 2
): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2', 'p3'].slice(0, playerCount)
    const colors = [Color.Pink, Color.Yellow, Color.Purple]
    const data: LowenherzGameState = {
        id: 'game-1',
        gameId: 'game-1',
        players: playerIds.map((playerId, index) => ({
            playerId,
            color: colors[index],
            money: 12,
            powerPoints: 0,
            knightsInStock: 12,
            politicsCards: []
        })),
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.StartOfTurn,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board,
        regions,
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

// "Each player receives one power point for each hill space in his regions" - the payout
// both the Silver Mine card and the King is Dead card make (see StartOfTurnStateHandler).
describe('awardHillPowerPoints', () => {
    it('awards one point per hill space inside a player’s own regions', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Hill }
        board.squares[0][1] = { type: SquareType.Hill }
        board.squares[0][2] = { type: SquareType.Blank } // not a hill - no point
        const state = buildState(board, [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0', '1,0', '2,0'] }
        ])

        const scored = awardHillPowerPoints(state)

        expect(state.getPlayerState('p1').powerPoints).toBe(2)
        expect(scored).toEqual([
            { playerId: 'p1', points: 2 },
            { playerId: 'p2', points: 0 }
        ])
    })

    it('reports an entry for every player, including those who scored nothing', () => {
        // Callers attach this straight to action metadata so history can say what each
        // player got - a player with no hills has to appear as 0 rather than be omitted.
        const state = buildState(blankBoard(), [])

        expect(awardHillPowerPoints(state)).toEqual([
            { playerId: 'p1', points: 0 },
            { playerId: 'p2', points: 0 }
        ])
        expect(state.getPlayerState('p1').powerPoints).toBe(0)
    })

    it('ignores hills that are outside every region', () => {
        // Only hills a player has ENCLOSED count - an unclaimed hill on open board pays
        // nobody, which is the whole point of walling territory in.
        const board = blankBoard()
        board.squares[5][5] = { type: SquareType.Hill } // (5,5), in no region
        const state = buildState(board, [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }
        ])

        expect(awardHillPowerPoints(state)).toEqual([
            { playerId: 'p1', points: 0 },
            { playerId: 'p2', points: 0 }
        ])
    })

    it('ignores hills in a neutral zone, which belongs to no prince', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Hill }
        const state = buildState(board, [
            { id: 'neutral-1', ownerColor: undefined, squareKeys: ['0,0'] }
        ])

        expect(awardHillPowerPoints(state)).toEqual([
            { playerId: 'p1', points: 0 },
            { playerId: 'p2', points: 0 }
        ])
    })

    it('scores each player separately, and sums hills across several of one player’s regions', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Hill } // Pink's first region
        board.squares[2][3] = { type: SquareType.Hill } // Pink's second region
        board.squares[2][4] = { type: SquareType.Hill } // Pink's second region
        board.squares[4][6] = { type: SquareType.Hill } // Yellow's region
        const state = buildState(
            board,
            [
                { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] },
                { id: 'r2', ownerColor: Color.Pink, squareKeys: ['3,2', '4,2'] },
                { id: 'r3', ownerColor: Color.Yellow, squareKeys: ['6,4'] }
            ],
            3
        )

        const scored = awardHillPowerPoints(state)

        expect(scored).toEqual([
            { playerId: 'p1', points: 3 },
            { playerId: 'p2', points: 1 },
            { playerId: 'p3', points: 0 }
        ])
        expect(state.getPlayerState('p1').powerPoints).toBe(3)
        expect(state.getPlayerState('p2').powerPoints).toBe(1)
        expect(state.getPlayerState('p3').powerPoints).toBe(0)
    })

    it('adds to power points already earned rather than replacing them', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Hill }
        const state = buildState(board, [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }
        ])
        state.getPlayerState('p1').powerPoints = 17

        awardHillPowerPoints(state)

        expect(state.getPlayerState('p1').powerPoints).toBe(18)
    })

    it('is not idempotent - each call pays out again, so callers must fire it once per card', () => {
        // Documented rather than defended: StartOfTurnStateHandler calls this exactly once
        // per Silver Mine / King is Dead reveal. Anything that re-enters that state without
        // a fresh card would double-pay, so this pins the behaviour a caller has to respect.
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Hill }
        const state = buildState(board, [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }
        ])

        awardHillPowerPoints(state)
        awardHillPowerPoints(state)

        expect(state.getPlayerState('p1').powerPoints).toBe(2)
    })
})
