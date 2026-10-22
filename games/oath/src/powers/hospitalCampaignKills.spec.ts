import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import type { WarbandCounts } from '../model/warbandCounts.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedTravel, Travel } from '../actions/travel.js'
import { CRADLE, HINTERLAND, PROVINCES, testPlayer, testState, openTurn, withChancellor } from '../testing/fixture.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { ATTACKER, DEFENDER, answerQuestion, campaign, defend, finishCampaign } from '../testing/steps.js'
import { enemyWarbandsKilledFor } from '../util/campaignRoll.js'
import { OathRevision } from '../util/revision.js'
import { describeWarbands } from '../util/warbands.js'
import '../powers/index.js'

const HOSPITAL = 'denizen.hearth.hospital'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const WRESTLERS = 'denizen.order.wrestlers'
const BOILING_LAKE = 'denizen.discord.boiling-lake'
const GRASPING_VINES = 'denizen.beast.grasping-vines'
const TOLL_ROADS = 'denizen.order.toll-roads'
const SPECIALIST = 'denizen.order.specialist'
const CODE_OF_HONOR = 'denizen.order.code-of-honor'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const CAULDRON = 'relic.cursed-cauldron'

const atRevision = OathRevision.EngineFixes9
const before = OathRevision.EngineFixes8

const FIXTURE_SITES = [...CRADLE, ...PROVINCES, ...HINTERLAND]
const ATTACKER_BANK = 4
const DEFENDER_BANK = 8

interface Scene {
    revision: number
    denizens?: Record<string, string[]>
    warbands?: Record<string, WarbandCounts>
    siteCards?: Record<string, string>
    attacker?: Partial<OathPlayerState>
    defender?: Partial<OathPlayerState>
}

/**
 * Both pawns at c1, which the defender rules (two warbands), as they do p1 (three); the attacker rules
 * c2 (one). Neither holds a card until the scene places one.
 */
function table(scene: Scene): HydratedOathGameState {
    const s = testState(
        withChancellor([
            testPlayer({
                playerId: ATTACKER, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3,
                warbandsOnBoard: { [ATTACKER]: 6 }, warbandsInPersonalBank: { [ATTACKER]: ATTACKER_BANK }, ...scene.attacker
            }),
            testPlayer({
                playerId: DEFENDER, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3,
                warbandsOnBoard: { [DEFENDER]: 2 }, warbandsInPersonalBank: { [DEFENDER]: DEFENDER_BANK }, ...scene.defender
            })
        ]),
        {
            oathRevision: scene.revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...scene.denizens },
            warbandsBySite: { c1: { [DEFENDER]: 2 }, c2: { [ATTACKER]: 1 }, p1: { [DEFENDER]: 3 }, ...scene.warbands },
            siteCards: { ...Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])), ...scene.siteCards },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, ATTACKER)
    return s
}

const bankOf = (s: HydratedOathGameState, playerId: string) =>
    s.getPlayerState(playerId).warbandsInPersonalBank[playerId] ?? 0
const boardOf = (s: HydratedOathGameState, playerId: string) =>
    s.getPlayerState(playerId).warbandsOnBoard[playerId] ?? 0
const atSite = (s: HydratedOathGameState, siteId: string, owner: string) =>
    s.warbandsBySite[siteId]?.[owner] ?? 0
const cauldronNote = (gained: number) =>
    `Cursed Cauldron: ${ATTACKER} gained ${describeWarbands(gained, ATTACKER)}, one per enemy warband killed`
const heldFor = (s: HydratedOathGameState, playerId: string) =>
    (ongoingCampaign(s).heldForHospital ?? [])
        .filter((held) => held.playerId === playerId)
        .reduce((total, held) => total + held.count, 0)

describe("Bear Traps against the attacker's Hospital", () => {
    /** The attacker uses Hospital at c2; Bear Traps stands at c1. No attack dice, so no skull kills. */
    function trapped(revision: number) {
        const s = table({ revision, denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] } })
        campaign({ attackDice: 0, plans: [battlePlanUse(HOSPITAL)] }).apply(s)
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: ATTACKER, siteId: 'c2' }])
        const defended = defend([battlePlanUse(BEAR_TRAPS)])
        defended.apply(s)
        return { s, defended }
    }

    it("the warband the defender's Bear Traps kills is held for Hospital's site, and placed there at the end", () => {
        const { s, defended } = trapped(atRevision)
        expect(boardOf(s, ATTACKER)).toBe(5)
        expect(heldFor(s, ATTACKER)).toBe(1)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
        expect(defended.metadata?.planNotes).toEqual([`Bear Traps: a warband on ${ATTACKER}'s board goes to Hospital's site`])
        // Cursed Cauldron's Q&A: Hospital prevents warbands from being killed.
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(0)
        const defeatKilled = finishCampaign(s).metadata?.defeatKilled ?? 0
        expect(s.campaign).toBeUndefined()
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
        expect(atSite(s, 'c2', ATTACKER)).toBe(1 + 1 + defeatKilled)
    })

    it("the bandits' compelled Bear Traps is held for Hospital's site too", () => {
        const s = table({ revision: atRevision, denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] }, warbands: { c1: {} }, defender: { siteId: 'p1' } })
        const declared = campaign({ defender: { kind: 'bandits' }, attackDice: 0, plans: [battlePlanUse(HOSPITAL)] })
        declared.apply(s)
        expect(declared.metadata?.battle?.plansUsed).toContain(BEAR_TRAPS)
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: ATTACKER, siteId: 'c2' }])
        expect(heldFor(s, ATTACKER)).toBe(1)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
        expect(declared.metadata?.battle?.planNotes).toContain(`Bear Traps: a warband on ${ATTACKER}'s board goes to Hospital's site`)
        const defeatKilled = finishCampaign(s).metadata?.defeatKilled ?? 0
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
        expect(atSite(s, 'c2', ATTACKER)).toBe(1 + 1 + defeatKilled)
    })

    it('Specialist locks the bandits\' plans: no Bear Traps, nothing held', () => {
        const s = table({ revision: atRevision, denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL, SPECIALIST] }, warbands: { c1: {} }, defender: { siteId: 'p1' } })
        const declared = campaign({ defender: { kind: 'bandits' }, attackDice: 0, plans: [battlePlanUse(HOSPITAL), battlePlanUse(SPECIALIST)] })
        declared.apply(s)
        expect(declared.metadata?.battle?.plansUsed).not.toContain(BEAR_TRAPS)
        expect(ongoingCampaign(s).heldForHospital).toBeUndefined()
        expect(boardOf(s, ATTACKER)).toBe(6)
    })

    it('control: with no Hospital the warband is killed, and counted once for Cursed Cauldron', () => {
        const s = table({ revision: atRevision, denizens: { c1: [BEAR_TRAPS] } })
        campaign({ attackDice: 0 }).apply(s)
        const defended = defend([battlePlanUse(BEAR_TRAPS)])
        defended.apply(s)
        expect(defended.metadata?.planNotes).toEqual([`Bear Traps: killed a warband on ${ATTACKER}'s board`])
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK + 1)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(1)
    })

    it('R-X.4 — before revision 13 the kill skips Hospital, as it was recorded', () => {
        const { s, defended } = trapped(before)
        expect(defended.metadata?.planNotes).toEqual([`Bear Traps: killed a warband on ${ATTACKER}'s board`])
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK + 1)
        expect(ongoingCampaign(s).heldForHospital).toBeUndefined()
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(1)

        const bandits = table({ revision: before, denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] }, warbands: { c1: {} }, defender: { siteId: 'p1' } })
        campaign({ defender: { kind: 'bandits' }, attackDice: 0, plans: [battlePlanUse(HOSPITAL)] }).apply(bandits)
        expect(bankOf(bandits, ATTACKER)).toBe(ATTACKER_BANK + 1)
        expect(ongoingCampaign(bandits).heldForHospital).toBeUndefined()
    })
})

describe("Wrestlers' sacrifice and the defender's Hospital (Law 5.5.3: a side's plans have no order)", () => {
    /** The defender uses `plans`; Wrestlers at c1, Hospital at `hospitalAt`. The attacker holds the Cauldron. No attack dice. */
    function wrestled(revision: number, plans: string[], hospitalAt: 'c1' | 'p1' = 'p1', defender: Partial<OathPlayerState> = {}) {
        const s = table({
            revision,
            denizens: hospitalAt === 'c1' ? { c1: [WRESTLERS, HOSPITAL] } : { c1: [WRESTLERS], p1: [HOSPITAL] },
            attacker: { relicIds: [CAULDRON] },
            defender
        })
        campaign({ attackDice: 0, plans: [battlePlanUse(CAULDRON)] }).apply(s)
        defend(plans.map(battlePlanUse)).apply(s)
        return s
    }

    for (const plans of [[HOSPITAL, WRESTLERS], [WRESTLERS, HOSPITAL]]) {
        it(`declared ${plans.join(' then ')}: the sacrifice is held, and is not an enemy warband killed`, () => {
            const s = wrestled(atRevision, plans)
            expect(ongoingCampaign(s).defensePool).toBeGreaterThan(0)
            expect(boardOf(s, DEFENDER)).toBe(1)
            expect(heldFor(s, DEFENDER)).toBe(1)
            expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK)
            expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(0)
        })
    }

    it('control: with no Hospital the sacrifice is killed and counted once, not twice', () => {
        const s = wrestled(atRevision, [WRESTLERS])
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + 1)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(1)
    })

    it("a sacrifice held for a Hospital whose site is lost is killed at the end, and counts for the attacker's Cauldron", () => {
        const s = wrestled(atRevision, [HOSPITAL, WRESTLERS], 'c1', { warbandsOnBoard: { [DEFENDER]: 3 } })
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: DEFENDER, siteId: 'c1' }])
        expect(heldFor(s, DEFENDER)).toBe(1)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        ).apply(s)
        defendingSideChooses(s)
        // The sacrifice, then R-5.5.6's half of the four left: c1's two, so c1 is lost.
        expect(heldFor(s, DEFENDER)).toBe(3)
        expect(atSite(s, 'c1', DEFENDER)).toBe(0)
        const victory = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false }))
        victory.apply(s)
        expect(victory.metadata?.triggered).toContain(cauldronNote(3))
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + 3)
    })

    it('R-X.4 — before revision 13 the sacrifice skips Hospital and is counted once, as it was recorded', () => {
        for (const plans of [[HOSPITAL, WRESTLERS], [WRESTLERS, HOSPITAL]]) {
            const s = wrestled(before, plans)
            expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + 1)
            expect(ongoingCampaign(s).heldForHospital).toBeUndefined()
            expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(1)
        }
    })
})

describe('kills a card makes during the banish (R-5.5.7.III) go through the Campaign', () => {
    interface Banish {
        name: string
        /** Where the scene stands, and the denizens it needs. */
        scene: Pick<Scene, 'denizens' | 'siteCards' | 'attacker' | 'defender'>
        targets: CampaignTarget[]
        banishToSiteId: string
        card: string
        /** The kills R-5.5.6 makes of the defender's force, then the card's. */
        defeatKilled: number
        cardKilled: number
    }
    const banishes: Banish[] = [
        {
            name: 'into Boiling Lake',
            scene: { denizens: { h1: [BOILING_LAKE] } },
            targets: [siteTarget('c1'), { kind: CampaignTargetKind.PawnAndFavor }],
            banishToSiteId: 'h1',
            card: 'Boiling Lake',
            defeatKilled: 2,
            cardKilled: 2
        },
        {
            name: 'out of a Grasping Vines site',
            scene: { denizens: { c2: [GRASPING_VINES] }, attacker: { siteId: 'c2' }, defender: { siteId: 'c2' } },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            banishToSiteId: 'h1',
            card: 'Grasping Vines',
            defeatKilled: 1,
            cardKilled: 1
        }
    ]

    /** The defender is defeated; R-5.5.6's kills come off c1 first, so the board keeps its two for the banish. */
    function defeated(revision: number, banish: Banish, hospital: boolean, cauldron: boolean) {
        const s = table({
            revision,
            ...banish.scene,
            denizens: { ...banish.scene.denizens, p1: hospital ? [HOSPITAL] : [] },
            attacker: { ...banish.scene.attacker, relicIds: cauldron ? [CAULDRON] : [] }
        })
        campaign({ attackDice: 0, targets: banish.targets, plans: cauldron ? [battlePlanUse(CAULDRON)] : [] }).apply(s)
        if (hospital) defend([battlePlanUse(HOSPITAL)]).apply(s)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        ).apply(s)
        defendingSideChooses(s)
        return s
    }

    function banished(s: HydratedOathGameState, banish: Banish) {
        const victory = new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false, banishToSiteId: banish.banishToSiteId })
        )
        victory.apply(s)
        return victory
    }

    for (const banish of banishes) {
        it(`a banish ${banish.name}: the defender's Hospital holds the kill, and places it at the end`, () => {
            const s = defeated(atRevision, banish, true, false)
            expect(heldFor(s, DEFENDER)).toBe(banish.defeatKilled)
            const victory = banished(s, banish)
            expect(s.campaign).toBeUndefined()
            expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK)
            expect(atSite(s, 'p1', DEFENDER)).toBe(3 + banish.defeatKilled + banish.cardKilled)
            const words = banish.cardKilled === 1 ? 'a warband' : `${banish.cardKilled} warbands`
            const verb = banish.cardKilled === 1 ? 'goes' : 'go'
            expect(victory.metadata?.triggered).toContain(`${banish.card}: ${words} on ${DEFENDER}'s board ${verb} to Hospital's site`)
        })

        it(`a banish ${banish.name}: with no Hospital the kill counts for the attacker's Cauldron`, () => {
            const s = defeated(atRevision, banish, false, true)
            const victory = banished(s, banish)
            const gained = banish.defeatKilled + banish.cardKilled
            expect(victory.metadata?.triggered).toContain(cauldronNote(gained))
            expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + gained)
        })

        it(`R-X.4 — before revision 13 a banish ${banish.name} kills past Hospital and the Cauldron, as it was recorded`, () => {
            const saved = defeated(before, banish, true, false)
            banished(saved, banish)
            expect(bankOf(saved, DEFENDER)).toBe(DEFENDER_BANK + banish.cardKilled)
            expect(atSite(saved, 'p1', DEFENDER)).toBe(3 + banish.defeatKilled)

            const counted = defeated(before, banish, false, true)
            const victory = banished(counted, banish)
            expect(victory.metadata?.triggered).toContain(cauldronNote(banish.defeatKilled))
        })
    }

    it('a banish through Toll Roads: the Boiling Lake kill made when the toll is paid is held, the Campaign being open', () => {
        const banish: Banish = { ...banishes[0], scene: { denizens: { c2: [TOLL_ROADS, BOILING_LAKE] } }, banishToSiteId: 'c2' }
        const s = defeated(atRevision, banish, true, false)
        banished(s, banish)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.PayTravelToll, askedPlayerId: DEFENDER })
        expect(s.campaign).toBeDefined()
        answerQuestion(s, DEFENDER, { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(s.getPlayerState(DEFENDER).siteId).toBe('c2')
        expect(s.campaign).toBeUndefined()
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK)
        expect(atSite(s, 'p1', DEFENDER)).toBe(3 + 2 + 2)
    })

    it("a banish from a Shrouded Wood: the Boiling Lake kill made at its ruler's pick is held, the Campaign being open", () => {
        const s = defeated(
            atRevision,
            { ...banishes[1], scene: { denizens: { h1: [BOILING_LAKE] }, siteCards: { c2: 'site.shrouded-wood' }, attacker: { siteId: 'c2' }, defender: { siteId: 'c2' } } },
            true,
            false
        )
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false, banish: true })).apply(s)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: ATTACKER, travelerPlayerId: DEFENDER })
        answerQuestion(s, ATTACKER, { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'h1' })
        expect(s.campaign).toBeUndefined()
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK)
        // R-5.5.6 took one of the board's two; Boiling Lake's two find one left.
        expect(atSite(s, 'p1', DEFENDER)).toBe(3 + 1 + 1)
    })

    it('control: travel into Boiling Lake outside a Campaign kills as before', () => {
        const s = table({ revision: atRevision, denizens: { c2: [BOILING_LAKE], p1: [HOSPITAL] } })
        s.warbandsBySite['c2'] = {}
        openTurn(s, DEFENDER)
        new HydratedTravel(buildAction(Travel, { playerId: DEFENDER, siteId: 'c2' })).apply(s)
        expect(boardOf(s, DEFENDER)).toBe(0)
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + 2)
    })
})

describe('Hospital beside the other plans', () => {
    it("Peace Envoy ignores killing warbands: the attacker's Hospital has nothing to hold", () => {
        const s = table({ revision: atRevision, denizens: { c1: [PEACE_ENVOY], c2: [HOSPITAL] }, defender: { favor: 9 } })
        campaign({ attackDice: 0, plans: [battlePlanUse(HOSPITAL)] }).apply(s)
        defend([battlePlanUse(PEACE_ENVOY)]).apply(s)
        expect(ongoingCampaign(s).decidedVictor).toBe('defender')
        expect(ongoingCampaign(s).heldForHospital).toBeUndefined()
        finishCampaign(s)
        expect(s.campaign).toBeUndefined()
        expect(boardOf(s, ATTACKER)).toBe(6)
        expect(atSite(s, 'c2', ATTACKER)).toBe(1)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
    })

    it('Code of Honor leaves no room for Hospital beside it, as before', () => {
        const s = table({ revision: atRevision, denizens: { c2: [HOSPITAL, CODE_OF_HONOR] } })
        expect(() => campaign({ attackDice: 0, plans: [battlePlanUse(CODE_OF_HONOR), battlePlanUse(HOSPITAL)] }).apply(s)).toThrow(/cannot use other battle plans/)
    })
})

describe("Hospital's placements are recorded on the step that ends the Campaign", () => {
    const placed = (playerId: string, siteId: string, count: number) => [{ playerId, siteId, owner: playerId, count }]

    /** The defender uses Hospital at `hospitalAt` and loses; R-5.5.6 kills half their force, c1's two first. */
    function defenderLoses(revision: number, hospitalAt: 'c1' | 'p1' | undefined, toll = false) {
        const s = table({
            revision,
            denizens: { ...(hospitalAt ? { [hospitalAt]: [HOSPITAL] } : {}), ...(toll ? { c2: [TOLL_ROADS] } : {}) }
        })
        campaign({ attackDice: 0, ...(toll ? { targets: [siteTarget('c1'), { kind: CampaignTargetKind.PawnAndFavor }] } : {}) }).apply(s)
        if (hospitalAt) defend([battlePlanUse(HOSPITAL)]).apply(s)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        const sacrifice = new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, { playerId: ATTACKER, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        )
        sacrifice.apply(s)
        defendingSideChooses(s)
        const victory = new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, { playerId: ATTACKER, placements: [], burnFavor: false, ...(toll ? { banishToSiteId: 'c2' } : {}) })
        )
        victory.apply(s)
        return { s, sacrifice, victory, killed: sacrifice.metadata?.defeatKilled ?? 0 }
    }

    it("a defeated attacker's Hospital: the sacrifice that ends the Campaign records the warbands placed on its site, one entry per Hospital", () => {
        const s = table({ revision: atRevision, denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] } })
        campaign({ attackDice: 0, plans: [battlePlanUse(HOSPITAL)] }).apply(s)
        defend([battlePlanUse(BEAR_TRAPS)]).apply(s)
        const sacrifice = finishCampaign(s)
        expect(s.campaign).toBeUndefined()
        const killed = sacrifice.metadata?.defeatKilled ?? 0
        expect(killed).toBeGreaterThan(0)
        // Bear Traps' one and R-5.5.6's, held apart, placed together.
        expect(sacrifice.metadata?.hospitalPlaced).toEqual(placed(ATTACKER, 'c2', 1 + killed))
        expect(atSite(s, 'c2', ATTACKER)).toBe(1 + 1 + killed)
    })

    it("a won Campaign: the spoils step that ends it records the defender's warbands placed on Hospital's site", () => {
        const { s, sacrifice, victory, killed } = defenderLoses(atRevision, 'p1')
        expect(s.campaign).toBeUndefined()
        expect(killed).toBe(2)
        expect(sacrifice.metadata?.hospitalPlaced).toBeUndefined()
        expect(victory.metadata?.hospitalPlaced).toEqual(placed(DEFENDER, 'p1', 2))
        expect(atSite(s, 'p1', DEFENDER)).toBe(3 + 2)
    })

    it('a Hospital whose site is lost places nothing, so nothing is recorded: the held warbands die', () => {
        const { s, victory } = defenderLoses(atRevision, 'c1')
        expect(s.campaign).toBeUndefined()
        expect(victory.metadata?.hospitalPlaced).toBeUndefined()
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + 2)
    })

    it('control: with no Hospital nothing is recorded', () => {
        const { victory } = defenderLoses(atRevision, undefined)
        expect(victory.metadata?.hospitalPlaced).toBeUndefined()
    })

    it("a banish through Toll Roads: the answer that ends the Campaign records Hospital's placement", () => {
        const { s, victory } = defenderLoses(atRevision, 'p1', true)
        expect(s.campaign).toBeDefined()
        expect(victory.metadata?.hospitalPlaced).toBeUndefined()
        const answer = answerQuestion(s, DEFENDER, { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(s.campaign).toBeUndefined()
        expect(answer.metadata?.hospitalPlaced).toEqual(placed(DEFENDER, 'p1', 2))
    })

    it('no gate: a record of what was placed, on the action alone; the state carries nothing new at any revision', () => {
        for (const revision of [before, atRevision, OathRevision.EngineFixes23]) {
            const { s, victory } = defenderLoses(revision, 'p1')
            expect(victory.metadata?.hospitalPlaced).toEqual(placed(DEFENDER, 'p1', 2))
            expect(JSON.stringify(s.dehydrate())).not.toContain('hospitalPlaced')
        }
    })
})
