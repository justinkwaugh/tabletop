import { describe, expect, it } from 'vitest'
import { ActionSource, Color } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import { BOARD_COLS, BOARD_ROWS, BoardSquare, SquareType } from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceCastle } from './placeCastle.js'
import { HydratedPlaceSetupKnight, PlaceSetupKnight } from './placeSetupKnight.js'
import { NEUTRAL_OWNER } from '../model/owner.js'

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
        machineState: MachineState.PlacingSetupKnight,
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

// Places p1's castle at 5,5 the way PlacingCastles would, leaving its knight pending.
function stateWithPendingCastle(playerIds = ['p1', 'p2', 'p3', 'p4']) {
    const state = buildState(playerIds, { machineState: MachineState.PlacingCastles })
    new HydratedPlaceCastle({
        id: 'castle',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceCastle,
        playerId: 'p1',
        castleCol: 5,
        castleRow: 5
    }).apply(state)
    return state
}

function makePlaceSetupKnight(
    overrides: Partial<PlaceSetupKnight> &
        Pick<PlaceSetupKnight, 'playerId' | 'knightCol' | 'knightRow'>
): HydratedPlaceSetupKnight {
    return new HydratedPlaceSetupKnight({
        id: 'a1',
        gameId: 'game-1',
        source: ActionSource.User,
        type: ActionType.PlaceSetupKnight,
        ...overrides
    })
}

describe('HydratedPlaceSetupKnight', () => {
    it('places the knight beside the castle and debits the stock', () => {
        const state = stateWithPendingCastle()
        const action = makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 4 })

        expect(action.isValidPlaceSetupKnight(state)).toBe(true)
        action.apply(state)

        expect(state.board.squares[4][5].knightOwner).toBe('p1')
        expect(state.getPlayerState('p1').knightsInStock).toBe(11)
        expect(state.pendingSetupCastle).toBeUndefined()
    })

    it('rejects a knight that is not orthogonally adjacent to the pending castle', () => {
        const state = stateWithPendingCastle()

        // diagonal, and two away
        expect(
            makePlaceSetupKnight({ playerId: 'p1', knightCol: 6, knightRow: 4 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
        expect(
            makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 3 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
    })

    it('rejects a knight on a wooded square (only allowed in regular play)', () => {
        const state = stateWithPendingCastle()
        state.board.squares[4][5].type = SquareType.Forest

        expect(
            makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 4 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
    })

    it('rejects a knight on the castle square itself, or any occupied square', () => {
        const state = stateWithPendingCastle()
        state.board.squares[4][5] = { type: SquareType.Blank, knightOwner: 'p2' }

        expect(
            makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 5 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
        expect(
            makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 4 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
    })

    it('rejects a knight from anyone but the player who placed the castle', () => {
        const state = stateWithPendingCastle()

        expect(
            makePlaceSetupKnight({ playerId: 'p2', knightCol: 5, knightRow: 4 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
        expect(HydratedPlaceSetupKnight.canPlaceSetupKnight(state, 'p2')).toBe(false)
        expect(HydratedPlaceSetupKnight.canPlaceSetupKnight(state, 'p1')).toBe(true)
    })

    it('rejects a knight when no castle is awaiting one', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        expect(state.pendingSetupCastle).toBeUndefined()

        expect(
            makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 4 })
                .isValidPlaceSetupKnight(state)
        ).toBe(false)
    })

    it('gives the knight the castle owner, and spends no player stock on a neutral placement', () => {
        const state = stateWithPendingCastle()
        // Re-own the pending castle to the neutral prince, as a neutral lap would.
        state.board.squares[5][5] = { type: SquareType.Blank, castleOwner: NEUTRAL_OWNER }

        makePlaceSetupKnight({ playerId: 'p1', knightCol: 5, knightRow: 4 }).apply(state)

        expect(state.board.squares[4][5].knightOwner).toBe(NEUTRAL_OWNER)
        expect(state.getPlayerState('p1').knightsInStock).toBe(12)
    })

    it('offers exactly the legal squares around the pending castle', () => {
        const state = stateWithPendingCastle()
        state.board.squares[4][5].type = SquareType.Hill

        const squares = HydratedPlaceSetupKnight.legalKnightSquares(state, 'p1')

        expect(squares).toHaveLength(3)
        expect(squares).not.toContainEqual({ col: 5, row: 4 })
        expect(HydratedPlaceSetupKnight.legalKnightSquares(state, 'p2')).toEqual([])
    })
})
