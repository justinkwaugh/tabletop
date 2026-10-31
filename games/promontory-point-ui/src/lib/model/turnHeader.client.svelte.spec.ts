import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { openSpaceIds } from '@tabletop/promontory-point'
import { dealtTable, disposeSessions, openSessionOn, settled } from '$lib/testing/sessionHarness.js'
import type { PromontoryPointGameSession } from './session.svelte.js'
import { turnHeader, type TurnHeaderSource } from './turnHeader.js'

afterEach(() => {
    disposeSessions()
})

function sourceOf(
    session: PromontoryPointGameSession,
    overrides: Partial<TurnHeaderSource> = {}
): TurnHeaderSource {
    return {
        isViewingHistory: session.isViewingHistory,
        gameState: session.gameState,
        decidingPlayerId: session.decidingPlayerId,
        getPlayerName: (playerId: string) => session.getPlayerName(playerId),
        ...overrides
    }
}

describe('turn header (game UI layout, "Turn header")', () => {
    it('reads "Your turn" for the deciding seat, with how far its turn has come', async () => {
        const session = await openSessionOn(dealtTable())
        const turnPlayer = session.gameState.activePlayerIds[0]
        assertExists(turnPlayer, 'A seat takes its turn')
        const name = session.getPlayerName(turnPlayer)
        expect(turnHeader(sourceOf(session))).toEqual({
            heading: 'Your turn',
            info: `${name} · placing 1 of 3`
        })

        const piece = session.pickablePieces[0] ?? session.handPieces[0]
        assertExists(piece, 'The turn holds a piece')
        session.pressPiece(piece)
        const spaceId = session.boardOffer.lit[0] ?? openSpaceIds(session.gameState.track, piece)[0]
        await session.placeTrack(spaceId)
        await settled(session)
        expect(turnHeader(sourceOf(session)).info).toBe(`${name} · placing 2 of 3`)
    })

    it('reads "[Name]\'s turn" for every other seat', async () => {
        const session = await openSessionOn(dealtTable())
        const turnPlayer = session.gameState.activePlayerIds[0]
        assertExists(turnPlayer, 'A seat takes its turn')
        const name = session.getPlayerName(turnPlayer)
        expect(turnHeader(sourceOf(session, { decidingPlayerId: undefined })).heading).toBe(
            `${name}'s turn`
        )
    })

    it('reads "History" in History View and "End of game" once the game has a result', async () => {
        const session = await openSessionOn(dealtTable())
        expect(turnHeader(sourceOf(session, { isViewingHistory: true })).heading).toBe('History')
        const ended = Object.create(session.gameState, {
            result: { value: { type: 'win', winners: [] } }
        }) as PromontoryPointGameSession['gameState']
        expect(turnHeader(sourceOf(session, { gameState: ended }))).toEqual({
            heading: 'End of game',
            info: 'final score'
        })
    })
})
