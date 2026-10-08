import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign, type CampaignDefender } from './campaign.js'
import { HydratedCampaignDefend } from './campaignDefend.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from './campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from './campaignResolveVictory.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PowerQuestionKind } from '../model/question.js'
import { BattlePlanSide, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { warbandsAt } from '../util/rule.js'
import { testBanners, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse, siteWarbands } from '../testing/choices.js'
import { defend } from '../testing/steps.js'
import { ongoingCampaign } from '../testing/required.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import { HydratedOathGameState } from '../model/gameState.js'
import '../powers/index.js'

const GREAT_CRUSADE = 'denizen.nomad.great-crusade'
const TENTS = 'denizen.nomad.tents'
const HORSE_ARCHERS = 'denizen.nomad.horse-archers'
const KINDRED_WARRIORS = 'denizen.arcane.kindred-warriors'
const FIRE_TALKERS = 'denizen.arcane.fire-talkers'
const LONGBOWS = 'denizen.order.longbows'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const WARNING_SIGNALS = 'denizen.nomad.warning-signals'
const WILD_MOUNTS = 'denizen.nomad.wild-mounts'
const HOSPITAL = 'denizen.hearth.hospital'
const WOLVES = 'denizen.beast.wolves'
const EXTRA_PROVISIONS = 'denizen.hearth.extra-provisions'
const ENCIRCLEMENT = 'denizen.order.encirclement'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

interface Table {
    oathRevision: number
    citizenAdvisers?: string[]
    /** The cards at c2, a site only the Empire's warbands rule. */
    atEmpireSite?: string[]
    darkestSecret?: string
    /** An Exile, `ex`, at c1 with 8 warbands on the board. */
    withExile?: boolean
}

/** `cit` (a Citizen, 4 of their own on the board) and `chan` at c1; the Empire's warbands hold c1 and c2. */
function table({ oathRevision, citizenAdvisers = [], atEmpireSite = [], darkestSecret, withExile = false }: Table) {
    const s = testState(
        [
            testPlayer({ playerId: 'cit', color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { cit: 4 }, advisers: citizenAdvisers.map((cardId) => ({ cardId, faceUp: true })) }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1', supply: 5, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 } }),
            ...(withExile ? [testPlayer({ playerId: 'ex', color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 5, favor: 2, warbandsOnBoard: { ex: 8 } })] : [])
        ],
        {
            oathRevision,
            banners: testBanners(darkestSecret ? { [Banner.DarkestSecret]: darkestSecret } : {}),
            denizensBySite: { c1: [], c2: atEmpireSite, p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 }, c2: { [IMPERIAL_WARBANDS]: 2 } }
        }
    )
    openTurn(s, 'cit')
    return s
}

const againstChancellor: CampaignDefender = { kind: 'player', playerId: 'chan' }
const atC1 = [{ kind: CampaignTargetKind.Site as const, siteId: 'c1' }]
const citizenAttacks = (plans: string[], attackDice = 3) =>
    buildAction(Campaign, { playerId: 'cit', defender: againstChancellor, targets: atC1, attackDice, plans: plans.map(battlePlanUse) })

/** No sacrifice, the defending side's losses, and a victory that takes nothing. */
function finish(s: HydratedOathGameState, attackerId: string) {
    new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: attackerId, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })).apply(s)
    defendingSideChooses(s)
    if (s.campaign) new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: attackerId, placements: [], burnFavor: false })).apply(s)
}

describe('R-5.5.1.a — a Citizen campaigning against the Chancellor shares none of the Empire’s sites (revision 5)', () => {
    it('Great Crusade counts no nomad card at a site only the Empire rules', () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [GREAT_CRUSADE], atEmpireSite: [TENTS] })
        new HydratedCampaign(citizenAttacks([GREAT_CRUSADE])).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(4)
    })

    it('a plan at a site only the Empire rules is refused, and is not listed', () => {
        const s = table({ oathRevision: atRevision, atEmpireSite: [HORSE_ARCHERS] })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: againstChancellor, targets: atC1, attackDice: 3, plans: [battlePlanUse(HORSE_ARCHERS)] })).toMatch(/do not rule denizen.nomad.horse-archers/)
        const parties = HydratedCampaign.partiesFor(s, 'cit', { defender: againstChancellor, targets: atC1 })
        expect(usableBattlePlans(s, 'cit', BattlePlanSide.Attacker, parties).map((p) => p.cardId)).not.toContain(HORSE_ARCHERS)
    })

    it('Kindred Warriors counts no suit ruled only through the Empire’s site', () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [KINDRED_WARRIORS], atEmpireSite: [TENTS, LONGBOWS] })
        new HydratedCampaign(citizenAttacks([KINDRED_WARRIORS])).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(3)
    })

    it('Fire Talkers does not count the Darkest Secret the Chancellor holds', () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [FIRE_TALKERS], darkestSecret: 'chan' })
        new HydratedCampaign(citizenAttacks([FIRE_TALKERS])).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(3)
    })

    it("Vow of Union: the Empire's warbands at the sites it reaches are not in the force", () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [VOW_OF_UNION] })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: againstChancellor, targets: atC1, attackDice: 5 })).toMatch(/at most 4 attack dice/)
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: againstChancellor, targets: atC1, attackDice: 4, skullLossOrder: [{ at: { kind: 'site', siteId: 'c2' }, owner: IMPERIAL_WARBANDS }] })).toMatch(/not in your force/)
        new HydratedCampaign(citizenAttacks([], 4)).apply(s)
        expect(ongoingCampaign(s).forceSiteIds).toEqual(['c1', 'c2'])
        expect(HydratedCampaignSacrifice.attackerForce(s, ongoingCampaign(s)).map((g) => g.at)).toEqual([{ kind: 'board', playerId: 'cit' }])
    })

    it("Encirclement counts no Imperial warband at a site its force reaches: 4 on the board against the Chancellor's 5", () => {
        for (const oathRevision of [atRevision, before]) {
            const s = table({ oathRevision, citizenAdvisers: [VOW_OF_UNION, ENCIRCLEMENT] })
            new HydratedCampaign(citizenAttacks([ENCIRCLEMENT])).apply(s)
            expect(ongoingCampaign(s).attackPool, `revision ${oathRevision}`).toBe(3)
        }
    })

    it('Wild Mounts offers no beast card at a site only the Empire rules', () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [WILD_MOUNTS, HORSE_ARCHERS], atEmpireSite: [WOLVES] })
        new HydratedCampaign(citizenAttacks([WILD_MOUNTS, HORSE_ARCHERS])).apply(s)
        Object.assign(ongoingCampaign(s), { swords: 0, defense: 9 })
        finish(s, 'cit')
        expect(s.pendingQuestions?.queue.filter((q) => q.kind === PowerQuestionKind.DiscardInstead) ?? []).toEqual([])
    })
})

describe('R-5.5.1.a — a Citizen the Chancellor attacks shares none of the Empire’s sites (revision 5)', () => {
    /** `chan` attacks `cit`, who rules c1 with a warband of their own beside the Empire's. */
    function attacked(oathRevision: number, citizenAdvisers: string[], cards: { atC1?: string[]; atEmpireSite?: string[] } = {}) {
        const s = table({ oathRevision, citizenAdvisers, atEmpireSite: cards.atEmpireSite })
        s.warbandsBySite.c1 = { cit: 1, [IMPERIAL_WARBANDS]: 1 }
        s.denizensBySite.c1 = cards.atC1 ?? []
        openTurn(s, 'chan')
        new HydratedCampaign(buildAction(Campaign, { playerId: 'chan', defender: { kind: 'player', playerId: 'cit' }, targets: atC1, attackDice: 2 })).apply(s)
        return s
    }

    it('the defender is not offered a plan at a site only the Empire rules', () => {
        const s = attacked(atRevision, [EXTRA_PROVISIONS], { atEmpireSite: [HORSE_ARCHERS] })
        expect(HydratedCampaignDefend.usablePlans(s, 'cit').map((p) => p.cardId)).toEqual([EXTRA_PROVISIONS])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'cit', [battlePlanUse(HORSE_ARCHERS)])).toMatch(/do not rule denizen.nomad.horse-archers/)
    })

    it('Warning Signals cannot move warbands off a site only the Empire rules', () => {
        const s = attacked(atRevision, [WARNING_SIGNALS])
        const offEmpireSite = { cardId: WARNING_SIGNALS, powerIndex: powerIndexOf(WARNING_SIGNALS, PowerTiming.BattlePlan), choices: [siteWarbands('c2', IMPERIAL_WARBANDS, 1)] }
        expect(HydratedCampaignDefend.reasonCannotDefend(s, 'cit', [offEmpireSite])).toBeDefined()
    })

    it("Hospital: a site held only by the Empire's warbands at the end is not one its user still rules", () => {
        const s = attacked(atRevision, [], { atC1: [HOSPITAL] })
        defend([battlePlanUse(HOSPITAL)], 'cit').apply(s)
        Object.assign(ongoingCampaign(s), { swords: 9, defense: 0 })
        finish(s, 'chan')
        expect(warbandsAt(s, 'c1')['cit'] ?? 0).toBe(0)
    })
})

describe('R-6.6.3 — an Imperial Campaign still shares the Empire’s sites', () => {
    /** `ex` attacks `cit`; the Chancellor joins the defence. */
    function exileAttacks(citizenAdvisers: string[], atEmpireSite: string[], darkestSecret?: string) {
        const s = table({ oathRevision: atRevision, citizenAdvisers, atEmpireSite, darkestSecret, withExile: true })
        openTurn(s, 'ex')
        new HydratedCampaign(buildAction(Campaign, { playerId: 'ex', defender: { kind: 'player', playerId: 'cit' }, targets: atC1, attackDice: 8 })).apply(s)
        return s
    }

    it('the Citizen defending beside the Chancellor may use a plan at the Empire’s site', () => {
        const s = exileAttacks([], [HORSE_ARCHERS])
        expect(ongoingCampaign(s).allyPlayerIds).toEqual(['chan'])
        expect(HydratedCampaignDefend.usablePlans(s, 'cit').map((p) => p.cardId)).toContain(HORSE_ARCHERS)
    })

    it('Great Crusade, Kindred Warriors and Fire Talkers count the Empire’s site and the Chancellor’s Darkest Secret', () => {
        const s = exileAttacks([GREAT_CRUSADE, KINDRED_WARRIORS, FIRE_TALKERS], [TENTS, LONGBOWS], 'chan')
        defend([battlePlanUse(GREAT_CRUSADE), battlePlanUse(KINDRED_WARRIORS), battlePlanUse(FIRE_TALKERS)], 'cit').apply(s)
        // 8 − 2 (Great Crusade and Tents) − 2 (nomad and order) − 3 (the Chancellor's Darkest Secret).
        expect(ongoingCampaign(s).attackPool).toBe(1)
    })

    it("a Citizen attacking an Exile counts the Empire's warbands at the sites Vow of Union reaches", () => {
        const s = table({ oathRevision: atRevision, citizenAdvisers: [VOW_OF_UNION], withExile: true })
        s.warbandsBySite.c1 = { [IMPERIAL_WARBANDS]: 1, ex: 1 }
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: { kind: 'player', playerId: 'ex' }, targets: atC1, attackDice: 7 })).toBeUndefined()
    })
})

describe('R-X.4 — before revision 5 a suspended Citizen still shared the Empire’s sites', () => {
    it('Great Crusade counted the nomad card at the Empire’s site', () => {
        const s = table({ oathRevision: before, citizenAdvisers: [GREAT_CRUSADE], atEmpireSite: [TENTS] })
        new HydratedCampaign(citizenAttacks([GREAT_CRUSADE])).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(5)
    })

    it('a plan at the Empire’s site was accepted', () => {
        const s = table({ oathRevision: before, atEmpireSite: [HORSE_ARCHERS] })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: againstChancellor, targets: atC1, attackDice: 3, plans: [battlePlanUse(HORSE_ARCHERS)] })).toBeUndefined()
    })

    it('Fire Talkers and Kindred Warriors counted through the Empire', () => {
        const s = table({ oathRevision: before, citizenAdvisers: [FIRE_TALKERS, KINDRED_WARRIORS], atEmpireSite: [TENTS, LONGBOWS], darkestSecret: 'chan' })
        new HydratedCampaign(citizenAttacks([FIRE_TALKERS, KINDRED_WARRIORS])).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(3 + 3 + 2)
    })

    it("Vow of Union's force counted the Empire's warbands", () => {
        const s = table({ oathRevision: before, citizenAdvisers: [VOW_OF_UNION] })
        expect(HydratedCampaign.reasonCannotCampaign(s, 'cit', { defender: againstChancellor, targets: atC1, attackDice: 7 })).toBeUndefined()
    })

    it('a Great Crusade Campaign recorded at revision 4 and at revision 5 each replays as recorded', () => {
        for (const [oathRevision, pool] of [[before, 5], [atRevision, 4]]) {
            const start = table({ oathRevision, citizenAdvisers: [GREAT_CRUSADE], atEmpireSite: [TENTS] }).dehydrate()
            const game = testGame(['cit', 'chan'])
            const recorded = engine.runNext(citizenAttacks([GREAT_CRUSADE]), structuredClone(start), game)
            expect(recorded.updatedState.campaign?.attackPool).toBe(pool)

            let replayed = structuredClone(start)
            for (const action of recorded.processedActions) replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
            expect(replayed).toEqual(recorded.updatedState)
        }
    })
})
