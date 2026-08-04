import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceKnight } from '../actions/placeKnight.js'
import { HydratedExpandRegion } from '../actions/expandRegion.js'
import { HydratedPass } from '../actions/pass.js'
import { HydratedCancelAlliance } from '../actions/cancelAlliance.js'
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
            ActionType.ExpandRegion,
            ActionType.Pass
        ])
    })

    it('offers only ExpandRegion/Pass when the knight stock is empty', () => {
        const state = buildState({
            knightsRemaining: 1,
            knightPlacingPlayerId: 'p1',
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }]
        })
        state.getPlayerState('p1').knightsInStock = 0
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        // "If he has no more knights, he may place no more" - but the action's other
        // half ("or extend one of his regions") needs nothing from stock.
        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.ExpandRegion,
            ActionType.Pass
        ])
    })

    it('offers nothing at all when neither half of the action is available', () => {
        const state = buildState({ knightsRemaining: 1, knightPlacingPlayerId: 'p1', regions: [] })
        state.getPlayerState('p1').knightsInStock = 0
        const context = new MachineContext({ gameConfig: {}, gameState: state })

        expect(new PlacingKnightsStateHandler().validActionsForPlayer('p1', context)).toEqual([])
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

    it('keeps the phase open after an expansion for both its 2nd space and the leftover sword', () => {
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

        // One sword spent on the expansion, one still owed as a knight.
        expect(state.knightsRemaining).toBe(1)
        expect(state.expandingRegionId).toBe('r1')
        expect(handler.onAction(action, context)).toBe(MachineState.PlacingKnights)
        // The optional 2nd space AND the leftover sword's knight are both live; a 2nd
        // separate expansion isn't, but that's ExpandRegion's own check (expansionUsed).
        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.PlaceKnight,
            ActionType.ExpandRegion,
            ActionType.Pass
        ])

        // Passing now stops the expansion at 1 space and forfeits the leftover sword.
        const passAction = new HydratedPass({
            id: 'pass-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.Pass,
            playerId: 'p1'
        })
        expect(handler.onAction(passAction, context)).toBe(MachineState.ResolvingActions)
        expect(state.expandingRegionId).toBeUndefined()
        expect(state.expansionUsed).toBeUndefined()
    })

    it('lets a two-sword action expand a region and then still place its knight', () => {
        const state = buildState({
            knightsRemaining: 2,
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }]
        })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        const expand = new HydratedExpandRegion({
            id: 'expand-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.ExpandRegion,
            playerId: 'p1',
            regionId: 'r1',
            space: { col: 1, row: 0 }
        })
        expand.apply(state, context)
        expect(handler.onAction(expand, context)).toBe(MachineState.PlacingKnights)

        // The knight goes down next to the castle at (0,0) - placing it also abandons
        // the expansion's unused 2nd space, and spends the action's last sword.
        const knight = makePlaceKnight(0, 1)
        expect(handler.isValidAction(knight, context)).toBe(true)
        knight.apply(state, context)

        expect(handler.onAction(knight, context)).toBe(MachineState.ResolvingActions)
        expect(state.knightsRemaining).toBeUndefined()
        expect(state.expandingRegionId).toBeUndefined()
        expect(state.knightPlacingPlayerId).toBeUndefined()
    })

    it('lets a two-sword action place its knight first and then expand', () => {
        const state = buildState({
            knightsRemaining: 2,
            regions: [{ id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] }]
        })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        // Knight first, below the castle at (0,0).
        const knight = makePlaceKnight(0, 1)
        knight.apply(state, context)
        expect(handler.onAction(knight, context)).toBe(MachineState.PlacingKnights)
        expect(state.knightsRemaining).toBe(1)

        // Then the expansion's 1st space, on the action's last sword.
        const first = new HydratedExpandRegion({
            id: 'expand-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.ExpandRegion,
            playerId: 'p1',
            regionId: 'r1',
            space: { col: 1, row: 0 }
        })
        expect(handler.isValidAction(first, context)).toBe(true)
        first.apply(state, context)
        expect(state.knightsRemaining).toBe(0)
        expect(state.expansionUsed).toBe(true)
        // Still open for the optional 2nd space, even with every sword spent - taking
        // that space (and the phase ending on it) is covered by the test below.
        expect(handler.onAction(first, context)).toBe(MachineState.PlacingKnights)
        expect(state.expandingRegionId).toBe('r1')
        expect(handler.validActionsForPlayer('p1', context)).toEqual([
            ActionType.ExpandRegion,
            ActionType.Pass
        ])
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

    it('accepts an alliance cancellation mid-action without spending any of it', () => {
        // The rulebook allows cancelling "at any time", and this is the moment it matters:
        // an alliance blocks expansion between its regions, so paying it off has to be
        // possible in the same action you'd then expand with.
        const state = buildState({
            regions: [
                { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'], castleSquareKey: '0,0' },
                { id: 'r2', ownerColor: Color.Yellow, squareKeys: ['0,1'], castleSquareKey: '0,1' }
            ],
            alliances: [{ id: 'alliance-1', regionAId: 'r1', regionBId: 'r2' }],
            activePlayerIds: ['p1']
        })
        const context = new MachineContext({ gameConfig: {}, gameState: state })
        const handler = new PlacingKnightsStateHandler()

        expect(handler.validActionsForPlayer('p1', context)).toContain(ActionType.CancelAlliance)

        const action = new HydratedCancelAlliance({
            id: 'cancel-1',
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.CancelAlliance,
            playerId: 'p1',
            allianceId: 'alliance-1'
        })
        expect(handler.isValidAction(action, context)).toBe(true)
        action.apply(state, context)

        // Stays in the phase with the whole knight action still owed - only ducats moved.
        expect(handler.onAction(action, context)).toBe(MachineState.PlacingKnights)
        expect(state.knightsRemaining).toBe(2)
        expect(state.knightPlacingPlayerId).toBe('p1')
        expect(state.getPlayerState('p1').money).toBe(2)
        expect(state.alliances).toEqual([])
    })

    it('does not offer a cancellation to a player who has no alliance or not enough ducats', () => {
        const noAlliance = buildState({ activePlayerIds: ['p1'] })
        const context = new MachineContext({ gameConfig: {}, gameState: noAlliance })
        const handler = new PlacingKnightsStateHandler()
        expect(handler.validActionsForPlayer('p1', context)).not.toContain(ActionType.CancelAlliance)

        const brokeState = buildState({
            regions: [
                { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'], castleSquareKey: '0,0' },
                { id: 'r2', ownerColor: Color.Yellow, squareKeys: ['0,1'], castleSquareKey: '0,1' }
            ],
            alliances: [{ id: 'alliance-1', regionAId: 'r1', regionBId: 'r2' }],
            activePlayerIds: ['p1']
        })
        brokeState.getPlayerState('p1').money = 9
        const brokeContext = new MachineContext({ gameConfig: {}, gameState: brokeState })
        expect(handler.validActionsForPlayer('p1', brokeContext)).not.toContain(ActionType.CancelAlliance)
    })
})
