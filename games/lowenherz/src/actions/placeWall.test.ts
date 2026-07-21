import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceWall } from './placeWall.js'

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
        machineState: MachineState.PlacingWalls,
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
        wallsRemaining: 2,
        wallPlacingPlayerId: 'p1',
        politicsCardPileA: [],
        politicsCardPileB: [],
        ...overrides
    }

    return new HydratedLowenherzGameState(data)
}

function makePlaceWall(
    playerId: string,
    col1: number,
    row1: number,
    col2: number,
    row2: number
): HydratedPlaceWall {
    return new HydratedPlaceWall({
        id: `wall-${col1}-${row1}-${col2}-${row2}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceWall,
        playerId,
        col1,
        row1,
        col2,
        row2
    })
}

describe('HydratedPlaceWall', () => {
    it('places a wall between two open adjacent squares and decrements wallsRemaining', () => {
        // Castles elsewhere on the board so the wide-open remainder has 2+ castles in
        // it (as any real game always would) and isn't itself misidentified as a
        // single-castle-or-fewer region - which would trigger this brand new wall's
        // own interior-wall cleanup, stripping it right back out.
        const board = blankBoard()
        board.squares[5][10] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[5][12] = { type: SquareType.Blank, castleColor: Color.Yellow }
        const state = buildState({ board })
        const action = makePlaceWall('p1', 0, 0, 1, 0)

        expect(action.isValidPlaceWall(state)).toBe(true)
        action.apply(state)

        expect(state.board.walls).toEqual([{ col: 1, row: 0, edge: WallEdge.West }])
        expect(state.wallsRemaining).toBe(1)
    })

    it('rejects a placement from anyone other than the designated wall-placing player', () => {
        const state = buildState()
        expect(makePlaceWall('p2', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(false)
    })

    it('rejects placement once wallsRemaining is exhausted', () => {
        const state = buildState({ wallsRemaining: 0 })
        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(false)
    })

    it('rejects non-adjacent squares', () => {
        const state = buildState()
        expect(makePlaceWall('p1', 0, 0, 5, 5).isValidPlaceWall(state)).toBe(false)
    })

    it('rejects a wall that already exists', () => {
        const state = buildState({ board: { ...blankBoard(), walls: [{ col: 1, row: 0, edge: WallEdge.West }] } })
        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(false)
    })

    it('rejects a wall between two knights of the same color', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        const state = buildState({ board })

        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(false)
    })

    it('allows a wall between two knights of different colors', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Yellow }
        const state = buildState({ board })

        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(true)
    })

    it('rejects a wall between a knight and a castle of the same color', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        const state = buildState({ board })

        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(false)
    })

    it('allows a wall between a knight and a castle of a different color', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Yellow }
        const state = buildState({ board })

        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(true)
    })

    it('rejects a wall entirely inside an already-existing region', () => {
        const state = buildState({
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0', '1,0'], castleSquareKey: '0,0' }]
        })
        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(false)
    })

    it('allows a wall between a square in an existing region and one outside it', () => {
        const state = buildState({
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'], castleSquareKey: '0,0' }]
        })
        expect(makePlaceWall('p1', 0, 0, 1, 0).isValidPlaceWall(state)).toBe(true)
    })

    it('scores a new region and cleans up its interior walls when a placement seals it', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        // Only the south wall of (0,0) exists so far - the action itself places the
        // east wall, which is the last piece needed to seal it off.
        board.walls = [{ col: 0, row: 1, edge: WallEdge.North }]

        const state = buildState({ board, regions: [] })
        const action = makePlaceWall('p1', 0, 0, 1, 0)
        expect(action.isValidPlaceWall(state)).toBe(true)
        action.apply(state)

        const pinkRegion = state.regions.find((r) => r.ownerColor === Color.Pink)
        expect(pinkRegion?.squareKeys).toEqual(['0,0'])
        expect(state.getPlayerState('p1').powerPoints).toBe(3) // 1-space region -> 3 points
        expect(action.metadata?.completedRegions).toContainEqual({
            ownerColor: Color.Pink,
            spaceCount: 1,
            townCount: 0,
            points: 3,
            anchorSquareKey: '0,0'
        })
    })

    it('records no completedRegions in metadata when the placement seals nothing', () => {
        // Castles elsewhere so the wide-open remainder has 2+ castles and isn't itself
        // misidentified as a single-castle region (see the first test in this file).
        const board = blankBoard()
        board.squares[5][10] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[5][12] = { type: SquareType.Blank, castleColor: Color.Yellow }
        const state = buildState({ board })
        const action = makePlaceWall('p1', 0, 0, 1, 0)
        action.apply(state)

        expect(action.metadata).toEqual({})
    })
})
