import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    DEED_WRITER_ALLOWS,
    GATHERING_ALLOWS,
    IMPERIAL_WARBANDS,
    OathRevision,
    PlayerStatus,
    TINKERS_FAIR_ALLOWS,
    type AdviserRow,
    type OathPlayerState
} from '@tabletop/oath'
import { testPlayer, testState } from '@tabletop/oath/testing'
import {
    exchangeComplete,
    exchangeOffers,
    noExchangePicks,
    siteCounts,
    tappedCount,
    tappedSiteCount,
    warbandsToMoveIn,
    withOfferedPicks,
    withSiteCount,
    withSitePicked,
    type ExchangePicks
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
 * 'ann' is a Citizen with Imperial warbands on her board.
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

    it('a site is offered to an empty board once the receiver hands over a site of their own, counted to what comes home', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        expect(sitesOffered(s, 'dana', 'rhys')).toEqual([])
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
    /** 'dana' proposes; she gives c1, 'rhys' gives p1 and the warbands it sends home fill c1. */
    const keep = (state: ReturnType<typeof table>, picks: ExchangePicks, allows = DEED_WRITER_ALLOWS) =>
        withOfferedPicks(state, 'dana', 'rhys', allows, 'dana', picks)
    const swap = (state: ReturnType<typeof table>) => {
        const p1 = keep(state, withSiteCount(noExchangePicks(), 'fromCounterparty', 'p1', 1))
        return keep(state, withSiteCount(p1, 'fromProposer', 'c1', 1))
    }

    it('Deed Writer: withdrawing the site that refills the board drops the counted site it allowed', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        const picked = swap(s)
        expect(picked.terms.fromProposer?.sites).toEqual([{ siteId: 'c1', warbands: 1 }])
        expect(exchangeComplete(picked)).toBe(true)

        const withdrawn = keep(s, withSitePicked(picked, 'fromCounterparty', 'p1', [1], false))
        expect(withdrawn.terms.fromProposer?.sites).toEqual([])
        expect(withdrawn.terms.fromCounterparty?.sites).toEqual([])
        expect(withdrawn.uncountedSiteIds).toEqual([])
        expect(exchangeComplete(withdrawn)).toBe(false)
    })

    it('Deed Writer: an uncounted site it allowed goes too, and what else is picked stays', () => {
        const s = swapTable(OathRevision.EngineFixes7)
        const p1 = keep(s, withSiteCount(noExchangePicks(), 'fromCounterparty', 'p1', 2))
        const favor = keep(s, { ...p1, terms: { ...p1.terms, fromProposer: { favor: 1 } } })
        const uncounted = keep(s, withSitePicked(favor, 'fromProposer', 'c1', [1, 2], true))
        expect(uncounted.uncountedSiteIds).toEqual(['c1'])

        const withdrawn = keep(s, withSitePicked(uncounted, 'fromCounterparty', 'p1', [1, 2], false))
        expect(withdrawn.uncountedSiteIds).toEqual([])
        expect(withdrawn.terms.fromProposer).toEqual({ favor: 1, sites: [] })
        expect(exchangeComplete(withdrawn)).toBe(true)
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
