// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { HydratedFeudumGameState, Mandates } from '@tabletop/feudum'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { buildFeudum, emptySpace, giveBead, giveSeal, giveTile } from '$lib/testing/turnTable.js'
import { fillBarrel, holdWrit } from '$lib/testing/followUpTable.js'
import { seatPanelOf } from './seatPanel.js'
import { pawnsNoteOf, seatLinesOf, serviceShieldOf } from './seatLines.js'

/** Contract, Seat panel: which line under the ribbon each piece of a seat stands on. */

const Owner = 'p2'
const Other = 'p1'

function nameOf(playerId: string): string {
    return `Name of ${playerId}`
}

function table(edit: (state: HydratedFeudumGameState) => void = () => {}): HydratedFeudumGameState {
    const host = new FeudumHost(4)
    host.edit(edit)
    return new HydratedFeudumGameState(structuredClone(host.state))
}

function linesOf(
    state: HydratedFeudumGameState,
    viewerId: string | undefined,
    hostView = false,
    handOnDesk = false
) {
    return seatLinesOf(
        seatPanelOf({ state, playerId: Owner, viewerId, hostView, nameOf, handOnDesk })
    )
}

const items = (line: readonly { item: string }[]) => line.map(({ item }) => item)

function midGame(state: HydratedFeudumGameState): void {
    const player = state.getPlayerState(Owner)
    player.hand = ['tax', 'conquer']
    player.handCount = 2
    player.played = [
        { kind: 'move', use: 'regular' },
        { kind: 'harvest', use: 'special' }
    ]
    player.pouch = undefined
}

describe('Seat panel lines (contract: Seat panel)', () => {
    it('R-3.1, R-3.2 Line one: another seat sees the backs with their count, then the played cards', () => {
        const { cards } = linesOf(table(midGame), Other)
        expect(cards).toEqual([
            { item: 'backs', count: 2 },
            { item: 'played', card: expect.objectContaining({ kind: 'move', mark: 'regular' }) },
            { item: 'played', card: expect.objectContaining({ kind: 'harvest', mark: 'special' }) }
        ])
    })

    it('R-3.1 The seat itself reads "2 in hand", not its hand again, while its desk shows the hand', () => {
        const { cards } = linesOf(table(midGame), Owner, false, true)
        expect(items(cards)).toEqual(['in-hand', 'played', 'played'])
        expect(cards[0]).toEqual({ item: 'in-hand', count: 2 })
        expect(JSON.stringify(cards)).not.toContain('"tax"')
        expect(JSON.stringify(cards)).not.toContain('"conquer"')
    })

    it("R-3.1 Off its turn the desk shows no hand, so the seat's own panel shows its faces", () => {
        const { cards } = linesOf(table(midGame), Owner)
        expect(cards.slice(0, 2)).toEqual([
            { item: 'face', card: expect.objectContaining({ kind: 'tax' }) },
            { item: 'face', card: expect.objectContaining({ kind: 'conquer' }) }
        ])
        expect(items(cards)).toEqual(['face', 'face', 'played', 'played'])
    })

    it('S57 Host View of another seat shows the hand faces; the set-aside cards never stand on a line', () => {
        const { cards } = linesOf(table(midGame), Other, true)
        expect(cards.slice(0, 2)).toEqual([
            { item: 'face', card: expect.objectContaining({ kind: 'tax' }) },
            { item: 'face', card: expect.objectContaining({ kind: 'conquer' }) }
        ])
        expect(items(cards)).toEqual(['face', 'face', 'played', 'played'])
    })

    it('R-3.3 While hands are chosen, "choosing" stands on the cards line, for others and the seat alike', () => {
        const state = table((row) => {
            row.flow.selection = { finalised: [] }
        })
        expect(items(linesOf(state, Other).cards)).toEqual(['choosing'])
        expect(items(linesOf(state, Owner).cards)).toEqual(['choosing'])
        expect(items(linesOf(state, Other).holdings)).not.toContain('pouch')
    })

    it('R-3.1-H1 A seat final with a pouch good holds it on line three; the others see it sealed', () => {
        const state = table((row) => {
            row.flow.selection = { finalised: [Owner] }
            const player = row.getPlayerState(Owner)
            player.hand = ['tax', 'conquer', 'move', 'harvest']
            player.committedPouch = 'sulfur'
        })
        expect(linesOf(state, Owner).holdings).toContainEqual({
            item: 'pouch',
            pouch: { status: 'committed', good: 'sulfur' }
        })
        expect(linesOf(state, Other).holdings).toContainEqual({
            item: 'pouch',
            pouch: { status: 'sealed' }
        })
    })

    it('R-5.3, R-5-H1 Line two: the five goods always, then shillings; seals and beads only when held', () => {
        const bare = linesOf(table(), Other).supply
        expect(items(bare)).toEqual(['good', 'good', 'good', 'good', 'good', 'shillings'])

        const held = linesOf(
            table((state) => {
                giveSeal(state, Owner)
                giveSeal(state, Owner)
                giveBead(state, Owner)
            }),
            Other
        ).supply
        expect(items(held)).toEqual([
            'good',
            'good',
            'good',
            'good',
            'good',
            'shillings',
            'seals',
            'bead'
        ])
        expect(held[6]).toEqual({ item: 'seals', count: 2 })
    })

    it('R-1.1, R-4.10.2, R-4.4.4 Line three: markers, discs, barrel and writs always; tiles, vessels and pouch only when held', () => {
        const bare = linesOf(table(), Other).holdings
        expect(items(bare)).toEqual(['markers', 'discs', 'barrel', 'writs'])
        expect(bare[3]).toMatchObject({ item: 'writs', count: 0 })

        const state = table((row) => {
            giveTile(row, Owner)
            fillBarrel(row, Owner, 2)
            holdWrit(row, Owner, Mandates[0].id)
            row.supply.haversack.sulfur -= 1
            row.getPlayerState(Owner).pouch = 'sulfur'
        })
        state.getPlayerState(Owner).vessels.ship = 1
        const held = linesOf(state, Other).holdings
        expect(items(held)).toEqual([
            'markers',
            'discs',
            'barrel',
            'writs',
            'tile',
            'vessel',
            'pouch'
        ])
        expect(held[2]).toEqual({ item: 'barrel', sulfur: 2, capacity: 3 })
        expect(held[3]).toMatchObject({ item: 'writs', count: 1 })
        expect(held[5]).toEqual({ item: 'vessel', vessel: 'ship', count: 1 })
        expect(held[6]).toMatchObject({ pouch: { status: 'finalised', good: 'sulfur' } })
    })

    it("R-4.5 No guild crest stands on any line: the guild standings hold every seat's places", () => {
        const view = seatPanelOf({ state: table(), playerId: Owner, viewerId: Other, nameOf })
        expect(view).not.toHaveProperty('guilds')
        expect(JSON.stringify(seatLinesOf(view))).not.toMatch(/crest|stars|rank|reeve/)
    })
})

describe('The ribbon shield and the pawns note (contract: Seat panel)', () => {
    it('R-3.7.5, R-4.9.2 No shield before the seat serves or rules a feudum', () => {
        const view = seatPanelOf({ state: table(), playerId: Owner, viewerId: Other, nameOf })
        expect(serviceShieldOf(view)).toBeUndefined()
    })

    it('R-3.7.5, R-4.9.2, R-4.9-H2 The shield says service, vassal and voyage', () => {
        const state = table((row) => {
            row.militaryService[Owner] = 'track.military.1'
            row.voyageTrack[Owner] = 'track.voyage.4'
            buildFeudum(row, Owner, emptySpace(row, 'town'))
        })
        const view = seatPanelOf({ state, playerId: Owner, viewerId: Other, nameOf })
        expect(serviceShieldOf(view)).toBe('Service 1/3 · vassal · voyage 4')
    })

    it('R-1.1 Pawns in supply are a tooltip; none, no note', () => {
        const state = table()
        const view = seatPanelOf({ state, playerId: Owner, viewerId: Other, nameOf })
        const off = state.getPlayerState(Owner).pawns.filter(({ spaceId }) => !spaceId).length
        expect(view.pawnsInSupply).toBe(off)
        expect(pawnsNoteOf({ ...view, pawnsInSupply: 1 })).toBe('1 pawn in supply')
        expect(pawnsNoteOf({ ...view, pawnsInSupply: 2 })).toBe('2 pawns in supply')
        expect(pawnsNoteOf({ ...view, pawnsInSupply: 0 })).toBeUndefined()
    })
})
