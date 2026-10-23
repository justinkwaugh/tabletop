import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Campaign, HydratedCampaign } from './campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { answerConsent, buildAction, joinDefence } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { adviser } from '../testing/tables.js'
import { ongoingCampaign } from '../testing/required.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const VOW_OF_PEACE = 'denizen.hearth.vow-of-peace'
const ZEALOTS = 'denizen.discord.zealots'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const HOSPITAL = 'denizen.hearth.hospital'
const TENTS = 'denizen.nomad.tents'

const atRevision = OathRevision.EngineFixes9
const before = OathRevision.EngineFixes8

const DANA = 'dana' // an Exile, the attacker
const BEA = 'bea' // a Citizen, the defender
const ANN = 'ann' // the Chancellor, Bea's Ally
const RHYS = 'rhys' // a second Citizen

const PAWN_AND_FAVOR: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

interface Scene {
    revision: number
    dana?: Partial<OathPlayerState>
    bea?: Partial<OathPlayerState>
    ann?: Partial<OathPlayerState>
    rhys?: Partial<OathPlayerState>
    state?: Partial<OathProjectedState>
}

/**
 * Dana and Bea stand at c1, which the Empire rules with two warbands; Ann, the Chancellor, is at
 * h1 and Rhys at p2, away from the battle unless a scene moves them.
 */
function table(scene: Scene): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [DANA]: 6 },
                warbandsInPersonalBank: { [DANA]: 4 },
                ...scene.dana
            }),
            testPlayer({
                playerId: BEA,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsInPersonalBank: { [BEA]: 8 },
                ...scene.bea
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                ...scene.ann
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Yellow,
                status: PlayerStatus.Citizen,
                siteId: 'p2',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsInPersonalBank: { [RHYS]: 8 },
                ...scene.rhys
            })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 }, p1: { [IMPERIAL_WARBANDS]: 1 } },
            prng: { seed: 1, invocations: 0 },
            ...scene.state
        }
    )
    openTurn(s, DANA)
    return s
}

interface Attack {
    attacker?: string
    defender?: string
    targets?: CampaignTarget[]
    attackDice?: number
    plans?: BattlePlanUse[]
}

/** Dana's Campaign against Bea at c1, with two attack dice and no plans. */
function attack(s: HydratedOathGameState, fields: Attack = {}): HydratedCampaign {
    const action = new HydratedCampaign(
        buildAction(Campaign, {
            playerId: fields.attacker ?? DANA,
            defender: { kind: 'player', playerId: fields.defender ?? BEA },
            targets: fields.targets ?? [siteTarget('c1')],
            attackDice: fields.attackDice ?? 2,
            plans: fields.plans ?? []
        })
    )
    action.apply(s)
    return action
}

/** The roll left the attack one sword against three defense: a sacrifice of three (each worth one) wins. */
function shortOfVictory(s: HydratedOathGameState) {
    const campaign = ongoingCampaign(s)
    expect(campaign.pendingDefenderPlans).toBeUndefined()
    campaign.swords = 1
    campaign.defense = 3
}

function sacrificeRefusal(
    s: HydratedOathGameState,
    sacrifice = 3,
    attacker = DANA
): string | undefined {
    return HydratedCampaignSacrifice.reasonCannotResolve(s, attacker, {
        sacrifice,
        defeatKills: []
    })
}

function sacrifice(
    s: HydratedOathGameState,
    count = 3,
    attacker = DANA
): HydratedCampaignSacrifice {
    const action = new HydratedCampaignSacrifice(
        buildAction(CampaignSacrifice, {
            playerId: attacker,
            sacrifice: count,
            defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, count)
        })
    )
    action.apply(s)
    return action
}

const VOW_REFUSAL = 'Vow of Peace: attackers cannot sacrifice against its holder'

describe("an Ally's Vow of Peace forbids the attacker's sacrifice (R-5.5.2-H1)", () => {
    it("Ann, joining Bea's defence as the Chancellor, holds it: the sacrifice is refused, and applying it throws", () => {
        const s = table({ revision: atRevision, ann: { advisers: [adviser(VOW_OF_PEACE)] } })
        attack(s)
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN])
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBe(VOW_REFUSAL)
        expect(() => sacrifice(s)).toThrow(/Vow of Peace/)
        expect(ongoingCampaign(s).attackerVictorious).toBeUndefined()
    })

    it('Ann defends as the Chancellor and Rhys, admitted as their Ally, holds it: the sacrifice is refused', () => {
        const s = table({
            revision: atRevision,
            ann: { siteId: 'c1' },
            bea: { siteId: 'p2' },
            rhys: { siteId: 'c1', advisers: [adviser(VOW_OF_PEACE)] }
        })
        attack(s, { defender: ANN })
        expect(s.pendingCampaign?.toAsk).toEqual([RHYS])
        joinDefence(s, RHYS, ANN)
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([RHYS])
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBe(VOW_REFUSAL)
    })

    it('Zealots makes each sacrificed warband worth three: still refused, where without the Vow one wins', () => {
        for (const [annAdvisers, expected] of [
            [[adviser(VOW_OF_PEACE)], VOW_REFUSAL],
            [[], undefined]
        ] as const) {
            // No attack dice, so no skull takes Dana's two warbands; Ann's four at c1 outnumber them.
            const s = table({
                revision: atRevision,
                dana: { warbandsOnBoard: { [DANA]: 2 }, advisers: [adviser(ZEALOTS)] },
                ann: { advisers: [...annAdvisers] },
                state: { warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 4 } } }
            })
            attack(s, { attackDice: 0, plans: [battlePlanUse(ZEALOTS)] })
            expect(ongoingCampaign(s).sacrificeWorth).toBe(3)
            shortOfVictory(s)
            expect(HydratedCampaignSacrifice.sacrificeNeeded(ongoingCampaign(s))).toBe(1)
            expect(sacrificeRefusal(s, 1)).toBe(expected)
        }
    })
})

describe('who is on the defending side, and what is not refused', () => {
    it("Bea's own Vow of Peace: refused, as before", () => {
        for (const revision of [atRevision, before]) {
            const s = table({ revision, bea: { advisers: [adviser(VOW_OF_PEACE)] } })
            attack(s)
            shortOfVictory(s)
            expect(sacrificeRefusal(s)).toBe(VOW_REFUSAL)
        }
    })

    it("Rhys at the targeted site holds it but is not admitted, by their choice or by Bea's: the sacrifice is accepted", () => {
        for (const [joins, admitted] of [
            [false, false],
            [true, false]
        ] as const) {
            const s = table({
                revision: atRevision,
                rhys: { siteId: 'c1', advisers: [adviser(VOW_OF_PEACE)] }
            })
            attack(s)
            expect(s.pendingCampaign?.toAsk).toEqual([RHYS])
            answerConsent(s, RHYS, joins)
            if (joins) answerConsent(s, BEA, admitted)
            expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN])
            shortOfVictory(s)
            expect(sacrificeRefusal(s)).toBeUndefined()
        }
    })

    it('a Citizen defending against the Chancellor is outside the Empire (R-5.5.1.a) and takes no Ally: the Vow of Rhys, at the site, does nothing', () => {
        const s = table({
            revision: atRevision,
            ann: { siteId: 'c1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 } },
            rhys: { siteId: 'c1', advisers: [adviser(VOW_OF_PEACE)] }
        })
        openTurn(s, ANN)
        attack(s, { attacker: ANN, targets: [PAWN_AND_FAVOR] })
        expect(s.pendingCampaign).toBeUndefined()
        expect(ongoingCampaign(s).nonImperialPlayerIds).toEqual([BEA])
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([])
        shortOfVictory(s)
        expect(sacrificeRefusal(s, 3, ANN)).toBeUndefined()
    })

    it('no Vow of Peace on the side: the sacrifice is accepted and wins', () => {
        const s = table({ revision: atRevision })
        attack(s)
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBeUndefined()
        expect(sacrifice(s).metadata?.attackerVictorious).toBe(true)
    })

    it("Dana's Peace Envoy against Bea, with Ann's Vow: Dana is victorious, and nothing is sacrificed", () => {
        const s = table({
            revision: atRevision,
            dana: { advisers: [adviser(PEACE_ENVOY)] },
            ann: { advisers: [adviser(VOW_OF_PEACE)] }
        })
        attack(s, { plans: [battlePlanUse(PEACE_ENVOY)] })
        expect(ongoingCampaign(s).decidedVictor).toBe('attacker')
        expect(sacrificeRefusal(s, 0)).toBeUndefined()
        expect(sacrifice(s, 0).metadata?.attackerVictorious).toBe(true)
    })
})

describe('the Campaign around the refusal', () => {
    it('the defeat that follows: Dana sacrifices nothing, loses, and R-5.5.6 kills half their force', () => {
        const s = table({ revision: atRevision, ann: { advisers: [adviser(VOW_OF_PEACE)] } })
        // No attack dice, so no skull kills before the defeat.
        attack(s, { attackDice: 0 })
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBe(VOW_REFUSAL)
        const kills = HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
        expect(kills).toEqual([{ at: { kind: 'board', playerId: DANA }, owner: DANA, count: 3 }])
        expect(sacrifice(s, 0).metadata?.attackerVictorious).toBe(false)
        expect(s.getPlayerState(DANA).warbandsOnBoard[DANA]).toBe(3)
    })

    it("the same defeat with Dana's Hospital: the killed half is held and placed on Hospital's site", () => {
        const s = table({
            revision: atRevision,
            ann: { advisers: [adviser(VOW_OF_PEACE)] },
            state: {
                denizensBySite: { c1: [], c2: [HOSPITAL], p1: [], h1: [] },
                warbandsBySite: {
                    c1: { [IMPERIAL_WARBANDS]: 2 },
                    c2: { [DANA]: 1 },
                    p1: { [IMPERIAL_WARBANDS]: 1 }
                }
            }
        })
        attack(s, { attackDice: 0, plans: [battlePlanUse(HOSPITAL)] })
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBe(VOW_REFUSAL)
        expect(sacrifice(s, 0).metadata?.attackerVictorious).toBe(false)
        expect(s.campaign).toBeUndefined()
        expect(s.getPlayerState(DANA).warbandsOnBoard[DANA]).toBe(3)
        expect(s.warbandsBySite['c2']?.[DANA]).toBe(1 + 3)
    })

    it("Sneak Attack's Campaign out of turn: Ann's Vow refuses Dana's sacrifice the same way", () => {
        const s = table({
            revision: atRevision,
            dana: { advisers: [adviser(SNEAK_ATTACK)] },
            ann: { advisers: [adviser(VOW_OF_PEACE)] }
        })
        // Bea's own Campaign against Dana, with no attack dice: a certain defeat (R-5.5.5.b).
        openTurn(s, BEA)
        attack(s, { attacker: BEA, defender: DANA, targets: [PAWN_AND_FAVOR], attackDice: 0 })
        sacrifice(s, 0, BEA)
        expect(s.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.SneakAttack,
            askedPlayerId: DANA
        })
        // Bea shares the Empire's c1, so Dana must target it (R-5.5.2).
        attack(s)
        expect(ongoingCampaign(s)).toMatchObject({
            attackerPlayerId: DANA,
            defenderPlayerId: BEA,
            allyPlayerIds: [ANN]
        })
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBe(VOW_REFUSAL)
    })
})

describe('revision 12 (R-X.4)', () => {
    it("Ann's Vow lets Dana sacrifice, as before", () => {
        const s = table({ revision: before, ann: { advisers: [adviser(VOW_OF_PEACE)] } })
        attack(s)
        shortOfVictory(s)
        expect(sacrificeRefusal(s)).toBeUndefined()
        expect(sacrifice(s).metadata?.attackerVictorious).toBe(true)
    })
})

describe("the sacrifice check on the attacker's own view, where hidden values cannot be read", () => {
    const dana = { kind: 'player', playerId: DANA } as const
    /** Dana's own view as their table judges on it: projected, then guarded. */
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    it("reasonCannotResolve: the same refusal with Ann's Vow and the same acceptance without it, and nothing changed", () => {
        for (const [annAdvisers, expected] of [
            [[adviser(VOW_OF_PEACE), adviser(TENTS, false)], VOW_REFUSAL],
            [[adviser(TENTS, false)], undefined]
        ] as const) {
            // Bea and Ann each hold a facedown adviser, so Dana's view lacks what the server has.
            const s = table({
                revision: atRevision,
                bea: { advisers: [adviser(TENTS, false)] },
                ann: { advisers: [...annAdvisers] }
            })
            attack(s)
            shortOfVictory(s)
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, dana))
            const view = ownView(s)
            expect(sacrificeRefusal(s)).toBe(expected)
            expect(sacrificeRefusal(view)).toBe(expected)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, dana))).toBe(seen)
        }
    })
})
