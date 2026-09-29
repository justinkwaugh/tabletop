import { PowerChoiceKind } from '../util/powerChoice.js'
import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { attackFromFaces, defenseShieldsFromFaces } from '../data/dice.js'
import { forceTotal } from '../util/force.js'
import { PowerQuestionKind } from '../model/question.js'
import '../powers/index.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { joinDefence } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ATTACKER, DEFENDER, campaign, defend, finishCampaign, finishCampaignSteps } from '../testing/steps.js'

const ALLY = 'ally'

function table(
    over: Record<string, unknown> = {},
    advisers: { attacker?: string[]; defender?: string[] } = {},
    players: Record<string, Record<string, unknown>> = {},
    seed = 1
) {
    return testState(
        [
            testPlayer({
                playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 5, favor: 4, secrets: 3,
                warbandsOnBoard: { [Color.Red]: 5 }, warbandsInPersonalBank: { [Color.Red]: 7 },
                advisers: (advisers.attacker ?? []).map((cardId) => ({ cardId, faceUp: true })),
                ...players[ATTACKER]
            }),
            testPlayer({
                playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'p1', favor: 6, secrets: 3,
                warbandsOnBoard: { [Color.Yellow]: 4 }, warbandsInPersonalBank: { [Color.Yellow]: 6 },
                advisers: (advisers.defender ?? []).map((cardId) => ({ cardId, faceUp: true })),
                ...players[DEFENDER]
            })
        ],
        {
            warbandsBySite: { c1: { [Color.Yellow]: 1 }, p1: { [Color.Yellow]: 3 } },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            prng: { seed, invocations: 0 },
            ...over
        }
    )
}

/** The dice come from the seeded PRNG, so a test searches seeds for the outcome it needs. */
function battleWhere(wantVictory: boolean, build: (seed: number) => ReturnType<typeof table>, act: (s: ReturnType<typeof table>) => void) {
    for (let seed = 1; seed < 40; seed++) {
        const s = build(seed)
        act(s)
        const won = ongoingCampaign(s).swords > ongoingCampaign(s).defense
        if (won === wantVictory) return s
    }
    throw new Error('no seed gave that outcome')
}

describe('the ± sign is by side (R-7.5.4-H1)', () => {
    it('Horse Archers: +3 attack dice for the attacker, −3 for the defender with underflow into defense', () => {
        const s = table({ denizensBySite: { c1: ['denizen.nomad.horse-archers'], c2: [], p1: [], h1: [] } })
        // The defender rules c1, so the card is theirs to use.
        const a = campaign()
        a.apply(s)
        expect(s.campaign?.attackPool).toBe(3)
        defend([battlePlanUse('denizen.nomad.horse-archers')]).apply(s)
        expect(s.campaign?.attackPool).toBe(0)
        expect(s.campaign?.defensePool).toBe(1)
        expect(s.campaign?.discardAtEnd).toEqual(['denizen.nomad.horse-archers'])

        const t = table({}, { attacker: ['denizen.nomad.horse-archers'] })
        campaign({ plans: [battlePlanUse('denizen.nomad.horse-archers')] }).apply(t)
        expect(t.campaign?.attackPool).toBe(6)
    })

    it('Mountain Giant: ±1 and kept, or ±3 and discarded, as its user chooses (its Q&A)', () => {
        const GIANT = 'denizen.nomad.mountain-giant'
        const one = table({}, { attacker: [GIANT] })
        campaign({ plans: [battlePlanUse(GIANT)] }).apply(one)
        expect(one.campaign?.attackPool).toBe(4)
        expect(one.campaign?.discardAtEnd).toEqual([])

        const three = table({}, { attacker: [GIANT] })
        campaign({ plans: [{ ...battlePlanUse(GIANT), choices: [{ kind: PowerChoiceKind.Yes }] }] }).apply(three)
        expect(three.campaign?.attackPool).toBe(6)
        expect(three.campaign?.discardAtEnd).toEqual([GIANT])
    })

    it('Code of Honor: ±2 and nothing else alongside it', () => {
        const s = table({}, { attacker: ['denizen.order.code-of-honor', 'denizen.order.scouts'] })
        expect(() => campaign({ plans: [battlePlanUse('denizen.order.code-of-honor'), battlePlanUse('denizen.order.scouts')] }).apply(s)).toThrow(/cannot use other battle plans/)
        campaign({ plans: [battlePlanUse('denizen.order.code-of-honor')] }).apply(s)
        expect(s.campaign?.attackPool).toBe(5)
    })
})

describe('conditions read the Campaign', () => {
    it('Rangers: skulls ignored, and +2 only against four or more defense dice', () => {
        const small = table({}, { attacker: ['denizen.beast.rangers'] })
        campaign({ plans: [battlePlanUse('denizen.beast.rangers')] }).apply(small)
        expect(small.campaign?.attackPool).toBe(3)
        expect(small.campaign?.ignoreSkulls).toBe(true)
        // Four targets, four defense dice.
        const big = table({ warbandsBySite: { c1: { [Color.Yellow]: 1 }, c2: { [Color.Yellow]: 1 }, p1: { [Color.Yellow]: 3 }, h1: { [Color.Yellow]: 1 } } }, { attacker: ['denizen.beast.rangers'] })
        campaign({ plans: [battlePlanUse('denizen.beast.rangers')], targets: [siteTarget('c1'), siteTarget('c2'), siteTarget('p1'), siteTarget('h1')] }).apply(big)
        expect(big.campaign?.attackPool).toBe(5)
    })

    it('Kindred Warriors: "ignore all skulls you roll" spares the attacker who rolls them, and does nothing for a defender', () => {
        const KINDRED = 'denizen.arcane.kindred-warriors'
        const defending = table({}, { defender: [KINDRED] })
        campaign().apply(defending)
        defend([battlePlanUse(KINDRED)]).apply(defending)
        expect(defending.campaign?.ignoreSkulls ?? false).toBe(false)
        const attacking = table({}, { attacker: [KINDRED] })
        campaign({ plans: [battlePlanUse(KINDRED)] }).apply(attacking)
        expect(attacking.campaign?.ignoreSkulls).toBe(true)
    })

    it('Keep: +2 defense dice only when its own site is targeted', () => {
        const s = table({ denizensBySite: { c1: ['denizen.order.keep'], c2: [], p1: [], h1: [] } })
        campaign().apply(s)
        defend([battlePlanUse('denizen.order.keep')]).apply(s)
        expect(s.campaign?.defensePool).toBe(3)
        const t = table({ denizensBySite: { c1: [], c2: [], p1: ['denizen.order.keep'], h1: [] } })
        campaign().apply(t) // targets c1 only
        expect(t.campaign?.pendingDefenderPlans).toBeDefined()
        defend([battlePlanUse('denizen.order.keep')]).apply(t)
        expect(t.campaign?.defensePool).toBe(1)
    })

    it('Disgraced Captain, Cracked Sage, Rival Khan, Village Constable: the enemy and the targets decide', () => {
        const captain = table({ denizensBySite: { c1: ['denizen.order.scouts'], c2: [], p1: [], h1: [] } }, { attacker: ['denizen.discord.disgraced-captain'] })
        campaign({ plans: [battlePlanUse('denizen.discord.disgraced-captain')] }).apply(captain)
        expect(captain.campaign?.attackPool).toBe(7)
        const noOrder = table({}, { attacker: ['denizen.discord.disgraced-captain'] })
        campaign({ plans: [battlePlanUse('denizen.discord.disgraced-captain')] }).apply(noOrder)
        expect(noOrder.campaign?.attackPool).toBe(3)

        const sage = table({}, { attacker: ['denizen.discord.cracked-sage'], defender: ['denizen.arcane.tutor'] })
        campaign({ plans: [battlePlanUse('denizen.discord.cracked-sage')] }).apply(sage)
        expect(sage.campaign?.attackPool).toBe(7)

        const khan = table({}, { attacker: ['denizen.nomad.rival-khan'], defender: ['denizen.nomad.tents'] })
        campaign({ plans: [battlePlanUse('denizen.nomad.rival-khan')] }).apply(khan)
        expect(khan.campaign?.attackPool).toBe(7)

        const pf = { banners: { [Banner.PeoplesFavor]: { holderPlayerId: DEFENDER, value: 1 }, [Banner.DarkestSecret]: { value: 1 } } }
        const constable = table(pf, { attacker: ['denizen.hearth.village-constable'] })
        campaign({ plans: [battlePlanUse('denizen.hearth.village-constable')] }).apply(constable)
        expect(constable.campaign?.attackPool).toBe(3)
        const levy = table(pf, { attacker: ['denizen.hearth.the-great-levy'] })
        expect(() => campaign({ plans: [battlePlanUse('denizen.hearth.the-great-levy')] }).apply(levy)).toThrow(/People's Favor/)
    })

    it('Encirclement and Great Crusade count forces and ruled cards', () => {
        // Force 5 against 1: the defender's board stays out, since the pawn at p1 is not targeted.
        const s = table({}, { attacker: ['denizen.order.encirclement'] })
        campaign({ plans: [battlePlanUse('denizen.order.encirclement')] }).apply(s)
        expect(s.campaign?.attackPool).toBe(5)
        const crusade = table({}, { attacker: ['denizen.nomad.great-crusade', 'denizen.nomad.tents', 'denizen.nomad.elders'] })
        campaign({ plans: [battlePlanUse('denizen.nomad.great-crusade')] }).apply(crusade)
        expect(crusade.campaign?.attackPool).toBe(6)
    })

    it('Bear Traps kills one on the attacker\'s board; Wrestlers sacrifices one for a die', () => {
        const s = table({ denizensBySite: { c1: ['denizen.order.bear-traps'], c2: [], p1: [], h1: [] } })
        campaign().apply(s)
        defend([battlePlanUse('denizen.order.bear-traps')]).apply(s)
        expect(s.campaign?.attackPool).toBe(2)
        // One to the trap, then one per skull rolled.
        expect(s.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red]).toBe(4 - attackFromFaces(ongoingCampaign(s).attackRoll).skulls)

        const w = table({ denizensBySite: { c1: ['denizen.order.wrestlers'], c2: [], p1: [], h1: [] } })
        campaign().apply(w)
        defend([battlePlanUse('denizen.order.wrestlers')]).apply(w)
        expect(w.campaign?.defensePool).toBe(2)
        // The pawn at p1 keeps the defender's board out, so c1's one warband is the force.
        expect(w.warbandsBySite['c1'][Color.Yellow] ?? 0).toBe(0)
    })
})

describe('the roll rules', () => {
    it('Lancers doubles every result, hollow swords before flooring and skulls too (its Q&A); Mounted Patrol halves the pool', () => {
        let oddHollow = false
        let skulled = false
        for (let seed = 1; seed < 40; seed++) {
            const s = table({}, { attacker: ['denizen.nomad.lancers'] }, {}, seed)
            campaign({ plans: [battlePlanUse('denizen.nomad.lancers')], attackDice: 5 }).apply(s)
            const roll = ongoingCampaign(s).attackRoll
            const sum = (pick: (face: (typeof roll)[number]) => number) => roll.reduce((n, face) => n + pick(face), 0)
            const hollow = sum((f) => f.hollowSwords)
            const skulls = sum((f) => f.skulls)
            expect(s.campaign?.swords).toBe(2 * sum((f) => f.swords) + hollow)
            expect(s.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red]).toBe(Math.max(0, 5 - 2 * skulls))
            if (hollow % 2 === 1) oddHollow = true
            if (skulls > 0) skulled = true
        }
        expect(oddHollow && skulled).toBe(true)
        const m = table({ denizensBySite: { c1: ['denizen.nomad.mounted-patrol'], c2: [], p1: [], h1: [] } })
        campaign({ attackDice: 5 }).apply(m)
        defend([battlePlanUse('denizen.nomad.mounted-patrol')]).apply(m)
        expect(m.campaign?.attackPool).toBe(2)
        expect(m.campaign?.attackRoll).toHaveLength(2)
    })

    it('Rain Boots ignores single shields; Rusting Ray ignores hollow swords; War Tortoise the big faces', () => {
        for (let seed = 1; seed < 12; seed++) {
            const s = table({}, { attacker: ['denizen.nomad.rain-boots'] }, {}, seed)
            campaign({ plans: [battlePlanUse('denizen.nomad.rain-boots')], targets: [siteTarget('c1')], attackDice: 3 }).apply(s)
            const counted = ongoingCampaign(s).defenseRoll.map((f) => (f.shields === 1 && !f.doubling ? { shields: 0, doubling: false } : f))
            expect(s.campaign?.defense).toBe(defenseShieldsFromFaces(counted) + forceTotal(ongoingCampaign(s).defendingForce))
        }
        const ds = { banners: { [Banner.DarkestSecret]: { holderPlayerId: DEFENDER, value: 1 }, [Banner.PeoplesFavor]: { value: 1 } } }
        for (let seed = 1; seed < 12; seed++) {
            const s = table({ ...ds, denizensBySite: { c1: ['denizen.arcane.rusting-ray'], c2: [], p1: [], h1: [] } }, {}, {}, seed)
            campaign().apply(s)
            defend([battlePlanUse('denizen.arcane.rusting-ray')]).apply(s)
            expect(s.campaign?.swords).toBe(attackFromFaces(ongoingCampaign(s).attackRoll.map((f) => ({ ...f, hollowSwords: 0 }))).swords)
        }
        const noDs = table({ denizensBySite: { c1: ['denizen.arcane.rusting-ray'], c2: [], p1: [], h1: [] } })
        campaign().apply(noDs)
        expect(() => defend([battlePlanUse('denizen.arcane.rusting-ray')]).apply(noDs)).toThrow(/Darkest Secret/)
        for (let seed = 1; seed < 12; seed++) {
            const s = table({ denizensBySite: { c1: ['denizen.beast.war-tortoise'], c2: [], p1: [], h1: [] } }, {}, {}, seed)
            campaign().apply(s)
            defend([battlePlanUse('denizen.beast.war-tortoise')]).apply(s)
            expect(s.campaign?.swords).toBe(attackFromFaces(ongoingCampaign(s).attackRoll.map((f) => (f.skulls > 0 ? { ...f, swords: 0 } : f))).swords)
        }
    })

    it('Zealots: three per sacrificed warband while the defending force is larger', () => {
        const s = battleWhere(false, (seed) => table({}, { attacker: ['denizen.discord.zealots'] }, { [ATTACKER]: { warbandsOnBoard: { [Color.Red]: 2 } } }, seed), (s) =>
            campaign({ plans: [battlePlanUse('denizen.discord.zealots')], targets: [siteTarget('c1'), siteTarget('p1')], attackDice: 2 }).apply(s)
        )
        // c1's one, p1's three and the board's four, since the defender's pawn is on a target.
        expect(forceTotal(ongoingCampaign(s).defendingForce)).toBe(8)
        expect(s.campaign?.sacrificeWorth).toBe(3)
        expect(HydratedCampaignSacrifice.attackTotal(ongoingCampaign(s), 1)).toBe(ongoingCampaign(s).swords + 3)
        expect(HydratedCampaignSacrifice.sacrificeNeeded(ongoingCampaign(s))).toBe(Math.ceil((ongoingCampaign(s).defense + 1 - ongoingCampaign(s).swords) / 3))
    })

    it('Zealots: its Q&A — judged when used, so skulls that later shrink the force change nothing', () => {
        let shrunk = false
        for (let seed = 1; seed < 40; seed++) {
            // Nine on the board against a defending force of eight: not larger when used.
            const s = table({}, { attacker: ['denizen.discord.zealots'] }, { [ATTACKER]: { warbandsOnBoard: { [Color.Red]: 9 } } }, seed)
            campaign({ plans: [battlePlanUse('denizen.discord.zealots')], targets: [siteTarget('c1'), siteTarget('p1')], attackDice: 6 }).apply(s)
            if ((s.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red] ?? 0) < 8) shrunk = true
            expect(s.campaign?.sacrificeWorth).toBe(1)
        }
        expect(shrunk).toBe(true)
    })

    it('Zealots: judged when used, so a Jinx reroll left open on the roll does not hold it back', () => {
        const s = table({}, { attacker: ['denizen.discord.zealots', 'denizen.arcane.jinx'] }, { [ATTACKER]: { warbandsOnBoard: { [Color.Red]: 2 } } })
        campaign({ plans: [battlePlanUse('denizen.discord.zealots')], targets: [siteTarget('c1'), siteTarget('p1')], attackDice: 2 }).apply(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.RerollDice, askedPlayerId: ATTACKER })
        expect(s.campaign?.pendingSkullKills).toBeDefined()
        expect(s.campaign?.sacrificeWorth).toBe(3)
    })
})

describe('locks', () => {
    it('Specialist: the defending side uses no plans, so nothing holds the roll', () => {
        const s = table({ denizensBySite: { c1: ['denizen.hearth.extra-provisions'], c2: [], p1: [], h1: [] } }, { attacker: ['denizen.order.specialist'] })
        const a = campaign({ plans: [battlePlanUse('denizen.order.specialist')] })
        a.apply(s)
        expect(s.campaign?.defenderPlansLocked).toBe(true)
        expect(a.metadata?.battle?.awaitingDefender).toBeUndefined()
        expect(s.prng.invocations).toBeGreaterThan(0)
        expect(HydratedCampaignDefend.usablePlans(s, DEFENDER)).toEqual([])
    })

    it("Code of Honor on the defending side locks the rest of it (R-10.28-H1)", () => {
        const s = testState(
            [
                testPlayer({ playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'h1', supply: 5, favor: 3, warbandsOnBoard: { [Color.Red]: 5 }, warbandsInPersonalBank: { [Color.Red]: 7 } }),
                testPlayer({ playerId: 'chancellor', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 4, warbandsOnBoard: { purple: 3 }, warbandsInPersonalBank: { purple: 15 }, advisers: [{ cardId: 'denizen.order.code-of-honor', faceUp: true }] }),
                testPlayer({ playerId: ALLY, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'h1', favor: 4, warbandsOnBoard: { purple: 2 }, warbandsInPersonalBank: { [Color.Blue]: 9 }, advisers: [{ cardId: 'denizen.hearth.extra-provisions', faceUp: true }] })
            ],
            { chancellorPlayerId: 'chancellor', warbandsBySite: { h1: { purple: 3 } }, prng: { seed: 1, invocations: 0 } }
        )
        campaign({ defender: { kind: 'player', playerId: 'chancellor' }, targets: [siteTarget('h1')] }).apply(s)
        joinDefence(s, ALLY, 'chancellor')
        expect(s.campaign?.pendingDefenderPlans?.queue).toEqual(['chancellor', ALLY])
        defend([battlePlanUse('denizen.order.code-of-honor')], 'chancellor').apply(s)
        expect(s.campaign?.defenderPlansLocked).toBe(true)
        expect(s.campaign?.pendingDefenderPlans).toBeUndefined()
        expect(s.prng.invocations).toBeGreaterThan(0)
    })
})

describe('the outcome', () => {
    it('Battle Honors and Field Promotion pay on victory, not on defeat', () => {
        const won = battleWhere(true, (seed) => table({}, { attacker: ['denizen.order.battle-honors', 'denizen.order.field-promotion'] }, {}, seed), (s) =>
            campaign({ plans: [battlePlanUse('denizen.order.battle-honors'), battlePlanUse('denizen.order.field-promotion')], attackDice: 5 }).apply(s)
        )
        const order = won.favorBank[Suit.Order]
        const board = required(won.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red], 'the attacker’s red warbands')
        const { sacrifice: a, victory } = finishCampaignSteps(won)
        expect(a.metadata?.attackerVictorious).toBe(true)
        expect(won.favorBank[Suit.Order]).toBe(order - 2)
        expect(won.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red]).toBe(board + 3)
        // R-5.5.8 — after R-5.5.7's spoils, so the victory's record reports them.
        expect(victory?.metadata?.triggered).toEqual(['Battle Honors: gained 2 favor from the order bank', 'Field Promotion: gained 3 warbands'])

        const lost = battleWhere(false, (seed) => table({}, { attacker: ['denizen.order.battle-honors'] }, { [ATTACKER]: { warbandsOnBoard: { [Color.Red]: 1 } } }, seed), (s) =>
            campaign({ plans: [battlePlanUse('denizen.order.battle-honors')], attackDice: 1 }).apply(s)
        )
        const before = lost.favorBank[Suit.Order]
        const b = finishCampaign(lost)
        expect(b.metadata?.attackerVictorious).toBe(false)
        expect(lost.favorBank[Suit.Order]).toBe(before)
    })

    it('Mercenaries is discarded on defeat; Traveling Doctor keeps the defeated force whole and goes', () => {
        const lost = battleWhere(false, (seed) => table({}, { attacker: ['denizen.discord.mercenaries'] }, { [ATTACKER]: { warbandsOnBoard: { [Color.Red]: 2 } } }, seed), (s) =>
            campaign({ plans: [battlePlanUse('denizen.discord.mercenaries')], attackDice: 1 }).apply(s)
        )
        finishCampaign(lost)
        expect(lost.getPlayerState(ATTACKER).advisers).toEqual([])
        expect(lost.discardPileCounts.provinces).toBe(1)

        const doc = battleWhere(false, (seed) => table({}, { attacker: ['denizen.hearth.traveling-doctor'] }, { [ATTACKER]: { warbandsOnBoard: { [Color.Red]: 4 } } }, seed), (s) =>
            campaign({ plans: [battlePlanUse('denizen.hearth.traveling-doctor')], attackDice: 1 }).apply(s)
        )
        const force = doc.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red]
        expect(HydratedCampaignSacrifice.defaultDefeatKills(doc, 0)).toEqual([])
        const a = finishCampaign(doc)
        expect(a.metadata?.defeatKilled).toBe(0)
        expect(doc.getPlayerState(ATTACKER).warbandsOnBoard[Color.Red]).toBe(force)
        expect(doc.getPlayerState(ATTACKER).advisers).toEqual([])
    })

    it('Shield Wall: +2 defense dice, and a defeated defender loses the whole force', () => {
        const s = battleWhere(true, (seed) => table({ denizensBySite: { c1: ['denizen.order.shield-wall'], c2: [], p1: [], h1: [] } }, {}, {}, seed), (s) => {
            campaign({ attackDice: 5 }).apply(s)
            defend([battlePlanUse('denizen.order.shield-wall')]).apply(s)
        })
        expect(s.campaign?.defensePool).toBe(3)
        expect(forceTotal(HydratedCampaignSacrifice.defaultDefeatKills(s, 0))).toBe(forceTotal(ongoingCampaign(s).defendingForce))
    })

    it("Slander and Book Burning strip the defender when their pawn was targeted", () => {
        const build = (seed: number) => table({}, { attacker: ['denizen.discord.slander', 'denizen.discord.book-burning'] }, { [DEFENDER]: { siteId: 'c1', secrets: 3, favor: 6 } }, seed)
        const won = battleWhere(true, build, (s) =>
            campaign({ plans: [battlePlanUse('denizen.discord.slander'), battlePlanUse('denizen.discord.book-burning')], targets: [siteTarget('c1'), { kind: CampaignTargetKind.PawnAndFavor }], attackDice: 5 }).apply(s)
        )
        finishCampaign(won)
        expect(won.getPlayerState(DEFENDER).favor).toBe(0)
        expect(won.getPlayerState(DEFENDER).secrets).toBe(1)
        const site1 = battleWhere(true, build, (s) => campaign({ plans: [battlePlanUse('denizen.discord.slander')], targets: [siteTarget('c1')], attackDice: 5 }).apply(s))
        finishCampaign(site1)
        expect(site1.getPlayerState(DEFENDER).favor).toBeGreaterThan(0)
    })
})
