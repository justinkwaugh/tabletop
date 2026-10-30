import { afterEach, describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import {
    HydratedPromontoryPointGameState,
    MachineState,
    openSpaceIds,
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
import { withHoldings, withTownsOpenTo, withTurnPieces } from '@tabletop/promontory-point/testing'
import { ChipKind, HexPick, OfferView, boardOffer, hexOffer } from './boardOffer.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'

afterEach(() => {
    disposeSessions()
})

// CP reaches a Dividend town and a Repairs town; the turn player holds 2 CP, the next seat 1 CP and
// no money, so a Repairs placement leaves the next seat short.
function townsTable(): { table: Table; dividend: SpaceId; repairs: SpaceId } {
    const dealt = dealtTable()
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [CP, UP, KP]), CP, [
        'tile.red.dividend',
        'tile.red.hammer'
    ])
    const held = withHoldings(state, [
        { money: 20, shares: { [CP]: 2 } },
        { money: 0, shares: { [CP]: 1 } },
        { money: 20 }
    ])
    return {
        table: editedTable(dealt, () => held),
        dividend: spaceIds[0],
        repairs: spaceIds[1]
    }
}

describe('board offer', () => {
    it('O-2: with nothing picked every hex is plain and nothing is veiled', async () => {
        const session = await openSessionOn(townsTable().table)
        expect(session.boardOffer.lit).toEqual([])
        expect(session.boardOffer.veiled).toBe(false)
        expect(
            [...session.boardOffer.hexes.values()].every((hex) => hex.pick === HexPick.Plain)
        ).toBe(true)
    })

    it('R-3.3: a picked piece lights its open spaces and dims the rest', async () => {
        const session = await openSessionOn(townsTable().table)
        session.pressPiece(CP)
        const lit = openSpaceIds(session.gameState.track, CP)
        expect(session.boardOffer.lit).toEqual(lit)
        expect(session.boardOffer.veiled).toBe(true)
        for (const [spaceId, hex] of session.boardOffer.hexes) {
            expect(hex.pick).toBe(lit.includes(spaceId) ? HexPick.Lit : HexPick.Dimmed)
        }
    })

    it("O-3, R-4.2, R-4.3-H1: lit Dividend and Repairs towns carry the deciding seat's own payout and bill", async () => {
        const { table, dividend, repairs } = townsTable()
        const session = await openSessionOn(table)
        session.pressPiece(CP)
        expect(hexOffer(session.boardOffer, dividend).chip).toEqual({
            kind: ChipKind.Dividend,
            dollars: 4
        })
        expect(hexOffer(session.boardOffer, repairs).chip).toEqual({
            kind: ChipKind.Repairs,
            dollars: 4
        })
        const chipped = [...session.boardOffer.hexes.values()].filter((hex) => hex.chip)
        expect(chipped).toHaveLength(2)
    })

    it('hover previews a hand piece’s hexes without dimming; a lit hex keeps its ring', async () => {
        const session = await openSessionOn(townsTable().table)
        session.hoverPiece(UP)
        const upHexes = openSpaceIds(session.gameState.track, UP)
        expect(session.boardOffer.veiled).toBe(false)
        for (const spaceId of upHexes) {
            expect(hexOffer(session.boardOffer, spaceId)).toMatchObject({
                pick: HexPick.Plain,
                previewed: true
            })
        }

        session.pressPiece(UP)
        for (const spaceId of upHexes) {
            expect(hexOffer(session.boardOffer, spaceId)).toMatchObject({
                pick: HexPick.Lit,
                previewed: false
            })
        }
        session.hoverPiece(undefined)
        expect([...session.boardOffer.hexes.values()].some((hex) => hex.previewed)).toBe(false)
    })

    it("R-2.2 step 3: this turn's placements carry their order badges until the turn ends", async () => {
        const session = await openSessionOn(townsTable().table)
        const placed: SpaceId[] = []
        for (const railroadId of [UP, KP, CP]) {
            session.pressPiece(railroadId)
            const spaceId = openSpaceIds(session.gameState.track, railroadId).find(
                (candidate) => !(candidate in session.gameState.towns)
            )
            assertExists(spaceId, `${railroadId} has open country next to its network`)
            await session.placeTrack(spaceId)
            await settled(session)
            placed.push(spaceId)
        }
        expect(
            placed.map((spaceId) => hexOffer(session.boardOffer, spaceId).placementOrder)
        ).toEqual([1, 2, 3])

        await session.endTurn()
        await settled(session)
        expect(
            [...session.boardOffer.hexes.values()].some((hex) => hex.placementOrder !== undefined)
        ).toBe(false)
    })

    it('R-4.3, R-4.3-H4: while a debtor decides, the Repairs town is outlined and nothing is lit', async () => {
        const { table, repairs } = townsTable()
        const session = await openSessionOn(table)
        session.pressPiece(CP)
        await session.placeTrack(repairs)
        await settled(session)
        expect(session.gameState.machineState).toBe(MachineState.PayingRepairs)
        expect(hexOffer(session.boardOffer, repairs)).toMatchObject({
            beingDecided: CP,
            placementOrder: 1
        })
        expect(session.pickablePieces).toEqual([])
        expect(session.boardOffer.lit).toEqual([])
    })

    it('History View keeps only the outline and the badges: no lit hex, no chip, no preview', async () => {
        const { table, repairs } = townsTable()
        const session = await openSessionOn(table)
        session.pressPiece(UP)
        await session.placeTrack(session.boardOffer.lit[0])
        await settled(session)
        session.pressPiece(CP)
        await session.placeTrack(repairs)
        await settled(session)
        await session.payRepairs([CP])
        await settled(session)

        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        session.hoverPiece(KP)
        expect(hexOffer(session.boardOffer, repairs)).toMatchObject({
            beingDecided: CP,
            placementOrder: 2
        })
        expect(session.boardOffer.lit).toEqual([])
        expect(session.boardOffer.veiled).toBe(false)
        expect(
            [...session.boardOffer.hexes.values()].some((hex) => hex.chip || hex.previewed)
        ).toBe(false)
    })

    it('is empty while the visible state is updating', () => {
        const { table, repairs } = townsTable()
        const offer = boardOffer({
            state: new HydratedPromontoryPointGameState(table.state),
            view: OfferView.Updating,
            placing: { railroadId: CP, decidingPlayerId: table.state.turnManager.turnOrder[0] },
            hovered: UP,
            placements: [{ spaceId: repairs, railroadId: CP, order: 1 }],
            repairsTown: { spaceId: repairs, railroadId: CP }
        })
        expect(offer.lit).toEqual([])
        expect(offer.veiled).toBe(false)
        expect(offer.hexes.size).toBe(0)
    })
})
