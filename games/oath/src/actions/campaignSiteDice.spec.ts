import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Campaign, HydratedCampaign, type CampaignDefender } from './campaign.js'
import { CampaignAttackPlans, HydratedCampaignAttackPlans } from './campaignAttackPlans.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import type { BattlePlanUse } from '../model/battlePlanUse.js'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testPlayer,
    testState,
    testVaultWithRelics
} from '../testing/fixture.js'
import { buildAction, joinDefence } from '../testing/actions.js'
import { actionPowerUse, battlePlanUse, site, siteTarget } from '../testing/choices.js'
import { defend } from '../testing/steps.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { served } from '../testing/projection.js'
import { OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const RANGERS = 'denizen.beast.rangers'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const LONGBOWS = 'denizen.order.longbows'
const SPECIALIST = 'denizen.order.specialist'
const CODE_OF_HONOR = 'denizen.order.code-of-honor'
const RELIC_HUNTER = 'denizen.order.relic-hunter'
const CAPTAINS = 'denizen.order.captains'
const HOSPITAL = 'denizen.hearth.hospital'
const INSECT_SWARM = 'denizen.beast.insect-swarm'
const TENTS = 'denizen.nomad.tents'
const MAP = 'relic.map'
const HIDDEN_PLACE = 'site.the-hidden-place'

const atRevision = OathRevision.EngineFixes9
const before = OathRevision.EngineFixes8

const DANA = 'dana' // the attacker
const RHYS = 'rhys' // the defender
const ANN = 'ann' // the Chancellor
const BEA = 'bea' // a Citizen

const FIXTURE_SITES = [...CRADLE, ...PROVINCES, ...HINTERLAND]
const PAWN_AND_FAVOR: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const PEOPLES_FAVOR: CampaignTarget = {
    kind: CampaignTargetKind.Banner,
    banner: Banner.PeoplesFavor
}

interface Scene {
    revision: number
    /** Where Dana's and Rhys's pawns stand: h1, the Mountain, unless a scene says otherwise. */
    at?: string
    dana?: Partial<OathPlayerState>
    rhys?: Partial<OathPlayerState>
    denizens?: Record<string, string[]>
    warbands?: Record<string, WarbandCounts>
    state?: Partial<OathProjectedState>
}

/**
 * Dana and Rhys are Exiles; Ann, the Chancellor, is away at p2. c1 is the Plains and h1 the Mountain.
 * Rhys rules the Mountain with two warbands; nobody holds the Plains, so the bandits rule it.
 */
function table(scene: Scene): HydratedOathGameState {
    const at = scene.at ?? 'h1'
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: at,
                supply: 6,
                favor: 6,
                secrets: 3,
                warbandsOnBoard: { [DANA]: 4 },
                warbandsInPersonalBank: { [DANA]: 8 },
                ...scene.dana
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: at,
                supply: 4,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [RHYS]: 2 },
                warbandsInPersonalBank: { [RHYS]: 10 },
                ...scene.rhys
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'p2',
                supply: 4,
                favor: 3,
                secrets: 1,
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 }
            })
        ],
        {
            oathRevision: scene.revision,
            siteCards: {
                ...Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])),
                c1: 'site.plains',
                h1: 'site.mountain'
            },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [], ...scene.denizens },
            warbandsBySite: { h1: { [RHYS]: 2 }, ...scene.warbands },
            prng: { seed: 1, invocations: 0 },
            ...scene.state
        }
    )
    openTurn(s, DANA)
    return s
}

interface Declared {
    targets?: CampaignTarget[]
    attackDice?: number
    plans?: BattlePlanUse[]
    defender?: CampaignDefender
    flipSecret?: boolean
}

/** Dana's Campaign against Rhys: by default the Mountain and Rhys's pawn and favor (3 defense dice), no attack dice. */
function declaration(fields: Declared = {}) {
    return {
        defender: fields.defender ?? { kind: 'player' as const, playerId: RHYS },
        targets: fields.targets ?? [siteTarget('h1'), PAWN_AND_FAVOR],
        attackDice: fields.attackDice ?? 0,
        plans: fields.plans ?? [],
        ...(fields.flipSecret ? { flipSecret: true } : {})
    }
}

function campaign(s: HydratedOathGameState, fields: Declared = {}): HydratedCampaign {
    const action = new HydratedCampaign(
        buildAction(Campaign, { playerId: DANA, ...declaration(fields) })
    )
    action.apply(s)
    return action
}

function battle(action: HydratedCampaign) {
    return required(action.metadata?.battle, 'the Campaign mustered')
}

function cannotCampaign(s: HydratedOathGameState, fields: Declared = {}): string | undefined {
    return HydratedCampaign.reasonCannotCampaign(s, DANA, declaration(fields))
}

const envoyRefusal = (pool: number, left: number) =>
    `Peace Envoy: one favor per defense die is ${pool} favor beyond its cost, and you would have ${left}`

describe('a targeted Plains or Mountain changes the attack pool in Step 2, before any battle plan (R-11.4-H1)', () => {
    it('Rangers sees the defense die the Mountain adds to an empty attack pool, and adds its two dice', () => {
        const s = table({
            revision: atRevision,
            dana: { advisers: [{ cardId: RANGERS, faceUp: true }] }
        })
        const action = campaign(s, { plans: [battlePlanUse(RANGERS)] })
        expect(battle(action).plansUsed).toContain(RANGERS)
        expect(ongoingCampaign(s).defensePool).toBe(4)
        expect(ongoingCampaign(s).attackPool).toBe(2)
    })

    it("Peace Envoy gives one favor for each of the four defense dice, the Mountain's included", () => {
        const s = table({
            revision: atRevision,
            dana: { advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        const action = campaign(s, { plans: [battlePlanUse(PEACE_ENVOY)] })
        expect(ongoingCampaign(s).defensePool).toBe(4)
        expect(s.getPlayerState(RHYS).favor).toBe(4 + 4)
        expect(s.getPlayerState(DANA).favor).toBe(6 - 1 - 4)
        expect(battle(action).planNotes).toEqual([
            `Peace Envoy: ${DANA} gave ${RHYS} 4 favor, one per defense die`
        ])
    })

    it("Peace Envoy's check counts the Mountain's die: its cost and three favor are refused, its cost and four accepted", () => {
        const envoy = [battlePlanUse(PEACE_ENVOY)]
        const short = table({
            revision: atRevision,
            dana: { favor: 1 + 3, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(short, { plans: envoy })).toBe(envoyRefusal(4, 3))
        const enough = table({
            revision: atRevision,
            dana: { favor: 1 + 4, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(enough, { plans: envoy })).toBeUndefined()
        campaign(enough, { plans: envoy })
        expect(enough.getPlayerState(RHYS).favor).toBe(4 + 4)
        expect(enough.getPlayerState(DANA).favor).toBe(0)
    })

    it("the bandits' Bear Traps at the Plains takes the die the Plains added, so no defense die is added", () => {
        const s = table({
            revision: atRevision,
            at: 'c1',
            denizens: { c1: [BEAR_TRAPS] },
            rhys: { siteId: 'p1' }
        })
        const action = campaign(s, { defender: { kind: 'bandits' }, targets: [siteTarget('c1')] })
        expect(battle(action).plansUsed).toContain(BEAR_TRAPS)
        expect(battle(action).attackPool).toBe(0)
        expect(battle(action).defensePool).toBe(1)
    })

    it("Longbows' die comes after the Mountain's: one attack die is rolled, and the Mountain's defense die stays", () => {
        const s = table({
            revision: atRevision,
            dana: { advisers: [{ cardId: LONGBOWS, faceUp: true }] }
        })
        campaign(s, { plans: [battlePlanUse(LONGBOWS)] })
        expect(ongoingCampaign(s).attackPool).toBe(1)
        expect(ongoingCampaign(s).defensePool).toBe(3 + 1)
    })

    describe('controls the order does not change', () => {
        it('Longbows at the Mountain with two attack dice declared: two dice, and the defense unchanged', () => {
            const s = table({
                revision: atRevision,
                dana: { advisers: [{ cardId: LONGBOWS, faceUp: true }] }
            })
            campaign(s, { attackDice: 2, plans: [battlePlanUse(LONGBOWS)] })
            expect(ongoingCampaign(s).attackPool).toBe(2)
            expect(ongoingCampaign(s).defensePool).toBe(3)
        })

        it('Rangers at the Mountain with one die declared: three defense dice in either order, so no two dice', () => {
            const s = table({
                revision: atRevision,
                dana: { advisers: [{ cardId: RANGERS, faceUp: true }] }
            })
            const action = campaign(s, { attackDice: 1, plans: [battlePlanUse(RANGERS)] })
            expect(battle(action).plansUsed).toContain(RANGERS)
            expect(ongoingCampaign(s).attackPool).toBe(0)
            expect(ongoingCampaign(s).defensePool).toBe(3)
        })

        it("the Mountain with the bandits' Longbows: the same end totals in either order", () => {
            // The bandits rule the Mountain and the Plains, so the Plains' cost-free Longbows is theirs.
            const s = table({
                revision: atRevision,
                denizens: { c1: [LONGBOWS] },
                warbands: { h1: {} },
                rhys: { siteId: 'p1' }
            })
            const action = campaign(s, {
                defender: { kind: 'bandits' },
                targets: [siteTarget('h1')],
                attackDice: 1
            })
            expect(battle(action).plansUsed).toEqual([LONGBOWS])
            expect(ongoingCampaign(s).attackPool).toBe(0)
            expect(ongoingCampaign(s).defensePool).toBe(2)
        })

        it('Peace Envoy at the Plains with one die: one defense die, one favor', () => {
            const s = table({
                revision: atRevision,
                at: 'c1',
                warbands: { c1: { [RHYS]: 2 } },
                dana: { advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
            })
            campaign(s, {
                targets: [siteTarget('c1')],
                attackDice: 1,
                plans: [battlePlanUse(PEACE_ENVOY)]
            })
            expect(ongoingCampaign(s).attackPool).toBe(2)
            expect(ongoingCampaign(s).defensePool).toBe(1)
            expect(s.getPlayerState(RHYS).favor).toBe(4 + 1)
        })
    })
})

describe('R-X.4: a game created before revision 13 adds the site dice after the battle plans', () => {
    it('Rangers sees three defense dice and adds nothing', () => {
        const s = table({
            revision: before,
            dana: { advisers: [{ cardId: RANGERS, faceUp: true }] }
        })
        campaign(s, { plans: [battlePlanUse(RANGERS)] })
        expect(ongoingCampaign(s).attackPool).toBe(0)
        expect(ongoingCampaign(s).defensePool).toBe(4)
    })

    it("Peace Envoy's check accepts its cost and three favor, and it gives three", () => {
        const s = table({
            revision: before,
            dana: { favor: 1 + 3, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(s, { plans: [battlePlanUse(PEACE_ENVOY)] })).toBeUndefined()
        campaign(s, { plans: [battlePlanUse(PEACE_ENVOY)] })
        expect(s.getPlayerState(RHYS).favor).toBe(4 + 3)
        expect(ongoingCampaign(s).defensePool).toBe(4)
    })

    it("the bandits' Bear Traps at the Plains ends at one attack die and two defense dice", () => {
        const s = table({
            revision: before,
            at: 'c1',
            denizens: { c1: [BEAR_TRAPS] },
            rhys: { siteId: 'p1' }
        })
        const action = campaign(s, { defender: { kind: 'bandits' }, targets: [siteTarget('c1')] })
        expect(battle(action).plansUsed).toContain(BEAR_TRAPS)
        expect(battle(action).attackPool).toBe(1)
        expect(battle(action).defensePool).toBe(2)
    })

    it('Longbows at the Mountain with no dice declared ends at no attack die and no extra defense die', () => {
        const s = table({
            revision: before,
            dana: { advisers: [{ cardId: LONGBOWS, faceUp: true }] }
        })
        campaign(s, { plans: [battlePlanUse(LONGBOWS)] })
        expect(ongoingCampaign(s).attackPool).toBe(0)
        expect(ongoingCampaign(s).defensePool).toBe(3)
    })
})

describe('the Step 2 pools with other targets, sites and plans', () => {
    it('a Mountain and a Plains fold in target order, both before the plans', () => {
        // Rhys rules both; his People's Favor (1) is the third target. Mountain first: its die from the
        // empty pool adds a defense die (4), and Rangers sees it. Plains first: no defense die is added.
        const banner = {
            banners: {
                [Banner.PeoplesFavor]: { value: 1, holderPlayerId: RHYS },
                [Banner.DarkestSecret]: { value: 1 }
            }
        }
        const scene = {
            revision: atRevision,
            warbands: { c1: { [RHYS]: 1 } },
            dana: { advisers: [{ cardId: RANGERS, faceUp: true }] },
            state: banner
        }
        const plans = [battlePlanUse(RANGERS)]

        const mountainFirst = table(scene)
        campaign(mountainFirst, {
            targets: [siteTarget('h1'), siteTarget('c1'), PEOPLES_FAVOR],
            plans
        })
        expect(ongoingCampaign(mountainFirst).defensePool).toBe(4)
        expect(ongoingCampaign(mountainFirst).attackPool).toBe(1 + 2)

        const plainsFirst = table(scene)
        campaign(plainsFirst, {
            targets: [siteTarget('c1'), siteTarget('h1'), PEOPLES_FAVOR],
            plans
        })
        expect(ongoingCampaign(plainsFirst).defensePool).toBe(3)
        expect(ongoingCampaign(plainsFirst).attackPool).toBe(0)

        const old = table({ ...scene, revision: before })
        campaign(old, { targets: [siteTarget('h1'), siteTarget('c1'), PEOPLES_FAVOR], plans })
        expect(ongoingCampaign(old).defensePool).toBe(4)
        expect(ongoingCampaign(old).attackPool).toBe(1)
    })

    // Nobody's warbands hold the Mountain, so Rhys's pawn there is the only thing targeted at it.
    const pawnOnly = {
        revision: atRevision,
        warbands: { h1: {} },
        dana: { advisers: [{ cardId: RANGERS, faceUp: true }] }
    }
    const onlyTargets: [string, CampaignTarget, Partial<Scene>][] = [
        [
            'his relic',
            { kind: CampaignTargetKind.Relic, cardId: MAP },
            { rhys: { relicIds: [MAP] } }
        ],
        [
            'his banner',
            PEOPLES_FAVOR,
            {
                state: {
                    banners: {
                        [Banner.PeoplesFavor]: { value: 3, holderPlayerId: RHYS },
                        [Banner.DarkestSecret]: { value: 1 }
                    }
                }
            }
        ]
    ]
    for (const [name, target, extra] of onlyTargets) {
        it(`the Mountain counts through Rhys's pawn there when only ${name} is targeted`, () => {
            const s = table({ ...pawnOnly, ...extra })
            campaign(s, { targets: [target], plans: [battlePlanUse(RANGERS)] })
            expect(ongoingCampaign(s).defensePool).toBe(3 + 1)
            expect(ongoingCampaign(s).attackPool).toBe(2)
        })
    }

    it('the Mountain counts through his pawn and favor too', () => {
        const s = table(pawnOnly)
        campaign(s, { targets: [PAWN_AND_FAVOR], plans: [battlePlanUse(RANGERS)] })
        expect(ongoingCampaign(s).attackPool).toBe(0)
        expect(ongoingCampaign(s).defensePool).toBe(2 + 1)
    })

    it("Relic Hunter's facedown relic at the Mountain: the site's die is there before Relic Hunter and Rangers are used", () => {
        const s = table({
            revision: atRevision,
            dana: {
                favor: 6,
                advisers: [
                    { cardId: RELIC_HUNTER, faceUp: true },
                    { cardId: RANGERS, faceUp: true }
                ]
            },
            state: {
                banners: {
                    [Banner.PeoplesFavor]: { value: 1, holderPlayerId: RHYS },
                    [Banner.DarkestSecret]: { value: 1 }
                },
                relicsBySite: { h1: [{ slotId: 'h1-r1' }] },
                vault: testVaultWithRelics({ 'h1-r1': 'relic.whistle' })
            }
        })
        const action = campaign(s, {
            targets: [
                siteTarget('h1'),
                { kind: CampaignTargetKind.SiteRelic, slotId: 'h1-r1' },
                PEOPLES_FAVOR
            ],
            plans: [battlePlanUse(RELIC_HUNTER), battlePlanUse(RANGERS)]
        })
        expect(battle(action).plansUsed).toEqual([RELIC_HUNTER, RANGERS])
        expect(ongoingCampaign(s).defensePool).toBe(3 + 1)
        expect(ongoingCampaign(s).attackPool).toBe(2)
    })

    it('Captains: Dana acts from the Plains she names, so her pawn on the Mountain takes nothing', () => {
        for (const revision of [atRevision, before]) {
            const s = table({
                revision,
                denizens: { h1: [CAPTAINS] },
                warbands: { c1: { [DANA]: 2, [RHYS]: 1 } }
            })
            actionPowerUse(DANA, CAPTAINS, [site('c1')]).apply(s)
            s.actionCount += 1
            campaign(s, { targets: [siteTarget('c1')], attackDice: 1 })
            expect(ongoingCampaign(s).attackPool, `revision ${revision}`).toBe(2)
            expect(ongoingCampaign(s).defensePool, `revision ${revision}`).toBe(1)
        }
    })

    it("Specialist locks the bandits' plans; the Plains' die still comes first", () => {
        const s = table({
            revision: atRevision,
            at: 'c1',
            denizens: { c1: [BEAR_TRAPS] },
            rhys: { siteId: 'p1' },
            dana: {
                advisers: [
                    { cardId: SPECIALIST, faceUp: true },
                    { cardId: LONGBOWS, faceUp: true }
                ]
            }
        })
        const action = campaign(s, {
            defender: { kind: 'bandits' },
            targets: [siteTarget('c1')],
            plans: [battlePlanUse(SPECIALIST), battlePlanUse(LONGBOWS)]
        })
        expect(battle(action).plansUsed).toEqual([SPECIALIST, LONGBOWS])
        expect(ongoingCampaign(s).attackPool).toBe(2)
        expect(ongoingCampaign(s).defensePool).toBe(1)
    })

    it("Hospital: the bandits' Bear Traps at the Plains still sends its warband to Hospital's site, from the new pools", () => {
        const s = table({
            revision: atRevision,
            at: 'c1',
            rhys: { siteId: 'p1' },
            denizens: { c1: [BEAR_TRAPS], c2: [HOSPITAL] },
            warbands: { c2: { [DANA]: 1 } }
        })
        const action = campaign(s, {
            defender: { kind: 'bandits' },
            targets: [siteTarget('c1')],
            plans: [battlePlanUse(HOSPITAL)]
        })
        expect(battle(action).plansUsed).toContain(BEAR_TRAPS)
        expect(ongoingCampaign(s).attackPool).toBe(0)
        expect(ongoingCampaign(s).defensePool).toBe(1)
        expect(ongoingCampaign(s).killRedirects).toEqual([{ playerId: DANA, siteId: 'c2' }])
        expect(ongoingCampaign(s).heldForHospital).toEqual([
            expect.objectContaining({ playerId: DANA, siteId: 'c2', count: 1 })
        ])
    })

    it("the defender's Peace Envoy reads the pool the site dice left, as before", () => {
        for (const revision of [atRevision, before]) {
            const s = table({
                revision,
                rhys: { favor: 6, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
            })
            campaign(s)
            defend([battlePlanUse(PEACE_ENVOY)], RHYS).apply(s)
            expect(s.getPlayerState(DANA).favor, `revision ${revision}`).toBe(6 + 4)
        }
    })

    it('Peace Envoy under Insect Swarm: the check is both costs and the Step 2 pool', () => {
        const envoy = [battlePlanUse(PEACE_ENVOY)]
        const rhys = { advisers: [{ cardId: INSECT_SWARM, faceUp: true }] }
        const short = table({
            revision: atRevision,
            rhys,
            dana: { favor: 2 + 3, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(short, { plans: envoy })).toBe(envoyRefusal(4, 3))
        const enough = table({
            revision: atRevision,
            rhys,
            dana: { favor: 2 + 4, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(enough, { plans: envoy })).toBeUndefined()
    })

    it('Code of Honor and Peace Envoy are still refused together', () => {
        const s = table({
            revision: atRevision,
            dana: {
                advisers: [
                    { cardId: PEACE_ENVOY, faceUp: true },
                    { cardId: CODE_OF_HONOR, faceUp: true }
                ]
            }
        })
        expect(
            cannotCampaign(s, {
                attackDice: 1,
                plans: [battlePlanUse(PEACE_ENVOY), battlePlanUse(CODE_OF_HONOR)]
            })
        ).toMatch(/cannot use other battle plans/)
    })

    it("The Hidden Place's flipped secret pays nothing toward Peace Envoy's favor", () => {
        const scene = {
            revision: atRevision,
            at: 'p1',
            warbands: { p1: { [RHYS]: 2 } },
            state: {
                siteCards: {
                    ...Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])),
                    p1: HIDDEN_PLACE
                }
            }
        }
        const fields = {
            targets: [siteTarget('p1'), PAWN_AND_FAVOR],
            attackDice: 1,
            plans: [battlePlanUse(PEACE_ENVOY)],
            flipSecret: true
        }
        const short = table({
            ...scene,
            dana: { favor: 1 + 2, secrets: 3, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(short, fields)).toBe(envoyRefusal(3, 2))
        const enough = table({
            ...scene,
            dana: { favor: 1 + 3, secrets: 1, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] }
        })
        expect(cannotCampaign(enough, fields)).toBeUndefined()
    })
})

/**
 * Dana attacks Ann, the Chancellor, on the Mountain, where Ann's pawn and two Imperial warbands stand
 * and Bea, a Citizen, is asked to join. The Mountain and Ann's pawn and favor: 3 defense dice.
 */
function askedToJoin(revision: number, danaFavor: number): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'h1',
                supply: 6,
                favor: danaFavor,
                secrets: 3,
                warbandsOnBoard: { [DANA]: 4 },
                warbandsInPersonalBank: { [DANA]: 8 },
                advisers: [{ cardId: PEACE_ENVOY, faceUp: true }]
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                supply: 4,
                favor: 3,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 }
            }),
            testPlayer({
                playerId: BEA,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'h1',
                supply: 4,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [BEA]: 10 },
                advisers: [{ cardId: TENTS, faceUp: false }]
            })
        ],
        {
            oathRevision: revision,
            siteCards: {
                ...Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])),
                c1: 'site.plains',
                h1: 'site.mountain'
            },
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { h1: { [IMPERIAL_WARBANDS]: 2 } },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, DANA)
    const declared = {
        defender: { kind: 'player' as const, playerId: ANN },
        targets: [siteTarget('h1'), PAWN_AND_FAVOR],
        attackDice: 0
    }
    expect(HydratedCampaign.reasonCannotCampaign(s, DANA, declared)).toBeUndefined()
    new HydratedCampaign(buildAction(Campaign, { playerId: DANA, ...declared })).apply(s)
    joinDefence(s, BEA, ANN)
    expect(s.pendingCampaign?.awaitingAttackerPlans).toBe(true)
    return s
}

describe('Peace Envoy declared once the Citizens asked to join have answered', () => {
    const envoy = [battlePlanUse(PEACE_ENVOY)]

    it("the check uses the declaration's attack dice: its cost and three favor are refused, its cost and four accepted and paid", () => {
        expect(
            HydratedCampaignAttackPlans.reasonCannotDeclare(
                askedToJoin(atRevision, 1 + 3),
                DANA,
                envoy
            )
        ).toBe(envoyRefusal(4, 3))
        const s = askedToJoin(atRevision, 1 + 4)
        expect(HydratedCampaignAttackPlans.reasonCannotDeclare(s, DANA, envoy)).toBeUndefined()
        new HydratedCampaignAttackPlans(
            buildAction(CampaignAttackPlans, { playerId: DANA, plans: envoy })
        ).apply(s)
        expect(ongoingCampaign(s).defensePool).toBe(4)
        expect(s.getPlayerState(ANN).favor).toBe(3 + 4)
    })

    it('R-X.4: before revision 13 its cost and three favor are accepted, and three are given', () => {
        const s = askedToJoin(before, 1 + 3)
        expect(HydratedCampaignAttackPlans.reasonCannotDeclare(s, DANA, envoy)).toBeUndefined()
        new HydratedCampaignAttackPlans(
            buildAction(CampaignAttackPlans, { playerId: DANA, plans: envoy })
        ).apply(s)
        expect(s.getPlayerState(ANN).favor).toBe(3 + 3)
    })
})

describe("Peace Envoy's check on the attacker's own view, where hidden values cannot be read", () => {
    const dana = { kind: 'player', playerId: DANA } as const
    /** Dana's own view as her table judges on it: projected, then guarded. */
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, dana)), dana)

    /**
     * Rhys holds a facedown adviser, the Map and the People's Favor (1), and the Mountain a facedown
     * relic, so Dana's view lacks what the server has.
     */
    function hidden(danaFavor: number) {
        return table({
            revision: atRevision,
            dana: { favor: danaFavor, advisers: [{ cardId: PEACE_ENVOY, faceUp: true }] },
            rhys: { relicIds: [MAP], advisers: [{ cardId: TENTS, faceUp: false }] },
            state: {
                banners: {
                    [Banner.PeoplesFavor]: { value: 1, holderPlayerId: RHYS },
                    [Banner.DarkestSecret]: { value: 1 }
                },
                relicsBySite: { h1: [{ slotId: 'h1-r1' }] },
                vault: testVaultWithRelics({ 'h1-r1': 'relic.whistle' })
            }
        })
    }

    it('reasonCannotCampaign: the same refusal and acceptance as on the server, and nothing changed', () => {
        const envoy = [battlePlanUse(PEACE_ENVOY)]
        const scenes: [CampaignTarget[], number][] = [
            // The Mountain (1) and Rhys's pawn and favor (2), and the Mountain's die: 4.
            [[siteTarget('h1'), PAWN_AND_FAVOR], 4],
            // The Mountain (1), the Map (3) and the People's Favor (1), and the Mountain's die: 6.
            [[siteTarget('h1'), { kind: CampaignTargetKind.Relic, cardId: MAP }, PEOPLES_FAVOR], 6]
        ]
        for (const [targets, pool] of scenes) {
            for (const [favor, expected] of [
                [1 + pool - 1, envoyRefusal(pool, pool - 1)],
                [1 + pool, undefined]
            ] as const) {
                const s = hidden(favor)
                const server = JSON.stringify(s.dehydrate())
                const view = ownView(s)
                const seen = JSON.stringify(served(s, dana))
                expect(cannotCampaign(s, { targets, plans: envoy })).toBe(expected)
                expect(cannotCampaign(view, { targets, plans: envoy })).toBe(expected)
                expect(JSON.stringify(s.dehydrate())).toBe(server)
                expect(JSON.stringify(served(s, dana))).toBe(seen)
            }
        }
    })

    it('HydratedCampaignAttackPlans.reasonCannotDeclare: the same refusal and acceptance as on the server, and nothing changed', () => {
        const envoy = [battlePlanUse(PEACE_ENVOY)]
        for (const [favor, expected] of [
            [1 + 3, envoyRefusal(4, 3)],
            [1 + 4, undefined]
        ] as const) {
            const s = askedToJoin(atRevision, favor)
            const server = JSON.stringify(s.dehydrate())
            const view = ownView(s)
            expect(HydratedCampaignAttackPlans.reasonCannotDeclare(s, DANA, envoy)).toBe(expected)
            expect(HydratedCampaignAttackPlans.reasonCannotDeclare(view, DANA, envoy)).toBe(
                expected
            )
            expect(JSON.stringify(s.dehydrate())).toBe(server)
        }
    })
})
