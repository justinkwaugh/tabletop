import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Campaign, HydratedCampaign } from './campaign.js'
import { HydratedCampaignDefend } from './campaignDefend.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { HydratedOathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction, defendingSideChooses, joinDefence } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { defend } from '../testing/steps.js'
import { adviser } from '../testing/tables.js'
import { ongoingCampaign } from '../testing/required.js'
import { reasonPersistentForbidsSacrifice } from '../util/persistent.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import '../powers/index.js'

const PEACE_ENVOY = 'denizen.order.peace-envoy'
const FIELD_PROMOTION = 'denizen.order.field-promotion'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const CODE_OF_HONOR = 'denizen.order.code-of-honor'
const VOW_OF_PEACE = 'denizen.hearth.vow-of-peace'

const atRevision = CURRENT_OATH_REVISION
const before = OathRevision.EngineFixes9

const DANA = 'dana' // an Exile, the attacker
const BEA = 'bea' // a Citizen, the defender
const ANN = 'ann' // the Chancellor, Bea's Ally
const RHYS = 'rhys' // a second Citizen

interface Scene {
    revision: number
    bea?: Partial<OathPlayerState>
    ann?: Partial<OathPlayerState>
    rhys?: Partial<OathPlayerState>
}

/**
 * Dana attacks Bea at c1, which the Empire rules with two warbands, so Ann, the Chancellor, joins
 * as an Ally (Law 5.5.2). Dana's pawn is at Bea's site, so Bea's Peace Envoy pays Dana a favor per
 * defense die. By default Bea holds Peace Envoy and Ann Field Promotion. Rhys waits at p2.
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
                warbandsInPersonalBank: { [DANA]: 4 }
            }),
            testPlayer({
                playerId: BEA,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                supply: 6,
                favor: 8,
                secrets: 3,
                warbandsOnBoard: {},
                warbandsInPersonalBank: {},
                advisers: [adviser(PEACE_ENVOY)],
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
                advisers: [adviser(FIELD_PROMOTION)],
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
                warbandsOnBoard: {},
                warbandsInPersonalBank: {},
                ...scene.rhys
            })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 }, p1: { [IMPERIAL_WARBANDS]: 1 } },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, DANA)
    return s
}

function attack(s: HydratedOathGameState) {
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: DANA,
            defender: { kind: 'player', playerId: BEA },
            targets: [siteTarget('c1')],
            attackDice: 3
        })
    ).apply(s)
}

function answer(s: HydratedOathGameState, playerId: string, cardIds: string[] = []) {
    defend(
        cardIds.map((cardId) => battlePlanUse(cardId)),
        playerId
    ).apply(s)
}

/** Dana sacrifices nothing; the battle, decided by Peace Envoy, settles. */
function finish(s: HydratedOathGameState): HydratedCampaignSacrifice {
    const sacrifice = new HydratedCampaignSacrifice(
        buildAction(CampaignSacrifice, {
            playerId: DANA,
            sacrifice: 0,
            defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
        })
    )
    sacrifice.apply(s)
    defendingSideChooses(s)
    return sacrifice
}

const offered = (s: HydratedOathGameState, playerId: string) =>
    HydratedCampaignDefend.usablePlans(s, playerId).map((power) => power.cardId)
const imperialOnBoard = (s: HydratedOathGameState, playerId: string) =>
    s.getPlayerState(playerId).warbandsOnBoard[IMPERIAL_WARBANDS] ?? 0
const danaOnBoard = (s: HydratedOathGameState) => s.getPlayerState(DANA).warbandsOnBoard[DANA] ?? 0

describe('R-10.28-H1 — Peace Envoy’s “you cannot use other battle plans” binds its user alone', () => {
    it('Bea’s Peace Envoy, then Ann is asked and uses Field Promotion, and gains three warbands with the victory', () => {
        const s = table({ revision: atRevision })
        attack(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([BEA, ANN])
        answer(s, BEA, [PEACE_ENVOY])
        expect(ongoingCampaign(s).decidedVictor).toBe('defender')
        expect(ongoingCampaign(s).defenderPlansLocked).toBeUndefined()
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN])
        expect(offered(s, ANN)).toEqual([FIELD_PROMOTION])
        answer(s, ANN, [FIELD_PROMOTION])
        expect(ongoingCampaign(s).plansUsed).toEqual([PEACE_ENVOY, FIELD_PROMOTION])
        const sacrifice = finish(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(false)
        expect(imperialOnBoard(s, ANN)).toBe(5)
    })

    it('Bea’s Peace Envoy, then Ann’s Bear Traps kills one warband on Dana’s board; Bea is still victorious and nothing else dies', () => {
        const s = table({ revision: atRevision, ann: { advisers: [adviser(BEAR_TRAPS)] } })
        attack(s)
        answer(s, BEA, [PEACE_ENVOY])
        answer(s, ANN, [BEAR_TRAPS])
        expect(danaOnBoard(s)).toBe(5)
        const sacrifice = finish(s)
        expect(sacrifice.metadata?.attackerVictorious).toBe(false)
        expect(sacrifice.metadata?.defeatKilled).toBe(0)
        expect(danaOnBoard(s)).toBe(5)
    })

    it('Vow of Peace, ruled by Bea, forbids Dana’s sacrifice but not Ann’s Bear Traps, which is no sacrifice', () => {
        const s = table({
            revision: atRevision,
            bea: { advisers: [adviser(PEACE_ENVOY), adviser(VOW_OF_PEACE)] },
            ann: { advisers: [adviser(BEAR_TRAPS)] }
        })
        attack(s)
        answer(s, BEA, [PEACE_ENVOY])
        answer(s, ANN, [BEAR_TRAPS])
        expect(reasonPersistentForbidsSacrifice(s, DANA, [BEA, ANN])).toMatch(/Vow of Peace/)
        expect(danaOnBoard(s)).toBe(5)
    })

    it('an Ally’s Peace Envoy decides the battle, and Rhys, admitted after Ann, may still use a plan', () => {
        const s = table({
            revision: atRevision,
            bea: { advisers: [] },
            ann: { advisers: [adviser(PEACE_ENVOY)] },
            rhys: { siteId: 'c1', advisers: [adviser(FIELD_PROMOTION)] }
        })
        attack(s)
        joinDefence(s, RHYS, BEA)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN, RHYS])
        answer(s, ANN, [PEACE_ENVOY])
        expect(ongoingCampaign(s).decidedVictor).toBe('defender')
        expect(offered(s, RHYS)).toEqual([FIELD_PROMOTION])
        answer(s, RHYS, [FIELD_PROMOTION])
        finish(s)
        expect(imperialOnBoard(s, RHYS)).toBe(3)
    })

    it('Code of Honor still binds the whole side forward', () => {
        const s = table({ revision: atRevision, bea: { advisers: [adviser(CODE_OF_HONOR)] } })
        attack(s)
        answer(s, BEA, [CODE_OF_HONOR])
        expect(ongoingCampaign(s).defenderPlansLocked).toBe(true)
        expect(ongoingCampaign(s).pendingDefenderPlans).toBeUndefined()
    })

    it('before revision 14 Bea’s Peace Envoy locks Ann out, as recorded', () => {
        const s = table({ revision: before })
        attack(s)
        answer(s, BEA, [PEACE_ENVOY])
        expect(ongoingCampaign(s).defenderPlansLocked).toBe(true)
        expect(ongoingCampaign(s).pendingDefenderPlans).toBeUndefined()
        finish(s)
        expect(imperialOnBoard(s, ANN)).toBe(2)
    })
})
