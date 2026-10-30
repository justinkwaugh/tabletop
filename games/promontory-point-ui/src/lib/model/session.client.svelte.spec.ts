import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    ActionType,
    MachineState,
    TradeRefusal,
    openSpaceIds,
    sharePrice,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled,
    type Table
} from '$lib/testing/sessionHarness.js'
import {
    seatOf,
    variantConfig,
    withHoldings,
    withNoRoomFor,
    withTownsOpenTo,
    withTurnPieces
} from '$lib/testing/tables.js'
import type { PromontoryPointGameSession } from './session.svelte.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

afterEach(() => {
    disposeSessions()
})

function piecesTable(pieces: RailroadId[], table: Table = dealtTable()): Table {
    return editedTable(table, (state) => withTurnPieces(state, pieces))
}

function variantTable(): Table {
    return dealtTable({ config: variantConfig(true) })
}

function lastActionType(session: PromontoryPointGameSession): string | undefined {
    return session.actions.at(-1)?.type
}

function money(session: PromontoryPointGameSession): number {
    return session.gameState.getPlayerState(session.decidingPlayerId).money
}

function openCountry(session: PromontoryPointGameSession, railroadId: RailroadId): SpaceId {
    const spaceId = openSpaceIds(session.gameState.track, railroadId).find(
        (candidate) => !(candidate in session.gameState.towns)
    )
    assertExists(spaceId, `${railroadId} has open country next to its network`)
    return spaceId
}

async function place(session: PromontoryPointGameSession, railroadId: RailroadId) {
    session.pressPiece(railroadId)
    await session.placeTrack(openCountry(session, railroadId))
    await settled(session)
}

describe('session — trades (R-3.1, R-3.2, R-2.2)', () => {
    it('R-3.1: buyShare sends BuyShare at the price; Undo restores the money', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        const before = money(session)
        await session.buyShare(CP)
        await settled(session)
        expect(lastActionType(session)).toBe(ActionType.BuyShare)
        expect(money(session)).toBe(before - sharePrice(session.gameState, CP))

        await session.undo()
        await settled(session)
        expect(session.actions).toHaveLength(0)
        expect(money(session)).toBe(before)
    })

    it('R-3.1: a refused Buy sends nothing and names its reason', async () => {
        const dealt = dealtTable()
        const session = await openSessionOn(
            editedTable(dealt, (state) => withHoldings(state, [{ money: 0 }]))
        )
        expect(session.buyRefusal(CP)).toBe(TradeRefusal.TooLittleMoney)
        await session.buyShare(CP)
        await settled(session)
        expect(session.actions).toHaveLength(0)
    })

    it('R-3.2: sellShare sends SellShare for a held share', async () => {
        const dealt = dealtTable()
        const session = await openSessionOn(
            editedTable(dealt, (state) => withHoldings(state, [{ money: 10, shares: { [UP]: 1 } }]))
        )
        expect(session.sellRefusal(KP)).toBe(TradeRefusal.NoShareHeld)
        await session.sellShare(UP)
        await settled(session)
        expect(lastActionType(session)).toBe(ActionType.SellShare)
        expect(session.gameState.getPlayerState(session.decidingPlayerId).shares[UP]).toBe(0)
    })

    it('R-2.2-H1: after a placement Buy and Sell are refused until placing ends', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        await place(session, CP)
        expect(session.buyRefusal(CP)).toBe(TradeRefusal.PlacingUnderWay)
        await place(session, UP)
        await place(session, KP)
        expect(session.buyRefusal(CP)).toBeUndefined()
    })
})

describe('session — placing (R-3.3, R-3.3-H1, R-2.2-H2)', () => {
    it('R-3.3: a press on a lit hex sends PlaceTrack for the picked piece', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        session.pressPiece(KP)
        const spaceId = openCountry(session, KP)
        await session.placeTrack(spaceId)
        await settled(session)
        expect(lastActionType(session)).toBe(ActionType.PlaceTrack)
        expect(session.gameState.track[spaceId]).toBe(KP)
        expect(session.gameState.turn?.pieces).toEqual([CP, UP])
        expect(session.pickedPiece).toBeUndefined()
    })

    it('R-3.3: a press on an unlit hex places nothing', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        session.pressPiece(KP)
        await session.placeTrack(openCountry(session, CP))
        await settled(session)
        expect(session.actions).toHaveLength(0)
        expect(session.pickedPiece).toBe(KP)
    })

    it('R-3.3-H1, R-2.2-H2, R-X.2: setting aside draws a replacement, closes trading and leaves no Undo', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) =>
                withNoRoomFor(withTurnPieces(state, [SP, UP, KP]), SP, KP)
            )
        )
        session.pressPiece(SP)
        await expect(session.placeTrack(openCountry(session, UP))).resolves.toBeUndefined()
        expect(session.actions).toHaveLength(0)

        await session.scrapTrack()
        await settled(session)
        expect(lastActionType(session)).toBe(ActionType.ScrapTrack)
        expect(session.gameState.turn?.pieces).toHaveLength(3)
        expect(session.gameState.machineState).toBe(MachineState.Placing)
        expect(session.buyRefusal(CP)).toBe(TradeRefusal.PlacingUnderWay)
        expect(session.canUndo).toBe(false)
    })

    it('R-3.3: a piece with a legal hex is never set aside', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        session.pressPiece(CP)
        await expect(session.scrapTrack()).rejects.toThrow()
        expect(session.actions).toHaveLength(0)
    })
})

describe('session — ending the turn (R-2.2 step 4, R-6.3, R-X.2)', () => {
    it('R-2.2 step 4, R-X.2: End turn draws the next hand and Undo is then unavailable', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        const turnPlayer = session.decidingPlayerId
        for (const railroadId of [CP, UP, KP]) await place(session, railroadId)
        await session.endTurn()
        await settled(session)
        expect(session.actions.some((action) => action.type === ActionType.EndTurn)).toBe(true)
        expect(session.decidingPlayerId).not.toBe(turnPlayer)
        expect(session.canUndo).toBe(false)
    })

    it('R-6.3: in the variant, End turn keeps or returns the leftover piece', async () => {
        const table = piecesTable([CP, UP, KP, SP], variantTable())
        const session = await openSessionOn(table)
        for (const railroadId of [CP, UP, KP]) await place(session, railroadId)
        await expect(session.endTurn()).rejects.toThrow()
        await session.endTurn(false)
        await settled(session)
        const ended = session.actions.find((action) => action.type === ActionType.EndTurn)
        expect(ended).toMatchObject({ returnKeptPiece: false })
        expect(session.gameState.getPlayerState(seatOf(table.state, 0)).keptPiece).toBe(SP)
    })
})

describe('session — Repairs (R-4.3, R-X.1)', () => {
    it('R-4.3, R-X.1: the short seat sends PayRepairs and the placing turn continues', async () => {
        const dealt = dealtTable()
        const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [CP, UP, KP]), CP, [
            'tile.red.hammer'
        ])
        const session = await openSessionOn(
            editedTable(dealt, () =>
                withHoldings(state, [
                    { money: 20 },
                    { money: 0, shares: { [CP]: 1 } },
                    { money: 20 }
                ])
            )
        )
        const placer = session.decidingPlayerId
        session.pressPiece(CP)
        await session.placeTrack(spaceIds[0])
        await settled(session)
        expect(session.decidingPlayerId).toBe(seatOf(dealt.state, 1))
        await expect(session.payRepairs([])).rejects.toThrow()

        await session.payRepairs([CP])
        await settled(session)
        expect(lastActionType(session)).toBe(ActionType.PayRepairs)
        expect(session.gameState.machineState).toBe(MachineState.Placing)
        expect(session.decidingPlayerId).toBe(placer)
    })
})

describe('session — Undo order (R-X.2)', () => {
    it('Undo unpicks the piece, then undoes the placements latest first, then the buy', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP, SP], variantTable()))
        await session.buyShare(SP)
        await settled(session)
        await place(session, CP)
        await place(session, UP)
        session.pressPiece(KP)
        expect(session.hasManualSelection).toBe(true)

        const walk: string[] = []
        while (session.canUndo) {
            walk.push(session.hasManualSelection ? 'pick' : (lastActionType(session) ?? 'none'))
            await session.undo()
            await settled(session)
        }
        expect(walk).toEqual([
            'pick',
            ActionType.PlaceTrack,
            ActionType.PlaceTrack,
            ActionType.BuyShare
        ])
        expect(session.actions).toHaveLength(0)
    })
})
