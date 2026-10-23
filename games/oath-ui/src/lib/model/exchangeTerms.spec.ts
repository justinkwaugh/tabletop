import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    DEED_WRITER_ALLOWS,
    GATHERING_ALLOWS,
    HydratedOathGameState,
    IMPERIAL_WARBANDS,
    OathRevision,
    PlayerStatus,
    TINKERS_FAIR_ALLOWS,
    TRIBUNAL_ALLOWS,
    reasonExchangeInvalid,
    reasonTermsOutsideCard,
    type AdviserRow,
    type OathPlayerState
} from '@tabletop/oath'
import { served, testPlayer, testState } from '@tabletop/oath/testing'
import {
    exchangeComplete,
    exchangeOffers,
    exchangePicked,
    inReturnOf,
    noExchangePicks,
    promiseDraftOf,
    promiseEdited,
    promiseLength,
    siteCounts,
    tappedCount,
    tappedSiteCount,
    transferOf,
    warbandsToMoveIn,
    withOfferedPicks,
    withPromise,
    withSiteCount,
    withSitePicked,
    type ExchangePicks,
    type ExchangeSide
} from './exchangeTerms.js'

const CROWN = 'relic.bandit-crown'
const RING = 'relic.ring-of-devotion'
const CUP = 'relic.cup-of-plenty'
const TENTS = 'denizen.nomad.tents'
const VOW_OF_PEACE = 'denizen.hearth.vow-of-peace'
const VOW_OF_SILENCE = 'denizen.arcane.vow-of-silence'
const MARRIAGE = 'denizen.hearth.marriage'
const ADVISERS = ['denizen.order.longbows', 'denizen.hearth.herald', 'denizen.order.scouts']

const faceup = (cardId: string): AdviserRow => ({ cardId, faceUp: true })

/**
 * 'dana' is the Chancellor and rules c1 and c2 (Imperial warbands); 'rhys' is an Exile;
 * 'ann' is a Citizen with Imperial warbands on their board.
 */
function table(
    seats: { dana?: Partial<OathPlayerState>; rhys?: Partial<OathPlayerState>; ann?: Partial<OathPlayerState> } = {},
    oathRevision: OathRevision = OathRevision.UiBatch1
) {
    return testState(
        [
            testPlayer({ playerId: 'dana', color: Color.Red, status: PlayerStatus.Chancellor, favor: 4, secrets: 2, ...seats.dana }),
            testPlayer({ playerId: 'rhys', color: Color.Purple, favor: 1, secrets: 1, warbandsOnBoard: { rhys: 2 }, ...seats.rhys }),
            testPlayer({ playerId: 'ann', color: Color.Blue, status: PlayerStatus.Citizen, favor: 2, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, ...seats.ann })
        ],
        {
            oathRevision,
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 }, c2: { [IMPERIAL_WARBANDS]: 1 } }
        }
    )
}

const sitesOffered = (state: ReturnType<typeof table>, from: string, to: string) =>
    exchangeOffers(state, from, to, DEED_WRITER_ALLOWS, from).sites.map(({ siteId, counts }) => ({ siteId, counts }))

describe('exchangeOffers — Deed Writer’s sites, read from the engine’s own check of each row', () => {
    it('a Bandit Crown holder’s count runs from 0 (its Q&A: "not zero unless they have the Bandit Crown")', () => {
        const s = table({ rhys: { relicIds: [CROWN] } })
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [0, 1, 2] },
            { siteId: 'c2', counts: [0, 1, 2] }
        ])
    })

    it('a Crown holder with no warbands on their board is offered 0 alone', () => {
        const s = table({ rhys: { relicIds: [CROWN], warbandsOnBoard: {} } })
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [0] },
            { siteId: 'c2', counts: [0] }
        ])
    })

    it('without the Crown a count runs from 1 to the warbands on the receiver’s board', () => {
        const s = table({ rhys: { warbandsOnBoard: { rhys: 3 } } })
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [1, 2, 3] },
            { siteId: 'c2', counts: [1, 2, 3] }
        ])
        expect(warbandsToMoveIn(s, 'rhys')).toEqual({ owner: 'rhys', held: 3 })
    })

    it('no site goes to a receiver who already rules it: the Chancellor and a Citizen (from revision 5)', () => {
        expect(sitesOffered(table(), 'dana', 'ann')).toEqual([])
        expect(sitesOffered(table({}, OathRevision.CardFixes1), 'dana', 'ann')).toEqual([
            { siteId: 'c1', counts: [1, 2] },
            { siteId: 'c2', counts: [1, 2] }
        ])
    })

    it('no site goes to a receiver with no warbands on their board and no Crown', () => {
        expect(sitesOffered(table({ rhys: { warbandsOnBoard: {} } }), 'dana', 'rhys')).toEqual([])
    })

    it('no site goes to a holder of Ring of Devotion, who cannot place warbands at sites (from revision 9)', () => {
        expect(sitesOffered(table({ rhys: { relicIds: [RING] } }, OathRevision.EngineFixes5), 'dana', 'rhys')).toEqual([])
        expect(sitesOffered(table({ rhys: { relicIds: [RING] } }, OathRevision.EngineFixes4), 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [1, 2] },
            { siteId: 'c2', counts: [1, 2] }
        ])
    })

    it('a holder of the Ring and the Crown is offered 0 alone, placing nothing (from revision 9)', () => {
        expect(sitesOffered(table({ rhys: { relicIds: [RING, CROWN] } }, OathRevision.EngineFixes5), 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [0] },
            { siteId: 'c2', counts: [0] }
        ])
    })

    it('a site row names its faceup card for its picture', () => {
        const s = table()
        expect(exchangeOffers(s, 'dana', 'rhys', DEED_WRITER_ALLOWS, 'dana').sites.map((site) => site.cardId)).toEqual([
            s.siteCardAt('c1'),
            s.siteCardAt('c2')
        ])
    })

    it('two sites share one board: each count stops at what the other leaves (R-10.8)', () => {
        const s = table({ rhys: { warbandsOnBoard: { rhys: 4 } } })
        expect(siteCounts(s, 'dana', 'rhys', { sites: [{ siteId: 'c1', warbands: 3 }] }, 'c2')).toEqual([1])
        expect(siteCounts(s, 'dana', 'rhys', { sites: [{ siteId: 'c2', warbands: 1 }] }, 'c1')).toEqual([1, 2, 3])
        expect(siteCounts(s, 'dana', 'rhys', { sites: [{ siteId: 'c1', warbands: 4 }] }, 'c2')).toEqual([])
    })

    it('sites are offered only where the card admits them', () => {
        expect(exchangeOffers(table(), 'dana', 'rhys', TINKERS_FAIR_ALLOWS, 'dana').sites).toEqual([])
    })
})

describe('exchangeOffers — favor, secrets, relics and advisers', () => {
    it('Vow of Silence: its holder’s secrets stay in the row and none can be added', () => {
        const s = table({ rhys: { secrets: 2, advisers: [faceup(VOW_OF_SILENCE)] } })
        const offers = exchangeOffers(s, 'rhys', 'dana', TINKERS_FAIR_ALLOWS, 'dana')
        expect(offers.secrets).toEqual({ held: 2, addable: 0 })
        expect(offers.favor).toEqual({ held: 1, addable: 1 })
        expect(exchangeOffers(s, 'dana', 'rhys', {}, 'dana').secrets).toEqual({ held: 2, addable: 2 })
    })

    it('Tinker’s Fair keeps every relic either player holds', () => {
        const s = table({ rhys: { relicIds: [CROWN, CUP] } })
        expect(exchangeOffers(s, 'rhys', 'dana', TINKERS_FAIR_ALLOWS, 'dana').relicIds).toEqual([CROWN, CUP])
        expect(exchangeOffers(s, 'rhys', 'dana', {}, 'dana').relicIds).toEqual([])
    })

    it('The Gathering: a faceup locked adviser is not listed; a facedown one stays (R-7.2.2, R-9.4)', () => {
        const s = table({
            rhys: { advisers: [faceup(VOW_OF_PEACE), faceup(TENTS), { cardId: MARRIAGE, faceUp: false }] }
        })
        expect(exchangeOffers(s, 'rhys', 'dana', GATHERING_ALLOWS, 'dana').advisers.map((a) => a.row)).toEqual([1, 2])
    })

    it('no adviser that counts toward the limit is listed for a receiver with no room (R-7.2.1)', () => {
        const advisers = { rhys: { advisers: [faceup(TENTS)] } }
        const full = table({ ...advisers, dana: { advisers: ADVISERS.map(faceup) } })
        expect(exchangeOffers(full, 'rhys', 'dana', GATHERING_ALLOWS, 'dana').advisers).toEqual([])
        const room = table({ ...advisers, dana: { advisers: ADVISERS.slice(0, 2).map(faceup) } })
        expect(exchangeOffers(room, 'rhys', 'dana', GATHERING_ALLOWS, 'dana').advisers.map((a) => a.row)).toEqual([0])
    })

    it('a receiver at the limit is offered an adviser once they give one back (R-10.8: judged on the result)', () => {
        const full = table({ rhys: { advisers: [faceup(TENTS)] }, dana: { advisers: ADVISERS.map(faceup) } })
        const back = { adviserRows: [0] }
        expect(exchangeOffers(full, 'rhys', 'dana', GATHERING_ALLOWS, 'dana', back).advisers.map((a) => a.row)).toEqual([0])
        // From revision 11 nothing is held back: an exchange over the limit asks a discard instead.
        const current = table({ rhys: { advisers: [faceup(TENTS)] }, dana: { advisers: ADVISERS.map(faceup) } }, OathRevision.EngineFixes7)
        expect(exchangeOffers(current, 'rhys', 'dana', GATHERING_ALLOWS, 'dana').advisers.map((a) => a.row)).toEqual([0])
    })
})

describe('the exchange picks — a site picked waits for its count', () => {
    it('a picked site starts with no count, and the terms are not complete until it has one', () => {
        const picked = withSitePicked(noExchangePicks(), 'fromProposer', 'c1', [0, 1, 2], true)
        expect(picked.terms).toEqual({ fromProposer: { sites: [] } })
        expect(picked.uncountedSiteIds).toEqual(['c1'])
        expect(exchangeComplete(picked)).toBe(false)

        const counted = withSiteCount(picked, 'fromProposer', 'c1', 0)
        expect(counted.terms).toEqual({ fromProposer: { sites: [{ siteId: 'c1', warbands: 0 }] } })
        expect(counted.uncountedSiteIds).toEqual([])
        expect(exchangeComplete(counted)).toBe(true)
    })

    it('a site with one legal count is picked with it', () => {
        const picked = withSitePicked(noExchangePicks(), 'fromProposer', 'c1', [0], true)
        expect(picked.terms).toEqual({ fromProposer: { sites: [{ siteId: 'c1', warbands: 0 }] } })
        expect(exchangeComplete(picked)).toBe(true)
    })

    it('a second tap on a site takes it out, counted or not', () => {
        const counted = withSiteCount(
            withSitePicked(noExchangePicks(), 'fromProposer', 'c1', [1, 2], true),
            'fromProposer',
            'c1',
            2
        )
        const dropped = withSitePicked(counted, 'fromProposer', 'c1', [1, 2], false)
        expect(dropped.terms).toEqual({ fromProposer: { sites: [] } })
        expect(dropped.uncountedSiteIds).toEqual([])
        expect(exchangeComplete(dropped)).toBe(false)
    })

    it('terms that name nothing are not complete', () => {
        expect(exchangeComplete(noExchangePicks())).toBe(false)
        expect(exchangeComplete({ terms: { fromCounterparty: { favor: 1 } }, uncountedSiteIds: [] })).toBe(true)
    })
})

describe('a count picked from its pieces', () => {
    it('a tap on the Nth piece sets N; a tap on the piece at the count sets 0', () => {
        expect(tappedCount(0, 2)).toBe(2)
        expect(tappedCount(2, 1)).toBe(1)
        expect(tappedCount(2, 2)).toBe(0)
    })

    it('with a floor (a banner’s least bid), a tap on the piece at the count goes back to the floor', () => {
        expect(tappedCount(2, 3, 2)).toBe(3)
        expect(tappedCount(3, 2, 2)).toBe(2)
        expect(tappedCount(2, 2, 2)).toBe(2)
        expect(tappedCount(3, 3, 2)).toBe(2)
    })

    it('a site’s count goes back to none where 0 is not legal, and to 0 where it is (the Crown)', () => {
        expect(tappedSiteCount([1, 2], undefined, 2)).toBe(2)
        expect(tappedSiteCount([1, 2], 2, 2)).toBeUndefined()
        expect(tappedSiteCount([0, 1, 2], 1, 1)).toBe(0)
        expect(tappedSiteCount([0, 1, 2], 0, 1)).toBe(1)
    })
})

// Deed Writer: "Old ruler moves warbands to board, and new ruler moves warbands from board."
describe('Deed Writer — from revision 11 a receiver moves in from the board their own sites refill', () => {
    /** 'dana' rules c1 and c2 (Imperial warbands); 'rhys' rules p1 with 2 warbands and has an empty board. */
    function swapTable(oathRevision: OathRevision) {
        const s = table({ rhys: { warbandsOnBoard: {} } }, oathRevision)
        s.warbandsBySite = { ...s.warbandsBySite, p1: { rhys: 2 } }
        return s
    }
    const p1 = { sites: [{ siteId: 'p1', warbands: 1 }] }

    it('a site is listed for an empty board without a count, and counted to what comes home once the receiver hands over a site of their own', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [] },
            { siteId: 'c2', counts: [] }
        ])
        expect(exchangeOffers(s, 'dana', 'rhys', DEED_WRITER_ALLOWS, 'dana', p1).sites.map(({ siteId, counts }) => ({ siteId, counts }))).toEqual([
            { siteId: 'c1', counts: [1, 2] },
            { siteId: 'c2', counts: [1, 2] }
        ])
        expect(siteCounts(s, 'dana', 'rhys', {}, 'c1', p1)).toEqual([1, 2])
        expect(warbandsToMoveIn(s, 'rhys')).toEqual({ owner: 'rhys', held: 0 })
        expect(warbandsToMoveIn(s, 'rhys', p1.sites)).toEqual({ owner: 'rhys', held: 2 })
    })

    it('before revision 11 the board is read as it stands, so nothing is offered', () => {
        const s = swapTable(OathRevision.EngineFixes6)
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([])
        expect(exchangeOffers(s, 'dana', 'rhys', DEED_WRITER_ALLOWS, 'dana', p1).sites).toEqual([])
        expect(warbandsToMoveIn(s, 'rhys', p1.sites)).toEqual({ owner: 'rhys', held: 0 })
    })
})

// R-10.8 — each side offers what the engine accepts with what the other gives back, so a pick
// offered only because of the other side's pick goes when that pick does: no row would show it.
describe('a pick the other side no longer allows leaves the terms with it', () => {
    function swapTable(oathRevision: OathRevision) {
        const s = table({ dana: { warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }, rhys: { warbandsOnBoard: {} } }, oathRevision)
        s.warbandsBySite = { ...s.warbandsBySite, p1: { rhys: 2 } }
        return s
    }
    /** 'dana' proposes; they give c1, 'rhys' gives p1 and the warbands it sends home fill c1. */
    const keep = (state: ReturnType<typeof table>, picks: ExchangePicks, allows = DEED_WRITER_ALLOWS) =>
        withOfferedPicks(state, 'dana', 'rhys', allows, 'dana', picks)
    const swap = (state: ReturnType<typeof table>) => {
        const p1 = keep(state, withSiteCount(noExchangePicks(), 'fromCounterparty', 'p1', 1))
        return keep(state, withSiteCount(p1, 'fromProposer', 'c1', 1))
    }

    it('Deed Writer: withdrawing the site that refills the board clears the count of the site it allowed, which waits for a site again', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        const picked = swap(s)
        expect(picked.terms.fromProposer?.sites).toEqual([{ siteId: 'c1', warbands: 1 }])
        expect(exchangeComplete(picked)).toBe(true)

        const withdrawn = keep(s, withSitePicked(picked, 'fromCounterparty', 'p1', [1], false))
        expect(withdrawn.terms.fromProposer?.sites).toEqual([])
        expect(withdrawn.terms.fromCounterparty?.sites).toEqual([])
        expect(withdrawn.uncountedSiteIds).toEqual(['c1'])
        expect(exchangeComplete(withdrawn)).toBe(false)
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([
            { siteId: 'c1', counts: [] },
            { siteId: 'c2', counts: [] }
        ])
    })

    it('Deed Writer: an uncounted site it allowed stays picked, waiting, and what else is picked stays', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        const p1 = keep(s, withSiteCount(noExchangePicks(), 'fromCounterparty', 'p1', 2))
        const favor = keep(s, { ...p1, terms: { ...p1.terms, fromProposer: { favor: 1 } } })
        const uncounted = keep(s, withSitePicked(favor, 'fromProposer', 'c1', [1, 2], true))
        expect(uncounted.uncountedSiteIds).toEqual(['c1'])

        const withdrawn = keep(s, withSitePicked(uncounted, 'fromCounterparty', 'p1', [1, 2], false))
        expect(withdrawn.uncountedSiteIds).toEqual(['c1'])
        expect(withdrawn.terms.fromProposer).toEqual({ favor: 1, sites: [] })
        expect(exchangeComplete(withdrawn)).toBe(false)
    })

    it('a change to the same side keeps the other side’s picks while they stay offered', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        const picked = swap(s)
        const more = keep(s, { ...picked, terms: { ...picked.terms, fromCounterparty: { ...picked.terms.fromCounterparty, favor: 1 } } })
        expect(more.terms.fromProposer?.sites).toEqual([{ siteId: 'c1', warbands: 1 }])
        expect(keep(s, picked)).toEqual(picked)
    })

    it('The Gathering before revision 11: an adviser offered only because one came back goes when it does', () => {
        const s = table({ rhys: { advisers: [faceup(TENTS)] }, dana: { advisers: ADVISERS.map(faceup) } })
        const back = keep(s, { terms: { fromProposer: { adviserRows: [0] } }, uncountedSiteIds: [] }, GATHERING_ALLOWS)
        const both = keep(s, { ...back, terms: { ...back.terms, fromCounterparty: { adviserRows: [0] } } }, GATHERING_ALLOWS)
        expect(both.terms).toEqual({ fromProposer: { adviserRows: [0] }, fromCounterparty: { adviserRows: [0] } })

        const withdrawn = keep(s, { ...both, terms: { ...both.terms, fromProposer: { adviserRows: [] } } }, GATHERING_ALLOWS)
        expect(withdrawn.terms).toEqual({ fromProposer: { adviserRows: [] }, fromCounterparty: { adviserRows: [] } })
        expect(exchangeComplete(withdrawn)).toBe(false)
    })
})

/**
 * The editor's own steps, on any view of the state: a side's rows are its offers with what the
 * other side gives back; a site is picked with the counts its row offers; a count is a piece of
 * that row; every change goes through `withOfferedPicks`.
 */
function editor(state: HydratedOathGameState, viewerId = 'dana') {
    const players: Record<ExchangeSide, { giver: string; receiver: string; back: ExchangeSide }> = {
        fromProposer: { giver: 'dana', receiver: 'rhys', back: 'fromCounterparty' },
        fromCounterparty: { giver: 'rhys', receiver: 'dana', back: 'fromProposer' }
    }
    const inReturn = (picks: ExchangePicks, side: ExchangeSide) =>
        inReturnOf(state, picks, players[side].back, players[side].receiver)
    const keep = (picks: ExchangePicks) =>
        withOfferedPicks(state, 'dana', 'rhys', DEED_WRITER_ALLOWS, viewerId, picks)
    const listed = (picks: ExchangePicks, side: ExchangeSide) =>
        exchangeOffers(state, players[side].giver, players[side].receiver, DEED_WRITER_ALLOWS, viewerId, inReturn(picks, side))
            .sites.map((site) => site.siteId)
    const counts = (picks: ExchangePicks, side: ExchangeSide, siteId: string) =>
        siteCounts(state, players[side].giver, players[side].receiver, transferOf(picks.terms, side), siteId, inReturn(picks, side))
    const pick = (picks: ExchangePicks, side: ExchangeSide, siteId: string, on = true) => {
        expect(listed(picks, side)).toContain(siteId)
        return keep(withSitePicked(picks, side, siteId, counts(picks, side, siteId), on))
    }
    const count = (picks: ExchangePicks, side: ExchangeSide, siteId: string, warbands: number) => {
        expect(counts(picks, side, siteId)).toContain(warbands)
        return keep(withSiteCount(picks, side, siteId, warbands))
    }
    return { keep, listed, counts, pick, count }
}

const danaView = (state: HydratedOathGameState) =>
    new HydratedOathGameState(served(state, { kind: 'player', playerId: 'dana' }))

const views = [
    ['the server’s state', (state: HydratedOathGameState) => state],
    ['Dana’s own view', danaView]
] as const

// R-10.8 — a site's count is one its row's pieces offer; a count the other side's change took
// away is cleared, not clamped, so the player picks again and the terms wait for it.
describe('a count no longer among its row’s counts is cleared', () => {
    /** 'rhys' has one warband on their board and rules p1 with three; 'dana' gives c1. */
    function staleTable() {
        const s = table({ dana: { warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 } }, rhys: { warbandsOnBoard: { rhys: 1 } } }, OathRevision.EngineFixes7)
        s.warbandsBySite = { ...s.warbandsBySite, p1: { rhys: 3 } }
        return s
    }

    for (const [view, of] of views) {
        it(`a receiver who promised four after giving a site that returns three, then withdrew it, picks again at one (${view})`, () => {
            const s = staleTable()
            const ed = editor(of(s))
            let picks = ed.count(ed.pick(noExchangePicks(), 'fromCounterparty', 'p1'), 'fromCounterparty', 'p1', 1)
            picks = ed.count(ed.pick(picks, 'fromProposer', 'c1'), 'fromProposer', 'c1', 4)
            expect(exchangeComplete(picks)).toBe(true)
            expect(reasonExchangeInvalid(s, 'dana', 'rhys', picks.terms)).toBeUndefined()

            const withdrawn = ed.pick(picks, 'fromCounterparty', 'p1', false)
            // The count left behind is one the engine refuses: Rhys's board holds one.
            expect(reasonExchangeInvalid(s, 'dana', 'rhys', { fromProposer: { sites: [{ siteId: 'c1', warbands: 4 }] } })).toBeDefined()
            expect(ed.listed(withdrawn, 'fromProposer')).toContain('c1')
            expect(ed.counts(withdrawn, 'fromProposer', 'c1')).toEqual([1])
            expect(withdrawn.terms.fromProposer?.sites).toEqual([])
            expect(withdrawn.uncountedSiteIds).toEqual(['c1'])
            expect(exchangeComplete(withdrawn)).toBe(false)

            const again = ed.count(withdrawn, 'fromProposer', 'c1', 1)
            expect(again.terms.fromProposer?.sites).toEqual([{ siteId: 'c1', warbands: 1 }])
            expect(exchangeComplete(again)).toBe(true)
            expect(reasonExchangeInvalid(s, 'dana', 'rhys', again.terms)).toBeUndefined()
        })
    }

    it('a count still among its row’s counts stays', () => {
        const s = staleTable()
        const ed = editor(s)
        let picks = ed.count(ed.pick(noExchangePicks(), 'fromCounterparty', 'p1'), 'fromCounterparty', 'p1', 1)
        picks = ed.count(ed.pick(picks, 'fromProposer', 'c1'), 'fromProposer', 'c1', 1)
        const withdrawn = ed.pick(picks, 'fromCounterparty', 'p1', false)
        expect(withdrawn.terms.fromProposer?.sites).toEqual([{ siteId: 'c1', warbands: 1 }])
        expect(withdrawn.uncountedSiteIds).toEqual([])
        expect(exchangeComplete(withdrawn)).toBe(true)
    })
})

// Deed Writer: "Old ruler moves warbands to board, and new ruler moves warbands from board."
describe('Deed Writer — two sites that depend on each other, both boards empty (revision 11)', () => {
    /** 'dana' rules c1 (2 Imperial) and c2 (1); 'rhys' rules p1 with 2 warbands; both boards are empty. */
    function bothEmpty(oathRevision: OathRevision = OathRevision.EngineFixes7, dana: Partial<OathPlayerState> = {}) {
        const s = table({ dana, rhys: { warbandsOnBoard: {} } }, oathRevision)
        s.warbandsBySite = { ...s.warbandsBySite, p1: { rhys: 2 } }
        return s
    }
    const swapTerms = {
        fromProposer: { sites: [{ siteId: 'c1', warbands: 2 }] },
        fromCounterparty: { sites: [{ siteId: 'p1', warbands: 2 }] }
    }

    it('the engine accepts the swap, and neither side alone', () => {
        const s = bothEmpty()
        expect(reasonExchangeInvalid(s, 'dana', 'rhys', swapTerms)).toBeUndefined()
        expect(reasonExchangeInvalid(s, 'dana', 'rhys', { fromProposer: swapTerms.fromProposer })).toBeDefined()
        expect(reasonExchangeInvalid(s, 'dana', 'rhys', { fromCounterparty: swapTerms.fromCounterparty })).toBeDefined()
    })

    for (const [view, of] of views) {
        for (const [who, first, firstSite, second, secondSite] of [
            ['Dana', 'fromProposer', 'c1', 'fromCounterparty', 'p1'],
            ['Rhys', 'fromCounterparty', 'p1', 'fromProposer', 'c1']
        ] as const) {
            it(`${who} picks first, with no count; the other's site brings both counts, and the engine accepts (${view})`, () => {
                const s = bothEmpty()
                const ed = editor(of(s))
                expect(ed.listed(noExchangePicks(), 'fromProposer')).toEqual(['c1', 'c2'])
                expect(ed.listed(noExchangePicks(), 'fromCounterparty')).toEqual(['p1'])

                const staged = ed.pick(noExchangePicks(), first, firstSite)
                expect(staged.uncountedSiteIds).toEqual([firstSite])
                expect(ed.counts(staged, first, firstSite)).toEqual([])
                expect(exchangeComplete(staged)).toBe(false)

                const both = ed.pick(staged, second, secondSite)
                expect([...both.uncountedSiteIds].sort()).toEqual(['c1', 'p1'])
                expect(ed.counts(both, 'fromProposer', 'c1')).toEqual([1, 2])
                expect(ed.counts(both, 'fromCounterparty', 'p1')).toEqual([1, 2])
                expect(exchangeComplete(both)).toBe(false)

                const done = ed.count(ed.count(both, 'fromProposer', 'c1', 2), 'fromCounterparty', 'p1', 2)
                expect(done.uncountedSiteIds).toEqual([])
                expect(done.terms.fromProposer?.sites).toEqual(swapTerms.fromProposer.sites)
                expect(done.terms.fromCounterparty?.sites).toEqual(swapTerms.fromCounterparty.sites)
                expect(exchangeComplete(done)).toBe(true)
                expect(reasonExchangeInvalid(s, 'dana', 'rhys', done.terms)).toBeUndefined()
            })
        }
    }

    it('withdrawing one side’s site clears the other’s count, and that site waits for a site again', () => {
        const s = bothEmpty()
        const ed = editor(s)
        const both = ed.pick(ed.pick(noExchangePicks(), 'fromProposer', 'c1'), 'fromCounterparty', 'p1')
        const done = ed.count(ed.count(both, 'fromProposer', 'c1', 2), 'fromCounterparty', 'p1', 2)

        const withdrawn = ed.pick(done, 'fromCounterparty', 'p1', false)
        expect(withdrawn.terms.fromCounterparty?.sites).toEqual([])
        expect(withdrawn.terms.fromProposer?.sites).toEqual([])
        expect(withdrawn.uncountedSiteIds).toEqual(['c1'])
        expect(ed.counts(withdrawn, 'fromProposer', 'c1')).toEqual([])
        expect(exchangeComplete(withdrawn)).toBe(false)
    })

    it('a site with no way to become legal is neither listed nor kept: a Ring of Devotion holder cannot take the other site back', () => {
        const s = bothEmpty(OathRevision.EngineFixes7, { relicIds: [RING] })
        const ed = editor(s)
        expect(ed.listed(noExchangePicks(), 'fromProposer')).toEqual([])
        expect(ed.listed(noExchangePicks(), 'fromCounterparty')).toEqual([])
        const kept = ed.keep(withSitePicked(noExchangePicks(), 'fromProposer', 'c1', [], true))
        expect(kept.uncountedSiteIds).toEqual([])
        expect(exchangeComplete(kept)).toBe(false)
    })

    it('before revision 11 nothing waits for a site: nothing is listed and no pick is kept, as before', () => {
        const s = bothEmpty(OathRevision.EngineFixes6)
        const ed = editor(s)
        expect(reasonExchangeInvalid(s, 'dana', 'rhys', swapTerms)).toBeDefined()
        expect(ed.listed(noExchangePicks(), 'fromProposer')).toEqual([])
        expect(ed.listed(noExchangePicks(), 'fromCounterparty')).toEqual([])
        const picked = withSitePicked(withSitePicked(noExchangePicks(), 'fromProposer', 'c1', [], true), 'fromCounterparty', 'p1', [], true)
        expect(ed.keep(picked).uncountedSiteIds).toEqual([])
    })
})

describe('the Tribunal’s promise boxes — each side’s promise, sent as the engine’s rule reads it (R-7.6.3-H1)', () => {
    it('the box keeps what was typed; the terms carry it trimmed, line breaks inside kept', () => {
        const typed = '  I will travel to the Hinterland\nnext round.  \n'
        const picks = withPromise(noExchangePicks(), 'fromProposer', typed)
        expect(promiseDraftOf(picks, 'fromProposer')).toBe(typed)
        expect(promiseDraftOf(picks, 'fromCounterparty')).toBe('')
        expect(picks.terms.promises).toEqual({ fromProposer: 'I will travel to the Hinterland\nnext round.' })
        expect(reasonTermsOutsideCard(picks.terms, TRIBUNAL_ALLOWS)).toBeUndefined()
    })

    it('a box empty after the trim is no promise: the side has no key, and no promises object without one', () => {
        const both = withPromise(withPromise(noExchangePicks(), 'fromProposer', 'I will.'), 'fromCounterparty', 'So will I.')
        expect(both.terms.promises).toEqual({ fromProposer: 'I will.', fromCounterparty: 'So will I.' })

        const one = withPromise(both, 'fromProposer', '   \n ')
        expect(one.terms.promises).toEqual({ fromCounterparty: 'So will I.' })
        expect(promiseDraftOf(one, 'fromProposer')).toBe('   \n ')

        const none = withPromise(one, 'fromCounterparty', '')
        expect(none.terms).not.toHaveProperty('promises')
    })

    it('a promise alone is an offer, "Use" ready; spaces alone are no pick', () => {
        const promised = withPromise(noExchangePicks(), 'fromCounterparty', 'Rhys stays home.')
        expect(exchangeComplete(promised)).toBe(true)
        expect(exchangePicked(promised)).toBe(true)
        const blank = withPromise(noExchangePicks(), 'fromCounterparty', '   ')
        expect(exchangeComplete(blank)).toBe(false)
        expect(exchangePicked(blank)).toBe(false)
    })

    it('the counter is the validator’s number: UTF-16 units of the trimmed text, so 201 is refused and 200 is not', () => {
        const over = withPromise(noExchangePicks(), 'fromProposer', ' a' + '\u0301'.repeat(200) + ' ')
        expect(promiseLength(over.terms, 'fromProposer')).toBe(201)
        expect(reasonTermsOutsideCard(over.terms, TRIBUNAL_ALLOWS)).toBe('a promise is at most 200 characters')

        const exact = withPromise(noExchangePicks(), 'fromProposer', '\u{1F600}' + 'x'.repeat(198))
        expect(promiseLength(exact.terms, 'fromProposer')).toBe(200)
        expect(reasonTermsOutsideCard(exact.terms, TRIBUNAL_ALLOWS)).toBeUndefined()
        expect(promiseLength(exact.terms, 'fromCounterparty')).toBe(0)
    })

    it('promiseEdited names the one side whose promise is all that changed', () => {
        const picked = { terms: { fromProposer: { favor: 1 } }, uncountedSiteIds: [] }
        const typed = withPromise(picked, 'fromProposer', 'I ')
        expect(promiseEdited(picked, typed)).toBe('fromProposer')
        expect(promiseEdited(typed, withPromise(typed, 'fromProposer', 'I s'))).toBe('fromProposer')
        expect(promiseEdited(typed, withPromise(typed, 'fromCounterparty', 'x'))).toBe('fromCounterparty')
        expect(promiseEdited(typed, typed)).toBeUndefined()
        const more = { ...typed, terms: { ...typed.terms, fromProposer: { favor: 2 } } }
        expect(promiseEdited(typed, withPromise(more, 'fromProposer', 'I s'))).toBeUndefined()
    })

    it('a change to the pieces keeps both promises, in the box and in the terms', () => {
        const s = table({}, OathRevision.EngineFixes24)
        const promised = withPromise(withPromise(noExchangePicks(), 'fromProposer', 'I will. '), 'fromCounterparty', 'So will I.')
        const tapped = withOfferedPicks(s, 'dana', 'rhys', TRIBUNAL_ALLOWS, 'dana', {
            ...promised,
            terms: { ...promised.terms, fromProposer: { favor: 2 } }
        })
        expect(tapped.terms).toEqual({ fromProposer: { favor: 2 }, promises: { fromProposer: 'I will.', fromCounterparty: 'So will I.' } })
        expect(promiseDraftOf(tapped, 'fromProposer')).toBe('I will. ')
        expect(reasonExchangeInvalid(s, 'dana', 'rhys', tapped.terms)).toBeUndefined()
    })
})
