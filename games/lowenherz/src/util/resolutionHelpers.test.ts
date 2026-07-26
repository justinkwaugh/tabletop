import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { Region } from '../model/region.js'
import { routeAfterSlotResolved } from './resolutionHelpers.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(
    resolvedSlots: { slot: 1 | 2 | 3; winnerPlayerId?: string }[],
    card: ActionCard,
    regions: Region[] = []
): HydratedLowenherzGameState {
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
        machineState: MachineState.ResolvingActions,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions,
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: 'p1',
        neutralColor: undefined,
        actionDeck: [],
        currentActionCard: card,
        decisions: [],
        resolvedSlots,
        politicsCardPileA: [],
        politicsCardPileB: []
    }

    return new HydratedLowenherzGameState(data)
}

const cardWithBorderMiddle: ActionCard = {
    id: 'card-1',
    back: CardBack.B,
    type: ActionCardType.Standard,
    top: { kind: 'politics' },
    middle: { kind: 'border', count: 2 },
    bottom: { kind: 'knight', count: 1 }
}

describe('routeAfterSlotResolved', () => {
    it('routes a border-slot winner into PlacingWalls with the right wall count', () => {
        const state = buildState([{ slot: 2, winnerPlayerId: 'p1' }], cardWithBorderMiddle)

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.PlacingWalls)
        expect(routing.bandKind).toBe('border')
        expect(routing.bandCount).toBe(2)
        expect(routing.placementSkippedReason).toBeUndefined()
        expect(state.wallsRemaining).toBe(2)
        expect(state.wallPlacingPlayerId).toBe('p1')
    })

    it('does not route to PlacingWalls when the winning player already has 3 regions', () => {
        const existingRegions: Region[] = [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'] },
            { id: 'r2', ownerColor: Color.Pink, squareKeys: ['1,0'] },
            { id: 'r3', ownerColor: Color.Pink, squareKeys: ['2,0'] }
        ]
        const state = buildState([{ slot: 2, winnerPlayerId: 'p1' }], cardWithBorderMiddle, existingRegions)

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.ResolvingActions)
        expect(routing.bandKind).toBe('border')
        expect(routing.placementSkippedReason).toBe('regionCap')
        expect(state.wallsRemaining).toBeUndefined()
        expect(state.wallPlacingPlayerId).toBeUndefined()
    })

    it('does not route to PlacingWalls when there is nowhere left to legally place a wall', () => {
        // Wall every edge on a tiny 2x1 slice of the board so no adjacent pair is
        // left un-walled anywhere - buildState's blank board is otherwise wide open.
        const state = buildState([{ slot: 2, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        for (let row = 0; row < BOARD_ROWS; row++) {
            for (let col = 0; col < BOARD_COLS; col++) {
                if (col + 1 < BOARD_COLS) state.board.walls.push({ col: col + 1, row, edge: WallEdge.West })
                if (row + 1 < BOARD_ROWS) state.board.walls.push({ col, row: row + 1, edge: WallEdge.North })
            }
        }

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.ResolvingActions)
        expect(routing.bandKind).toBe('border')
        expect(routing.placementSkippedReason).toBe('noLegalWallSpots')
        expect(state.wallsRemaining).toBeUndefined()
        expect(state.wallPlacingPlayerId).toBeUndefined()
    })

    it('routes a knight-slot winner into PlacingKnights with the right knight count', () => {
        const state = buildState([{ slot: 3, winnerPlayerId: 'p1' }], cardWithBorderMiddle) // bottom = knight
        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.PlacingKnights)
        expect(routing.bandKind).toBe('knight')
        expect(routing.bandCount).toBe(1)
        expect(state.knightsRemaining).toBe(1)
        expect(state.knightPlacingPlayerId).toBe('p1')
    })

    it('caps knightsRemaining at the winner\'s knight stock, and skips entirely if they have none', () => {
        const state = buildState([{ slot: 3, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        state.getPlayerState('p1').knightsInStock = 0

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.ResolvingActions)
        expect(routing.bandKind).toBe('knight')
        expect(routing.placementSkippedReason).toBe('noKnightsInStock')
        expect(state.knightsRemaining).toBeUndefined()
        expect(state.knightPlacingPlayerId).toBeUndefined()
    })

    it('does not route anywhere when there is no winner', () => {
        const state = buildState([{ slot: 2, winnerPlayerId: undefined }], cardWithBorderMiddle)
        expect(routeAfterSlotResolved(state).nextState).toBe(MachineState.ResolvingActions)
    })

    it('routes a politics-slot (slot 1) winner into TakingPoliticsCard', () => {
        const state = buildState([{ slot: 1, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        expect(routeAfterSlotResolved(state).nextState).toBe(MachineState.TakingPoliticsCard)
        expect(state.politicsTakingPlayerId).toBe('p1')
    })

    it('does not route slot 1 to TakingPoliticsCard when the top band is income, not politics', () => {
        const cardWithIncomeTop: ActionCard = { ...cardWithBorderMiddle, top: { kind: 'income', value: 4 } }
        const state = buildState([{ slot: 1, winnerPlayerId: 'p1' }], cardWithIncomeTop)
        expect(routeAfterSlotResolved(state).nextState).toBe(MachineState.ResolvingActions)
        expect(state.politicsTakingPlayerId).toBeUndefined()
    })
})
