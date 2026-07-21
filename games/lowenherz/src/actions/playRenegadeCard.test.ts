import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType, WallEdge } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import { Region } from '../model/region.js'
import { HydratedPlayRenegadeCard } from './playRenegadeCard.js'

function blankBoard(): { squares: BoardSquare[][]; walls: { col: number; row: number; edge: WallEdge }[] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function ownRegion(): Region {
    return { id: 'own', ownerColor: Color.Pink, squareKeys: ['0,0', '1,0', '2,0'], castleSquareKey: '0,0' }
}

function enemyRegion(): Region {
    return { id: 'enemy', ownerColor: Color.Yellow, squareKeys: ['0,1', '1,1'], castleSquareKey: '0,1' }
}

function buildState(overrides: Partial<LowenherzGameState> = {}): HydratedLowenherzGameState {
    const playerIds = ['p1', 'p2']
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow][index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 5,
        politicsCards: [{ id: 'card-renegade', type: PoliticsCardType.Renegade }]
    }))

    const board = blankBoard()
    board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
    board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
    board.squares[0][2] = { type: SquareType.Blank }
    board.squares[1][0] = { type: SquareType.Blank, castleColor: Color.Yellow }
    board.squares[1][1] = { type: SquareType.Blank, knightColor: Color.Yellow }

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
        board,
        regions: [ownRegion(), enemyRegion()],
        alliances: [],
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

function makePlayRenegadeCard(
    playerId: string,
    overrides: Partial<{
        cardId: string
        ownRegionId: string
        enemyRegionId: string
        removedCol: number
        removedRow: number
        placedCol: number
        placedRow: number
    }> = {}
): HydratedPlayRenegadeCard {
    return new HydratedPlayRenegadeCard({
        id: 'renegade-1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlayRenegadeCard,
        playerId,
        cardId: 'card-renegade',
        ownRegionId: 'own',
        enemyRegionId: 'enemy',
        removedCol: 1,
        removedRow: 1,
        placedCol: 2,
        placedRow: 0,
        ...overrides
    })
}

describe('HydratedPlayRenegadeCard', () => {
    it('removes an enemy knight and places one of the player\'s own in exchange', () => {
        const state = buildState()
        const action = makePlayRenegadeCard('p1')

        expect(action.isValidPlayRenegadeCard(state)).toBe(true)
        action.apply(state)

        expect(state.board.squares[1][1].knightColor).toBeUndefined()
        expect(state.getPlayerState('p2').knightsInStock).toBe(6)

        expect(state.board.squares[0][2].knightColor).toBe(Color.Pink)
        expect(state.getPlayerState('p1').knightsInStock).toBe(4)

        expect(state.getPlayerState('p1').politicsCards).toEqual([])
        expect(action.metadata).toEqual({
            victimColor: Color.Yellow,
            removedSquareKey: '1,1',
            placedSquareKey: '2,0'
        })
    })

    it('does not consume any ducats when neither square is wooded', () => {
        const state = buildState()
        const action = makePlayRenegadeCard('p1')
        action.apply(state)

        expect(state.getPlayerState('p1').money).toBe(12)
    })

    it('charges the wooded cost when removing a knight from a forest square', () => {
        const state = buildState()
        state.board.squares[1][1] = { type: SquareType.Forest, knightColor: Color.Yellow }
        const action = makePlayRenegadeCard('p1')

        expect(action.isValidPlayRenegadeCard(state)).toBe(true)
        action.apply(state)

        expect(state.getPlayerState('p1').money).toBe(12 - 5)
        expect(action.metadata?.removalWoodedCostPaid).toBe(5)
    })

    it('charges the wooded cost when placing into a forest square', () => {
        const state = buildState()
        state.board.squares[0][2] = { type: SquareType.Forest }
        const action = makePlayRenegadeCard('p1')

        expect(action.isValidPlayRenegadeCard(state)).toBe(true)
        action.apply(state)

        expect(state.getPlayerState('p1').money).toBe(12 - 5)
        expect(action.metadata?.placementWoodedCostPaid).toBe(5)
    })

    it('charges both wooded costs when applicable, additively', () => {
        const state = buildState()
        state.board.squares[1][1] = { type: SquareType.Forest, knightColor: Color.Yellow }
        state.board.squares[0][2] = { type: SquareType.Forest }
        const action = makePlayRenegadeCard('p1')
        action.apply(state)

        expect(state.getPlayerState('p1').money).toBe(12 - 10)
        expect(action.metadata).toEqual({
            victimColor: Color.Yellow,
            removedSquareKey: '1,1',
            placedSquareKey: '2,0',
            removalWoodedCostPaid: 5,
            placementWoodedCostPaid: 5
        })
    })

    it("rejects play when it isn't the player's turn to lay a decision card", () => {
        const state = buildState()
        expect(makePlayRenegadeCard('p2').isValidPlayRenegadeCard(state)).toBe(false)
    })

    it("rejects a card that isn't a Renegade card the player actually holds", () => {
        const state = buildState()
        state.getPlayerState('p1').politicsCards = []
        expect(makePlayRenegadeCard('p1').isValidPlayRenegadeCard(state)).toBe(false)
    })

    it('rejects play when the player has no knights left in stock', () => {
        const state = buildState()
        state.getPlayerState('p1').knightsInStock = 0
        expect(makePlayRenegadeCard('p1').isValidPlayRenegadeCard(state)).toBe(false)
    })

    it("rejects when the chosen 'own' region doesn't belong to the player", () => {
        const state = buildState()
        expect(
            makePlayRenegadeCard('p1', { ownRegionId: 'enemy', enemyRegionId: 'own' }).isValidPlayRenegadeCard(
                state
            )
        ).toBe(false)
    })

    it("rejects when the chosen 'enemy' region is neutral or the player's own", () => {
        const state = buildState({ regions: [ownRegion(), { ...enemyRegion(), ownerColor: undefined }] })
        expect(makePlayRenegadeCard('p1').isValidPlayRenegadeCard(state)).toBe(false)
    })

    it("rejects when the two regions don't border each other", () => {
        const farEnemy: Region = { id: 'enemy', ownerColor: Color.Yellow, squareKeys: ['9,9'], castleSquareKey: '9,9' }
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][1] = { type: SquareType.Blank, knightColor: Color.Pink }
        board.squares[0][2] = { type: SquareType.Blank }
        board.squares[9][9] = { type: SquareType.Blank, castleColor: Color.Yellow, knightColor: undefined }
        const state = buildState({ regions: [ownRegion(), farEnemy], board })

        expect(
            makePlayRenegadeCard('p1', { removedCol: 9, removedRow: 9 }).isValidPlayRenegadeCard(state)
        ).toBe(false)
    })

    it("rejects removing a knight that isn't actually in the target region", () => {
        const state = buildState()
        // (0,0) is Pink's own castle square - nowhere near the enemy region's squareKeys.
        expect(
            makePlayRenegadeCard('p1', { removedCol: 0, removedRow: 0 }).isValidPlayRenegadeCard(state)
        ).toBe(false)
    })

    it('rejects removing a knight that would strand another one of the same color from every castle', () => {
        const state = buildState({
            regions: [
                ownRegion(),
                { id: 'enemy', ownerColor: Color.Yellow, squareKeys: ['0,1', '1,1', '2,1'], castleSquareKey: '0,1' }
            ]
        })
        state.board.squares[1][2] = { type: SquareType.Blank, knightColor: Color.Yellow } // (2,1) - only reachable via (1,1)

        expect(
            makePlayRenegadeCard('p1', { removedCol: 1, removedRow: 1 }).isValidPlayRenegadeCard(state)
        ).toBe(false)
    })

    it('allows removing the last knight a color has, even though it "strands" nothing', () => {
        const state = buildState()
        // Only one Yellow knight exists on the whole board in the default fixture.
        expect(makePlayRenegadeCard('p1').isValidPlayRenegadeCard(state)).toBe(true)
    })

    it("rejects placement onto a square outside the player's own region", () => {
        const state = buildState()
        expect(
            makePlayRenegadeCard('p1', { placedCol: 5, placedRow: 5 }).isValidPlayRenegadeCard(state)
        ).toBe(false)
    })

    it('rejects placement onto an already-occupied square', () => {
        const state = buildState()
        expect(
            makePlayRenegadeCard('p1', { placedCol: 1, placedRow: 0 }).isValidPlayRenegadeCard(state)
        ).toBe(false)
    })

    it('rejects placement onto a hill or village square', () => {
        const state = buildState()
        state.board.squares[0][2] = { type: SquareType.Hill }
        expect(makePlayRenegadeCard('p1').isValidPlayRenegadeCard(state)).toBe(false)
    })

    it('rejects placement not adjacent to any of the own knights/castles', () => {
        const board = blankBoard()
        board.squares[0][0] = { type: SquareType.Blank, castleColor: Color.Pink }
        board.squares[0][2] = { type: SquareType.Blank } // not adjacent to (0,0) or any Pink piece
        board.squares[1][0] = { type: SquareType.Blank, castleColor: Color.Yellow }
        board.squares[1][1] = { type: SquareType.Blank, knightColor: Color.Yellow }
        const state = buildState({
            board,
            regions: [
                { id: 'own', ownerColor: Color.Pink, squareKeys: ['0,0', '2,0'], castleSquareKey: '0,0' },
                enemyRegion()
            ]
        })

        expect(makePlayRenegadeCard('p1').isValidPlayRenegadeCard(state)).toBe(false)
    })
})
