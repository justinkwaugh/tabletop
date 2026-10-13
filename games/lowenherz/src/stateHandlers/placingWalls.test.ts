import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceWall } from '../actions/placeWall.js'
import { HydratedPass } from '../actions/pass.js'
import { PlacingWallsStateHandler } from './placingWalls.js'

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
        activePlayerIds: [],
        actionCount: 0,
        actionChecksum: 0,
        prng: { seed: 1, invocations: 0 },
        machineState: MachineState.PlacingWalls,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
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

function makePlaceWall(col1: number, row1: number, col2: number, row2: number) {
    return new HydratedPlaceWall({
        id: `wall-${col1}-${row1}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceWall,
        playerId: 'p1',
        col1,
        row1,
        col2,
        row2
    })
}

describe('PlacingWallsStateHandler', () => {
    it('sets activePlayerIds to the designated wall-placing player on enter', () => {
        const state = buildState()
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        new PlacingWallsStateHandler().enter(context)

        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('stays in PlacingWalls while wallsRemaining is still positive after a placement', () => {
        const state = buildState({ wallsRemaining: 2 })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingWallsStateHandler()

        const action = makePlaceWall(0, 0, 1, 0)
        action.apply(state, context)
        expect(state.wallsRemaining).toBe(1)

        expect(handler.onAction(action, context)).toBe(MachineState.PlacingWalls)
    })

    it('returns to ResolvingActions and clears wall-placement fields once wallsRemaining hits 0', () => {
        const state = buildState({ wallsRemaining: 1 })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingWallsStateHandler()

        const action = makePlaceWall(0, 0, 1, 0)
        action.apply(state, context)
        expect(state.wallsRemaining).toBe(0)

        expect(handler.onAction(action, context)).toBe(MachineState.ResolvingActions)
        expect(state.wallsRemaining).toBeUndefined()
        expect(state.wallPlacingPlayerId).toBeUndefined()
    })

    it('only offers PlaceWall/Pass to the designated player while walls remain', () => {
        const state = buildState({ wallsRemaining: 1, wallPlacingPlayerId: 'p1' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingWallsStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.PlaceWall,
            ActionType.Pass
        ])
        expect(handler.validActionsForPlayer('p2', context)).toEqual([])
    })

    it('ends the turn immediately on Pass, even with walls remaining', () => {
        const state = buildState({ wallsRemaining: 2, wallPlacingPlayerId: 'p1' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingWallsStateHandler()

        const action = new HydratedPass({
            id: 'pass-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.Pass,
            playerId: 'p1'
        })

        expect(handler.isValidAction(action, context)).toBe(true)
        expect(handler.onAction(action, context)).toBe(MachineState.ResolvingActions)
        expect(state.wallsRemaining).toBeUndefined()
        expect(state.wallPlacingPlayerId).toBeUndefined()
    })

    it('rejects a Pass from a player who is not the designated wall-placer', () => {
        const state = buildState({ wallsRemaining: 2, wallPlacingPlayerId: 'p1' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingWallsStateHandler()

        const action = new HydratedPass({
            id: 'pass-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.Pass,
            playerId: 'p2'
        })

        expect(handler.isValidAction(action, context)).toBe(false)
    })

    describe('when the placer encloses their last castle with walls still in hand', () => {
        function enclosedState(overrides: Partial<LowenherzGameState> = {}) {
            const board = blankBoard()
            board.squares[5][5] = { type: SquareType.Blank, castleOwner: 'p1', regionId: 'r1' }
            return buildState({
                board,
                regions: [{ id: 'r1', owner: 'p1', squareKeys: ['5,5'], castleSquareKey: '5,5' }],
                wallsRemaining: 1,
                ...overrides
            })
        }

        it('ends the allotment in a game that records the enclosure rule', () => {
            const state = enclosedState({ enclosureEndsWallAllotment: true })
            const context = new MachineContext({ gameConfig: {}, gameState: state })

            const next = new PlacingWallsStateHandler().onAction(makePlaceWall(0, 0, 1, 0), context)

            expect(next).toBe(MachineState.ResolvingActions)
            expect(state.wallsRemaining).toBeUndefined()
            expect(state.wallPlacingPlayerId).toBeUndefined()
        })

        it('keeps the allotment open in a stored game that predates the enclosure rule', () => {
            const state = enclosedState()
            const context = new MachineContext({ gameConfig: {}, gameState: state })

            const next = new PlacingWallsStateHandler().onAction(makePlaceWall(0, 0, 1, 0), context)

            expect(next).toBe(MachineState.PlacingWalls)
            expect(state.wallsRemaining).toBe(1)
            expect(state.wallPlacingPlayerId).toBe('p1')
        })
    })
})
