import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Campaign, HydratedCampaign } from './campaign.js'
import { HydratedCampaignDefend } from './campaignDefend.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction, joinDefence } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { defend } from '../testing/steps.js'
import { adviser } from '../testing/tables.js'
import { ongoingCampaign } from '../testing/required.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const CODE_OF_HONOR = 'denizen.order.code-of-honor'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const HOSPITAL = 'denizen.hearth.hospital'
const WRESTLERS = 'denizen.order.wrestlers'
const LONGBOWS = 'denizen.order.longbows'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const SPECIALIST = 'denizen.order.specialist'
const TENTS = 'denizen.nomad.tents'

const atRevision = OathRevision.EngineFixes9
const before = OathRevision.EngineFixes8

const DANA = 'dana' // an Exile, the attacker
const BEA = 'bea' // a Citizen, the defender
const ANN = 'ann' // the Chancellor, Bea's Ally
const RHYS = 'rhys' // a second Citizen

const HONOR_REFUSAL = `${CODE_OF_HONOR}: your side has already used another battle plan`

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
 * h1 and Rhys at p2, away from the battle unless a scene moves him. By default Bea holds Bear
 * Traps and Ann Code of Honor.
 */
function table(scene: Scene): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3,
                warbandsOnBoard: { [DANA]: 6 }, warbandsInPersonalBank: { [DANA]: 4 }, ...scene.dana
            }),
            testPlayer({
                playerId: BEA, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', supply: 6, favor: 4, secrets: 3,
                warbandsInPersonalBank: { [BEA]: 8 }, advisers: [adviser(BEAR_TRAPS)], ...scene.bea
            }),
            testPlayer({
                playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', supply: 6, favor: 4, secrets: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                advisers: [adviser(CODE_OF_HONOR)], ...scene.ann
            }),
            testPlayer({
                playerId: RHYS, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'p2', supply: 6, favor: 4, secrets: 3,
                warbandsInPersonalBank: { [RHYS]: 8 }, ...scene.rhys
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

/** Dana's Campaign against `defender` (Bea) at c1, with three attack dice. */
function attack(s: HydratedOathGameState, defender = BEA, plans: BattlePlanUse[] = []): HydratedCampaign {
    const action = new HydratedCampaign(
        buildAction(Campaign, {
            playerId: DANA,
            defender: { kind: 'player', playerId: defender },
            targets: [siteTarget('c1')],
            attackDice: 3,
            plans
        })
    )
    action.apply(s)
    return action
}

function answer(s: HydratedOathGameState, playerId: string, cardIds: string[] = []): HydratedCampaignDefend {
    const action = defend(cardIds.map((cardId) => battlePlanUse(cardId)), playerId)
    action.apply(s)
    return action
}

const honor = [battlePlanUse(CODE_OF_HONOR)]
const offered = (s: HydratedOathGameState, playerId: string) =>
    HydratedCampaignDefend.usablePlans(s, playerId).map((power) => power.cardId)

describe('Code of Honor cannot be used once its side has used another battle plan (R-5.5.3-H3)', () => {
    it('Bea uses Bear Traps; then Ann cannot use Code of Honor, is not offered it, and answers with no plans', () => {
        const s = table({ revision: atRevision })
        attack(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([BEA, ANN])
        answer(s, BEA, [BEAR_TRAPS])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBe(HONOR_REFUSAL)
        expect(() => answer(s, ANN, [CODE_OF_HONOR])).toThrow(/your side has already used another battle plan/)
        expect(offered(s, ANN)).toEqual([])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, [])).toBeUndefined()
        const rolls = s.prng.invocations
        answer(s, ANN)
        expect(ongoingCampaign(s).pendingDefenderPlans).toBeUndefined()
        expect(s.prng.invocations).toBeGreaterThan(rolls)
        expect(ongoingCampaign(s).plansUsed).toEqual([BEAR_TRAPS])
    })

    it('Ann defends and uses a plan; Rhys, admitted as her Ally, cannot use his Code of Honor', () => {
        const s = table({
            revision: atRevision,
            bea: { siteId: 'p2', advisers: [] },
            ann: { siteId: 'c1', advisers: [adviser(BEAR_TRAPS)] },
            rhys: { siteId: 'c1', advisers: [adviser(CODE_OF_HONOR)] }
        })
        attack(s, ANN)
        joinDefence(s, RHYS, ANN)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN, RHYS])
        answer(s, ANN, [BEAR_TRAPS])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, RHYS, honor)).toBe(HONOR_REFUSAL)
        expect(offered(s, RHYS)).toEqual([])
    })

    it('a later Ally after an earlier one: Ann uses Bear Traps, and Rhys, admitted by Bea, cannot use Code of Honor', () => {
        const s = table({
            revision: atRevision,
            bea: { advisers: [] },
            ann: { advisers: [adviser(BEAR_TRAPS)] },
            rhys: { siteId: 'c1', advisers: [adviser(CODE_OF_HONOR)] }
        })
        attack(s)
        joinDefence(s, RHYS, BEA)
        expect(ongoingCampaign(s).allyPlayerIds).toEqual([ANN, RHYS])
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN, RHYS])
        answer(s, ANN, [BEAR_TRAPS])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, RHYS, honor)).toBe(HONOR_REFUSAL)
        expect(offered(s, RHYS)).toEqual([])
    })

    it('Code of Honor standing at an Imperial site: any of the side may use it until Bea uses Bear Traps, and then Ann cannot', () => {
        const s = table({
            revision: atRevision,
            ann: { advisers: [adviser(TENTS)] },
            state: { denizensBySite: { c1: [CODE_OF_HONOR], c2: [], p1: [], h1: [] } }
        })
        attack(s)
        expect(offered(s, BEA)).toEqual(expect.arrayContaining([BEAR_TRAPS, CODE_OF_HONOR]))
        answer(s, BEA, [BEAR_TRAPS])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBe(HONOR_REFUSAL)
        expect(offered(s, ANN)).toEqual([])
    })

    it('a plan that kills or sacrifices counts too: after Bea uses Hospital, or Wrestlers, alone, Ann cannot use Code of Honor', () => {
        const scenes: [string, Partial<OathProjectedState>][] = [
            [HOSPITAL, { denizensBySite: { c1: [HOSPITAL], c2: [], p1: [], h1: [] } }],
            [WRESTLERS, {}]
        ]
        for (const [plan, state] of scenes) {
            const s = table({ revision: atRevision, bea: { advisers: plan === WRESTLERS ? [adviser(WRESTLERS)] : [] }, state })
            attack(s)
            answer(s, BEA, [plan])
            expect(ongoingCampaign(s).plansUsed).toEqual([plan])
            expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBe(HONOR_REFUSAL)
            expect(offered(s, ANN)).toEqual([])
        }
    })
})

describe('what Code of Honor still allows, and what it still locks', () => {
    it('Bea answers with no plans: Ann uses Code of Honor and takes two attack dice away', () => {
        const s = table({ revision: atRevision })
        attack(s)
        answer(s, BEA)
        expect(offered(s, ANN)).toEqual([CODE_OF_HONOR])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBeUndefined()
        const used = answer(s, ANN, [CODE_OF_HONOR])
        expect(used.metadata?.plansUsed).toEqual([CODE_OF_HONOR])
        expect(used.metadata?.attackPool).toBe(1)
    })

    it('Bea uses Code of Honor first: the rest of her side is locked out, as before', () => {
        const s = table({ revision: atRevision, bea: { advisers: [adviser(CODE_OF_HONOR)] }, ann: { advisers: [adviser(BEAR_TRAPS)] } })
        attack(s)
        answer(s, BEA, [CODE_OF_HONOR])
        expect(ongoingCampaign(s).defenderPlansLocked).toBe(true)
        expect(ongoingCampaign(s).pendingDefenderPlans).toBeUndefined()
    })

    it('Code of Honor with Hospital in one declaration stays refused', () => {
        const s = table({
            revision: atRevision,
            bea: { advisers: [adviser(CODE_OF_HONOR)] },
            state: { denizensBySite: { c1: [HOSPITAL], c2: [], p1: [], h1: [] } }
        })
        attack(s)
        expect(HydratedCampaignDefend.reasonCannotDefend(s, BEA, [battlePlanUse(HOSPITAL), battlePlanUse(CODE_OF_HONOR)])).toMatch(/you cannot use other battle plans with it/)
    })

    it("the attacker's plans are the other side's: after Dana's Longbows, Ann's Code of Honor, and Bea's own, are accepted", () => {
        const dana = { advisers: [adviser(LONGBOWS)] }
        const s = table({ revision: atRevision, dana, bea: { advisers: [] } })
        attack(s, BEA, [battlePlanUse(LONGBOWS)])
        expect(ongoingCampaign(s).plansUsedBy[DANA]).toEqual([LONGBOWS])
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBeUndefined()
        expect(answer(s, ANN, [CODE_OF_HONOR]).metadata?.plansUsed).toEqual([CODE_OF_HONOR])

        const own = table({ revision: atRevision, dana, bea: { advisers: [adviser(CODE_OF_HONOR)] }, ann: { advisers: [] } })
        attack(own, BEA, [battlePlanUse(LONGBOWS)])
        expect(HydratedCampaignDefend.reasonCannotDefend(own, BEA, honor)).toBeUndefined()
        expect(answer(own, BEA, [CODE_OF_HONOR]).metadata?.plansUsed).toEqual([CODE_OF_HONOR])
    })

    it("Peace Envoy binds its user alone: Ann's Peace Envoy after Bea's Bear Traps is accepted", () => {
        const s = table({ revision: atRevision, ann: { advisers: [adviser(PEACE_ENVOY)] } })
        attack(s)
        answer(s, BEA, [BEAR_TRAPS])
        expect(offered(s, ANN)).toEqual([PEACE_ENVOY])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, [battlePlanUse(PEACE_ENVOY)])).toBeUndefined()
        answer(s, ANN, [PEACE_ENVOY])
        expect(ongoingCampaign(s).plansUsed).toEqual([BEAR_TRAPS, PEACE_ENVOY])
        expect(ongoingCampaign(s).decidedVictor).toBe('defender')
    })

    it("Specialist locks the defending side at the muster: nobody answers, so Code of Honor's check never runs", () => {
        const s = table({ revision: atRevision, dana: { advisers: [adviser(SPECIALIST)] } })
        attack(s, BEA, [battlePlanUse(SPECIALIST)])
        expect(ongoingCampaign(s).defenderPlansLocked).toBe(true)
        expect(ongoingCampaign(s).pendingDefenderPlans).toBeUndefined()
        expect(offered(s, ANN)).toEqual([])
    })
})

describe('revision 12 (R-X.4)', () => {
    it("Ann's Code of Honor after Bea's Bear Traps is accepted, and the side keeps both, as before", () => {
        const s = table({ revision: before })
        attack(s)
        answer(s, BEA, [BEAR_TRAPS])
        expect(offered(s, ANN)).toEqual([CODE_OF_HONOR])
        expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBeUndefined()
        answer(s, ANN, [CODE_OF_HONOR])
        expect(ongoingCampaign(s).plansUsed).toEqual([BEAR_TRAPS, CODE_OF_HONOR])
    })
})

describe("the defending side's checks on Ann's own view, where hidden values cannot be read", () => {
    const ann = { kind: 'player', playerId: ANN } as const
    /** Ann's own view as her table judges on it: projected, then guarded. */
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, ann)), ann)

    it('reasonCannotDefend and usablePlans: the same refusal and list as on the server, and nothing changed', () => {
        for (const [beaPlans, expected, list] of [
            [[BEAR_TRAPS], HONOR_REFUSAL, []],
            [[], undefined, [CODE_OF_HONOR]]
        ] as const) {
            // Dana and Bea each hold a facedown adviser, so Ann's view lacks what the server has.
            const s = table({
                revision: atRevision,
                dana: { advisers: [adviser(TENTS, false)] },
                bea: { advisers: [adviser(BEAR_TRAPS), adviser(TENTS, false)] }
            })
            attack(s)
            answer(s, BEA, [...beaPlans])
            const server = JSON.stringify(s.dehydrate())
            const seen = JSON.stringify(served(s, ann))
            const view = ownView(s)
            expect(HydratedCampaignDefend.reasonCannotDefend(s, ANN, honor)).toBe(expected)
            expect(HydratedCampaignDefend.reasonCannotDefend(view, ANN, honor)).toBe(expected)
            expect(offered(s, ANN)).toEqual(list)
            expect(offered(view, ANN)).toEqual(list)
            expect(JSON.stringify(s.dehydrate())).toBe(server)
            expect(JSON.stringify(served(s, ann))).toBe(seen)
        }
    })
})
