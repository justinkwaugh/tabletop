import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceKnight } from '../actions/placeKnight.js'
import { HydratedExpandRegion } from '../actions/expandRegion.js'
import { HydratedPass } from '../actions/pass.js'
import { PlacingKnightsStateHandler } from './placingKnights.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    const squares = Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }) as BoardSquare)
    )
    squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
    return { squares, walls: [] }
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

function makePlaceKnight(col: number, row: number) {
    return new HydratedPlaceKnight({
        id: `knight-${col}-${row}`,
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceKnight,
        playerId: 'p1',
        col,
        row
    })
}

describe('PlacingKnightsStateHandler', () => {
    it('sets activePlayerIds to the designated knight-placing player on enter', () => {
        const state = buildState()
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        new PlacingKnightsStateHandler().enter(context)

        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('stays in PlacingKnights while knightsRemaining is still positive after a placement', () => {
        const state = buildState({ knightsRemaining: 2 })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const action = makePlaceKnight(1, 0)
        action.apply(state, context)
        expect(state.knightsRemaining).toBe(1)

        expect(handler.onAction(action, context)).toBe(MachineState.PlacingKnights)
    })

    it('returns to ResolvingActions and clears knight-placement fields once knightsRemaining hits 0', () => {
        const state = buildState({ knightsRemaining: 1 })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const action = makePlaceKnight(1, 0)
        action.apply(state, context)
        expect(state.knightsRemaining).toBe(0)

        expect(handler.onAction(action, context)).toBe(MachineState.ResolvingActions)
        expect(state.knightsRemaining).toBeUndefined()
        expect(state.knightPlacingPlayerId).toBeUndefined()
    })

    it('only offers PlaceKnight/Pass to the designated player while knights remain', () => {
        const state = buildState({ knightsRemaining: 1, knightPlacingPlayerId: 'p1' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.PlaceKnight,
            ActionType.Pass
        ])
        expect(handler.validActionsForPlayer('p2', context)).toEqual([])
    })

    it('also offers ExpandRegion once the player owns a region', () => {
        const state = buildState({
            knightsRemaining: 1,
            knightPlacingPlayerId: 'p1',
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }]
        })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.PlaceKnight,
            ActionType.Pass,
            ActionType.ExpandRegion
        ])
    })

    it('ends the turn immediately on Pass, even with knights remaining', () => {
        const state = buildState({ knightsRemaining: 2, knightPlacingPlayerId: 'p1' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const action = new HydratedPass({
            id: 'pass-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.Pass,
            playerId: 'p1'
        })

        expect(handler.isValidAction(action, context)).toBe(true)
        expect(handler.onAction(action, context)).toBe(MachineState.ResolvingActions)
        expect(state.knightsRemaining).toBeUndefined()
        expect(state.knightPlacingPlayerId).toBeUndefined()
    })

    it('rejects a Pass from a player who is not the designated knight-placer', () => {
        const state = buildState({ knightsRemaining: 2, knightPlacingPlayerId: 'p1' })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const action = new HydratedPass({
            id: 'pass-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.Pass,
            playerId: 'p2'
        })

        expect(handler.isValidAction(action, context)).toBe(false)
    })

    it('zeroes knightsRemaining but keeps the phase open for a possible 2nd space, even with knightsRemaining > 1', () => {
        const state = buildState({
            knightsRemaining: 2,
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }]
        })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const action = new HydratedExpandRegion({
            id: 'expand-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.ExpandRegion,
            playerId: 'p1',
            regionId: 'r1',
            space: { col: 1, row: 0 }
        })
        expect(handler.isValidAction(action, context)).toBe(true)
        action.apply(state, context)

        expect(state.knightsRemaining).toBe(0)
        expect(state.expandingRegionId).toBe('r1')
        // Still open - a 2nd space of the same region (or a Pass to stop) is next,
        // not placing a knight (see validActionsForPlayer above).
        expect(handler.onAction(action, context)).toBe(MachineState.PlacingKnights)
        expect(handler.validActionsForPlayer('p1', context)).toEqual([ActionType.ExpandRegion, ActionType.Pass])

        // Passing now stops the expansion at 1 space and ends the phase.
        const passAction = new HydratedPass({
            id: 'pass-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.Pass,
            playerId: 'p1'
        })
        expect(handler.onAction(passAction, context)).toBe(MachineState.ResolvingActions)
        expect(state.expandingRegionId).toBeUndefined()
    })

    it('ends the phase once a 2nd space completes the expansion', () => {
        const state = buildState({
            knightsRemaining: 2,
            expandingRegionId: 'r1',
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0', '1,0'] }]
        })
        state.knightsRemaining = 0
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const action = new HydratedExpandRegion({
            id: 'expand-2',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.ExpandRegion,
            playerId: 'p1',
            regionId: 'r1',
            space: { col: 2, row: 0 }
        })
        expect(handler.isValidAction(action, context)).toBe(true)
        action.apply(state, context)

        expect(state.expandingRegionId).toBeUndefined()
        expect(handler.onAction(action, context)).toBe(MachineState.ResolvingActions)
    })
})
