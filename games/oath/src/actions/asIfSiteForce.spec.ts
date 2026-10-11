import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign, type CampaignDefender } from './campaign.js'
import { HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { CampaignTargetKind, type LossSource, type WarbandGroup } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { collectAttackingForce, type CampaignParties } from '../util/campaign.js'
import { attackingForceSources, killFromAttackingForce } from '../util/campaignRoll.js'
import { forceTotal } from '../util/force.js'
import { warbandsAt } from '../util/rule.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, site } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import { HydratedOathGameState } from '../model/gameState.js'
import '../powers/index.js'

const CAPTAINS = 'denizen.order.captains'
const WILD_ALLIES = 'denizen.beast.wild-allies'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const ENCIRCLEMENT = 'denizen.order.encirclement'
const WOLVES = 'denizen.beast.wolves'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

interface Table {
    oathRevision: number
    citizenAdvisers?: string[]
    /** A second Citizen, `cit2`, away at h1 with 2 Imperial warbands on the board. */
    secondCitizen?: boolean
    /** The Chancellor's pawn; at h1 it is out of every battle here. */
    chancellorAt?: string
    /** The Empire's warbands at c2, the site Captains or Wild Allies names. */
    empireAtC2?: number
}

/**
 * `cit`, a Citizen at c1 with 3 Imperial warbands on the board (R-6.6.2: a Citizen has no colour of
 * their own on the map). The Empire's warbands alone hold c1 (Captains is there) and c2 (Wolves, a
 * beast card, is there), so `cit` rules both only as an Imperial player.
 */
function table({ oathRevision, citizenAdvisers = [], secondCitizen = false, chancellorAt = 'h1', empireAtC2 = 2 }: Table) {
    const s = testState(
        [
            testPlayer({ playerId: 'cit', color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, advisers: citizenAdvisers.map((cardId) => ({ cardId, faceUp: true })) }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: chancellorAt, supply: 5, favor: 4, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 } }),
            ...(secondCitizen ? [testPlayer({ playerId: 'cit2', color: Color.Green, status: PlayerStatus.Citizen, siteId: 'h1', supply: 5, favor: 2, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 } })] : [])
        ],
        {
            oathRevision,
            denizensBySite: { c1: [CAPTAINS], c2: [WOLVES], p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [IMPERIAL_WARBANDS]: empireAtC2 } }
        }
    )
    openTurn(s, 'cit')
    return s
}

const useCaptains = () =>
    buildAction(UseActionPower, { playerId: 'cit', cardId: CAPTAINS, powerIndex: powerIndexOf(CAPTAINS, PowerTiming.Action), choices: [site('c2')] })
const useWildAllies = () =>
    buildAction(UseActionPower, { playerId: 'cit', cardId: WILD_ALLIES, powerIndex: powerIndexOf(WILD_ALLIES, PowerTiming.Action), choices: [site('c2')] })

/** The card is used; the next action is the Campaign from c2. */
function actingFromC2(s: HydratedOathGameState, card: 'captains' | 'wild allies') {
    new HydratedUseActionPower(card === 'captains' ? useCaptains() : useWildAllies()).apply(s)
    s.actionCount += 1
    return s
}

const againstChancellor: CampaignDefender = { kind: 'player', playerId: 'chan' }
const againstCitizen: CampaignDefender = { kind: 'player', playerId: 'cit2' }
const target = (siteId: string) => [{ kind: CampaignTargetKind.Site as const, siteId }]
const fromSite = (siteId: string): LossSource => ({ at: { kind: 'site', siteId }, owner: IMPERIAL_WARBANDS })

const campaign = (defender: CampaignDefender, attackDice: number, targetSiteId = 'c2', plans: string[] = [], skullLossOrder?: LossSource[]) =>
    buildAction(Campaign, { playerId: 'cit', defender, targets: target(targetSiteId), attackDice, plans: plans.map(battlePlanUse), skullLossOrder })

/** R-5.5.2 — a target at "your site": c2 once Captains or Wild Allies names it, c1 (the pawn's) otherwise. */
const reason = (s: HydratedOathGameState, defender: CampaignDefender, attackDice: number, skullLossOrder?: LossSource[], targetSiteId = 'c2') =>
    HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender, targets: target(targetSiteId), attackDice, skullLossOrder })

const partiesAgainst = (s: HydratedOathGameState, defender: CampaignDefender, targetSiteId = 'c2'): CampaignParties =>
    HydratedCampaign.partiesFor(s, 'cit', { defender, targets: target(targetSiteId) })

const placeKey = (group: Pick<WarbandGroup, 'at' | 'owner'>) =>
    `${group.at.kind === 'board' ? `board:${group.at.playerId}` : `site:${group.at.siteId}`}/${group.owner}`

/** Both seams: the force the dice cap, the plans and the sacrifice read, and the places the skulls kill from. */
function seams(s: HydratedOathGameState, parties: CampaignParties) {
    return {
        force: collectAttackingForce(s, parties).map(placeKey).sort(),
        sources: attackingForceSources(s, parties, parties.forceSiteIds).map(placeKey).sort()
    }
}

describe("Captains' Q&A — a Citizen attacking the Chancellor or a Citizen still adds the warbands at the site to their force (revision 5)", () => {
    for (const [name, defender, secondCitizen] of [
        ['the Chancellor', againstChancellor, false],
        ['another Citizen', againstCitizen, true]
    ] as const) {
        it(`against ${name}: the dice cap counts the 2 at c2 beside the 3 on the board, and the loss order may name c2`, () => {
            const s = actingFromC2(table({ oathRevision: atRevision, secondCitizen }), 'captains')
            expect(reason(s, defender, 6)).toMatch(/at most 5 attack dice/)
            expect(reason(s, defender, 5)).toBeUndefined()
            expect(reason(s, defender, 5, [fromSite('c2')])).toBeUndefined()
            expect(HydratedCampaign.maxAttackDice(s, partiesAgainst(s, defender))).toBe(5)
        })
    }

    it("targeting the Captains site (R-5.5.2: a target at your site): they are in the sacrifice list and the skulls' kills, not in the defending force", () => {
        const s = actingFromC2(table({ oathRevision: atRevision }), 'captains')
        new HydratedCampaign(campaign(againstChancellor, 0)).apply(s)
        const running = ongoingCampaign(s)
        expect(running.forceSiteIds).toEqual(['c2'])
        expect(running.defendingForce).toEqual([])
        expect(HydratedCampaignSacrifice.attackerForce(s, running)).toContainEqual({ at: { kind: 'site', siteId: 'c2' }, owner: IMPERIAL_WARBANDS, count: 2 })

        expect(killFromAttackingForce(s, running, 1, [fromSite('c2')])).toEqual([{ at: { kind: 'site', siteId: 'c2' }, owner: IMPERIAL_WARBANDS, count: 1 }])
        expect(warbandsAt(s, 'c2')[IMPERIAL_WARBANDS]).toBe(1)
        expect(s.getPlayerState('cit').warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(3)
    })

    it("with the Chancellor's pawn there too: the defending force is the Chancellor's board alone", () => {
        const s = actingFromC2(table({ oathRevision: atRevision, chancellorAt: 'c2' }), 'captains')
        const targets = [...target('c2'), { kind: CampaignTargetKind.PawnAndFavor as const }]
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: againstChancellor, targets, attackDice: 6 })).toMatch(/at most 5 attack dice/)
        new HydratedCampaign(buildAction(Campaign, { playerId: 'cit', defender: againstChancellor, targets, attackDice: 0 })).apply(s)
        expect(ongoingCampaign(s).defendingForce).toEqual([{ at: { kind: 'board', playerId: 'chan' }, owner: IMPERIAL_WARBANDS, count: 4 }])
    })

    it('Encirclement counts them: 3 on the board and 3 at c2 against no defending warband, so it adds two dice', () => {
        const s = actingFromC2(table({ oathRevision: atRevision, citizenAdvisers: [ENCIRCLEMENT], empireAtC2: 3 }), 'captains')
        new HydratedCampaign(campaign(againstChancellor, 3, 'c2', [ENCIRCLEMENT])).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(5)
    })
})

describe('Wild Allies follows Captains: the same words, so the same answer (revision 5)', () => {
    for (const [name, defender, secondCitizen] of [
        ['the Chancellor', againstChancellor, false],
        ['another Citizen', againstCitizen, true]
    ] as const) {
        it(`against ${name}: the 2 at c2 are in the force`, () => {
            const s = actingFromC2(table({ oathRevision: atRevision, citizenAdvisers: [WILD_ALLIES], secondCitizen }), 'wild allies')
            expect(reason(s, defender, 6)).toMatch(/at most 5 attack dice/)
            expect(reason(s, defender, 5, [fromSite('c2')])).toBeUndefined()
        })
    }
})

describe("Vow of Union's Q&A — a Citizen attacking the Chancellor adds no purple warbands at the sites it reaches (revision 5)", () => {
    it('Vow of Union alone: the board only', () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [VOW_OF_UNION] })
        expect(partiesAgainst(s, againstChancellor).forceSiteIds).toEqual(['c1', 'c2'])
        expect(reason(s, againstChancellor, 4, undefined, 'c1')).toMatch(/at most 3 attack dice/)
        expect(reason(s, againstChancellor, 3, [fromSite('c2')], 'c1')).toMatch(/not in your force/)
    })

    it('Vow of Union with Captains: the Captains site counts, as its Q&A rules; the other Vow site does not', () => {
        const s = actingFromC2(table({ oathRevision: atRevision, citizenAdvisers: [VOW_OF_UNION] }), 'captains')
        expect(partiesAgainst(s, againstChancellor).forceSiteIds).toEqual(['c2', 'c1'])
        expect(reason(s, againstChancellor, 6)).toMatch(/at most 5 attack dice/)
        expect(reason(s, againstChancellor, 5, [fromSite('c2')])).toBeUndefined()
        expect(reason(s, againstChancellor, 5, [fromSite('c1')])).toMatch(/not in your force/)
    })
})

describe('R-5.5.2 — the dice cap and the loss sources read one force', () => {
    it('both seams name the same places and owners, and the cap is that force', () => {
        const cases: [string, HydratedOathGameState, CampaignDefender, string[]][] = [
            ['Captains', actingFromC2(table({ oathRevision: atRevision }), 'captains'), againstChancellor, ['site:c2/imperial']],
            ['Captains, against a Citizen', actingFromC2(table({ oathRevision: atRevision, secondCitizen: true }), 'captains'), againstCitizen, ['site:c2/imperial']],
            ['Wild Allies', actingFromC2(table({ oathRevision: atRevision, citizenAdvisers: [WILD_ALLIES] }), 'wild allies'), againstChancellor, ['site:c2/imperial']],
            ['Vow of Union with Captains', actingFromC2(table({ oathRevision: atRevision, citizenAdvisers: [VOW_OF_UNION] }), 'captains'), againstChancellor, ['site:c2/imperial']],
            ['Vow of Union', table({ oathRevision: atRevision, citizenAdvisers: [VOW_OF_UNION] }), againstChancellor, []],
            ['Captains at revision 4', actingFromC2(table({ oathRevision: before }), 'captains'), againstChancellor, ['site:c2/imperial']]
        ]
        for (const [name, s, defender, sites] of cases) {
            const parties = partiesAgainst(s, defender)
            const { force, sources } = seams(s, parties)
            expect(force, name).toEqual(sources)
            expect(force.filter((key) => key.startsWith('site:')), name).toEqual(sites)
            expect(HydratedCampaign.maxAttackDice(s, parties), name).toBe(forceTotal(collectAttackingForce(s, parties)))
        }
    })
})

describe('R-X.4 — before revision 5 the Captains site already counted', () => {
    it('Captains and Wild Allies add the 2 at c2, and Vow of Union its sites, as they always did', () => {
        const captains = actingFromC2(table({ oathRevision: before }), 'captains')
        expect(reason(captains, againstChancellor, 6)).toMatch(/at most 5 attack dice/)
        expect(reason(captains, againstChancellor, 5, [fromSite('c2')])).toBeUndefined()
        const wildAllies = actingFromC2(table({ oathRevision: before, citizenAdvisers: [WILD_ALLIES] }), 'wild allies')
        expect(reason(wildAllies, againstChancellor, 5)).toBeUndefined()
        const vow = table({ oathRevision: before, citizenAdvisers: [VOW_OF_UNION] })
        expect(reason(vow, againstChancellor, 6, undefined, 'c1')).toBeUndefined()
    })

    it('a targeted Captains site still defends with the warbands its force counts', () => {
        const s = actingFromC2(table({ oathRevision: before }), 'captains')
        new HydratedCampaign(campaign(againstChancellor, 0, 'c2')).apply(s)
        expect(ongoingCampaign(s).defendingForce).toEqual([{ at: { kind: 'site', siteId: 'c2' }, owner: IMPERIAL_WARBANDS, count: 2 }])
    })

    function recordAndReplay(oathRevision: number) {
        const initial = table({ oathRevision }).dehydrate()
        const game = testGame(['cit', 'chan'])
        const captains = engine.runNext(useCaptains(), structuredClone(initial), game)
        const recorded = engine.runNext(campaign(againstChancellor, 5, 'c2', [], [fromSite('c2')]), structuredClone(captains.updatedState), game)
        let replayed = structuredClone(initial)
        for (const action of [...captains.processedActions, ...recorded.processedActions]) {
            replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        }
        expect(replayed).toEqual(recorded.updatedState)
        return recorded.updatedState
    }

    it('a Citizen’s Captains Campaign of 5 dice against the Chancellor is accepted and replays at revision 4 and at revision 5', () => {
        for (const oathRevision of [before, atRevision]) {
            expect(recordAndReplay(oathRevision).campaign?.attackerPlayerId, `revision ${oathRevision}`).toBe('cit')
        }
    })
})
