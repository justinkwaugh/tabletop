import { flushSync } from 'svelte'
import { HydratedFeudumGameState, Mandates, MachineState } from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { atPlayingCards } from '$lib/testing/turnTable.js'
import { holdWrit } from '$lib/testing/followUpTable.js'
import { seatPanelOf } from './seatPanel.js'

/** The panel's one derivation, reached through a seat's own session on what that seat was sent. */

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

async function atHandSelection(numPlayers = 3): Promise<FeudumHost> {
    host = new FeudumHost(numPlayers)
    await host.playStartingGoods()
    await host.playStartingPawns()
    expect(host.state.machineState).toBe(MachineState.SelectingHands)
    return host
}

describe('Seat panel on a session (S57, S58)', () => {
    it('R-5.1 a seat derives another seat from a state that never held the faces', async () => {
        const table = await atPlayingCards(['move', 'tax'], { otherCards: ['conquer', 'guild'] })
        host = table.host
        host.edit((state) => {
            holdWrit(state, table.other, Mandates[0].id)
        })
        const session = await host.openSeat(table.seat)
        const canonical = seatPanelOf({
            state: new HydratedFeudumGameState(structuredClone(host.state)),
            playerId: table.other,
            viewerId: table.seat,
            nameOf: (id) => session.getPlayerName(id)
        })

        expect(session.gameState.getPlayerState(table.other).hand).toBeUndefined()
        expect(session.seatPanel(table.other)).toEqual(canonical)
        expect(session.seatPanel(table.other).cards.handBacks).toBe(2)
    })

    it("R-3.1, R-5.1 the owner's panel counts their hand, which their desk shows", async () => {
        const table = await atPlayingCards(['move', 'tax'], { otherCards: ['conquer', 'guild'] })
        host = table.host
        const session = await host.openSeat(table.seat)

        expect(session.seatPanel(table.seat).cards).toMatchObject({
            handBacks: 0,
            handFaces: [],
            handCount: 2,
            handOnDesk: true
        })
    })

    it('Host View is the look that shows another seat, and still no note says "you"', async () => {
        const table = await atPlayingCards(['move', 'tax'], { otherCards: ['conquer', 'guild'] })
        host = table.host
        const session = await host.openSeat(table.seat)
        const canonical = new HydratedFeudumGameState(structuredClone(host.state))
        vi.spyOn(session, 'isViewingHost', 'get').mockReturnValue(true)
        vi.spyOn(session, 'gameState', 'get').mockReturnValue(canonical)

        const { cards, writs } = session.seatPanel(table.other)

        expect(cards.handBacks).toBe(0)
        expect(cards.handFaces.map(({ kind }) => kind)).toEqual(['conquer', 'guild'])
        expect(writs.deckNote).toBeUndefined()
    })

    it("R-3.3 a drafted pouch good is the drafting seat's alone until it is finalised", async () => {
        const table = await atHandSelection()
        const [first, second] = table.order
        const mine = await table.openSeat(first)
        const theirs = await table.openSeat(second)

        mine.choosePouch('saltpeter')
        flushSync()

        expect(mine.seatPanel(first).pouch).toEqual({ status: 'drafted', good: 'saltpeter' })
        expect(mine.seatPanel(second).pouch).toEqual({ status: 'choosing' })
        expect(theirs.seatPanel(first).pouch).toEqual({ status: 'choosing' })
    })
})
