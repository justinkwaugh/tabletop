import { afterEach, describe, expect, it, vi } from 'vitest'
import { OathRevision, SearchPlay } from '@tabletop/oath'
import { served } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, type PlayedTable } from '$lib/testing/sessionHarness.js'
import {
    BLOOD_PACT,
    CONSPIRACY,
    CROP_ROTATION,
    FULL_SITE_DRAW,
    GLEAMING_ARMOR,
    LAND_WARDEN,
    RELIC_BREAKER,
    TWIN_BROTHER,
    WRESTLERS,
    fullSiteSearch,
    type FullSiteSearch
} from '$lib/testing/fullSiteSearchTable.js'
import type { OathGameSession } from './session.svelte.js'

// R-5.1.3, R-5.1.4.II — Dana searches with a full adviser row at a full site, and keeps Wrestlers, which could go to
// a site, as an adviser. Each tap of the Search panel is answered at once, and the panel offers and sends what it
// did when every read worked the whole chain of site plays out again.

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

/**
 * The whole draft in Node, every read the panel makes after each tap included. Today's code takes it in some tens
 * of milliseconds; before the fix it took over ten seconds. A second leaves CI a wide margin either way.
 */
const DRAFT_BUDGET_MS = 1000

const DANA = { kind: 'player', playerId: 'Dana' } as const
const ADVISERS = [BLOOD_PACT, CONSPIRACY, GLEAMING_ARMOR]
const SLUM_DENIZENS = [
    'denizen.beast.wolves',
    'denizen.hearth.tavern-songs',
    'denizen.nomad.oracle'
]
const [COAST, , PASS] = ['slot.hinterland.0', 'slot.hinterland.1', 'slot.hinterland.2']

type View = 'own' | 'table'
const VIEWS: View[] = ['own', 'table']

function tableFor(view: View, options: FullSiteSearch = {}): PlayedTable {
    const table = fullSiteSearch(options)
    return view === 'own' ? { state: served(table.state, DANA), actions: table.actions } : table
}

async function drafting(view: View, options: FullSiteSearch = {}) {
    const session = await openSessionOn(tableFor(view, options))
    const sent = vi.spyOn(session, 'resolveSearch').mockResolvedValue()
    return { session, draft: session.search, sent }
}

/** Every value `SearchPanel.svelte` reads to draw the draft, as one render reads them. */
function render(session: OathGameSession) {
    const search = session.search
    return {
        swapping: search.swapping,
        drawn: search.drawn,
        kept: search.kept,
        placement: search.placement,
        needsDisplaced: search.needsDisplaced,
        needsConspiracy: search.needsConspiracy,
        needsWhenPlayed: search.needsWhenPlayed,
        needsSecondDisplaced: search.needsSecondDisplaced,
        room: search.room,
        secondRoom: search.secondRoom,
        playTo: session.playTo,
        secondAllowed: search.secondAllowed,
        secondCandidates: search.secondCandidates,
        second: search.second,
        discardFirstOptions: search.discardFirstOptions,
        discardFirsts: search.discardFirsts,
        placements: search.placements,
        siteGain: search.siteGain,
        placementReason: search.placementReason,
        displaceable: search.displaceable,
        displaced: search.displaced,
        others: search.others,
        tapped: search.tapped
    }
}

/** Each tap, then the render that follows it, timed. */
async function timedSteps(session: OathGameSession, steps: [string, () => unknown][]) {
    const times: string[] = []
    const start = performance.now()
    for (const [label, tap] of steps) {
        const t = performance.now()
        await tap()
        render(session)
        times.push(`${label} ${Math.round(performance.now() - t)} ms`)
    }
    return { total: performance.now() - start, times: times.join(', ') }
}

const ADVISER_KEPT = {
    keptCardId: WRESTLERS,
    discardOrder: [TWIN_BROTHER, RELIC_BREAKER],
    play: SearchPlay.Adviser,
    faceUp: true,
    discardedAdviserCardIds: [GLEAMING_ARMOR]
}

const viewName = (view: View) => (view === 'own' ? "Dana's own view" : 'the table')

describe("Dana's Search draft at a full site answers each tap at once", () => {
    const sites: [string, FullSiteSearch, string][] = [
        ['at the Great Slum', {}, GLEAMING_ARMOR],
        ['at a full site that is not the Great Slum', { slumElsewhere: true }, GLEAMING_ARMOR],
        ["with the People's Favor", { peoplesFavor: true }, GLEAMING_ARMOR],
        ['with Crop Rotation used on the Search', { modifier: CROP_ROTATION }, BLOOD_PACT]
    ]
    for (const [where, options, discarded] of sites)
        for (const view of VIEWS)
            it(`${where}, on ${viewName(view)}: Wrestlers kept faceup, an adviser discarded, sent within the budget`, async () => {
                const { session, draft, sent } = await drafting(view, options)
                const { total, times } = await timedSteps(session, [
                    ['open', () => undefined],
                    ['keep Wrestlers', () => draft.keep(WRESTLERS)],
                    [
                        'adviser, faceup',
                        () => draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
                    ],
                    ['discard an adviser', () => draft.chooseDisplaced(discarded)],
                    ['discard Twin Brother', () => draft.tapDiscard(TWIN_BROTHER)]
                ])
                expect(sent).toHaveBeenCalledTimes(1)
                expect(sent.mock.calls[0][0]).toEqual({
                    ...ADVISER_KEPT,
                    discardedAdviserCardIds: [discarded]
                })
                expect(total, times).toBeLessThan(DRAFT_BUDGET_MS)
            }, 60_000)

    // Land Warden — the second card is still judged where it may be played: from revision 31 an adviser may be
    // discarded for it, so Twin Brother joins Dana's advisers beside Wrestlers played to the Great Slum.
    for (const view of VIEWS)
        it(`with Land Warden used on the Search, on ${viewName(view)}: Wrestlers to the Great Slum and Twin Brother as a second adviser, sent within the budget`, async () => {
            const { session, draft, sent } = await drafting(view, {
                modifier: LAND_WARDEN,
                revision: OathRevision.EngineFixes27
            })
            const { total, times } = await timedSteps(session, [
                ['open', () => undefined],
                ['keep Wrestlers', () => draft.keep(WRESTLERS)],
                ['discard the Wolves first', () => draft.tapDiscardFirst(SLUM_DENIZENS[0])],
                ['Twin Brother as the second card', () => draft.tapSecondCard(TWIN_BROTHER)],
                ['to your site', () => draft.choosePlacement({ play: SearchPlay.Site })],
                ['discard Blood Pact', () => draft.chooseSecondDisplaced(BLOOD_PACT)]
            ])
            expect(draft.secondAllowed).toBe(true)
            expect(draft.secondCandidates).toEqual([TWIN_BROTHER, RELIC_BREAKER])
            expect(sent).toHaveBeenCalledTimes(1)
            expect(sent.mock.calls[0][0]).toEqual({
                keptCardId: WRESTLERS,
                discardOrder: [RELIC_BREAKER],
                play: SearchPlay.Site,
                discardFirstCardId: SLUM_DENIZENS[0],
                secondPlay: {
                    cardId: TWIN_BROTHER,
                    play: SearchPlay.Adviser,
                    faceUp: true,
                    discardedAdviserCardIds: [BLOOD_PACT]
                }
            })
            expect(total, times).toBeLessThan(DRAFT_BUDGET_MS)
        }, 60_000)
})

describe("the resolve Dana's draft sends is the same, field for field", () => {
    for (const view of VIEWS) {
        it(`on ${viewName(view)}: Wrestlers to the Great Slum, the Wolves discarded first`, async () => {
            const { draft, sent } = await drafting(view)
            draft.keep(WRESTLERS)
            draft.tapDiscardFirst('denizen.beast.wolves')
            await draft.choosePlacement({ play: SearchPlay.Site })
            expect(draft.placementReason).toBeUndefined()
            await draft.tapDiscard(TWIN_BROTHER)
            expect(sent.mock.calls).toEqual([
                [
                    {
                        keptCardId: WRESTLERS,
                        discardOrder: [TWIN_BROTHER, RELIC_BREAKER],
                        play: SearchPlay.Site,
                        discardFirstCardId: 'denizen.beast.wolves'
                    }
                ]
            ])
        })

        it(`on ${viewName(view)}: with the People's Favor, Wrestlers to the Narrow Pass`, async () => {
            const { session, draft, sent } = await drafting(view, { peoplesFavor: true })
            draft.keep(WRESTLERS)
            session.pickPlayToSite(PASS)
            expect(draft.toSite).toBe(PASS)
            await draft.choosePlacement({ play: SearchPlay.Site })
            await draft.tapDiscard(TWIN_BROTHER)
            expect(sent.mock.calls).toEqual([
                [
                    {
                        keptCardId: WRESTLERS,
                        discardOrder: [TWIN_BROTHER, RELIC_BREAKER],
                        play: SearchPlay.Site,
                        toSiteId: PASS
                    }
                ]
            ])
        })

        for (const discarded of ADVISERS)
            it(`on ${viewName(view)}: Twin Brother kept facedown, ${discarded} discarded`, async () => {
                const { draft, sent } = await drafting(view)
                draft.keep(TWIN_BROTHER)
                await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: false })
                await draft.chooseDisplaced(discarded)
                await draft.tapDiscard(WRESTLERS)
                expect(sent.mock.calls).toEqual([
                    [
                        {
                            keptCardId: TWIN_BROTHER,
                            discardOrder: [WRESTLERS, RELIC_BREAKER],
                            play: SearchPlay.Adviser,
                            faceUp: false,
                            discardedAdviserCardIds: [discarded]
                        }
                    ]
                ])
            })
    }
})

/** What the draft offers for a kept card: its plays and their rooms, the other sites, and the cards to discard first. */
function offers(session: OathGameSession, kept: string) {
    const draft = session.search
    draft.keep(kept)
    return {
        placements: draft.placements.map(({ label, room }) => [
            label,
            room.needed,
            room.discardable
        ]),
        otherSites: draft.otherSites,
        discardFirstOptions: draft.discardFirstOptions,
        siteGain: draft.siteGain,
        secondCandidates: draft.secondCandidates
    }
}

/** The plays the draft offers now, each with its room. */
function plays(session: OathGameSession) {
    return session.search.placements.map(({ label, room }) => [
        label,
        room.needed,
        room.discardable
    ])
}

const AT_LIMIT = [1, ADVISERS] as const
const SITE_PLAYS = [
    ['To your site', 0, []],
    ['Adviser, faceup', ...AT_LIMIT],
    ['Adviser, facedown', ...AT_LIMIT],
    ['Discard', 0, []]
]
const ADVISER_PLAYS = SITE_PLAYS.slice(1)
const GAIN = { favor: 1, secrets: 0 }

describe('the choices offered at a full site stay as they were', () => {
    const revisions: [string, OathRevision][] = [
        ['15', OathRevision.EngineFixes11],
        ['28', OathRevision.EngineFixes24],
        ['31', OathRevision.EngineFixes26],
        ['32', OathRevision.EngineFixes27]
    ]
    for (const [name, revision] of revisions)
        for (const view of VIEWS) {
            const on = `at revision ${name}, on ${viewName(view)}`

            it(`${on}: at the Great Slum, a card that can go to a site offers it once a Slum card is picked to discard first`, async () => {
                const { session, draft } = await drafting(view, { revision })
                const siteKeep = {
                    placements: ADVISER_PLAYS,
                    otherSites: [],
                    discardFirstOptions: SLUM_DENIZENS,
                    siteGain: GAIN,
                    secondCandidates: []
                }
                expect(offers(session, WRESTLERS)).toEqual(siteKeep)
                draft.tapDiscardFirst(SLUM_DENIZENS[0])
                expect(plays(session)).toEqual(SITE_PLAYS)
                expect(offers(session, TWIN_BROTHER)).toEqual({
                    ...siteKeep,
                    discardFirstOptions: []
                })
                expect(offers(session, RELIC_BREAKER)).toEqual(siteKeep)
                draft.tapDiscardFirst(SLUM_DENIZENS[0])
                expect(plays(session)).toEqual(SITE_PLAYS)
            })

            it(`${on}: at a full site that is not the Great Slum, no card can go to a site`, async () => {
                const { session } = await drafting(view, { revision, slumElsewhere: true })
                for (const kept of FULL_SITE_DRAW)
                    expect(offers(session, kept)).toEqual({
                        placements: ADVISER_PLAYS,
                        otherSites: [],
                        discardFirstOptions: [],
                        siteGain: GAIN,
                        secondCandidates: []
                    })
            })

            it(`${on}: with the People's Favor, the other Hinterland sites are offered, and the Slum's cards at each`, async () => {
                const { session, draft } = await drafting(view, { revision, peoplesFavor: true })
                expect(offers(session, WRESTLERS)).toEqual({
                    placements: ADVISER_PLAYS,
                    otherSites: [COAST, PASS],
                    discardFirstOptions: SLUM_DENIZENS,
                    siteGain: GAIN,
                    secondCandidates: []
                })
                expect(session.playTo).toEqual({
                    here: 'slot.hinterland.1',
                    others: [COAST, PASS],
                    picked: undefined
                })
                session.pickPlayToSite(PASS)
                expect(draft.discardFirstOptions).toEqual(SLUM_DENIZENS)
                expect(draft.placements.map((option) => option.label)).toEqual(
                    SITE_PLAYS.map(([label]) => label)
                )
                expect(offers(session, TWIN_BROTHER).otherSites).toEqual([])
            })
        }
})

describe('the draft never shows a choice from before a change', () => {
    it('keeping another card offers that card’s plays', async () => {
        const { draft } = await drafting('own')
        draft.keep(WRESTLERS)
        expect(draft.placements.map((option) => option.play)).not.toContain(SearchPlay.Site)
        draft.tapDiscardFirst(SLUM_DENIZENS[0])
        expect(draft.placements.map((option) => option.play)).toContain(SearchPlay.Site)
        draft.keep(TWIN_BROTHER)
        expect(draft.placements.map((option) => option.play)).not.toContain(SearchPlay.Site)
        expect(draft.discardFirstOptions).toEqual([])
    })

    it('Undo after the adviser to discard asks for it again, and Undo again leaves the play to pick', async () => {
        const { session, draft, sent } = await drafting('own')
        draft.keep(WRESTLERS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        await draft.chooseDisplaced(GLEAMING_ARMOR)
        expect(draft.placed).toBe(true)
        await session.undo()
        expect(draft.placed).toBe(false)
        expect(draft.needsDisplaced).toBe(true)
        expect(draft.displaceable).toEqual(ADVISERS)
        expect(draft.tapped).toEqual([])
        await session.undo()
        expect(draft.placement).toBeUndefined()
        expect(draft.room.needed).toBe(0)
        expect(draft.placements.map((option) => option.label)).toEqual(
            ADVISER_PLAYS.map(([label]) => label)
        )
        await session.undo()
        expect(draft.kept).toBeUndefined()
        expect(draft.placements).toEqual([])
        expect(sent).not.toHaveBeenCalled()
    })

    it('a new state from the server mid-draft is judged afresh: with room at the Great Slum, no card is needed first', async () => {
        const { session, draft } = await drafting('own')
        draft.keep(WRESTLERS)
        expect(draft.siteGain).toEqual(GAIN)
        const before = draft.placements
        expect(before.map((option) => option.label)).not.toContain('To your site')

        const roomy = fullSiteSearch()
        roomy.state.denizensBySite['slot.hinterland.1'] = SLUM_DENIZENS.slice(0, 2)
        await session.presentState(served(roomy.state, DANA))
        expect(draft.kept).toBeUndefined()
        draft.keep(WRESTLERS)
        await draft.choosePlacement({ play: SearchPlay.Site })
        expect(draft.placementReason).toBeUndefined()
        expect(draft.placed).toBe(true)
        expect(draft.discardFirsts).toEqual([])
    })

    it('in hotseat, viewing as a seat not on the clock offers nothing, and back on Dana the draft is as it was', async () => {
        const { session, draft } = await drafting('table')
        draft.keep(WRESTLERS)
        await draft.choosePlacement({ play: SearchPlay.Adviser, faceUp: true })
        const shown = render(session)
        expect(shown.needsDisplaced).toBe(true)

        // Viewing as another hotseat seat leaves the table to that seat, which is not on the clock. Node runs Svelte's
        // server build, where a $derived is worked out once, so the seat the session acts for is set directly.
        const seat = vi.spyOn(session, 'liveTurnSeatId', 'get').mockReturnValue(undefined)
        expect(draft.drawn).toEqual([])
        expect(draft.placements).toEqual([])
        expect(draft.displaceable).toEqual([])
        expect(draft.needsDisplaced).toBe(false)

        seat.mockRestore()
        expect(session.liveTurnSeatId).toBe('Dana')
        expect(render(session)).toEqual(shown)
    })
})
