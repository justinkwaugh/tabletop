import { describe, expect, it } from 'vitest'
import { Color, type GameAction } from '@tabletop/common'
import { Campaign, isCampaign } from './campaign.js'
import { CampaignDefend, isCampaignDefend } from './campaignDefend.js'
import { AnswerQuestion, isAnswerQuestion } from './answerQuestion.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import { type OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { PowerQuestionKind } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime } from '../definition/runtime.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import { CRADLE, HINTERLAND, PROVINCES, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { OathTestEngine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { ongoingCampaign } from '../testing/required.js'
import '../powers/index.js'

const JINX = 'denizen.arcane.jinx'
const MOUNTED_PATROL = 'denizen.nomad.mounted-patrol'
const HEARTS_AND_MINDS = 'denizen.hearth.hearts-and-minds'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const HOSPITAL = 'denizen.hearth.hospital'

const DANA = 'dana' // an Exile, the attacker
const BEA = 'bea' // an Exile who rules c1, the defender
const ANN = 'ann' // the Chancellor, away

const atRevision = CURRENT_OATH_REVISION
const before = OathRevision.EngineFixes9

interface Scene {
    revision?: number
    /** Who holds Jinx faceup as an adviser. */
    jinx?: string[]
    /** The denizens at c1, which Bea rules, and at c2, which Dana rules. */
    c1?: string[]
    c2?: string[]
    defender?: Partial<OathPlayerState>
}

/**
 * Dana (an Exile, 5 warbands on their board) at c1 attacks Bea (an Exile with 2 warbands at c1 and 3
 * on their board), targeting c1 and Bea's pawn and favor: 3 defense dice. Seed 1 rolls 1 shield, so 6
 * defense; kept, the 4 attack dice roll 4 swords and a skull; Bea's reroll makes 7 defense, then the
 * attack rolls 2 swords and no skull.
 */
function table(scene: Scene = {}): OathProjectedState {
    const advisers = (playerId: string) => ((scene.jinx ?? [BEA]).includes(playerId) ? [{ cardId: JINX, faceUp: true }] : [])
    const s = testState(
        [
            testPlayer({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 2, advisers: advisers(DANA), warbandsOnBoard: { [DANA]: 5 }, warbandsInPersonalBank: { [DANA]: 6 } }),
            testPlayer({ playerId: BEA, color: Color.Yellow, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 2, advisers: advisers(BEA), warbandsOnBoard: { [BEA]: 3 }, warbandsInPersonalBank: { [BEA]: 6 }, ...scene.defender }),
            testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1' })
        ],
        {
            oathRevision: scene.revision ?? atRevision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: scene.c1 ?? [], c2: scene.c2 ?? [], p1: [], h1: [] },
            warbandsBySite: { c1: { [BEA]: 2 }, c2: { [DANA]: 1 } },
            siteCards: Object.fromEntries([...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => [slotId, slotId])),
            prng: { seed: 1, invocations: 0 }
        }
    )
    s.turnManager.series = [{ type: 'turn', playerId: DANA, start: 0 }]
    s.activePlayerIds = [DANA]
    return s.dehydrate()
}

const engine = new OathTestEngine(OathRuntime)
const game = testGame([DANA, BEA, ANN])

const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

function declare(state: OathProjectedState, fields: { attackDice?: number; plans?: string[] } = {}) {
    const plans = (fields.plans ?? []).map((cardId) => battlePlanUse(cardId))
    return engine.runNext(buildAction(Campaign, { playerId: DANA, defender: { kind: 'player', playerId: BEA }, targets: [siteTarget('c1'), pawnAndFavor], attackDice: fields.attackDice ?? 4, plans }), state, game)
}

function defend(state: OathProjectedState, plans: string[]) {
    return engine.runNext(buildAction(CampaignDefend, { playerId: BEA, plans: plans.map((cardId) => battlePlanUse(cardId)) }), state, game)
}

function answer(state: OathProjectedState, playerId: string, reroll: boolean) {
    return engine.runNext(buildAction(AnswerQuestion, { playerId, answer: { kind: PowerQuestionKind.RerollDice, reroll } }), state, game)
}

function only(processed: readonly GameAction[]): GameAction {
    expect(processed).toHaveLength(1)
    return processed[0]
}

/** The Campaign action's record of the battle. */
function campaignBattle(processed: readonly GameAction[]) {
    const action = only(processed)
    if (!isCampaign(action)) throw Error(`expected a Campaign, not ${action.type}`)
    return action.metadata?.battle
}

function defendRecord(processed: readonly GameAction[]) {
    const action = only(processed)
    if (!isCampaignDefend(action)) throw Error(`expected a CampaignDefend, not ${action.type}`)
    return action.metadata
}

/** The answer's record of the attack it rolled. */
function heldAttackOf(processed: readonly GameAction[]) {
    const action = only(processed)
    if (!isAnswerQuestion(action)) throw Error(`expected an answer, not ${action.type}`)
    return action.metadata?.heldAttack
}

const danaBoard = (state: OathProjectedState) => state.players[0].warbandsOnBoard[DANA] ?? 0
const asked = (state: OathProjectedState) => (state.pendingQuestions?.queue ?? []).map((question) => question.askedPlayerId)

describe('R-5.5.4-H1 — the attack held for the defender’s reroll, as History reads it', () => {
    it('the Campaign records the 4 attack dice held, with the defense rolled and no swords', () => {
        const declared = declare(table())
        expect(asked(declared.updatedState)).toEqual([BEA])
        expect(campaignBattle(declared.processedActions)).toMatchObject({ attackPool: 4, heldAttackDice: 4, defense: 6, swords: 0, skullsKilled: 0 })
    })

    it('Bea keeps the roll: the answer records 4 swords against 6 defense and 1 warband lost to a skull', () => {
        const atQuestion = declare(table()).updatedState
        const kept = answer(atQuestion, BEA, false)
        expect(heldAttackOf(kept.processedActions)).toEqual({ attackerPlayerId: DANA, swords: 4, defense: 6, skullsKilled: 1 })
        expect(danaBoard(kept.updatedState)).toBe(4)
        const campaign = ongoingCampaign(kept.updatedState)
        expect([campaign.swords, campaign.defense]).toEqual([4, 6])
    })

    it('Bea rerolls: the answer records 2 swords against the rerolled 7 defense, and no loss', () => {
        const atQuestion = declare(table()).updatedState
        const rerolled = answer(atQuestion, BEA, true)
        expect(heldAttackOf(rerolled.processedActions)).toEqual({ attackerPlayerId: DANA, swords: 2, defense: 7, skullsKilled: 0 })
        expect(danaBoard(rerolled.updatedState)).toBe(5)
    })

    it('from the plans path: Bea declines a plan, is asked, and the rows record the same', () => {
        const declared = declare(table({ c1: [MOUNTED_PATROL] }))
        expect(declared.updatedState.machineState).toBe(MachineState.CampaignPlans)
        expect(campaignBattle(declared.processedActions)?.heldAttackDice).toBeUndefined()
        const defended = defend(declared.updatedState, [])
        expect(asked(defended.updatedState)).toEqual([BEA])
        expect(defendRecord(defended.processedActions)).toMatchObject({ heldAttackDice: 4, defense: 6, swords: 0, skullsKilled: 0 })
        const kept = answer(defended.updatedState, BEA, false)
        expect(heldAttackOf(kept.processedActions)).toEqual({ attackerPlayerId: DANA, swords: 4, defense: 6, skullsKilled: 1 })
    })

    it('Mounted Patrol: the dice held are the half that will be rolled, in the Campaign and in the rows', () => {
        const declared = declare(table({ c1: [MOUNTED_PATROL] }), { attackDice: 5 })
        const defended = defend(declared.updatedState, [MOUNTED_PATROL])
        expect(asked(defended.updatedState)).toEqual([BEA])
        // The panel draws the Campaign's pool while the attack is held.
        expect(ongoingCampaign(defended.updatedState).attackPool).toBe(2)
        expect(defendRecord(defended.processedActions)).toMatchObject({ attackPool: 2, heldAttackDice: 2 })
        const kept = answer(defended.updatedState, BEA, false)
        expect(ongoingCampaign(kept.updatedState).attackRoll).toHaveLength(2)
        expect(heldAttackOf(kept.processedActions)?.attackerPlayerId).toBe(DANA)
    })

    it('Mounted Patrol with nothing held: the dice rolled are halved once, as before', () => {
        const declared = declare(table({ jinx: [], c1: [MOUNTED_PATROL] }), { attackDice: 5 })
        const defended = defend(declared.updatedState, [MOUNTED_PATROL])
        expect(asked(defended.updatedState)).toEqual([])
        expect(ongoingCampaign(defended.updatedState).attackRoll).toHaveLength(2)
        expect(defendRecord(defended.processedActions)?.heldAttackDice).toBeUndefined()
    })

    it('no one rules Jinx: both pools are rolled at once and nothing is recorded as held', () => {
        const declared = declare(table({ jinx: [] }))
        const battle = campaignBattle(declared.processedActions)
        expect(battle?.heldAttackDice).toBeUndefined()
        expect(battle?.swords).toBe(ongoingCampaign(declared.updatedState).swords)
        expect(asked(declared.updatedState)).toEqual([])
    })

    it('Dana’s own Jinx: asked after both rolls, as before, and their answer records no held attack', () => {
        const declared = declare(table({ jinx: [DANA] }))
        expect(asked(declared.updatedState)).toEqual([DANA])
        expect(campaignBattle(declared.processedActions)?.heldAttackDice).toBeUndefined()
        expect(heldAttackOf(answer(declared.updatedState, DANA, false).processedActions)).toBeUndefined()
    })

    it('a battle plan that decides the battle rolls nothing, so nothing is held or asked', () => {
        for (const plan of [HEARTS_AND_MINDS, PEACE_ENVOY]) {
            const declared = declare(table({ c1: [plan] }))
            const defended = defend(declared.updatedState, [plan])
            expect(asked(defended.updatedState)).toEqual([])
            expect(defendRecord(defended.processedActions)?.heldAttackDice).toBeUndefined()
            expect(ongoingCampaign(defended.updatedState).attackRoll).toEqual([])
        }
    })

    it('Hospital holds the skull’s loss: the answer counts it as the Campaign row counts its own', () => {
        const declared = declare(table({ c2: [HOSPITAL] }), { plans: [HOSPITAL] })
        expect(asked(declared.updatedState)).toEqual([BEA])
        const kept = answer(declared.updatedState, BEA, false)
        expect(heldAttackOf(kept.processedActions)).toEqual({ attackerPlayerId: DANA, swords: 4, defense: 6, skullsKilled: 1 })
        expect(danaBoard(kept.updatedState)).toBe(4)
        expect(ongoingCampaign(kept.updatedState).heldForHospital).toEqual([{ playerId: DANA, siteId: 'c2', owner: DANA, count: 1 }])
    })

    /**
     * Only one Jinx exists, and a Jinx at a site the Empire rules answers one side alone, so the attacker
     * is never asked after a held attack in play. Two copies reach the path: the skulls then wait on
     * Dana's answer, and Bea's answer records the roll with no loss yet.
     */
    it('the attacker asked after the held attack: Bea’s answer records the roll, the kills wait', () => {
        const atQuestion = declare(table({ jinx: [DANA, BEA] })).updatedState
        expect(asked(atQuestion)).toEqual([BEA])
        const kept = answer(atQuestion, BEA, false)
        expect(asked(kept.updatedState)).toEqual([DANA])
        expect(heldAttackOf(kept.processedActions)).toEqual({ attackerPlayerId: DANA, swords: 4, defense: 6, skullsKilled: 0 })
        expect(danaBoard(kept.updatedState)).toBe(5)
        const danaKept = answer(kept.updatedState, DANA, false)
        expect(heldAttackOf(danaKept.processedActions)).toBeUndefined()
        expect(danaBoard(danaKept.updatedState)).toBe(4)
    })

    it(`before revision 14 nothing is held: the Campaign records the roll and the answer records nothing new`, () => {
        const declared = declare(table({ revision: before }))
        const battle = campaignBattle(declared.processedActions)
        expect(battle?.heldAttackDice).toBeUndefined()
        expect(battle?.swords).toBe(ongoingCampaign(declared.updatedState).swords)
        expect(asked(declared.updatedState)).toEqual([BEA])
        expect(heldAttackOf(answer(declared.updatedState, BEA, false).processedActions)).toBeUndefined()
    })
})
