import { afterEach, describe, expect, it } from 'vitest'
import {
    GameCallKind,
    GameResult,
    assertExists,
    isCallGameAction,
    type GameCall
} from '@tabletop/common'
import { MachineState, openSpaceIds } from '@tabletop/promontory-point'
import { seatOf } from '@tabletop/promontory-point/testing'
import {
    calledTable,
    dealtTable,
    disposeSessions,
    openSessionOn,
    settled,
    tableOf,
    type Table
} from '$lib/testing/sessionHarness.js'
import { aggregateTurns } from '$lib/utils/actionAggregator.js'
import { EndKind, endSummary } from '$lib/utils/endSummary.js'
import { scoreView } from './score.js'
import { seatView } from './seatView.js'
import type { PromontoryPointGameSession } from './session.svelte.js'
import { turnHeader } from './turnHeader.js'
import { waitingView } from './waitingView.js'
import { yourHand } from './yourHand.js'

afterEach(() => {
    disposeSessions()
})

// The turn player places one piece, so the call lands in the middle of a turn.
async function midTurn(table: Table): Promise<Table> {
    const session = await openSessionOn(table)
    const piece = session.pickablePieces[0] ?? session.handPieces[0]
    assertExists(piece, 'The turn holds a piece')
    session.pressPiece(piece)
    const spaceId = session.boardOffer.lit[0] ?? openSpaceIds(session.gameState.track, piece)[0]
    await session.placeTrack(spaceId)
    await settled(session)
    return tableOf(session)
}

function callOf(session: PromontoryPointGameSession): GameCall {
    const call = session.gameCall
    assertExists(call, 'The state on screen is the result of a call')
    return call
}

describe('a called game (docs/player-votes.md, "Called games and UI Artifacts")', () => {
    it('with a declared winner: the call is the result, with no final score', async () => {
        const table = await midTurn(dealtTable())
        const [asker, winner] = [seatOf(table.state, 0), seatOf(table.state, 1)]
        const session = await openSessionOn(
            calledTable(table, { initiatorPlayerId: asker, declaredWinnerId: winner })
        )
        const state = session.gameState
        const call = callOf(session)

        expect(call.kind).toBe(GameCallKind.Called)
        // The logic keeps its own machine state; the call alone ends the game.
        expect(state.machineState).not.toBe(MachineState.EndOfGame)
        expect(state.result).toBe(GameResult.Win)
        expect(endSummary(state, call)).toEqual({ kind: EndKind.Called, call, winnerIds: [winner] })
        expect(scoreView(state, call)).toBeUndefined()
        expect(turnHeader(session)).toEqual({
            heading: 'End of game',
            info: `The game was called; ${winner} wins`
        })
    })

    it('with no winner: abandoned, with no final score', async () => {
        const table = await midTurn(dealtTable())
        const session = await openSessionOn(
            calledTable(table, { initiatorPlayerId: seatOf(table.state, 0) })
        )
        const call = callOf(session)

        expect(session.gameState.result).toBe(GameResult.Abandoned)
        expect(endSummary(session.gameState, call)).toEqual({
            kind: EndKind.Called,
            call,
            winnerIds: []
        })
        expect(scoreView(session.gameState, call)).toBeUndefined()
        expect(turnHeader(session).info).toBe('The game was called with no winner')
    })

    it('by the stalled-game sweep: abandoned, with no final score', async () => {
        const session = await openSessionOn(calledTable(await midTurn(dealtTable())))
        const call = callOf(session)

        expect(call.kind).toBe(GameCallKind.Stalled)
        expect(endSummary(session.gameState, call)).toEqual({
            kind: EndKind.Called,
            call,
            winnerIds: []
        })
        expect(turnHeader(session).info).toBe('The game ended with no move in 30 days')
    })

    it('conceded in a two-seat game: the other seat wins', async () => {
        const table = await midTurn(dealtTable({ playerCount: 2 }))
        const [conceding, other] = [seatOf(table.state, 0), seatOf(table.state, 1)]
        const session = await openSessionOn(
            calledTable(table, { initiatorPlayerId: conceding, declaredWinnerId: other })
        )
        const call = callOf(session)

        expect(call.kind).toBe(GameCallKind.Conceded)
        expect(session.gameState.winningPlayerIds).toEqual([other])
        expect(endSummary(session.gameState, call)).toEqual({
            kind: EndKind.Called,
            call,
            winnerIds: [other]
        })
        expect(turnHeader(session).info).toBe(`${conceding} conceded; ${other} wins`)
    })

    it('offers no continuation: no decision, no waiting line, no hand, no seat tagged as deciding', async () => {
        const table = await midTurn(dealtTable())
        const turnPlayer = seatOf(table.state, 0)
        const session = await openSessionOn(
            calledTable(table, { initiatorPlayerId: turnPlayer, declaredWinnerId: turnPlayer })
        )
        const state = session.gameState

        // The call stopped a turn under way; nothing of it is offered again.
        expect(state.turn).toBeDefined()
        expect(state.activePlayerIds).toEqual([])
        expect(session.decidingPlayerId).toBeUndefined()
        expect(session.validActionTypes).toEqual([])
        for (const viewerId of [turnPlayer, seatOf(state, 1), undefined]) {
            expect(waitingView(state, session.actions, viewerId)).toBeUndefined()
            expect(yourHand(undefined, state, viewerId)).toBeUndefined()
            expect(seatView(state, turnPlayer, viewerId).tag).toBeUndefined()
        }
    })

    it('history: the call is its own entry and closes the turn it stopped', async () => {
        const table = await midTurn(dealtTable())
        const session = await openSessionOn(
            calledTable(table, { initiatorPlayerId: seatOf(table.state, 0) })
        )
        const turns = aggregateTurns(session.actions, session.gameState, undefined)

        expect(turns).toHaveLength(1)
        expect(turns[0].ended).toBe(true)
        expect(turns[0].actions.some(isCallGameAction)).toBe(false)
        expect(turns[0].actions).toHaveLength(session.actions.length - 1)
    })
})
