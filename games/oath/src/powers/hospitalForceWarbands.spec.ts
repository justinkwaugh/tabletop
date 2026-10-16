import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { CampaignTargetKind, type CampaignTarget, type WarbandGroup } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import { Campaign, HydratedCampaign } from '../actions/campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { CampaignSkullLosses, HydratedCampaignSkullLosses } from '../actions/campaignSkullLosses.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { actionPowerUse, battlePlanUse, site, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { defend } from '../testing/steps.js'
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

describe('a Citizen attacker with Vow of Union: the Empire\'s warbands at her sites are hers for Hospital (R-10.28-H2)', () => {
    /** Bea (a Citizen, Vow of Union) attacks Dana (an Exile) at c1, using Hospital at p1; c2's three Imperial warbands join her force. */
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

    it('A: skull losses picked at a Vow of Union site are held for her Hospital, and not an enemy warband killed', () => {
        const s = citizenAttacks(atRevision)
        skullsPicked(s)
        expect(heldFor(s, BEA)).toBe(2)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(0)
    })

    it("defeated, her Hospital's site is a Vow of Union site too: its survivor goes to her board (R-5.5.6-H2), so what Hospital held dies at the end", () => {
        const s = citizenAttacks(atRevision)
        Object.assign(ongoingCampaign(s), { swords: 0, defense: 1 })
        // Half her force of seven: two at c2 and one on her board.
        sacrifice(s, BEA, { sacrifice: 0, defeatKills: [atSite('c2', 2), onBoard(BEA, 1)] })
        expect(s.campaign).toBeUndefined()
        expect(s.warbandsBySite['p1']?.[I] ?? 0).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 3)
    })

    it("R-X.4 — before revision 13 the Empire's warbands there are the Chancellor's, so her Hospital misses them, as recorded", () => {
        const s = citizenAttacks(before)
        skullsPicked(s)
        expect(heldFor(s, BEA)).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Defender)).toBe(2)
    })
})

describe('B: a defeated Citizen attacker through Captains: the Empire\'s warbands at the Captains site are hers for Hospital', () => {
    /**
     * Bea (a Citizen) rules c1, where Captains is, and names c2 (three Imperial warbands), where Dana (an
     * Exile) stands; she attacks Dana's pawn and is defeated. Hospital is at p1, which she rules.
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
        // R-5.5.6 — half her force of six: two at c2 and one on her board; c2's last goes to her board.
        sacrifice(s, BEA, { sacrifice: 0, defeatKills: [atSite('c2', 2), onBoard(BEA, 1)] })
        expect(s.campaign).toBeUndefined()
        expect(s.warbandsBySite['c2']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(BEA).warbandsOnBoard[I]).toBe(3)
        return s
    }

    it('all three are held, and placed on her Hospital site at the end', () => {
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

describe("a Citizen defender: the Empire's warbands at her targeted sites are hers for Hospital", () => {
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

    it("C: her own Hospital catches the Empire's warbands killed at her targeted site", () => {
        const s = citizenDefends(atRevision, BEA)
        defendingSideChooses(s, [atSite('c1', 1)])
        expect(heldFor(s, BEA)).toBe(1)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(0)
    })

    it("the reverse: the Chancellor's Hospital, as her Ally, does not catch them (R-10.28: you alone)", () => {
        const s = citizenDefends(atRevision, ANN)
        defendingSideChooses(s, [atSite('c1', 1)])
        expect(heldFor(s, ANN)).toBe(0)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 1)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(1)
    })

    it("the Ally's Hospital holds the Ally's own board, and only that", () => {
        // R-5.5.6 — half the force of four: c1's one, then one from Ann's board.
        const s = citizenDefends(atRevision, ANN, { ann: { siteId: 'c1', warbandsOnBoard: { [I]: 3 } }, warbands: { c1: { [I]: 1 }, p1: { [I]: 1 } } })
        defendingSideChooses(s)
        expect(s.warbandsBySite['c1']?.[I] ?? 0).toBe(0)
        expect(s.getPlayerState(ANN).warbandsOnBoard[I]).toBe(2)
        expect(heldFor(s, ANN)).toBe(1)
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 1)
    })

    it("the Ally answering later sees her redirect: the Chancellor's Wrestlers sacrifice at her site is held for her Hospital", () => {
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

    it("a Hospital whose site is lost: the warbands held for her are killed at the end, and count for the attacker's Cauldron", () => {
        const s = citizenDefends(atRevision, BEA, { bea: { warbandsOnBoard: { [I]: 2 } }, denizens: { c1: [HOSPITAL] }, warbands: { c1: { [I]: 2 } } }, 'c1')
        defendingSideChooses(s, [atSite('c1', 2)])
        expect(heldFor(s, BEA)).toBe(2)
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(2)
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: DANA, placements: [], burnFavor: false })).apply(s)
        expect(s.campaign).toBeUndefined()
        expect(imperialBank(s)).toBe(CHANCELLOR_BANK + 2)
    })

    it("R-X.4 — before revision 13 they are the Chancellor's, so the Chancellor's Hospital catches them and hers does not, as recorded", () => {
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

describe("the Chancellor defending: the Empire's warbands at her targeted sites and on her board are hers", () => {
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

describe('D: a Citizen attacking the Chancellor through Captains — the warbands at the Captains site are hers (Captains\' Q&A)', () => {
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

    it("her sacrifice at the Captains site is not held for the Chancellor's Hospital, and counts for the Chancellor's Cauldron", () => {
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

    it('she has no Hospital of her own here: outside the Empire for this Campaign, she rules no site through its warbands (R-5.5.1.a)', () => {
        const s = captainsTable(atRevision)
        s.denizensBySite['c1'] = [CAPTAINS, HOSPITAL]
        expect(() => attack(s, BEA, ANN, [siteTarget('c2')], [HOSPITAL])).toThrow(/you do not rule denizen\.hearth\.hospital/)
    })
})
