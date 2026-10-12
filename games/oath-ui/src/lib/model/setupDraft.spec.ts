import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionSource, createAction } from '@tabletop/common'
import { HydratedOathGameState, SetupChoice, TOP_CRADLE_SLOT } from '@tabletop/oath'
import {
    disposeSessions,
    openSessionOn,
    played,
    setupTable,
    shortBankTable
} from '$lib/testing/sessionHarness.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

/** R-1.16 — when the bank cannot pay every site's favor, the Chancellor chooses how to place it. */
describe('the Chancellor splits a short bank at setup', () => {
    function short() {
        const table = setupTable()
        table.state.favorSupply = 3
        table.state.pendingSiteFavor = [
            { siteCardId: 'site.fertile-valley', wanted: 2 },
            { siteCardId: 'site.plains', wanted: 2 }
        ]
        const session = openSessionOn(table)
        const sent = vi.spyOn(session, 'resolveSetup').mockResolvedValue()
        return { session, setup: session.setup, sent }
    }

    it('shows map order filled first, lets favor move between sites, and sends the split', async () => {
        const { setup, sent } = short()
        expect(setup.siteFavor).toEqual([
            { siteCardId: 'site.fertile-valley', favor: 2 },
            { siteCardId: 'site.plains', favor: 1 }
        ])
        setup.setSiteFavor('site.fertile-valley', 1)
        setup.setSiteFavor('site.plains', 2)
        expect(setup.siteFavorPlaced).toBe(3)
        expect(setup.siteId).toBeDefined()

        const [keep, ...rest] = setup.hand
        await setup.chooseAdviser(keep)
        for (const cardId of rest.slice(0, -1)) await setup.tapDiscard(cardId)
        expect(sent).toHaveBeenCalledWith(expect.any(String), keep, expect.any(Array), [
            { siteCardId: 'site.fertile-valley', favor: 1 },
            { siteCardId: 'site.plains', favor: 2 }
        ])
    })

    // R-1.23.1 — the Chancellor's site never depends on the split; R-1.16 holds only the send.
    it('a short split keeps the top Cradle site and holds the discards', async () => {
        const { setup, sent } = short()
        setup.setSiteFavor('site.plains', 0)
        expect(setup.siteFavorPlaced).toBe(2)
        expect(setup.splitWhole).toBe(false)
        expect(setup.sites).toEqual([TOP_CRADLE_SLOT])
        expect(setup.siteId).toBe(TOP_CRADLE_SLOT)

        const [keep, first] = setup.hand
        await setup.chooseAdviser(keep)
        expect(setup.adviserCardId).toBe(keep)
        expect(setup.ordering).toBe(false)
        await setup.tapDiscard(first)
        expect(setup.tapped).toEqual([])
        expect(sent).not.toHaveBeenCalled()
    })

    it('a card kept while short stays kept when the split is made whole, and the discards start', async () => {
        const { setup, sent } = short()
        setup.setSiteFavor('site.plains', 0)
        const [keep, first, last] = setup.hand
        await setup.chooseAdviser(keep)

        setup.setSiteFavor('site.plains', 1)
        expect(setup.splitWhole).toBe(true)
        expect(setup.adviserCardId).toBe(keep)
        expect(setup.ordering).toBe(true)
        await setup.tapDiscard(first)
        expect(sent).toHaveBeenCalledWith(TOP_CRADLE_SLOT, keep, [first, last], [
            { siteCardId: 'site.fertile-valley', favor: 2 },
            { siteCardId: 'site.plains', favor: 1 }
        ])
    })

    it('Undo pops a card kept while short before the split under it', async () => {
        const { session, setup } = short()
        setup.setSiteFavor('site.plains', 0)
        const [keep] = setup.hand
        await setup.chooseAdviser(keep)
        await session.undo()
        expect(setup.adviserCardId).toBeUndefined()
        expect(setup.siteFavorPlaced).toBe(2)
    })
})

/** R-1.16 on a real deal: six seats, a bank of 4 for the Salt Flats (2) and the Mine (3). */
describe('the Chancellor on a six-seat deal whose bank runs short', () => {
    function shortBank() {
        const session = openSessionOn(shortBankTable())
        const sent = vi.spyOn(session, 'resolveSetup').mockResolvedValue()
        return { session, setup: session.setup, sent }
    }

    it('deals a bank of 4 against 5 wanted, filled in map order', () => {
        const { session, setup } = shortBank()
        expect(session.gameState.favorSupply).toBe(4)
        expect(setup.pendingSiteFavor).toEqual([
            { siteCardId: 'site.salt-flats', wanted: 2 },
            { siteCardId: 'site.mine', wanted: 3 }
        ])
        expect(setup.siteFavor).toEqual([
            { siteCardId: 'site.salt-flats', favor: 2 },
            { siteCardId: 'site.mine', favor: 2 }
        ])
        expect(setup.siteId).toBe(TOP_CRADLE_SLOT)
    })

    it('one favor off the Salt Flats and a card kept: the split rows stay, nothing is sent, and 1/3 sends', async () => {
        const { setup, sent } = shortBank()
        setup.setSiteFavor('site.salt-flats', 1)
        expect(setup.siteId).toBe(TOP_CRADLE_SLOT)
        expect(setup.boardPick).toEqual({
            sites: [TOP_CRADLE_SLOT],
            label: 'start here',
            picked: TOP_CRADLE_SLOT,
            pickable: false
        })
        const [keep, first, last] = setup.hand
        await setup.chooseAdviser(keep)
        expect(setup.ordering).toBe(false)
        await setup.tapDiscard(first)
        expect(sent).not.toHaveBeenCalled()

        setup.setSiteFavor('site.mine', 3)
        expect(setup.ordering).toBe(true)
        await setup.tapDiscard(first)
        expect(sent).toHaveBeenCalledWith(TOP_CRADLE_SLOT, keep, [first, last], [
            { siteCardId: 'site.salt-flats', favor: 1 },
            { siteCardId: 'site.mine', favor: 3 }
        ])
    })

    it('an over-full split holds the discards the same way', async () => {
        const { setup, sent } = shortBank()
        setup.setSiteFavor('site.mine', 3)
        expect(setup.siteFavorPlaced).toBe(5)
        expect(setup.siteId).toBe(TOP_CRADLE_SLOT)
        const [keep, first] = setup.hand
        await setup.chooseAdviser(keep)
        expect(setup.ordering).toBe(false)
        await setup.tapDiscard(first)
        expect(sent).not.toHaveBeenCalled()
    })
})

/** An Exile on the clock at setup, after the Chancellor's choice. */
function exileOnTheClock() {
    const table = setupTable()
    const chancellor = table.state.chancellorPlayerId
    const start = openSessionOn(table).setup
    const hand = new HydratedOathGameState(table.state).getPlayerState(chancellor).knownHand()
    const after = played(table, [
        createAction(SetupChoice, {
            gameId: table.state.gameId,
            source: ActionSource.User,
            playerId: chancellor,
            siteId: start.siteId,
            adviserCardId: hand[0],
            discardOrder: hand.slice(1)
        })
    ])
    disposeSessions()
    const session = openSessionOn(after)
    const sent = vi.spyOn(session, 'resolveSetup').mockResolvedValue()
    return { session, setup: session.setup, sent }
}

/** R-1.20 deals the hand before R-1.23 places the pawn, so an Exile may keep a card first. */
describe('an Exile sees the hand while choosing where to start', () => {
    it('offers the hand before any site is tapped', () => {
        const { setup } = exileOnTheClock()
        expect(setup.sites.length).toBeGreaterThan(1)
        expect(setup.siteId).toBeUndefined()
        expect(setup.hand).toHaveLength(3)
        expect(setup.boardPick?.sites).toEqual(setup.sites)
    })

    it('keeps a card chosen first when the site is tapped, then orders the discards and sends', async () => {
        const { setup, sent } = exileOnTheClock()
        const [keep, first, last] = setup.hand
        await setup.chooseAdviser(keep)
        expect(setup.adviserCardId).toBe(keep)
        expect(setup.ordering).toBe(false)
        await setup.tapDiscard(first)
        expect(setup.tapped).toEqual([])

        const [site] = setup.sites
        setup.chooseSite(site)
        expect(setup.siteId).toBe(site)
        expect(setup.adviserCardId).toBe(keep)
        expect(setup.ordering).toBe(true)
        await setup.tapDiscard(first)
        expect(sent).toHaveBeenCalledWith(site, keep, [first, last], undefined)
    })

    it('Undo takes back the last tap: the site tapped after the card comes off first, then the card', async () => {
        const { session, setup } = exileOnTheClock()
        const [keep] = setup.hand
        await setup.chooseAdviser(keep)
        setup.chooseSite(setup.sites[0])
        await session.undo()
        expect(setup.siteId).toBeUndefined()
        expect(setup.adviserCardId).toBe(keep)
        await session.undo()
        expect(setup.adviserCardId).toBeUndefined()
        expect(session.selection.hasManualSelection()).toBe(false)
    })

    it('Undo takes back the last tap: the card tapped after the site comes off first, then the site', async () => {
        const { session, setup } = exileOnTheClock()
        const [keep] = setup.hand
        const [site] = setup.sites
        setup.chooseSite(site)
        await setup.chooseAdviser(keep)
        await session.undo()
        expect(setup.adviserCardId).toBeUndefined()
        expect(setup.siteId).toBe(site)
        await session.undo()
        expect(setup.siteId).toBeUndefined()
        expect(session.selection.hasManualSelection()).toBe(false)
    })
})

/** R-1.23.1 — the start sites are picked on the map: lit, the pick ringed and marked "start here". */
describe('the start sites on the map', () => {
    const startOffers = (session: ReturnType<typeof openSessionOn>) =>
        session.siteOffers.map((offer) =>
            offer.intent === 'start'
                ? { slotId: offer.slotId, picked: offer.picked, pickable: offer.pickable }
                : offer
        )

    it('before a tap every start site is lit and pickable, none marked, and the rest of the map dims', () => {
        const { session, setup } = exileOnTheClock()
        const sites = setup.sites
        expect(sites).toHaveLength(3)
        expect(setup.boardPick).toEqual({ sites, label: 'start here', picked: undefined, pickable: true })
        expect(startOffers(session)).toEqual(
            sites.map((slotId) => ({ slotId, picked: false, pickable: true }))
        )
        expect(session.mapDimmed).toBe(true)
        expect(session.mapPick).toEqual({ kind: 'start', sites, choosing: true })
    })

    it('a picked site stays lit with the others, marked and no longer pickable; a tap on another moves the pick', () => {
        const { session, setup } = exileOnTheClock()
        const [first, second, third] = setup.sites
        setup.chooseSite(first)
        expect(setup.boardPick).toEqual({
            sites: [first, second, third],
            label: 'start here',
            picked: first,
            pickable: true
        })
        expect(startOffers(session)).toEqual([
            { slotId: first, picked: true, pickable: false },
            { slotId: second, picked: false, pickable: true },
            { slotId: third, picked: false, pickable: true }
        ])
        expect(session.mapDimmed).toBe(true)

        setup.chooseSite(second)
        expect(startOffers(session)).toEqual([
            { slotId: first, picked: false, pickable: true },
            { slotId: second, picked: true, pickable: false },
            { slotId: third, picked: false, pickable: true }
        ])
    })

    it('once the discards are asked, the pick alone is offered, ringed and not pickable, and nothing dims', async () => {
        const { session, setup } = exileOnTheClock()
        const sites = setup.sites
        const [, site] = sites
        setup.chooseSite(site)
        await setup.chooseAdviser(setup.hand[0])
        expect(setup.ordering).toBe(true)
        expect(setup.boardPick).toEqual({
            sites: [site],
            label: 'start here',
            picked: site,
            pickable: false
        })
        expect(startOffers(session)).toEqual([{ slotId: site, picked: true, pickable: false }])
        expect(session.mapDimmed).toBe(false)
        // The frame and its region chips stay on every start site until the send.
        expect(session.mapPick).toEqual({ kind: 'start', sites, choosing: true })
    })

    it('the Chancellor’s one legal site is shown picked and not pickable, with nothing dimmed', () => {
        const session = openSessionOn(setupTable())
        expect(session.setup.boardPick).toEqual({
            sites: [TOP_CRADLE_SLOT],
            label: 'start here',
            picked: TOP_CRADLE_SLOT,
            pickable: false
        })
        expect(startOffers(session)).toEqual([
            { slotId: TOP_CRADLE_SLOT, picked: true, pickable: false }
        ])
        expect(session.mapDimmed).toBe(false)
        expect(session.mapPick).toEqual({ kind: 'start', sites: [TOP_CRADLE_SLOT], choosing: false })
    })
})
