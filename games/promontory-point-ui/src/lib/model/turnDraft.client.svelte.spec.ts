import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameSession } from '@tabletop/frontend-components'
import { openSpaceIds, type RailroadId } from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled
} from '$lib/testing/sessionHarness.js'
import { withNoRoomFor, withTurnPieces } from '$lib/testing/tables.js'
import { HexPick, hexOffer } from './boardOffer.js'
import { emptyTurnDraft, hasManualTurnDraft, popTurnDraft, pressPiece } from './turnDraft.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

async function sessionWithPieces(pieces: RailroadId[]) {
    return await openSessionOn(editedTable(dealtTable(), (state) => withTurnPieces(state, pieces)))
}

// docs/user-interactions.md: the five minimum tests for the turn draft (piece → hex).
describe('turn draft — minimum staged-selection tests', () => {
    it('O-2: picking another piece clears what the first pick offered on the board', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        session.pressPiece(CP)
        const cpHexes = session.boardOffer.lit
        expect(cpHexes).toEqual(openSpaceIds(session.gameState.track, CP))

        session.pressPiece(UP)
        expect(session.pickedPiece).toBe(UP)
        expect(session.boardOffer.lit).toEqual(openSpaceIds(session.gameState.track, UP))
        for (const spaceId of cpHexes) {
            expect(hexOffer(session.boardOffer, spaceId).pick).toBe(HexPick.Dimmed)
        }
    })

    it('R-X.2: Undo with a manual pick unpicks it and undoes no action', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        await session.buyShare(CP)
        await settled(session)
        const actionUndo = vi.spyOn(GameSession.prototype, 'undo')
        session.pressPiece(KP)
        expect(session.canUndo).toBe(true)

        await session.undo()
        expect(session.pickedPiece).toBeUndefined()
        expect(session.hasManualSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()
        expect(session.actions).toHaveLength(1)
    })

    it('R-X.2: Undo with only the auto-picked lone railroad undoes the last action', async () => {
        const session = await sessionWithPieces([KP, KP, KP])
        await session.buyShare(CP)
        await settled(session)
        expect(session.piecePick).toEqual({ railroadId: KP, source: 'auto' })
        expect(session.hasManualSelection).toBe(false)

        await session.undo()
        await settled(session)
        expect(session.actions).toHaveLength(0)
        expect(session.piecePick).toEqual({ railroadId: KP, source: 'auto' })
        expect(session.canUndo).toBe(false)
    })

    it('fails fast on a stage out of order: a hex before a piece, or a piece not in hand', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        const [spaceId] = openSpaceIds(session.gameState.track, CP)
        await expect(session.placeTrack(spaceId)).rejects.toThrow()
        expect(() => session.pressPiece(SP)).toThrow()
        expect(session.actions).toHaveLength(0)
    })

    it('O-2: pressing the picked piece again unpicks it; pressing another switches', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        session.pressPiece(CP)
        expect(session.piecePick).toEqual({ railroadId: CP, source: 'manual' })
        session.pressPiece(CP)
        expect(session.pickedPiece).toBeUndefined()
        expect(session.boardOffer.veiled).toBe(false)

        session.pressPiece(UP)
        session.pressPiece(KP)
        expect(session.pickedPiece).toBe(KP)
        await session.undo()
        expect(session.pickedPiece).toBeUndefined()
    })
})

describe('turn draft — module', () => {
    it('keeps one piece stage: a press toggles it, a pop clears it', () => {
        const picked = pressPiece(emptyTurnDraft(), CP)
        expect(hasManualTurnDraft(picked)).toBe(true)
        expect(pressPiece(picked, CP)).toEqual(emptyTurnDraft())
        expect(popTurnDraft(pressPiece(picked, UP))).toEqual(emptyTurnDraft())
        expect(popTurnDraft(emptyTurnDraft())).toEqual(emptyTurnDraft())
    })
})

describe('turn draft — auto-pick, lifetime and validity', () => {
    it('O-2: a lone railroad in hand is picked automatically and a press keeps it', async () => {
        const session = await sessionWithPieces([KP, KP, KP])
        expect(session.piecePick).toEqual({ railroadId: KP, source: 'auto' })
        expect(session.boardOffer.lit).toEqual(openSpaceIds(session.gameState.track, KP))
        session.pressPiece(KP)
        expect(session.piecePick).toEqual({ railroadId: KP, source: 'auto' })
        expect(session.canUndo).toBe(false)
    })

    it('O-2: after a placement leaves one railroad in hand, Undo goes to the placement, not the auto pick', async () => {
        const session = await sessionWithPieces([CP, KP, KP])
        session.pressPiece(CP)
        await session.placeTrack(session.boardOffer.lit[0])
        await settled(session)
        expect(session.piecePick).toEqual({ railroadId: KP, source: 'auto' })

        await session.undo()
        await settled(session)
        expect(session.gameState.turn?.pieces).toEqual([CP, KP, KP])
        expect(session.pickedPiece).toBeUndefined()
    })

    it('clears on every transition: a buy drops the pick', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        session.pressPiece(UP)
        await session.buyShare(CP)
        await settled(session)
        expect(session.pickedPiece).toBeUndefined()
    })

    it('clears on every transition: an Undo drops the pick', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        await session.buyShare(CP)
        await settled(session)
        session.pressPiece(UP)
        await session.undo()
        session.pressPiece(UP)
        session.pressPiece(KP)
        expect(session.pickedPiece).toBe(KP)
        await session.undo()
        expect(session.pickedPiece).toBeUndefined()
        await session.undo()
        await settled(session)
        expect(session.actions).toHaveLength(0)
        expect(session.pickedPiece).toBeUndefined()
    })

    it('R-3.3: a piece with no legal hex is pickable only to set it aside', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) =>
                withNoRoomFor(withTurnPieces(state, [SP, UP, KP]), SP, KP)
            )
        )
        session.pressPiece(SP)
        expect(session.pickedPieceHasNoRoom).toBe(true)
        expect(session.boardOffer.lit).toEqual([])
        expect(session.boardOffer.veiled).toBe(false)
    })

    it('R-2.2-H1: no piece is pickable once placing has ended', async () => {
        const session = await sessionWithPieces([CP, UP, KP])
        for (const railroadId of [CP, UP, KP]) {
            session.pressPiece(railroadId)
            await session.placeTrack(session.boardOffer.lit[0])
            await settled(session)
        }
        expect(session.pickablePieces).toEqual([])
        expect(session.piecePick).toBeUndefined()
    })
})
