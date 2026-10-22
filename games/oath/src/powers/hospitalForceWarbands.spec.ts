import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { CampaignTargetKind, type CampaignTarget, type WarbandGroup } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignSkullLosses, HydratedCampaignSkullLosses } from '../actions/campaignSkullLosses.js'
import { HydratedCampaignDefeatKills } from '../actions/campaignDefeatKills.js'
import { OathVisibility } from '../definition/runtime.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { actionPowerUse, battlePlanUse, site, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { defend } from '../testing/steps.js'
import { served } from '../testing/projection.js'
import { enemyWarbandsKilledFor } from '../util/campaignRoll.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const HOSPITAL = 'denizen.hearth.hospital'
const UNION = 'denizen.beast.vow-of-union'
const CAPTAINS = 'denizen.order.captains'
const WRESTLERS = 'denizen.order.wrestlers'

const atRevision = OathRevision.EngineFixes9
const before = OathRevision.EngineFixes8

const I = IMPERIAL_WARBANDS
const DANA = 'dana' // an Exile
const BEA = 'bea' // a Citizen
const ANN = 'ann' // the Chancellor
const CHANCELLOR_BANK = 10

interface Scene {
    revision: number
    dana?: Partial<OathPlayerState>
    bea?: Partial<OathPlayerState>
    ann?: Partial<OathPlayerState>
    denizens: Record<string, string[]>
    warbands: Record<string, WarbandCounts>
    turn: string
}

function table(scene: Scene): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3, warbandsInPersonalBank: { [DANA]: 8 }, ...scene.dana }),
            testPlayer({ playerId: BEA, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', supply: 6, favor: 4, secrets: 3, ...scene.bea }),
            testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', supply: 6, favor: 4, secrets: 3, warbandsInPersonalBank: { [I]: CHANCELLOR_BANK }, ...scene.ann })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...scene.denizens },
            warbandsBySite: scene.warbands,
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, scene.turn)
    return s
}

const imperialBank = (s: HydratedOathGameState) => s.getPlayerState(ANN).warbandsInPersonalBank[I] ?? 0
const heldFor = (s: HydratedOathGameState, playerId: string) =>
    (ongoingCampaign(s).heldForHospital ?? [])
        .filter((held) => held.playerId === playerId)
        .reduce((total, held) => total + held.count, 0)
const atSite = (siteId: string, count: number): WarbandGroup => ({ at: { kind: 'site', siteId }, owner: I, count })
const onBoard = (playerId: string, count: number): WarbandGroup => ({ at: { kind: 'board', playerId }, owner: I, count })

function attack(s: HydratedOathGameState, attackerId: string, defenderId: string, targets: CampaignTarget[], plans: string[] = []) {
    new HydratedCampaign(
        buildAction(Campaign, { playerId: attackerId, defender: { kind: 'player', playerId: defenderId }, targets, attackDice: 0, plans: plans.map(battlePlanUse) })
    ).apply(s)
}

function sacrifice(s: HydratedOathGameState, playerId: string, fields: { sacrifice: number; sacrificeKills?: WarbandGroup[]; defeatKills?: WarbandGroup[] }) {
    new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId, ...fields })).apply(s)
}

describe('a Citizen attacker with Vow of Union: the Empire\'s warbands at their sites are theirs for Hospital (R-10.28-H2)', () => {
    /** Bea (a Citizen, Vow of Union) attacks Dana (an Exile) at c1, using Hospital at p1; c2's three Imperial warbands join their force. */
    function citizenAttacks(revision: number) {
        const s = table({
            revision,
            bea: { warbandsOnBoard: { [I]: 3 }, advisers: [{ cardId: UNION, faceUp: true }] },
            denizens: { p1: [HOSPITAL] },
            warbands: { c1: { [DANA]: 1 }, c2: { [I]: 3 }, p1: { [I]: 1 } },
            turn: BEA
        })
        attack(s, BEA, DANA, [siteTarget('c1')], [HOSPITAL])
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: BEA, siteId: 'p1' }])
        return s
    }

    function skullsPicked(s: HydratedOathGameState) {
        ongoingCampaign(s).pendingSkullLosses = { skulls: 2 }
        new HydratedCampaignSkullLosses(buildAction(CampaignSkullLosses, { playerId: BEA, kills: [atSite('c2', 2)] })).apply(s)
    }

    it('A: skull losses picked at a Vow of Union site are held for their Hospital, and not an enemy warband killed', () => {
        const s = citizenAttacks(atRevision)
        skullsPicked(s)
        expect(heldFor(s, BEA)).toBe(2)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(0)
    })

    it("defeated, their Hospital's site is a Vow of Union site too: its survivor goes to their board (R-5.5.6-H2), so what Hospital held dies at the end", () => {
        const s = citizenAttacks(atRevision)
        Object.assign(ongoingCampaign(s), { swords: 0, defense: 1 })
        // Half their force of seven: two at c2 and one on their board.
        sacrifice(s, BEA, { sacrifice: 0, defeatKills: [atSite('c2', 2), onBoard(BEA, 1)] })
        expect(s.campaign).toBeUndefined()
        expect(s.warbandsBySite['p1']?.[I] ?? 0).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 3)
    })

    it("R-X.4 — before revision 13 the Empire's warbands there are the Chancellor's, so their Hospital misses them, as recorded", () => {
        const s = citizenAttacks(before)
        skullsPicked(s)
        expect(heldFor(s, BEA)).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(2)
    })
})

describe('B: a defeated Citizen attacker through Captains: the Empire\'s warbands at the Captains site are theirs for Hospital', () => {
    /**
     * Bea (a Citizen) rules c1, where Captains is, and names c2 (three Imperial warbands), where Dana (an
     * Exile) stands; Bea attacks Dana's pawn and is defeated. Hospital is at p1, which they rule.
     */
    function defeatedFromCaptains(revision: number) {
        const s = table({
            revision,
            dana: { siteId: 'c2', warbandsOnBoard: { [DANA]: 2 } },
            bea: { warbandsOnBoard: { [I]: 3 } },
            denizens: { c1: [CAPTAINS], p1: [HOSPITAL] },
            warbands: { c1: { [I]: 1 }, c2: { [I]: 3 }, p1: { [I]: 1 } },
            turn: BEA
        })
        actionPowerUse(BEA, CAPTAINS, [site('c2')]).apply(s)
        s.actionCount += 1
        attack(s, BEA, DANA, [{ kind: CampaignTargetKind.PawnAndFavor }], [HOSPITAL])
        Object.assign(ongoingCampaign(s), { swords: 0, defense: 1 })
        // R-5.5.6 — half their force of six: two at c2 and one on their board; c2's last goes to their board.
        sacrifice(s, BEA, { sacrifice: 0, defeatKills: [atSite('c2', 2), onBoard(BEA, 1)] })
        expect(s.campaign).toBeUndefined()
        expect(s.warbandsBySite['c2']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(BEA).warbandsOnBoard[I]).toBe(3)
        return s
    }

    it('all three are held, and placed on their Hospital site at the end', () => {
        const s = defeatedFromCaptains(atRevision)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(s.warbandsBySite['p1']?.[I]).toBe(1 + 3)
    })

    it('R-X.4 — before revision 13 the two at c2 are the Chancellor\'s and die, as recorded', () => {
        const s = defeatedFromCaptains(before)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
        expect(s.warbandsBySite['p1']?.[I]).toBe(1 + 1)
    })
})

describe("a Citizen defender: the Empire's warbands at their targeted sites are theirs for Hospital", () => {
    /** Dana attacks Bea (a Citizen) at c1, two Imperial warbands there; Ann, the Chancellor, joins as an Ally. */
    function citizenDefends(revision: number, hospitalUser: string, scene: Partial<Scene> = {}, hospitalAt = 'p1') {
        const s = table({
            revision,
            dana: { warbandsOnBoard: { [DANA]: 8 } },
            denizens: { p1: [HOSPITAL] },
            warbands: { c1: { [I]: 2 }, p1: { [I]: 1 } },
            turn: DANA,
            ...scene
        })
        attack(s, DANA, BEA, [siteTarget('c1')])
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN])
        for (const playerId of [BEA, ANN]) {
            if (ongoingCampaign(s).pendingDefenderPlans?.queue[0] === playerId) {
                defend(playerId === hospitalUser ? [battlePlanUse(HOSPITAL)] : [], playerId).apply(s)
            }
        }
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: hospitalUser, siteId: hospitalAt }])
        Object.assign(ongoingCampaign(s), { swords: 9, defense: 0 })
        sacrifice(s, DANA, { sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        return s
    }

    it("C: their own Hospital catches the Empire's warbands killed at their targeted site", () => {
        const s = citizenDefends(atRevision, BEA)
        defendingSideChooses(s, [atSite('c1', 1)])
        expect(heldFor(s, BEA)).toBe(1)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(0)
    })

    it("the reverse: the Chancellor's Hospital, as their Ally, does not catch them (R-10.28: you alone)", () => {
        const s = citizenDefends(atRevision, ANN)
        defendingSideChooses(s, [atSite('c1', 1)])
        expect(heldFor(s, ANN)).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 1)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(1)
    })

    it("the Ally's Hospital holds the Ally's own board, and only that", () => {
        // R-5.5.6 — half the force of four. Ann picks (see the loss pick below); the default is c1's one, then one from Ann's board.
        const s = citizenDefends(atRevision, ANN, { ann: { siteId: 'c1', warbandsOnBoard: { [I]: 3 } }, warbands: { c1: { [I]: 1 }, p1: { [I]: 1 } } })
        defendingSideChooses(s)
        expect(s.warbandsBySite['c1']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(ANN).warbandsOnBoard[I]).toBe(2)
        expect(heldFor(s, ANN)).toBe(1)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 1)
    })

    it("the Ally answering later sees their redirect: the Chancellor's Wrestlers sacrifice at their site is held for their Hospital", () => {
        const s = table({
            revision: atRevision,
            dana: { warbandsOnBoard: { [DANA]: 8 } },
            denizens: { p1: [HOSPITAL, WRESTLERS] },
            warbands: { c1: { [I]: 2 }, p1: { [I]: 1 } },
            turn: DANA
        })
        attack(s, DANA, BEA, [siteTarget('c1')])
        defend([battlePlanUse(HOSPITAL)], BEA).apply(s)
        defend([battlePlanUse(WRESTLERS)], ANN).apply(s)
        expect(ongoingCampaign(s).plansUsedBy[ANN]).toEqual([WRESTLERS])
        expect(s.warbandsBySite['c1']?.[I]).toBe(1)
        expect(heldFor(s, BEA)).toBe(1)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
    })

    it("a Hospital whose site is lost: the warbands held for them are killed at the end, and count for the attacker's Cauldron", () => {
        const s = citizenDefends(atRevision, BEA, { bea: { warbandsOnBoard: { [I]: 2 } }, denizens: { c1: [HOSPITAL] }, warbands: { c1: { [I]: 2 } } }, 'c1')
        defendingSideChooses(s, [atSite('c1', 2)])
        expect(heldFor(s, BEA)).toBe(2)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(2)
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: DANA, placements: [], burnFavor: false })).apply(s)
        expect(s.campaign).toBeUndefined()
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
    })

    it("R-X.4 — before revision 13 they are the Chancellor's, so the Chancellor's Hospital catches them and theirs does not, as recorded", () => {
        const hers = citizenDefends(before, BEA)
        defendingSideChooses(hers, [atSite('c1', 1)])
        expect(heldFor(hers, BEA)).toBe(0)
        expect(imperialBank(hers)).toBe(CHANCELLOR_BANK + 1)

        const allys = citizenDefends(before, ANN)
        defendingSideChooses(allys, [atSite('c1', 1)])
        expect(heldFor(allys, ANN)).toBe(1)
        expect(imperialBank(allys)).toBe(CHANCELLOR_BANK)
    })
})

describe("the Chancellor defending: the Empire's warbands at their targeted sites and on their board are theirs", () => {
    function chancellorDefends(revision: number) {
        const s = table({
            revision,
            dana: { warbandsOnBoard: { [DANA]: 8 } },
            bea: { siteId: 'h1' },
            ann: { siteId: 'c1', warbandsOnBoard: { [I]: 2 } },
            denizens: { p1: [HOSPITAL] },
            warbands: { c1: { [I]: 2 }, p1: { [I]: 1 } },
            turn: DANA
        })
        attack(s, DANA, ANN, [siteTarget('c1')])
        defend([battlePlanUse(HOSPITAL)], ANN).apply(s)
        Object.assign(ongoingCampaign(s), { swords: 9, defense: 0 })
        sacrifice(s, DANA, { sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        defendingSideChooses(s, [atSite('c1', 1), onBoard(ANN, 1)])
        return s
    }

    for (const revision of [atRevision, before]) {
        it(`control at revision ${revision}: the Chancellor's Hospital holds both`, () => {
            const s = chancellorDefends(revision)
            expect(heldFor(s, ANN)).toBe(2)
            expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        })
    }
})

describe('D: a Citizen attacking the Chancellor through Captains — the warbands at the Captains site are theirs (Captains\' Q&A)', () => {
    /**
     * Bea (a Citizen) rules c1, where Captains is, and names c2 (two Imperial warbands) to attack Ann,
     * the Chancellor, who uses Hospital at h1.
     */
    function captainsTable(revision: number) {
        const s = table({
            revision,
            bea: { warbandsOnBoard: { [I]: 3 } },
            ann: { warbandsOnBoard: { [I]: 3 } },
            denizens: { c1: [CAPTAINS], h1: [HOSPITAL] },
            warbands: { c1: { [I]: 1 }, c2: { [I]: 2 }, h1: { [I]: 2 } },
            turn: BEA
        })
        actionPowerUse(BEA, CAPTAINS, [site('c2')]).apply(s)
        s.actionCount += 1
        return s
    }

    function captainsAttack(revision: number) {
        const s = captainsTable(revision)
        attack(s, BEA, ANN, [siteTarget('c2')])
        expect(ongoingCampaign(s).nonImperialPlayerIds).toEqual([BEA])
        defend([battlePlanUse(HOSPITAL)], ANN).apply(s)
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: ANN, siteId: 'h1' }])
        Object.assign(ongoingCampaign(s), { swords: 0, defense: 1 })
        sacrifice(s, BEA, { sacrifice: 2, sacrificeKills: [atSite('c2', 2)] })
        return s
    }

    it("their sacrifice at the Captains site is not held for the Chancellor's Hospital, and counts for the Chancellor's Cauldron", () => {
        const s = captainsAttack(atRevision)
        expect(heldFor(s, ANN)).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(2)
    })

    it("R-X.4 — before revision 13 the Chancellor's Hospital holds them, as recorded", () => {
        const s = captainsAttack(before)
        expect(heldFor(s, ANN)).toBe(2)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(0)
    })

    it('they have no Hospital of their own here: outside the Empire for this Campaign, they rule no site through its warbands (R-5.5.1.a)', () => {
        const s = captainsTable(atRevision)
        s.denizensBySite['c1'] = [CAPTAINS, HOSPITAL]
        expect(() => attack(s, BEA, ANN, [siteTarget('c2')], [HOSPITAL])).toThrow(/you do not rule denizen\.hearth\.hospital/)
    })
})

describe('D, untargeted: from revision 14 the Captains site need not be targeted (R-5.5.2-H2), and its warbands are still the Citizen’s for Hospital', () => {
    const fixed = OathRevision.EngineFixes10

    /**
     * Bea (a Citizen) names c2 (two Imperial warbands) with Captains against Ann, the Chancellor,
     * without targeting it: Ann's pawn and favor at c2, or h1, a site Ann rules elsewhere, where
     * Ann uses Hospital.
     */
    function untargeted(annAt: string, targets: CampaignTarget[], annBoard = 3) {
        const s = table({
            revision: fixed,
            bea: { warbandsOnBoard: { [I]: 3 } },
            ann: { siteId: annAt, warbandsOnBoard: { [I]: annBoard } },
            denizens: { c1: [CAPTAINS], h1: [HOSPITAL] },
            warbands: { c1: { [I]: 1 }, c2: { [I]: 2 }, h1: { [I]: 2 } },
            turn: BEA
        })
        actionPowerUse(BEA, CAPTAINS, [site('c2')]).apply(s)
        s.actionCount += 1
        attack(s, BEA, ANN, targets)
        expect(ongoingCampaign(s).nonImperialPlayerIds).toEqual([BEA])
        expect(ongoingCampaign(s).forceSiteIds).toContain('c2')
        defend([battlePlanUse(HOSPITAL)], ANN).apply(s)
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: ANN, siteId: 'h1' }])
        return s
    }

    const scenes: Array<[string, string, CampaignTarget[]]> = [
        ['only Ann’s pawn and favor', 'c2', [{ kind: CampaignTargetKind.PawnAndFavor }]],
        ['only h1, a site elsewhere', 'h1', [siteTarget('h1')]]
    ]
    for (const [what, annAt, targets] of scenes) {
        it(`${what}: the skulls’ kills at c2 die, count for Ann’s Cauldron, and Ann’s Hospital holds none`, () => {
            const s = untargeted(annAt, targets)
            ongoingCampaign(s).pendingSkullLosses = { skulls: 2 }
            new HydratedCampaignSkullLosses(buildAction(CampaignSkullLosses, { playerId: BEA, kills: [atSite('c2', 2)] })).apply(s)
            expect(s.warbandsBySite['c2']?.[I] ?? 0).toBe(0)
            expect(heldFor(s, ANN)).toBe(0)
            expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
            expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(2)
        })

    }

    it('only Ann’s pawn and favor, Ann’s board empty so the defending side loses nothing: the sacrifice at c2 dies the same way', () => {
        const s = untargeted('c2', [{ kind: CampaignTargetKind.PawnAndFavor }], 0)
        expect(ongoingCampaign(s).defendingForce).toEqual([])
        Object.assign(ongoingCampaign(s), { swords: 0, defense: 1 })
        sacrifice(s, BEA, { sacrifice: 2, sacrificeKills: [atSite('c2', 2)] })
        expect(s.warbandsBySite['c2']?.[I] ?? 0).toBe(0)
        expect(heldFor(s, ANN)).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(2)
    })
})

describe("the defending side's loss pick: Hospital holding one group's dead and not another's makes it a choice (R-5.5.6, R-10.28-H2)", () => {
    /**
     * Dana attacks Bea (a Citizen) at c1, where one Imperial warband stands; Ann, the Chancellor, is
     * there as an Ally with three on their board. Dana wins, so two of the four die, and Ann picks
     * them for the Empire (R-5.5.6.a). Hospital is at p1.
     */
    function siteAndBoard(revision: number, hospitalUser?: string) {
        const s = table({
            revision,
            dana: { warbandsOnBoard: { [DANA]: 8 } },
            ann: { siteId: 'c1', warbandsOnBoard: { [I]: 3 } },
            denizens: { p1: [HOSPITAL] },
            warbands: { c1: { [I]: 1 }, p1: { [I]: 1 } },
            turn: DANA
        })
        attack(s, DANA, BEA, [siteTarget('c1')])
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN])
        for (const playerId of [BEA, ANN]) {
            if (ongoingCampaign(s).pendingDefenderPlans?.queue[0] === playerId) {
                defend(playerId === hospitalUser ? [battlePlanUse(HOSPITAL)] : [], playerId).apply(s)
            }
        }
        expect(ongoingCampaign(s).killRedirects).toEqual(hospitalUser ? [{ playerId: hospitalUser, siteId: 'p1' }] : [])
        expect(ongoingCampaign(s).defendingForce).toEqual([atSite('c1', 1), onBoard(ANN, 3)])
        Object.assign(ongoingCampaign(s), { swords: 9, defense: 0 })
        sacrifice(s, DANA, { sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        return s
    }

    const siteAndOne = [atSite('c1', 1), onBoard(ANN, 1)]
    const twoFromBoard = [onBoard(ANN, 2)]

    function answer(s: HydratedOathGameState, kills: WarbandGroup[]) {
        expect(HydratedCampaignDefeatKills.reasonCannotChoose(s, ANN, kills)).toBeUndefined()
        defendingSideChooses(s, kills)
        expect(s.campaign?.pendingDefeatKills).toBeUndefined()
        // c1's warband dies, or survives to the Chancellor's board (R-5.5.6): Ann keeps two either way.
        expect(s.warbandsBySite['c1']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(ANN).warbandsOnBoard[I]).toBe(2)
    }

    it("Ann's Hospital holds Ann's board and not Bea's site: Ann is asked, and each answer kills and holds as picked", () => {
        expect(HydratedCampaignDefeatKills.chooserId(siteAndBoard(atRevision, ANN))).toBe(ANN)

        const one = siteAndBoard(atRevision, ANN)
        answer(one, siteAndOne)
        expect(heldFor(one, ANN)).toBe(1)
        expect(imperialBank(one)).toBe(CHANCELLOR_BANK + 1)

        const both = siteAndBoard(atRevision, ANN)
        answer(both, twoFromBoard)
        expect(heldFor(both, ANN)).toBe(2)
        expect(imperialBank(both)).toBe(CHANCELLOR_BANK)
        expect(enemyWarbandsKilledFor(both, ongoingCampaign(both), BattlePlanSide.Attacker)).toBe(0)
    })

    it("Bea's Hospital holds Bea's site and not Ann's board: Ann is asked, and each answer kills and holds as picked", () => {
        expect(HydratedCampaignDefeatKills.chooserId(siteAndBoard(atRevision, BEA))).toBe(ANN)

        const one = siteAndBoard(atRevision, BEA)
        answer(one, siteAndOne)
        expect(heldFor(one, BEA)).toBe(1)
        expect(imperialBank(one)).toBe(CHANCELLOR_BANK + 1)

        const both = siteAndBoard(atRevision, BEA)
        answer(both, twoFromBoard)
        expect(heldFor(both, BEA)).toBe(0)
        expect(imperialBank(both)).toBe(CHANCELLOR_BANK + 2)
    })

    it('control: with no Hospital in force nothing differs, so the engine picks as before', () => {
        const s = siteAndBoard(atRevision)
        expect(HydratedCampaignDefeatKills.chooserId(s)).toBeUndefined()
        expect(s.warbandsBySite['c1']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(ANN).warbandsOnBoard[I]).toBe(2)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
    })

    it("control: one Hospital holding every group (Ann defending Ann's own site) leaves nothing to pick", () => {
        const s = table({
            revision: atRevision,
            dana: { warbandsOnBoard: { [DANA]: 8 } },
            bea: { siteId: 'h1' },
            ann: { siteId: 'c1', warbandsOnBoard: { [I]: 3 } },
            denizens: { p1: [HOSPITAL] },
            warbands: { c1: { [I]: 1 }, p1: { [I]: 1 } },
            turn: DANA
        })
        attack(s, DANA, ANN, [siteTarget('c1')])
        defend([battlePlanUse(HOSPITAL)], ANN).apply(s)
        expect(ongoingCampaign(s).defendingForce).toEqual([atSite('c1', 1), onBoard(ANN, 3)])
        Object.assign(ongoingCampaign(s), { swords: 9, defense: 0 })
        sacrifice(s, DANA, { sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
        expect(HydratedCampaignDefeatKills.chooserId(s)).toBeUndefined()
        expect(heldFor(s, ANN)).toBe(2)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
    })

    it("Ann's own view offers the same pick: Ann may choose, and both answers pass there as on the server, changing nothing", () => {
        const ann = { kind: 'player', playerId: ANN } as const
        const s = siteAndBoard(atRevision, ANN)
        const server = JSON.stringify(s.dehydrate())
        const view = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, ann)), ann)
        expect(HydratedCampaignDefeatKills.chooserId(view)).toBe(ANN)
        expect(HydratedCampaignDefeatKills.canDoCampaignDefeatKills(view, ANN)).toBe(true)
        expect(HydratedCampaignDefeatKills.required(view)).toBe(2)
        for (const kills of [siteAndOne, twoFromBoard]) {
            expect(HydratedCampaignDefeatKills.reasonCannotChoose(view, ANN, kills)).toBeUndefined()
            expect(HydratedCampaignDefeatKills.reasonCannotChoose(s, ANN, kills)).toBeUndefined()
        }
        expect(JSON.stringify(s.dehydrate())).toBe(server)
    })

    it("R-X.4 — before revision 13 both groups were the Chancellor's for Hospital, so the engine picks, as recorded", () => {
        const s = siteAndBoard(before, ANN)
        expect(HydratedCampaignDefeatKills.chooserId(s)).toBeUndefined()
        expect(s.warbandsBySite['c1']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(ANN).warbandsOnBoard[I]).toBe(2)
        expect(heldFor(s, ANN)).toBe(2)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
    })
})
