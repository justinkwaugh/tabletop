import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { testPlayer, testState } from '../testing/fixture.js'
import {
    areEnemies,
    banditsRuleSite,
    banditsServe,
    isImperialPlayer,
    isImperialSite,
    rulersOfSite,
    rulesSite,
    sitesRuledBy,
    warbandsAt,
    warbandsFreeToLeave,
    totalWarbandsAt
} from './rule.js'
import { HydratedCampaign } from '../actions/campaign.js'
import { CampaignTargetKind } from '../model/campaign.js'
import type { CampaignTarget } from '../model/campaign.js'
import { OathRevision } from './revision.js'
import '../powers/index.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'
const EXILE = 'exile'
const OTHER_EXILE = 'otherExile'

function table(warbandsBySite: Record<string, Record<string, number>> = {}) {
    return testState(
        [
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 24 }
            }),
            testPlayer({
                playerId: CITIZEN,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                // R-6.6.2 -- a Citizen's board holds the Empire's warbands, not their own.
                warbandsInPersonalBank: { [CITIZEN]: 14 }
            }),
            testPlayer({
                playerId: EXILE,
                color: Color.Red,
                status: PlayerStatus.Exile,
                warbandsInPersonalBank: { [EXILE]: 14 }
            }),
            testPlayer({
                playerId: OTHER_EXILE,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                warbandsInPersonalBank: { [OTHER_EXILE]: 14 }
            })
        ],
        { warbandsBySite, chancellorPlayerId: CHANCELLOR }
    )
}

describe('warbands at a site', () => {
    it('reads the counts, defaulting an untouched site to none', () => {
        const state = table({ c1: { [EXILE]: 2 } })
        expect(warbandsAt(state, 'c1')).toEqual({ [EXILE]: 2 })
        expect(warbandsAt(state, 'p1')).toEqual({})
        expect(totalWarbandsAt(state, 'c1')).toBe(2)
        expect(totalWarbandsAt(state, 'p1')).toBe(0)
    })

    it('does not count an owner whose entry has fallen to zero', () => {
        const state = table({ c1: { [EXILE]: 0, [OTHER_EXILE]: 1 } })
        expect(totalWarbandsAt(state, 'c1')).toBe(1)
    })
})

describe('rule of a site (R-10.21)', () => {
    it('is held by a player with any of their warbands on it', () => {
        const state = table({ c1: { [EXILE]: 1 } })
        expect(rulesSite(state, EXILE, 'c1')).toBe(true)
        expect(rulersOfSite(state, 'c1')).toEqual([EXILE])
    })

    it('takes any number, not a majority', () => {
        expect(rulesSite(table({ c1: { [EXILE]: 1 } }), EXILE, 'c1')).toBe(true)
        expect(rulesSite(table({ c1: { [OTHER_EXILE]: 9 } }), OTHER_EXILE, 'c1')).toBe(true)
    })

    it('is not held by a player whose warbands have all left', () => {
        const state = table({ c1: { [EXILE]: 0 } })
        expect(rulesSite(state, EXILE, 'c1')).toBe(false)
        expect(rulersOfSite(state, 'c1')).toEqual([])
    })

    it('lists every site a player rules, anywhere on the map (R-5.5.2)', () => {
        const state = table({
            c1: { [EXILE]: 1 },
            p2: { [OTHER_EXILE]: 3 },
            h3: { [EXILE]: 2 }
        })
        expect(sitesRuledBy(state, EXILE)).toEqual(['c1', 'h3'])
    })
})

describe('Imperial sharing of rule (R-6.6.3)', () => {
    it('gives every Imperial player rule of a site holding Imperial warbands', () => {
        const state = table({ c1: { [IMPERIAL_WARBANDS]: 1 } })
        expect(rulesSite(state, CHANCELLOR, 'c1')).toBe(true)
        expect(rulesSite(state, CITIZEN, 'c1')).toBe(true)
        expect(rulersOfSite(state, 'c1').sort()).toEqual([CHANCELLOR, CITIZEN])
    })

    it('does not extend to Exiles', () => {
        const state = table({ c1: { [IMPERIAL_WARBANDS]: 1 } })
        expect(rulesSite(state, EXILE, 'c1')).toBe(false)
    })

    /** R-6.7 — exile replaces the warbands on a Citizen's board, not those left on the map. */
    it('leaves an exiled Citizen ruling nothing through Imperial warbands they left behind', () => {
        const state = table({ c1: { [IMPERIAL_WARBANDS]: 2 } })
        const citizen = state.getPlayerState(CITIZEN)
        citizen.status = PlayerStatus.Exile

        expect(rulesSite(state, CITIZEN, 'c1')).toBe(false)
        expect(rulesSite(state, CHANCELLOR, 'c1')).toBe(true)
    })
})

describe('Campaign-scoped Imperial status (R-5.5.1.a, R-10.12)', () => {
    it('makes the Chancellor Imperial always and Exiles never', () => {
        const state = table()
        expect(isImperialPlayer(state, CHANCELLOR)).toBe(true)
        expect(isImperialPlayer(state, CITIZEN)).toBe(true)
        expect(isImperialPlayer(state, EXILE)).toBe(false)
    })

    it('suspends a named player, and their share of the Imperial warbands with it', () => {
        const state = table({ c1: { [IMPERIAL_WARBANDS]: 1 } })
        const scope = { nonImperialPlayerIds: [CITIZEN] }

        expect(isImperialPlayer(state, CITIZEN, scope)).toBe(false)
        expect(rulesSite(state, CITIZEN, 'c1', scope)).toBe(false)
        expect(sitesRuledBy(state, CITIZEN, scope)).toEqual([])

        expect(rulesSite(state, CHANCELLOR, 'c1', scope)).toBe(true)
    })

    it('cannot suspend the Chancellor, who is Imperial always (R-10.12)', () => {
        const state = table({ c1: { [IMPERIAL_WARBANDS]: 1 } })
        const scope = { nonImperialPlayerIds: [CHANCELLOR] }

        expect(isImperialPlayer(state, CHANCELLOR, scope)).toBe(true)
        expect(rulesSite(state, CHANCELLOR, 'c1', scope)).toBe(true)
    })

    it('leaves a suspended Citizen ruling sites holding their own warbands', () => {
        // Unreachable in play, but R-10.21 rule follows whose warbands they are, not the status.
        const state = table({ c1: { [CITIZEN]: 1 } })
        expect(rulesSite(state, CITIZEN, 'c1', { nonImperialPlayerIds: [CITIZEN] })).toBe(true)
    })
})

describe('bandits (R-10.21, R-2.8.3)', () => {
    it('rule a site with no warbands on it', () => {
        expect(banditsRuleSite(table(), 'c1')).toBe(true)
        expect(banditsRuleSite(table({ c1: {} }), 'c1')).toBe(true)
        expect(banditsRuleSite(table({ c1: { [EXILE]: 0 } }), 'c1')).toBe(true)
    })

    it('do not rule a site any player has a warband on', () => {
        expect(banditsRuleSite(table({ c1: { [EXILE]: 1 } }), 'c1')).toBe(false)
        expect(banditsRuleSite(table({ c1: { [IMPERIAL_WARBANDS]: 1 } }), 'c1')).toBe(false)
    })

    it('never appear among the ruling players', () => {
        expect(rulersOfSite(table(), 'c1')).toEqual([])
    })
})

describe('enemies (R-10.7)', () => {
    it('every pair but two Imperial players, and nobody is their own enemy', () => {
        const state = table()
        expect(areEnemies(state, CHANCELLOR, CITIZEN)).toBe(false)
        expect(areEnemies(state, CHANCELLOR, EXILE)).toBe(true)
        expect(areEnemies(state, EXILE, OTHER_EXILE)).toBe(true)
        expect(areEnemies(state, EXILE, EXILE)).toBe(false)
    })

    it('a Citizen suspended for one Campaign is the Empire\'s enemy in it (R-5.5.1.a)', () => {
        const state = table()
        expect(areEnemies(state, CHANCELLOR, CITIZEN, { nonImperialPlayerIds: [CITIZEN] })).toBe(true)
    })
})

describe('Imperial sites (R-6.6.3)', () => {
    it('are the faceup sites holding Imperial warbands', () => {
        const state = table({ c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [EXILE]: 1 } })
        expect(isImperialSite(state, 'c1')).toBe(true)
        expect(isImperialSite(state, 'c2')).toBe(false)
        expect(isImperialSite(state, 'p1')).toBe(false)
    })
})

describe('the Bandit Crown at the rule seam (R-7.6.5)', () => {
    const CROWN = 'relic.bandit-crown'
    function crowned(holderId: string, warbandsBySite: Record<string, Record<string, number>> = {}) {
        const state = table(warbandsBySite)
        state.getPlayerState(holderId).relicIds = [CROWN]
        return state
    }

    it('gives its holder every faceup site with no warbands, and takes them from the bandits', () => {
        const state = crowned(EXILE, { c1: { [OTHER_EXILE]: 1 }, c2: { [EXILE]: 1 } })
        expect(rulesSite(state, EXILE, 'p1')).toBe(true)
        expect(rulersOfSite(state, 'p1')).toEqual([EXILE])
        expect(banditsRuleSite(state, 'p1')).toBe(false)
        expect(sitesRuledBy(state, EXILE)).toEqual(['c2', 'p1', 'p2', 'p3', 'h1', 'h2', 'h3'])
        expect(sitesRuledBy(state, OTHER_EXILE)).toEqual(['c1'])
    })

    it('stops at sites an enemy rules, and at facedown sites', () => {
        const state = crowned(EXILE, { c1: { [OTHER_EXILE]: 1 }, c2: { [IMPERIAL_WARBANDS]: 1 } })
        expect(banditsServe(state, EXILE, 'c1')).toBe(false)
        expect(banditsServe(state, EXILE, 'c2')).toBe(false)
        expect(rulesSite(state, EXILE, 'c1')).toBe(false)
        expect(banditsServe(state, EXILE, 'not-a-site')).toBe(false)
    })

    it('reads enemies through the Campaign\'s scope', () => {
        const state = crowned(CITIZEN, { c1: { [IMPERIAL_WARBANDS]: 1 } })
        expect(banditsServe(state, CITIZEN, 'c1')).toBe(true)
        expect(banditsServe(state, CITIZEN, 'c1', { nonImperialPlayerIds: [CITIZEN] })).toBe(false)
    })

    it('frees the last warband at a site the bandits hold for the holder (R-6.5)', () => {
        const state = crowned(EXILE, { c1: { [EXILE]: 2 } })
        expect(warbandsFreeToLeave(state, EXILE, 'c1', EXILE)).toBe(2)
        expect(warbandsFreeToLeave(table({ c1: { [EXILE]: 2 } }), EXILE, 'c1', EXILE)).toBe(1)
        expect(warbandsFreeToLeave(table(), EXILE, 'c1', EXILE)).toBe(0)
    })

    it('does nothing for anyone who does not hold it', () => {
        const state = crowned(EXILE)
        expect(rulesSite(state, OTHER_EXILE, 'p1')).toBe(false)
        expect(banditsServe(state, CHANCELLOR, 'p1')).toBe(false)
        expect(banditsRuleSite(table(), 'p1')).toBe(true)
    })
})

describe('the Bandit Crown for an Imperial holder: the bandits are the Empire\'s warbands (R-7.6.5, R-6.6.3)', () => {
    const CROWN = 'relic.bandit-crown'
    const IMPERIAL = [CHANCELLOR, CITIZEN]
    function crowned(
        oathRevision: OathRevision,
        holderId: string,
        warbandsBySite: Record<string, Record<string, number>> = {}
    ) {
        const state = table(warbandsBySite)
        state.oathRevision = oathRevision
        state.getPlayerState(holderId).relicIds = [CROWN]
        return state
    }
    const atRevision = OathRevision.EngineFixes2
    const before = OathRevision.CardFixes1

    it('a Citizen holder: every Imperial player rules the empty sites, and they are Imperial sites', () => {
        const state = crowned(atRevision, CITIZEN, { c1: { [EXILE]: 1 } })
        for (const siteId of ['c2', 'p1', 'h3']) {
            expect(rulersOfSite(state, siteId), siteId).toEqual(IMPERIAL)
            expect(isImperialSite(state, siteId), siteId).toBe(true)
        }
        expect(sitesRuledBy(state, CHANCELLOR)).toEqual(['c2', 'p1', 'p2', 'p3', 'h1', 'h2', 'h3'])
    })

    it('a Chancellor holder: the same', () => {
        const state = crowned(atRevision, CHANCELLOR)
        expect(rulersOfSite(state, 'p1')).toEqual(IMPERIAL)
        expect(isImperialSite(state, 'p1')).toBe(true)
        expect(sitesRuledBy(state, CITIZEN)).toHaveLength(8)
    })

    it('a Citizen suspended for a Campaign (R-5.5.1.a) has them in their own colour, alone', () => {
        const state = crowned(atRevision, CITIZEN)
        const scope = { nonImperialPlayerIds: [CITIZEN] }
        expect(rulersOfSite(state, 'p1')).toEqual(IMPERIAL)
        expect(rulersOfSite(state, 'p1', scope)).toEqual([CITIZEN])
        expect(isImperialSite(state, 'p1', scope)).toBe(false)
        expect(rulesSite(state, CHANCELLOR, 'p1', scope)).toBe(false)

        // The Chancellor's bandits are the Empire's still, and the suspended Citizen shares none.
        const chancellors = crowned(atRevision, CHANCELLOR)
        expect(rulersOfSite(chancellors, 'p1', scope)).toEqual([CHANCELLOR])
        expect(isImperialSite(chancellors, 'p1', scope)).toBe(true)
    })

    it('an Exile holder is unchanged: their own colour, theirs alone', () => {
        const state = crowned(atRevision, EXILE)
        expect(rulersOfSite(state, 'p1')).toEqual([EXILE])
        expect(isImperialSite(state, 'p1')).toBe(false)
        expect(rulesSite(state, CHANCELLOR, 'p1')).toBe(false)
    })

    it("an enemy Exile's warbands still keep the bandits out", () => {
        const state = crowned(atRevision, CITIZEN, { c1: { [EXILE]: 1 } })
        expect(rulersOfSite(state, 'c1')).toEqual([EXILE])
        expect(isImperialSite(state, 'c1')).toBe(false)
    })

    it("a fellow Imperial player's last warband may leave a served site, which stays the Empire's (R-6.5)", () => {
        const state = crowned(atRevision, CITIZEN, { c2: { [IMPERIAL_WARBANDS]: 1 } })
        expect(warbandsFreeToLeave(state, CHANCELLOR, 'c2', IMPERIAL_WARBANDS)).toBe(1)
        state.warbandsBySite.c2 = {}
        expect(rulersOfSite(state, 'c2')).toEqual(IMPERIAL)

        // An Exile's bandits are no Imperial player's: the Chancellor's last warband stays.
        const exiles = crowned(atRevision, EXILE, { c2: { [IMPERIAL_WARBANDS]: 1 } })
        expect(warbandsFreeToLeave(exiles, CHANCELLOR, 'c2', IMPERIAL_WARBANDS)).toBe(0)
    })

    it('R-X.4 — before the revision the empty sites were the holder\'s alone, and not Imperial', () => {
        for (const holderId of IMPERIAL) {
            const state = crowned(before, holderId, { c2: { [IMPERIAL_WARBANDS]: 1 } })
            expect(rulersOfSite(state, 'p1'), holderId).toEqual([holderId])
            expect(isImperialSite(state, 'p1'), holderId).toBe(false)
        }
        const citizens = crowned(before, CITIZEN, { c2: { [IMPERIAL_WARBANDS]: 1 } })
        expect(warbandsFreeToLeave(citizens, CHANCELLOR, 'c2', IMPERIAL_WARBANDS)).toBe(0)
        expect(warbandsFreeToLeave(citizens, CITIZEN, 'c2', IMPERIAL_WARBANDS)).toBe(1)
    })
})

describe('R-10.21 — bandit rule honours the faceup qualifier', () => {
    const site = (siteId: string): CampaignTarget => ({ kind: CampaignTargetKind.Site, siteId })

    function board() {
        const faceupSlots = ['c1', 'c2', 'p1', 'p2', 'p3', 'h1', 'h2']
        return testState(
            [
                testPlayer({
                    playerId: 'attacker',
                    color: Color.Red,
                    siteId: 'c1',
                    supply: 7,
                    warbandsOnBoard: { attacker: 3 }
                })
            ],
            {
                siteCards: Object.fromEntries(faceupSlots.map((s) => [s, s])),
                warbandsBySite: {}
            }
        )
    }

    it('R-10.21 — a facedown slot and a nonexistent id are ruled by nobody', () => {
        const state = board()
        expect(state.isSiteFaceup('h3')).toBe(false)
        expect(banditsRuleSite(state, 'h3')).toBe(false)
        expect(banditsRuleSite(state, 'no-such-site')).toBe(false)
    })

    it('R-10.21, R-5.5.2 — Campaign refuses facedown and nonexistent bandit site targets', () => {
        const state = board()
        for (const bogus of ['h3', 'no-such-site']) {
            const reason = HydratedCampaign.reasonCannotCampaign(state, 'attacker', {
                defender: { kind: 'bandits' },
                targets: [site('c1'), site(bogus)],
                attackDice: 2,
            })
            expect(reason, bogus).toBeDefined()
        }
        expect(
            HydratedCampaign.reasonCannotCampaign(state, 'attacker', {
                defender: { kind: 'bandits' },
                targets: [site('c1')],
                attackDice: 2,
            })
        ).toBeUndefined()
    })
})
