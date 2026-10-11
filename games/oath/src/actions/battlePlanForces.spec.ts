import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign } from './campaign.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction, joinDefence } from '../testing/actions.js'
import { battlePlanUse, site } from '../testing/choices.js'
import { defend } from '../testing/steps.js'
import { ongoingCampaign } from '../testing/required.js'
import { RunMode, engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const ENCIRCLEMENT = 'denizen.order.encirclement'
const ZEALOTS = 'denizen.discord.zealots'
const CAPTAINS = 'denizen.order.captains'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'

const atRevision = OathRevision.EngineFixes2
const before = OathRevision.CardFixes1

interface Sides {
    /** The defender's warbands at c2, the site Captains campaigns from. */
    defenderAtC2: number
    defenderBoard: number
    attackerAdvisers?: string[]
    defenderAdvisers?: string[]
}

/** `att` (pawn at c1, 4 on the board, 2 at c2) and `def`, who rules c2 and whose pawn is at c1. */
function table(oathRevision: number, sides: Sides) {
    const adv = (ids: string[] = []) => ids.map((cardId) => ({ cardId, faceUp: true }))
    const s = testState(
        withChancellor([
            testPlayer({ playerId: 'att', color: Color.Red, siteId: 'c1', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { att: 4 }, warbandsInPersonalBank: { att: 6 }, advisers: adv(sides.attackerAdvisers) }),
            testPlayer({ playerId: 'def', color: Color.Blue, siteId: 'c1', supply: 4, favor: 3, secrets: 2, warbandsOnBoard: { def: sides.defenderBoard }, warbandsInPersonalBank: { def: 5 }, advisers: adv(sides.defenderAdvisers) })
        ]),
        {
            oathRevision,
            denizensBySite: { c1: [CAPTAINS], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { att: 1, def: 2 }, c2: { att: 2, def: sides.defenderAtC2 }, p1: { def: 3 } }
        }
    )
    openTurn(s, 'att')
    return s
}

const useCaptains = () =>
    buildAction(UseActionPower, { playerId: 'att', cardId: CAPTAINS, powerIndex: powerIndexOf(CAPTAINS, PowerTiming.Action), choices: [site('c2')] })

/** Captains: the next Campaign acts from c2, so the attacking force is 6. */
function captainsTable(oathRevision: number, sides: Sides) {
    const s = table(oathRevision, sides)
    new HydratedUseActionPower(useCaptains()).apply(s)
    s.actionCount += 1
    return s
}

const fromC2 = (plans: string[]) =>
    buildAction(Campaign, {
        playerId: 'att',
        defender: { kind: 'player', playerId: 'def' },
        targets: [{ kind: CampaignTargetKind.Site, siteId: 'c2' }],
        attackDice: 3,
        plans: plans.map((cardId) => battlePlanUse(cardId))
    })

const campaignFromC2 = (plans: string[]) => new HydratedCampaign(fromC2(plans))

describe('R-10.9 — a battle plan counts the whole attacking force (revision 5)', () => {
    // 4 on the board and 2 at the Captains site, against a defending force of 5.
    const wholeForce = { defenderAtC2: 5, defenderBoard: 0 }

    it("Encirclement: the attacker's 6 beat the defender's 5, so it adds two dice", () => {
        const s = captainsTable(atRevision, { ...wholeForce, attackerAdvisers: [ENCIRCLEMENT] })
        campaignFromC2([ENCIRCLEMENT]).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(5)
    })

    it('Zealots: a defending force of 5 is not larger than a force of 6', () => {
        const s = captainsTable(atRevision, { ...wholeForce, attackerAdvisers: [ZEALOTS] })
        campaignFromC2([ZEALOTS]).apply(s)
        expect(ongoingCampaign(s).rollRules.zealots).toBe(false)
    })

    it("a defender's Encirclement compares their 5 with the attacker's whole 6, and adds nothing", () => {
        const s = captainsTable(atRevision, { ...wholeForce, defenderAdvisers: [ENCIRCLEMENT] })
        campaignFromC2([]).apply(s)
        defend([battlePlanUse(ENCIRCLEMENT)], 'def').apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(3)
    })

    it('Vow of Union: the warbands at every site the attacker rules are in the force Encirclement counts', () => {
        const s = testState(
            [
                testPlayer({ playerId: 'att', color: Color.Red, siteId: 'c1', supply: 6, favor: 4, warbandsOnBoard: { att: 2 }, advisers: [{ cardId: VOW_OF_UNION, faceUp: true }, { cardId: ENCIRCLEMENT, faceUp: true }] }),
                testPlayer({ playerId: 'def', color: Color.Blue, siteId: 'p1', favor: 3, warbandsOnBoard: { def: 3 } })
            ],
            { oathRevision: atRevision, denizensBySite: { c1: [], c2: [], p1: [], h1: [] }, warbandsBySite: { c1: { def: 3 }, c2: { att: 2 }, h1: { att: 1 } } }
        )
        openTurn(s, 'att')
        new HydratedCampaign(buildAction(Campaign, { playerId: 'att', defender: { kind: 'player', playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 3, plans: [battlePlanUse(ENCIRCLEMENT)] })).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(5)
    })

    it("an Imperial ally's board is in the defending force a defender's Encirclement counts", () => {
        const s = testState(
            [
                testPlayer({ playerId: 'att', color: Color.Red, status: PlayerStatus.Exile, siteId: 'h1', supply: 5, favor: 3, warbandsOnBoard: { att: 7 } }),
                testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 4, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, advisers: [{ cardId: ENCIRCLEMENT, faceUp: true }] }),
                testPlayer({ playerId: 'cit', color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'h1', favor: 1, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 } })
            ],
            { oathRevision: atRevision, chancellorPlayerId: 'chan', warbandsBySite: { h1: { [IMPERIAL_WARBANDS]: 3 } } }
        )
        openTurn(s, 'att')
        new HydratedCampaign(buildAction(Campaign, { playerId: 'att', defender: { kind: 'player', playerId: 'chan' }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'h1' }], attackDice: 3 })).apply(s)
        joinDefence(s, 'cit', 'chan')
        // 3 at h1, the Chancellor's 3 and the Citizen's 2: 8 against 7.
        defend([battlePlanUse(ENCIRCLEMENT)], 'chan').apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(1)
    })
})

describe("R-5.5.1 — the attacker's plans judge the defending force from the site Captains names (revision 5)", () => {
    // The defender's board is out of the battle: their pawn is at c1, not at c2.
    const boardAway = { defenderAtC2: 3, defenderBoard: 4 }

    it("Encirclement: 6 against the 3 at c2, not against the defender's board as well", () => {
        const s = captainsTable(atRevision, { ...boardAway, attackerAdvisers: [ENCIRCLEMENT] })
        campaignFromC2([ENCIRCLEMENT]).apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(5)
    })

    it('Zealots: the 3 at c2 are no larger than a force of 6', () => {
        const s = captainsTable(atRevision, { ...boardAway, attackerAdvisers: [ZEALOTS] })
        campaignFromC2([ZEALOTS]).apply(s)
        expect(ongoingCampaign(s).rollRules.zealots).toBe(false)
    })

    it('the roll counts the same defending force the plans judged', () => {
        const s = captainsTable(atRevision, { ...boardAway, attackerAdvisers: [ZEALOTS] })
        campaignFromC2([ZEALOTS]).apply(s)
        expect(ongoingCampaign(s).defendingForce).toEqual([{ at: { kind: 'site', siteId: 'c2' }, owner: 'def', count: 3 }])
    })
})

describe('R-X.4 — a game created before revision 5 counts the board alone, judged from the pawn', () => {
    it('Encirclement and Zealots as they were: 4 against 5 adds nothing, and Zealots applies', () => {
        const encircled = captainsTable(before, { defenderAtC2: 5, defenderBoard: 0, attackerAdvisers: [ENCIRCLEMENT] })
        campaignFromC2([ENCIRCLEMENT]).apply(encircled)
        expect(ongoingCampaign(encircled).attackPool).toBe(3)
        const zealous = captainsTable(before, { defenderAtC2: 3, defenderBoard: 4, attackerAdvisers: [ZEALOTS] })
        campaignFromC2([ZEALOTS]).apply(zealous)
        expect(ongoingCampaign(zealous).rollRules.zealots).toBe(true)
    })

    it("a defender's Encirclement against the attacker's board alone", () => {
        const s = captainsTable(before, { defenderAtC2: 5, defenderBoard: 0, defenderAdvisers: [ENCIRCLEMENT] })
        campaignFromC2([]).apply(s)
        defend([battlePlanUse(ENCIRCLEMENT)], 'def').apply(s)
        expect(ongoingCampaign(s).attackPool).toBe(1)
    })

    function recordAndReplay(oathRevision: number) {
        const initial = table(oathRevision, { defenderAtC2: 3, defenderBoard: 4, attackerAdvisers: [ZEALOTS] }).dehydrate()
        const game = testGame(['att', 'def', 'chancellor'])
        const captains = engine.runNext(useCaptains(), structuredClone(initial), game)
        const recorded = engine.runNext(fromC2([ZEALOTS]), structuredClone(captains.updatedState), game)
        let replayed = structuredClone(initial)
        for (const action of [...captains.processedActions, ...recorded.processedActions]) {
            replayed = engine.run(structuredClone(action), replayed, game, RunMode.Single).updatedState
        }
        expect(replayed).toEqual(recorded.updatedState)
        return recorded.updatedState.campaign
    }

    it('a Captains Campaign with Zealots replays unchanged at revision 4 and at revision 5', () => {
        expect(recordAndReplay(before)?.rollRules.zealots).toBe(true)
        expect(recordAndReplay(atRevision)?.rollRules.zealots).toBe(false)
    })
})
