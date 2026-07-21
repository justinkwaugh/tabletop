import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceCastle, PlaceCastle } from './placeCastle.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(playerIds: string[], overrides: Partial<LowenherzGameState> = {}) {
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: [Color.Pink, Color.Yellow, Color.Purple, Color.Gray][index],
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
        machineState: MachineState.PlacingCastles,
        turnManager: { series: [], turnOrder: playerIds, turnCounts: {} },
        winningPlayerIds: [],
        board: blankBoard(),
        regions: [],
        alliances: [],
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? Color.Gray : undefined,
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

function makePlaceCastle(
    overrides: Partial<PlaceCastle> & Pick<PlaceCastle, 'playerId' | 'castleCol' | 'castleRow' | 'knightCol' | 'knightRow'>
): HydratedPlaceCastle {
    return new HydratedPlaceCastle({
        id: 'a1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceCastle,
        ...overrides
    })
}

describe('HydratedPlaceCastle', () => {
    it('allows the current player in the placement order to place a legal castle+knight', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5,
            castleRow: 5,
            knightCol: 5,
            knightRow: 4
        })

        expect(action.isValidPlaceCastle(state)).toBe(true)
    })

    it('rejects a placement from a player who is not up next', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p2', // it's p1's turn first
            castleCol: 5,
            castleRow: 5,
            knightCol: 5,
            knightRow: 4
        })

        expect(action.isValidPlaceCastle(state)).toBe(false)
    })

    it('rejects a castle placed on a hill or village square', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        state.board.squares[5][5].type = SquareType.Hill
        state.board.squares[5][6].type = SquareType.Village

        const onHill = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })
        const onVillage = makePlaceCastle({
            playerId: 'p1',
            castleCol: 6, castleRow: 5, knightCol: 6, knightRow: 4
        })

        expect(onHill.isValidPlaceCastle(state)).toBe(false)
        expect(onVillage.isValidPlaceCastle(state)).toBe(false)
    })

    it('rejects a setup knight placed on a wooded square (only allowed in regular play)', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        state.board.squares[4][5].type = SquareType.Forest

        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })

        expect(action.isValidPlaceCastle(state)).toBe(false)
    })

    it('rejects a knight that is not orthogonally adjacent to the new castle', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const diagonal = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 6, knightRow: 4 // diagonal, not orthogonal
        })
        const tooFar = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 3 // 2 away
        })

        expect(diagonal.isValidPlaceCastle(state)).toBe(false)
        expect(tooFar.isValidPlaceCastle(state)).toBe(false)
    })

    it('enforces the 6-space gap rule against the same color only', () => {
        // Single-player turn order so it's always p1's turn regardless of how many
        // castles have already been placed - isolates the gap check from turn order.
        const state = buildState(['p1'])
        // p1 (Pink) already has a castle at (2,2)
        state.board.squares[2][2].castleColor = Color.Pink
        state.board.squares[2][1].knightColor = Color.Pink

        // Too close for p1's own next castle (distance 5 < 6)
        const tooClose = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 7, knightCol: 2, knightRow: 6 // distance = 5
        })
        expect(tooClose.isValidPlaceCastle(state)).toBe(false)

        // Exactly 6 away is legal
        const exactlySix = makePlaceCastle({
            playerId: 'p1',
            castleCol: 2, castleRow: 8, knightCol: 2, knightRow: 7 // distance = 6
        })
        expect(exactlySix.isValidPlaceCastle(state)).toBe(true)
    })

    it('applying the action places the castle+knight and decrements the stock for own-color placements', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 5, castleRow: 5, knightCol: 5, knightRow: 4
        })

        action.apply(state)

        expect(state.board.squares[5][5].castleColor).toBe(Color.Pink)
        expect(state.board.squares[4][5].knightColor).toBe(Color.Pink)
        expect(state.getPlayerState('p1').knightsInStock).toBe(11)
    })

    it('does not decrement any player stock for a neutral-color placement', () => {
        const state = buildState(['p1', 'p2', 'p3'], {
            // Fast-forward: p1, p2, p3 have already placed all 3 of their own castles,
            // so the next placement (index 9) is p1's neutral-color one.
            board: (() => {
                const b = blankBoard()
                // 3 laps x 3 players x (castle+knight) = 9 pairs; 6 columns per lap
                // easily fits in a 15-column row, one lap per row.
                for (let lap = 0; lap < 3; lap++) {
                    let col = 0
                    for (const color of [Color.Pink, Color.Yellow, Color.Purple]) {
                        b.squares[lap][col] = { type: SquareType.Blank, castleColor: color }
                        col += 1
                        b.squares[lap][col] = { type: SquareType.Blank, knightColor: color }
                        col += 1
                    }
                }
                return b
            })()
        })

        const action = makePlaceCastle({
            playerId: 'p1',
            castleCol: 8, castleRow: 8, knightCol: 8, knightRow: 7
        })

        expect(action.isValidPlaceCastle(state)).toBe(true)
        action.apply(state)

        expect(state.board.squares[8][8].castleColor).toBe(Color.Gray) // neutral color
        expect(state.getPlayerState('p1').knightsInStock).toBe(12) // unchanged
    })
})
