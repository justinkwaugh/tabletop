import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    Banner,
    CURRENT_OATH_REVISION,
    MachineState,
    PlayerStatus,
    SearchPlay
} from '@tabletop/oath'
import { openTurn, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { PLAY_TO_ROWS_AT_MOST, playToOnMap } from './playToSites.js'
import type { OathGameSession } from './session.svelte.js'

// R-5.1.4.I the People's Favor, New Growth — "To which site": rows for a few sites on a
// desktop; with more, or on a phone at any number, the sites are lit on the map, the seat's own
// site ringed until another is tapped, each reading "play here".

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const WOLVES = 'denizen.beast.wolves'
const TUTOR = 'denizen.arcane.tutor'
const NEW_GROWTH = 'denizen.beast.new-growth'
const CROP_ROTATION = 'denizen.hearth.crop-rotation'
const INN = 'denizen.hearth.wayside-inn'
const TENTS = 'denizen.nomad.tents'

/** Each site the map lights for the play, and the one ringed. */
const lit = (session: OathGameSession) =>
    session.siteOffers.flatMap((offer) => (offer.intent === 'playTo' ? [offer.slotId] : []))
const ringed = (session: OathGameSession) =>
    session.siteOffers.flatMap((offer) =>
        offer.intent === 'playTo' && offer.picked ? [offer.slotId] : []
    )

describe('where "To which site" is picked', () => {
    it('rows for up to four sites on a desktop; the lit map for five or more', () => {
        expect(PLAY_TO_ROWS_AT_MOST).toBe(4)
        expect(playToOnMap(2, false)).toBe(false)
        expect(playToOnMap(4, false)).toBe(false)
        expect(playToOnMap(5, false)).toBe(true)
        expect(playToOnMap(8, false)).toBe(true)
    })

    it('on a phone, the lit map at any number', () => {
        expect(playToOnMap(2, true)).toBe(true)
        expect(playToOnMap(8, true)).toBe(true)
    })
})

describe("R-5.1.4.I — Search with the People's Favor: the kept card's sites on the map", () => {
    /** Dana, an Exile at c1 holding the People's Favor, searching with Wolves and Tutor drawn. */
    async function searching() {
        const state = testState(
            [
                testPlayer({
                    playerId: 'dana',
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    siteId: 'c1',
                    handIds: [WOLVES, TUTOR]
                }),
                testPlayer({
                    playerId: 'rhys',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'p1'
                })
            ],
            {
                machineState: MachineState.Searching,
                oathRevision: CURRENT_OATH_REVISION,
                chancellorPlayerId: 'rhys',
                banners: testBanners({ [Banner.PeoplesFavor]: 'dana' }),
                denizensBySite: { c1: [], c2: [], p1: [], h1: [] }
            }
        )
        openTurn(state, 'dana')
        const session = await openSessionOn(tableOf(state))
        vi.spyOn(session, 'resolveSearch').mockResolvedValue()
        return session
    }

    it('nothing is lit until a card is kept; then the seat’s site and the other, the seat’s ringed', async () => {
        const session = await searching()
        expect(lit(session)).toEqual([])
        session.search.keep(WOLVES)
        expect(session.search.otherSites).toEqual(['c2'])
        expect(lit(session)).toEqual(['c1', 'c2'])
        expect(ringed(session)).toEqual(['c1'])
        expect(session.mapPick).toEqual({
            kind: 'playTo',
            sites: ['c1', 'c2'],
            choosing: true,
            moverId: 'dana'
        })
    })

    it('a tap on the other site picks it; a tap on the seat’s own takes it back', async () => {
        const session = await searching()
        session.search.keep(WOLVES)
        session.pickPlayToSite('c2')
        expect(session.search.toSite).toBe('c2')
        expect(ringed(session)).toEqual(['c2'])
        session.pickPlayToSite('c1')
        expect(session.search.toSite).toBeUndefined()
        expect(ringed(session)).toEqual(['c1'])
    })
})

describe('R-6.1, R-7.4 — the facedown play with New Growth: every site with space on the map', () => {
    /** Dana on turn at c1 with Wolves facedown beside `faceup`; `denizens` at their sites. */
    async function playing(
        faceup: string[] = [NEW_GROWTH],
        denizens: Record<string, string[]> = {}
    ) {
        const state = testState(
            [
                testPlayer({
                    playerId: 'dana',
                    color: Color.Red,
                    siteId: 'c1',
                    supply: 3,
                    advisers: [
                        { cardId: WOLVES, faceUp: false },
                        ...faceup.map((cardId) => ({ cardId, faceUp: true }))
                    ]
                }),
                testPlayer({ playerId: 'rhys', color: Color.Blue, siteId: 'p1' })
            ],
            {
                machineState: MachineState.ActPhase,
                oathRevision: CURRENT_OATH_REVISION,
                denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...denizens }
            }
        )
        openTurn(state, 'dana')
        const session = await openSessionOn(tableOf(state))
        vi.spyOn(session, 'applyAction').mockResolvedValue()
        session.chooseAction(ActionType.PlayFacedownAdviser)
        return session
    }

    it('nothing is lit until the site play is chosen; then the seat’s site first, ringed, and each other site', async () => {
        const session = await playing()
        expect(lit(session)).toEqual([])
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
        expect(lit(session)).toEqual(['c1', ...session.adviserOtherSites])
        expect(session.adviserOtherSites).toContain('h1')
        expect(ringed(session)).toEqual(['c1'])
        expect(session.mapPick).toMatchObject({ kind: 'playTo', choosing: true, moverId: 'dana' })
    })

    it('a tap on a far site picks it, and a tap on the seat’s own takes it back', async () => {
        const session = await playing()
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
        session.pickPlayToSite('h1')
        expect(session.adviserToSite).toBe('h1')
        expect(ringed(session)).toEqual(['h1'])
        session.pickPlayToSite('c1')
        expect(session.adviserToSite).toBeUndefined()
        expect(ringed(session)).toEqual(['c1'])
    })

    it('a tap on the site already picked keeps the card to discard first; only a change of site clears it', async () => {
        const session = await playing([NEW_GROWTH, CROP_ROTATION], { c1: [INN], h1: [TENTS] })
        await session.chooseAdviserPlay(WOLVES, SearchPlay.Site)
        session.setAdviserDiscardFirst(INN)
        session.pickPlayToSite('c1')
        expect(session.adviserDiscardFirst).toBe(INN)
        session.pickPlayToSite('h1')
        expect(session.selection.value('discardFirst')).toBeUndefined()

        session.setAdviserDiscardFirst(TENTS)
        session.pickPlayToSite('h1')
        expect(session.adviserToSite).toBe('h1')
        expect(session.adviserDiscardFirst).toBe(TENTS)
        session.pickPlayToSite('c1')
        expect(session.adviserToSite).toBeUndefined()
        expect(session.selection.value('discardFirst')).toBeUndefined()
    })
})
