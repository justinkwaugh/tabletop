import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { openSpaceIds, type RailroadId, type SpaceId } from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled,
    type Table
} from '$lib/testing/sessionHarness.js'
import {
    variantConfig,
    withBagLeft,
    withHoldings,
    withNoRoomFor,
    withTownsOpenTo,
    withTurnPieces
} from '@tabletop/promontory-point/testing'
import type { PromontoryPointGameSession } from './session.svelte.js'
import { turnPanel, type TurnPanel } from './turnPanel.js'

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

function panelOf(session: PromontoryPointGameSession): TurnPanel {
    const panel = turnPanel(session)
    assertExists(panel, 'The seat on screen is taking its turn')
    return panel
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

function entry(panel: TurnPanel, railroadId: RailroadId) {
    const found = panel.shares.entries.find((share) => share.railroadId === railroadId)
    assertExists(found, `The share block lists ${railroadId}`)
    return found
}

describe('turn panel — the turn opens (R-2.2, R-3.1, R-3.2)', () => {
    it('R-2.2: prompts trading then three placements, with the pieces to pick', async () => {
        const session = await openSessionOn(piecesTable([SP, UP, KP]))
        const panel = panelOf(session)
        expect(panel.prompt).toEqual({
            lead: 'Your turn.',
            text: 'Buy or sell up to 2 shares, then place your 3 pieces.',
            note: 'Shares open again after the third piece.'
        })
        expect(panel.piecesHeading).toBe('Your pieces · tap one')
        expect(panel.pieces.map((piece) => [piece.tag, piece.pickable, piece.noRoom])).toEqual([
            ['SP', true, false],
            ['UP', true, false],
            ['KP', true, false]
        ])
        expect(panel.placedCount).toBe(0)
        expect(panel.setAside).toBeUndefined()
        expect(panel.endTurn).toEqual([])
        expect(session.canUndo).toBe(false)
    })

    it('R-3.1, R-3.2: each railroad shows its price, deck, holding, Buy and Sell', async () => {
        const session = await openSessionOn(
            editedTable(piecesTable([SP, UP, KP]), (state) =>
                withHoldings(state, [{ money: 26, shares: { [CP]: 1 } }])
            )
        )
        const panel = panelOf(session)
        expect(panel.shares.heading).toBe('Shares · 2 actions left')
        expect(panel.shares.lockedNote).toBeUndefined()
        expect(panel.shares.entries.map((share) => share.name)).toEqual([
            'Central Pacific',
            'Union Pacific',
            'Kansas Pacific',
            'Southern Pacific'
        ])
        expect(entry(panel, CP)).toMatchObject({
            price: 5,
            deckCount: 8,
            held: 1,
            buyLabel: '$5',
            sellLabel: '$5',
            canBuy: true,
            canSell: true,
            buyReason: undefined
        })
        expect(entry(panel, UP)).toMatchObject({ held: 0, canBuy: true, canSell: false })
    })

    it('R-3.1: Buy is dimmed with "none left" or "you have $3"', async () => {
        const session = await openSessionOn(
            editedTable(piecesTable([SP, UP, KP]), (state) =>
                withHoldings(state, [{ money: 3 }, { money: 0, shares: { [UP]: 10 } }])
            )
        )
        const panel = panelOf(session)
        expect(entry(panel, UP)).toMatchObject({ canBuy: false, buyReason: 'none left' })
        expect(entry(panel, CP)).toMatchObject({ canBuy: false, buyReason: 'you have $3' })
    })

    it('R-2.2: after two trades every Buy and Sell is dimmed with "no share actions left"', async () => {
        const session = await openSessionOn(
            editedTable(piecesTable([SP, UP, KP]), (state) =>
                withHoldings(state, [{ money: 20, shares: { [CP]: 2 } }])
            )
        )
        await session.buyShare(UP)
        await settled(session)
        expect(panelOf(session).shares.heading).toBe('Shares · 1 action left')
        expect(panelOf(session).prompt.text).toBe(
            'Buy or sell up to 1 share, then place your 3 pieces.'
        )
        expect(session.canUndo).toBe(true)

        await session.sellShare(CP)
        await settled(session)
        const panel = panelOf(session)
        expect(panel.shares.heading).toBe('Shares · no share actions left')
        expect(panel.prompt.text).toBe('Place your 3 pieces.')
        expect(panel.shares.entries.every((share) => !share.canBuy && !share.canSell)).toBe(true)
    })
})

describe('turn panel — placing (R-3.3, R-2.2-H1)', () => {
    it('R-3.3: a picked piece prompts for a lit hex of its railroad', async () => {
        const session = await openSessionOn(piecesTable([SP, UP, KP]))
        session.pressPiece(KP)
        const panel = panelOf(session)
        expect(panel.prompt.lead).toBe('Place piece 1 of 3.')
        expect(panel.prompt.text).toBe('Tap a lit hex for Kansas Pacific.')
        expect(panel.piecesHeading).toBe('Your pieces')
        expect(panel.pieces.find((piece) => piece.picked)?.railroadId).toBe(KP)
        expect(panel.shares.lockedNote).toBeUndefined()
    })

    it('R-2.2-H1: between placements the share block is locked', async () => {
        const session = await openSessionOn(piecesTable([SP, UP, KP]))
        await place(session, UP)
        expect(panelOf(session).prompt).toEqual({
            lead: 'Place piece 2 of 3.',
            text: 'Tap a piece to place.'
        })
        session.pressPiece(KP)
        const panel = panelOf(session)
        expect(panel.prompt.lead).toBe('Place piece 2 of 3.')
        expect(panel.prompt.text).toBe('Tap a lit hex for Kansas Pacific.')
        expect(panel.placedCount).toBe(1)
        expect(panel.shares.lockedNote).toBe('Buying and selling open again after your third piece')
        expect(panel.shares.entries.every((share) => !share.canBuy && !share.canSell)).toBe(true)
        expect(panel.shares.entries.every((share) => share.buyReason === undefined)).toBe(true)
    })
})

describe('turn panel — no room (R-3.3, R-3.3-H1, R-2.2-H2, R-6.3-H2, R-X.2)', () => {
    it('R-3.3, R-X.2: a piece with no legal hex shows "no room" and offers only Set aside', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) =>
                withNoRoomFor(withTurnPieces(state, [SP, UP, KP]), SP, KP)
            )
        )
        expect(panelOf(session).pieces.find((piece) => piece.railroadId === SP)?.noRoom).toBe(true)
        expect(panelOf(session).setAside).toBeUndefined()

        session.pressPiece(SP)
        const panel = panelOf(session)
        expect(panel.setAside).toEqual({
            label: "Set aside · draw a replacement · can't be undone"
        })
        expect(panel.prompt.lead).toBe('No room for Southern Pacific.')
    })

    it('R-2.2-H2: once a piece is set aside the share block locks before any placement', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) =>
                withNoRoomFor(withTurnPieces(state, [SP, UP, KP]), SP, KP)
            )
        )
        session.pressPiece(SP)
        await session.scrapTrack()
        await settled(session)
        const panel = panelOf(session)
        expect(panel.placedCount).toBe(0)
        expect(panel.prompt.lead).toBe('Place piece 1 of 3.')
        expect(panel.shares.lockedNote).toBe('Buying and selling open again after your third piece')
        expect(session.canUndo).toBe(false)
    })

    it('R-3.3-H1: with the bag empty the button reads "Set aside · bag empty"', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) =>
                withBagLeft(withNoRoomFor(withTurnPieces(state, [SP, UP, KP]), SP, KP), 0)
            )
        )
        session.pressPiece(SP)
        expect(panelOf(session).setAside?.label).toBe('Set aside · bag empty')
    })

    it('R-3.3-H1, R-2.2-H1: a set-aside with the bag empty leaves two placements, and trading reopens after the second', async () => {
        const session = await openSessionOn(
            editedTable(dealtTable(), (state) =>
                withBagLeft(withNoRoomFor(withTurnPieces(state, [SP, UP, KP]), SP, KP), 0)
            )
        )
        session.pressPiece(SP)
        await session.scrapTrack()
        await settled(session)
        const panel = panelOf(session)
        expect(panel.prompt.lead).toBe('Place piece 1 of 2.')
        expect(panel.shares.lockedNote).toBe(
            'Buying and selling open again after your second piece'
        )
    })

    it('R-6.3-H2: in the variant a piece with no room may instead be kept', async () => {
        const session = await openSessionOn(
            editedTable(variantTable(), (state) =>
                withNoRoomFor(withTurnPieces(state, [SP, UP, KP, CP]), SP, KP)
            )
        )
        session.pressPiece(SP)
        expect(panelOf(session).setAside).toEqual({
            label: "Set aside · draw a replacement · can't be undone",
            keepNote: 'Or keep it: place your other pieces and carry it over face up.'
        })
    })
})

describe('turn panel — ending the turn (R-2.2 step 4, R-6.1-H2, R-6.3)', () => {
    it('R-2.2 step 4: after the third placement trading reopens and End turn draws 3', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP]))
        for (const railroadId of [CP, UP, KP]) await place(session, railroadId)
        const panel = panelOf(session)
        expect(panel.prompt).toEqual({
            lead: 'Pieces placed.',
            text: 'Buy or sell up to 2 shares, then end your turn.'
        })
        expect(panel.shares.lockedNote).toBeUndefined()
        expect(panel.shares.heading).toBe('Shares · 2 actions left')
        expect(panel.endTurn).toEqual([{ label: 'End turn · draw 3' }])
        expect(panel.placedCount).toBe(3)
    })

    it('R-6.1-H2: with two pieces left in the bag End turn draws 2', async () => {
        const session = await openSessionOn(
            editedTable(piecesTable([CP, UP, KP]), (state) => withBagLeft(state, 2))
        )
        for (const railroadId of [CP, UP, KP]) await place(session, railroadId)
        expect(panelOf(session).endTurn).toEqual([{ label: 'End turn · draw 2' }])
    })

    it('R-6.3: in the variant a leftover piece is kept for 3 or returned for 4', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP, SP], variantTable()))
        for (const railroadId of [CP, UP, KP]) await place(session, railroadId)
        expect(panelOf(session).endTurn).toEqual([
            { label: 'Keep SP · draw 3', keptPiece: SP, returnKeptPiece: false },
            { label: 'Return it · draw 4', returnKeptPiece: true }
        ])
    })

    it('R-6.3: in the variant with no piece left over End turn draws 4', async () => {
        const session = await openSessionOn(piecesTable([CP, UP, KP], variantTable()))
        for (const railroadId of [CP, UP, KP]) await place(session, railroadId)
        expect(panelOf(session).endTurn).toEqual([{ label: 'End turn · draw 4' }])
    })
})

describe('turn panel — only for the turn player (R-4.3-H4)', () => {
    it('a debtor deciding Repairs out of turn has no turn panel', async () => {
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
        session.pressPiece(CP)
        await session.placeTrack(spaceIds[0])
        await settled(session)
        expect(session.decidingPlayerId).toBeDefined()
        expect(turnPanel(session)).toBeUndefined()
    })
})
