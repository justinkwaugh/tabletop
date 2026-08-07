import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionCard, ActionCardType, CardBack } from '../definition/actionCards.js'
import { Region } from '../model/region.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
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

const cardWithTwoKnightsBottom: ActionCard = {
    id: 'card-2',
    back: CardBack.B,
    type: ActionCardType.Standard,
    top: { kind: 'politics' },
    middle: { kind: 'border', count: 2 },
    bottom: { kind: 'knight', count: 2 }
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

    it('does not route to PlacingWalls once every one of the winner\'s castles is enclosed', () => {
        // The rulebook's cap is "three regions" because a prince has three castles and a
        // region holds exactly one - so the cap is really "nothing left to enclose", and
        // the castles have to be on the board for it to mean anything.
        const existingRegions: Region[] = [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'], castleSquareKey: '0,0' },
            { id: 'r2', ownerColor: Color.Pink, squareKeys: ['1,0'], castleSquareKey: '1,0' },
            { id: 'r3', ownerColor: Color.Pink, squareKeys: ['2,0'], castleSquareKey: '2,0' }
        ]
        const state = buildState([{ slot: 2, winnerPlayerId: 'p1' }], cardWithBorderMiddle, existingRegions)
        for (const [col, row] of [[0, 0], [1, 0], [2, 0]]) {
            state.board.squares[row][col] = { type: SquareType.Blank, castleColor: Color.Pink }
        }

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.ResolvingActions)
        expect(routing.bandKind).toBe('border')
        expect(routing.placementSkippedReason).toBe('regionCap')
        expect(state.wallsRemaining).toBeUndefined()
        expect(state.wallPlacingPlayerId).toBeUndefined()
    })

    it('still routes to PlacingWalls at 3 regions when the player has a 4th castle (2-player variant)', () => {
        // The 2-player variant gives each prince FOUR castles of their own. A hardcoded
        // 3-region cap locked them out of wall placement here - permanently, since their
        // 4th castle could then never be enclosed or scored.
        const existingRegions: Region[] = [
            { id: 'r1', ownerColor: Color.Pink, squareKeys: ['0,0'], castleSquareKey: '0,0' },
            { id: 'r2', ownerColor: Color.Pink, squareKeys: ['1,0'], castleSquareKey: '1,0' },
            { id: 'r3', ownerColor: Color.Pink, squareKeys: ['2,0'], castleSquareKey: '2,0' }
        ]
        const state = buildState([{ slot: 2, winnerPlayerId: 'p1' }], cardWithBorderMiddle, existingRegions)
        for (const [col, row] of [[0, 0], [1, 0], [2, 0], [8, 5]]) {
            state.board.squares[row][col] = { type: SquareType.Blank, castleColor: Color.Pink }
        }

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.PlacingWalls)
        expect(routing.placementSkippedReason).toBeUndefined()
        expect(state.wallsRemaining).toBe(2)
        expect(state.wallPlacingPlayerId).toBe('p1')
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

    it('skips the politics slot entirely when both piles are exhausted', () => {
        // TakingPoliticsCard has no Pass, so entering it with nothing to take would strand
        // its only active player with no legal action at all.
        const state = buildState([{ slot: 1, winnerPlayerId: 'p1' }], cardWithBorderMiddle) // top = politics
        state.politicsCardPileA = []
        state.politicsCardPileB = []

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.ResolvingActions)
        expect(routing.placementSkippedReason).toBe('noPoliticsCardsLeft')
        expect(state.politicsTakingPlayerId).toBeUndefined()
    })

    it('still routes to TakingPoliticsCard when only one pile has cards left', () => {
        const state = buildState([{ slot: 1, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        state.politicsCardPileA = []
        state.politicsCardPileB = [{ id: 'c1', type: PoliticsCardType.Alliance }]

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.TakingPoliticsCard)
        expect(state.politicsTakingPlayerId).toBe('p1')
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

    it('skips the knight action entirely when the winner can neither place nor expand', () => {
        const state = buildState([{ slot: 3, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        state.getPlayerState('p1').knightsInStock = 0
        state.regions = []

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.ResolvingActions)
        expect(routing.bandKind).toBe('knight')
        expect(routing.placementSkippedReason).toBe('noKnightsInStock')
        expect(state.knightsRemaining).toBeUndefined()
        expect(state.knightPlacingPlayerId).toBeUndefined()
    })

    it('still routes an empty-stock winner into PlacingKnights when they have a region to expand', () => {
        const state = buildState([{ slot: 3, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        state.getPlayerState('p1').knightsInStock = 0
        state.regions = [
            {
                id: 'r1',
                ownerColor: state.getPlayerState('p1').color,
                squareKeys: ['0,0'],
                castleSquareKey: '0,0'
            }
        ]

        // "If he has no more knights, he may place no more" only closes off the placing
        // half - "or extend one of his regions by two spaces" is still available.
        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.PlacingKnights)
        expect(state.knightPlacingPlayerId).toBe('p1')
        expect(state.knightsRemaining).toBe(1)
    })

    it('does not cap knightsRemaining at the knight stock - a spare sword can still expand', () => {
        // A 2-knight card whose winner only holds one knight: the 2nd sword is unusable
        // for placing, but must still be spendable on a region expansion.
        const state = buildState([{ slot: 3, winnerPlayerId: 'p1' }], cardWithTwoKnightsBottom)
        state.getPlayerState('p1').knightsInStock = 1

        const routing = routeAfterSlotResolved(state)
        expect(routing.nextState).toBe(MachineState.PlacingKnights)
        expect(routing.bandCount).toBe(2)
        expect(state.knightsRemaining).toBe(2)
    })

    it('does not route anywhere when there is no winner', () => {
        const state = buildState([{ slot: 2, winnerPlayerId: undefined }], cardWithBorderMiddle)
        expect(routeAfterSlotResolved(state).nextState).toBe(MachineState.ResolvingActions)
    })

    it('routes a politics-slot (slot 1) winner into TakingPoliticsCard', () => {
        const state = buildState([{ slot: 1, winnerPlayerId: 'p1' }], cardWithBorderMiddle)
        // There has to be something left to take - buildState's piles start empty, and an
        // exhausted pair now skips the slot instead (see the test below).
        state.politicsCardPileA = [{ id: 'c1', type: PoliticsCardType.Alliance }]
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
