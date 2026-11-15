import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import type { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from '../actions/campaignResolveVictory.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    testPlayer,
    testState,
    openTurn,
    withChancellor
} from '../testing/fixture.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse, boardWarbands, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { ATTACKER, DEFENDER, campaign, defend, finishCampaign } from '../testing/steps.js'
import { enemyWarbandsKilledFor } from '../util/campaignRoll.js'
import { OathRevision } from '../util/revision.js'
import { describeWarbands } from '../util/warbands.js'
import '../powers/index.js'

const HOSPITAL = 'denizen.hearth.hospital'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const WRESTLERS = 'denizen.order.wrestlers'
const CAULDRON = 'relic.cursed-cauldron'
const RING = 'relic.ring-of-devotion'

const atRevision = OathRevision.EngineFixes27
const before = OathRevision.EngineFixes26

const FIXTURE_SITES = [...CRADLE, ...PROVINCES, ...HINTERLAND]
const ATTACKER_BANK = 4
const DEFENDER_BANK = 8

interface Scene {
    revision: number
    denizens: Record<string, string[]>
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
                playerId: ATTACKER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [ATTACKER]: 6 },
                warbandsInPersonalBank: { [ATTACKER]: ATTACKER_BANK },
                ...scene.attacker
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [DEFENDER]: 2 },
                warbandsInPersonalBank: { [DEFENDER]: DEFENDER_BANK },
                ...scene.defender
            })
        ]),
        {
            oathRevision: scene.revision,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...scene.denizens },
            warbandsBySite: {
                c1: { [DEFENDER]: 2 },
                c2: { [ATTACKER]: 1 },
                p1: { [DEFENDER]: 3 }
            },
            siteCards: Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])),
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, ATTACKER)
    return s
}

const bankOf = (s: HydratedOathGameState, playerId: string) =>
    s.getPlayerState(playerId).warbandsInPersonalBank[playerId] ?? 0
const atSite = (s: HydratedOathGameState, siteId: string, owner: string) =>
    s.warbandsBySite[siteId]?.[owner] ?? 0
const heldFor = (s: HydratedOathGameState, playerId: string) =>
    (ongoingCampaign(s).heldForHospital ?? [])
        .filter((held) => held.playerId === playerId)
        .reduce((total, held) => total + held.count, 0)
/** Wrestlers sacrifices one of the defender's warbands on their board. */
const wrestlers = { ...battlePlanUse(WRESTLERS), choices: [boardWarbands(DEFENDER, DEFENDER, 1)] }
const cauldronNote = (gained: number) =>
    `Cursed Cauldron: ${ATTACKER} gained ${describeWarbands(gained, ATTACKER)}, one per enemy warband killed`

/** The attacker wins: nine swords against no defense, no sacrifice, the defender's losses chosen. */
function attackerWins(s: HydratedOathGameState): HydratedCampaignResolveVictory {
    ongoingCampaign(s).swords = 9
    ongoingCampaign(s).defense = 0
    new HydratedCampaignSacrifice(
        buildAction(CampaignSacrifice, {
            playerId: ATTACKER,
            sacrifice: 0,
            defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
        })
    ).apply(s)
    defendingSideChooses(s)
    const victory = new HydratedCampaignResolveVictory(
        buildAction(CampaignResolveVictory, {
            playerId: ATTACKER,
            placements: [],
            burnFavor: false
        })
    )
    victory.apply(s)
    return victory
}

describe("Ring of Devotion bars Hospital's placement (revision 32)", () => {
    /**
     * Dana's case, as the attacker: Hospital at c2, which they rule; the defender's Bear Traps kills
     * one of their warbands and their defeat half the five left, so three are held for c2.
     */
    function defeatedAttacker(revision: number, attacker: Partial<OathPlayerState> = {}) {
        const s = table({
            revision,
            denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] },
            attacker
        })
        campaign({ attackDice: 0, plans: [battlePlanUse(HOSPITAL)] }).apply(s)
        defend([battlePlanUse(BEAR_TRAPS)]).apply(s)
        expect(heldFor(s, ATTACKER)).toBe(1)
        const ended = finishCampaign(s)
        expect(s.campaign).toBeUndefined()
        expect(ended.metadata?.defeatKilled).toBe(2)
        return { s, ended }
    }

    it("the Ring's holder still rules Hospital's site at the end: the three held warbands are killed", () => {
        const { s, ended } = defeatedAttacker(atRevision, { relicIds: [RING] })
        expect(atSite(s, 'c2', ATTACKER)).toBe(1)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK + 3)
        // History: nothing went to Hospital's site.
        expect(ended.metadata?.hospitalPlaced).toBeUndefined()
    })

    it('control: without the Ring the three go to the site, as before', () => {
        const { s, ended } = defeatedAttacker(atRevision)
        expect(atSite(s, 'c2', ATTACKER)).toBe(1 + 3)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
        expect(ended.metadata?.hospitalPlaced).toEqual([
            { playerId: ATTACKER, siteId: 'c2', owner: ATTACKER, count: 3 }
        ])
    })

    it('R-X.4 — before revision 32 the Ring does not stop Hospital: the three go to the site', () => {
        const { s, ended } = defeatedAttacker(before, { relicIds: [RING] })
        expect(atSite(s, 'c2', ATTACKER)).toBe(1 + 3)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK)
        expect(ended.metadata?.hospitalPlaced).toEqual([
            { playerId: ATTACKER, siteId: 'c2', owner: ATTACKER, count: 3 }
        ])
    })

    it('Hospital is still a plan its holder may use: it sets the warbands aside until the end', () => {
        const s = table({
            revision: atRevision,
            denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] },
            attacker: { relicIds: [RING] }
        })
        const declared = campaign({ attackDice: 0, plans: [battlePlanUse(HOSPITAL)] })
        declared.apply(s)
        expect(declared.metadata?.battle?.plansUsed).toContain(HOSPITAL)
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: ATTACKER, siteId: 'c2' }])
    })
})

describe("Cursed Cauldron counts the warbands the Ring's Hospital cannot place (revision 32)", () => {
    /**
     * The defender holds Hospital at p1, which they keep, and sacrifices to Wrestlers at c1; the
     * attacker holds the Cauldron and wins.
     */
    function wrestled(revision: number, defender: Partial<OathPlayerState> = {}) {
        const s = table({
            revision,
            denizens: { c1: [WRESTLERS], p1: [HOSPITAL] },
            attacker: { relicIds: [CAULDRON] },
            defender: { warbandsOnBoard: { [DEFENDER]: 3 }, ...defender }
        })
        campaign({ attackDice: 0, plans: [battlePlanUse(CAULDRON)] }).apply(s)
        defend([battlePlanUse(HOSPITAL), wrestlers]).apply(s)
        expect(heldFor(s, DEFENDER)).toBe(1)
        return s
    }

    it('the held warbands die at the end, so they count for the Cauldron, once, and none reach p1', () => {
        const s = wrestled(atRevision, { relicIds: [RING] })
        const victory = attackerWins(s)
        // The sacrifice, then half the four left: c1's two lost.
        const held = 3
        expect(victory.metadata?.triggered).toContain(cauldronNote(held))
        expect(atSite(s, 'p1', DEFENDER)).toBe(3)
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK + held)
        expect(victory.metadata?.hospitalPlaced).toBeUndefined()
    })

    it('control: without the Ring Hospital places them at p1, and the Cauldron counts none', () => {
        const s = wrestled(atRevision)
        const victory = attackerWins(s)
        expect(victory.metadata?.triggered).toContain(cauldronNote(0))
        expect(atSite(s, 'p1', DEFENDER)).toBe(3 + 3)
        expect(bankOf(s, DEFENDER)).toBe(DEFENDER_BANK)
    })

    it('R-X.4 — before revision 32 the Ring changes nothing: placed at p1, none counted', () => {
        const s = wrestled(before, { relicIds: [RING] })
        expect(enemyWarbandsKilledFor(s, ongoingCampaign(s), BattlePlanSide.Attacker)).toBe(0)
        const victory = attackerWins(s)
        expect(victory.metadata?.triggered).toContain(cauldronNote(0))
        expect(atSite(s, 'p1', DEFENDER)).toBe(3 + 3)
    })
})

describe('the Ring changing hands during the Campaign is read when Hospital would place (revision 32)', () => {
    const ringTarget: CampaignTarget = { kind: CampaignTargetKind.Relic, cardId: RING }

    it("the attacker's Hospital: they take the Ring as a target, so at the end the held warband dies", () => {
        const s = table({
            revision: atRevision,
            denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] },
            defender: { relicIds: [RING] }
        })
        campaign({
            attackDice: 0,
            targets: [siteTarget('c1'), ringTarget],
            plans: [battlePlanUse(HOSPITAL)]
        }).apply(s)
        defend([battlePlanUse(BEAR_TRAPS)]).apply(s)
        expect(heldFor(s, ATTACKER)).toBe(1)
        const victory = attackerWins(s)
        expect(s.getPlayerState(ATTACKER).relicIds).toContain(RING)
        expect(atSite(s, 'c2', ATTACKER)).toBe(1)
        expect(bankOf(s, ATTACKER)).toBe(ATTACKER_BANK + 1)
        expect(victory.metadata?.hospitalPlaced).toBeUndefined()
    })

    it("the defender's Hospital: the attacker takes the Ring from them, so at the end Hospital places", () => {
        // The Cauldron tests' scene, with the defender holding the Ring and the attacker targeting it.
        const ringHeld = table({
            revision: atRevision,
            denizens: { c1: [WRESTLERS], p1: [HOSPITAL] },
            attacker: { relicIds: [CAULDRON] },
            defender: { warbandsOnBoard: { [DEFENDER]: 3 }, relicIds: [RING] }
        })
        campaign({
            attackDice: 0,
            targets: [siteTarget('c1'), ringTarget],
            plans: [battlePlanUse(CAULDRON)]
        }).apply(ringHeld)
        defend([battlePlanUse(HOSPITAL), wrestlers]).apply(ringHeld)
        expect(heldFor(ringHeld, DEFENDER)).toBe(1)
        const victory = attackerWins(ringHeld)
        expect(ringHeld.getPlayerState(DEFENDER).relicIds).not.toContain(RING)
        // The Cauldron reads after the Ring is taken, as the end does: none counted, all placed.
        expect(victory.metadata?.triggered).toContain(cauldronNote(0))
        expect(atSite(ringHeld, 'p1', DEFENDER)).toBe(3 + 3)
        expect(bankOf(ringHeld, DEFENDER)).toBe(DEFENDER_BANK)
        expect(victory.metadata?.hospitalPlaced).toEqual([
            { playerId: DEFENDER, siteId: 'p1', owner: DEFENDER, count: 3 }
        ])
    })
})
