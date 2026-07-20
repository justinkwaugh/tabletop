import { describe, expect, it } from 'vitest'
import { ActionSource, Color, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState, LowenherzGameState } from '../model/gameState.js'
import {
    BOARD_COLS,
    BOARD_ROWS,
    BoardSquare,
    SquareType,
    castleSquaresForColor,
    isOnBoard,
    manhattanDistance,
    neighbors
} from '../model/board.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceCastle } from '../actions/placeCastle.js'
import { PlacingCastlesStateHandler } from './placingCastles.js'
import { buildPlacementPlan, currentPlacementSlot } from '../util/placementPlan.js'

function blankBoard(): { squares: BoardSquare[][]; walls: [] } {
    return {
        squares: Array.from({ length: BOARD_ROWS }, () =>
            Array.from({ length: BOARD_COLS }, () => ({ type: SquareType.Blank }))
        ),
        walls: []
    }
}

function buildState(playerIds: string[]): HydratedLowenherzGameState {
    const colors = [Color.Pink, Color.Yellow, Color.Purple, Color.Gray]
    const players = playerIds.map((playerId, index) => ({
        playerId,
        color: colors[index],
        money: 12,
        powerPoints: 0,
        knightsInStock: 12
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
        turnOrder: playerIds,
        firstPlayerId: playerIds[0],
        neutralColor: playerIds.length < 4 ? colors[playerIds.length] : undefined,
        actionDeck: [],
        currentActionCard: undefined,
        decisions: [],
        resolvedSlots: []
    }

    return new HydratedLowenherzGameState(data)
}

// Brute-force scan for any legal castle+knight spot for the given color - mirrors what
// a real player/UI would need to find, so driving the full setup sequence with this
// exercises the same rules an actual game would.
function findLegalPlacement(state: HydratedLowenherzGameState, color: Color) {
    const existing = castleSquaresForColor(state.board, color)
    for (let row = 0; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
            const square = state.board.squares[row][col]
            if (square.type !== SquareType.Blank || square.castleColor || square.knightColor) continue
            if (existing.some((e) => manhattanDistance(e.col, e.row, col, row) < 6)) continue

            for (const n of neighbors(col, row)) {
                if (!isOnBoard(n.col, n.row)) continue
                const knightSquare = state.board.squares[n.row][n.col]
                if (
                    knightSquare.type === SquareType.Blank &&
                    !knightSquare.castleColor &&
                    !knightSquare.knightColor
                ) {
                    return { castleCol: col, castleRow: row, knightCol: n.col, knightRow: n.row }
                }
            }
        }
    }
    throw new Error(`no legal placement found for ${color}`)
}

// Drives the setup state machine to completion, letting the handler itself determine
// whose turn it is at each step (rather than hardcoding a per-player-count pattern),
// so this works unmodified for any player count.
function runFullSetup(state: HydratedLowenherzGameState, totalPlacements: number) {
    const handler = new PlacingCastlesStateHandler()
    const context = new MachineContext({ gameConfig: {}, gameState: state })

    const plan = buildPlacementPlan(
        state.turnOrder,
        (playerId) => state.getPlayerState(playerId).color,
        state.neutralColor
    )

    // Mirrors gameEngine.ts calling the initial state's enter() once at game creation -
    // this is what actually keeps activePlayerIds (and hotseat's myPlayer) in sync, so
    // it must be exercised here rather than just checked via validActionsForPlayer.
    handler.enter(context)
    expect(state.activePlayerIds).toEqual([plan[0].playerId])

    for (let i = 0; i < totalPlacements; i++) {
        const candidates = state.turnOrder.filter(
            (playerId) => handler.validActionsForPlayer(playerId, context).length > 0
        )
        expect(candidates.length).toBe(1)
        const currentPlayerId = candidates[0]
        expect(state.activePlayerIds).toEqual([currentPlayerId])

        const slot = currentPlacementSlot(plan, i)!
        expect(slot.playerId).toBe(currentPlayerId)
        const placement = findLegalPlacement(state, slot.color)

        const action = new HydratedPlaceCastle({
            id: `action-${i}`,
            gameId: 'game-1',
            source: ActionSource.User,
            type: ActionType.PlaceCastle,
            playerId: currentPlayerId,
            ...placement
        })

        expect(handler.isValidAction(action, context)).toBe(true)

        action.apply(state)
        const machineState = handler.onAction(action, context)

        const expectedDone = i === totalPlacements - 1
        expect(machineState).toBe(expectedDone ? MachineState.StartOfTurn : MachineState.PlacingCastles)

        // gameEngine.ts calls the next machine state's enter() after every action,
        // even when staying in the same state - re-check that here.
        if (!expectedDone) {
            handler.enter(context)
            expect(state.activePlayerIds).toEqual([plan[i + 1].playerId])
        }
    }
}

describe('PlacingCastlesStateHandler', () => {
    it('drives a full 4-player setup through to completion (no neutral color)', () => {
        const state = buildState(['p1', 'p2', 'p3', 'p4'])
        runFullSetup(state, 12)

        for (const playerId of state.turnOrder) {
            const color = state.getPlayerState(playerId).color
            expect(castleSquaresForColor(state.board, color).length).toBe(3)
            expect(state.getPlayerState(playerId).knightsInStock).toBe(9)
        }
    })

    it('drives a full 3-player setup through to completion, including the neutral round', () => {
        const state = buildState(['p1', 'p2', 'p3'])
        runFullSetup(state, 12)

        for (const playerId of state.turnOrder) {
            const color = state.getPlayerState(playerId).color
            expect(castleSquaresForColor(state.board, color).length).toBe(3)
            // Each player also placed 1 neutral castle, but it shouldn't cost them a knight.
            expect(state.getPlayerState(playerId).knightsInStock).toBe(9)
        }
        expect(castleSquaresForColor(state.board, state.neutralColor!).length).toBe(3)
    })
})
