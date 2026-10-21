import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color } from '@tabletop/common'
import {
    Banner,
    CURRENT_OATH_REVISION,
    HydratedOathGameState,
    MachineState,
    PlayerStatus,
    PowerTiming,
    SearchPlay,
    Suit,
    powerIndexOf,
    type SitePlayGain
} from '@tabletop/oath'
import { openTurn, testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'
import { adviserPlacements } from './adviserPlacements.js'
import { siteGainParts, withSiteGain } from './siteGain.js'

// R-5.1.4.I "gain 1 favor from the bank matching its suit", R-11.2 a Homeland's, R-7.4 Welcoming Party's: the line
// on "To your site" shows all the favor the site play gains, as the engine plans it on the banks as they stand.

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

const SALAD = 'denizen.hearth.salad-days'
const WOLVES = 'denizen.beast.wolves'
const TUTOR = 'denizen.arcane.tutor'
const TENTS = 'denizen.nomad.tents'
const BIRDSONG = 'denizen.beast.birdsong'
const STORYTELLER = 'denizen.hearth.storyteller'
const VOW = 'denizen.nomad.vow-of-kinship'
const WELCOMING_PARTY = 'denizen.hearth.welcoming-party'
const LAND_WARDEN = 'denizen.hearth.land-warden'
const BOOK = 'relic.book-of-records'

/** The table's banks: Discord 2, Arcane 2, Order 4, Hearth 3, Beast 0, Nomad 0. */
const TABLE_BANKS: Record<Suit, number> = {
    [Suit.Discord]: 2,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 3,
    [Suit.Beast]: 0,
    [Suit.Nomad]: 0
}

const carrying = (...cardIds: string[]) => ({
    pendingSearchModifiers: cardIds.map((cardId) => ({ cardId, powerIndex: powerIndexOf(cardId, PowerTiming.Modifier) }))
})
const sites = (c1: string) => ({ siteCards: { c1, c2: 'site.plains', p1: 'site.mountain', h1: 'site.wastes' } })

type Table = {
    banks?: Partial<Record<Suit, number>>
    rhys?: Partial<Parameters<typeof testPlayer>[0]>
    over?: Record<string, unknown>
}

/** Rhys, an Exile at the River (c1), searching with Salad Days, Wolves and Tutor drawn; Dana the Chancellor. */
function table({ banks = {}, rhys = {}, over = {} }: Table = {}) {
    const state = testState(
        [
            testPlayer({ playerId: 'rhys', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 2, secrets: 3, handIds: [SALAD, WOLVES, TUTOR], ...rhys }),
            testPlayer({ playerId: 'dana', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2' })
        ],
        {
            machineState: MachineState.Searching,
            oathRevision: CURRENT_OATH_REVISION,
            chancellorPlayerId: 'dana',
            favorBank: { ...TABLE_BANKS, ...banks },
            ...sites('site.river'),
            denizensBySite: { c1: [BIRDSONG], c2: [], p1: [], h1: [] },
            ...over
        }
    )
    openTurn(state, 'rhys')
    return state
}

/** The kept card's "To your site" line in the Search panel; the site play is offered beside it. */
async function searchLine(state: HydratedOathGameState, cardId: string, before: (draft: Awaited<ReturnType<typeof openSessionOn>>['search']) => void = () => {}) {
    const session = await openSessionOn(tableOf(state))
    vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    const draft = session.search
    draft.keep(cardId)
    before(draft)
    expect(draft.placements.some((option) => option.play === SearchPlay.Site)).toBe(true)
    return draft.siteGain
}

/** A facedown adviser's "To your site" line (R-6.1). */
function adviserLine(state: HydratedOathGameState, cardId: string): SitePlayGain | undefined {
    const placements = adviserPlacements(state, 'rhys', cardId)
    expect(placements.filter((option) => option.play !== SearchPlay.Site).every((option) => option.gain === undefined)).toBe(true)
    return placements.find((option) => option.play === SearchPlay.Site)?.gain
}

const favor = (n: number): SitePlayGain => ({ favor: n, secrets: 0 })

describe('"To your site" shows the favor the Search\'s site play gains (R-5.1.4.I, R-11.2, R-7.4)', () => {
    it("the site's favor: Salad Days takes 1 from Hearth 3", async () => {
        expect(await searchLine(table(), SALAD)).toEqual(favor(1))
    })

    it('an empty bank: Wolves takes nothing from Beast 0', async () => {
        expect(await searchLine(table(), WOLVES)).toEqual(favor(0))
    })

    it('Fertile Valley (the Hearth Homeland) with Hearth 3: the site and the Homeland, +2', async () => {
        expect(await searchLine(table({ over: sites('site.fertile-valley') }), SALAD)).toEqual(favor(2))
    })

    it('Fertile Valley with Hearth 1: the site takes the last, +1', async () => {
        expect(await searchLine(table({ banks: { [Suit.Hearth]: 1 }, over: sites('site.fertile-valley') }), SALAD)).toEqual(favor(1))
    })

    it('Fertile Valley with a Hearth card discarded there this turn: the ledger bars the Homeland, +1', async () => {
        const state = table({ rhys: { homelandUsedThisTurn: ['c1:hearth'] }, over: sites('site.fertile-valley') })
        expect(await searchLine(state, SALAD)).toEqual(favor(1))
    })

    it("Welcoming Party carried: its Hearth favor after the play counts, even when the card's own bank is empty", async () => {
        const party = { rhys: { advisers: [{ cardId: WELCOMING_PARTY, faceUp: true }] }, over: carrying(WELCOMING_PARTY) }
        expect(await searchLine(table(party), WOLVES)).toEqual(favor(1))
        expect(await searchLine(table(party), SALAD)).toEqual(favor(2))
        expect(await searchLine(table({ ...party, banks: { [Suit.Hearth]: 1 } }), SALAD)).toEqual(favor(1))
    })

    it('Book of Records carried: a secret instead of the favor', async () => {
        const state = table({ rhys: { relicIds: [BOOK] }, over: carrying(BOOK) })
        expect(await searchLine(state, SALAD)).toEqual({ favor: 0, secrets: 1 })
    })

    it('Vow of Kinship: a Nomad card takes the Nomad bank\'s favor, kept in that bank', async () => {
        const state = table({ banks: { [Suit.Nomad]: 1 }, rhys: { handIds: [TENTS, WOLVES, TUTOR], advisers: [{ cardId: VOW, faceUp: true }] } })
        expect(await searchLine(state, TENTS)).toEqual(favor(1))
    })

    it("a card discarded first gives its favor back before the site takes one (the People's Favor)", async () => {
        const state = table({ banks: { [Suit.Hearth]: 0 }, over: { banners: testBanners({ [Banner.PeoplesFavor]: 'rhys' }) } })
        state.denizensBySite['c1'] = [BIRDSONG, STORYTELLER]
        state.addTokensOn(STORYTELLER, { favor: 1 })
        expect(await searchLine(state, SALAD)).toEqual(favor(0))
        expect(await searchLine(state, SALAD, (draft) => draft.setDiscardFirst(STORYTELLER))).toEqual(favor(1))
    })

    it('"Play to:" another site (the People\'s Favor): no line', async () => {
        const state = table({ over: { banners: testBanners({ [Banner.PeoplesFavor]: 'rhys' }) } })
        let otherSites: string[] = []
        const gain = await searchLine(state, SALAD, (draft) => {
            otherSites = draft.otherSites
            draft.setToSite(otherSites[0])
        })
        expect(otherSites.length).toBeGreaterThan(0)
        expect(gain).toBeUndefined()
    })

    it("Land Warden's second card to the site leaves the kept card's line its own", async () => {
        // The River holds nothing here, so it has room for both cards.
        const state = table({ rhys: { advisers: [{ cardId: LAND_WARDEN, faceUp: true }] }, over: carrying(LAND_WARDEN) })
        state.denizensBySite['c1'] = []
        let second: string | undefined
        const gain = await searchLine(state, SALAD, (draft) => {
            const toSite = draft.secondPlays.find((option) => option.cardId === WOLVES && option.play === SearchPlay.Site)
            draft.setSecondPlay(toSite?.key)
            second = draft.second?.cardId
        })
        expect(second).toBe(WOLVES)
        expect(gain).toEqual(favor(1))
    })
})

describe('a facedown adviser\'s "To your site" shows the same line (R-6.1)', () => {
    const facedown = (cardId: string) => ({ handIds: [], advisers: [{ cardId, faceUp: false }] })
    const acting = { machineState: MachineState.ActPhase }

    it('Wolves to the River with Beast 0: +0', () => {
        expect(adviserLine(table({ rhys: facedown(WOLVES), over: acting }), WOLVES)).toEqual(favor(0))
    })

    it('Salad Days to Fertile Valley with Hearth 3: +2', () => {
        expect(adviserLine(table({ rhys: facedown(SALAD), over: { ...acting, ...sites('site.fertile-valley') } }), SALAD)).toEqual(favor(2))
    })

    it('with Book of Records held (its mandatory modifier acts on the play): +1 secret', () => {
        const state = table({ rhys: { ...facedown(SALAD), relicIds: [BOOK] }, over: acting })
        expect(adviserLine(state, SALAD)).toEqual({ favor: 0, secrets: 1 })
    })
})

describe('the line in words', () => {
    it('gold for a gain, "+0" in grey for none, and a secret beside any favor', () => {
        expect(siteGainParts(favor(2))).toEqual([{ text: '+2 favor', gains: true }])
        expect(siteGainParts(favor(0))).toEqual([{ text: '+0 favor', gains: false }])
        expect(siteGainParts({ favor: 0, secrets: 1 })).toEqual([{ text: '+1 secret', gains: true }])
        expect(siteGainParts({ favor: 1, secrets: 1 })).toEqual([
            { text: '+1 secret', gains: true },
            { text: '+1 favor', gains: true }
        ])
    })

    it("the button's name says it", () => {
        expect(withSiteGain('To your site', favor(0))).toBe('To your site, +0 favor')
        expect(withSiteGain('To your site: Wolves', { favor: 0, secrets: 1 })).toBe('To your site: Wolves, +1 secret')
        expect(withSiteGain('Discard', undefined)).toBe('Discard')
    })
})
