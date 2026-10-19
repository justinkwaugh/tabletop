import { describe, expect, it } from 'vitest'
import { Color, type Prng } from '@tabletop/common'
import { Campaign } from './campaign.js'
import { AnswerQuestion } from './answerQuestion.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { PowerQuestionKind } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { rollAttackDice, rollDefenseDice } from '../data/dice.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime } from '../definition/runtime.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import { CRADLE, HINTERLAND, PROVINCES, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import { OathTestEngine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { ongoingCampaign } from '../testing/required.js'
import '../powers/index.js'

const JINX = 'denizen.arcane.jinx'
/** Mountain: one defense die, and "−[attackDie]" when targeted. */
const MOUNTAIN = 'site.mountain'

const DANA = 'dana' // an Exile, the attacker
const BEA = 'bea' // a Citizen, the defender
const ANN = 'ann' // the Chancellor, who joins the defence as an Ally
const RHYS = 'rhys' // a second Citizen, away

const atRevision = CURRENT_OATH_REVISION
const before = OathRevision.EngineFixes9

interface Scene {
    revision: number
    /** Who holds Jinx faceup as an adviser. */
    jinx?: string
    seed?: number
    siteCards?: Record<string, string>
}

/**
 * Dana (an Exile) at c1 attacks Bea (a Citizen) there. The Empire's warbands hold c1, so Bea rules it
 * as an Imperial player and Dana targets it; Ann, the Chancellor, joins the defence (Law 5.5.2). No seat
 * holds a battle plan, so the dice are rolled with the declaration.
 */
function table(scene: Scene): OathProjectedState {
    const advisers = (playerId: string) =>
        scene.jinx === playerId ? [{ cardId: JINX, faceUp: true }] : []
    const seat = (player: Partial<OathPlayerState>) => testPlayer({ supply: 6, favor: 4, secrets: 3, advisers: advisers(player.playerId ?? ''), ...player })
    const s = testState(
        [
            seat({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', warbandsOnBoard: { [DANA]: 8 }, warbandsInPersonalBank: { [DANA]: 6 } }),
            seat({ playerId: BEA, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: {} }),
            seat({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 } }),
            seat({ playerId: RHYS, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'h2', warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: {} })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 1 } },
            siteCards: { ...Object.fromEntries([...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => [slotId, slotId])), ...scene.siteCards },
            prng: { seed: scene.seed ?? 1, invocations: 0 }
        }
    )
    s.turnManager.series = [{ type: 'turn', playerId: DANA, start: 0 }]
    s.activePlayerIds = [DANA]
    return s.dehydrate()
}

const engine = new OathTestEngine(OathRuntime)
const game = testGame([DANA, BEA, ANN, RHYS])

const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

function declare(state: OathProjectedState, targets: CampaignTarget[] = [siteTarget('c1'), pawnAndFavor]) {
    return engine.runNext(buildAction(Campaign, { playerId: DANA, defender: { kind: 'player', playerId: BEA }, targets, attackDice: 4 }), state, game)
}

function answer(state: OathProjectedState, playerId: string, reroll: boolean) {
    return engine.runNext(buildAction(AnswerQuestion, { playerId, answer: { kind: PowerQuestionKind.RerollDice, reroll } }), state, game)
}

/** Who is asked to reroll which roll, in the order asked. */
const asked = (state: OathProjectedState) =>
    (state.pendingQuestions?.queue ?? []).map((question) =>
        question.kind === PowerQuestionKind.RerollDice ? `${question.askedPlayerId}:${question.roll.kind === 'campaign' ? question.roll.side : question.roll.kind}` : question.kind
    )

/** The protected stream as it stands in this state, without moving it. */
const streamOf = (state: OathProjectedState): Prng => new HydratedOathGameState(structuredClone(state)).getProtectedPrng()

const skullsOf = (state: OathProjectedState) => ongoingCampaign(state).attackRoll.reduce((n, face) => n + face.skulls, 0)
const danaBoard = (state: OathProjectedState) => state.players[0].warbandsOnBoard[DANA] ?? 0

describe('R-5.5.4-H1 — the defender’s reroll is settled before the attack is rolled', () => {
    it('Bea, defending with Jinx, is asked after the defense roll, with the attack not yet rolled', () => {
        const state = declare(table({ revision: atRevision, jinx: BEA })).updatedState
        const campaign = ongoingCampaign(state)
        expect(state.machineState).toBe(MachineState.PowerQuestion)
        expect(state.activePlayerIds).toEqual([BEA])
        expect(asked(state)).toEqual([`${BEA}:defense`])
        expect(campaign.defenseRoll).toHaveLength(campaign.defensePool)
        expect(campaign.attackRoll).toEqual([])
        expect(campaign.swords).toBe(0)
        expect(campaign.pendingSkullKills).toBeUndefined()
        expect(danaBoard(state)).toBe(8)
    })

    it('Bea keeps the roll: the attack is rolled from the stream after the defense, then the skulls kill', () => {
        const atQuestion = declare(table({ revision: atRevision, jinx: BEA })).updatedState
        const defenseRoll = ongoingCampaign(atQuestion).defenseRoll
        const expectedAttack = rollAttackDice(streamOf(atQuestion), ongoingCampaign(atQuestion).attackPool)
        const result = answer(atQuestion, BEA, false)
        const state = result.updatedState
        const campaign = ongoingCampaign(state)
        expect(state.players[1].secrets).toBe(3)
        expect(campaign.defenseRoll).toEqual(defenseRoll)
        expect(campaign.attackRoll).toEqual(expectedAttack)
        expect(campaign.attackRoll).toHaveLength(campaign.attackPool)
        expect(danaBoard(state)).toBe(8 - skullsOf(state))
        expect(asked(state)).toEqual([])
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
        // R-X.3 — the answer that rolled the attack cannot be undone.
        expect(result.processedActions[0]?.revealsInfo).toBe(true)
    })

    it('Bea rerolls: the defense is rerolled first, and the attack is rolled from the stream after the reroll', () => {
        const atQuestion = declare(table({ revision: atRevision, jinx: BEA })).updatedState
        const { defensePool, attackPool } = ongoingCampaign(atQuestion)
        const stream = streamOf(atQuestion)
        const rerolled = rollDefenseDice(stream, defensePool)
        const expectedAttack = rollAttackDice(stream, attackPool)
        const state = answer(atQuestion, BEA, true).updatedState
        const campaign = ongoingCampaign(state)
        // R-7.1.2.a — out of turn the placed secret goes to Bea's board, facedown.
        expect(state.players[1].secrets).toBe(2)
        expect(state.players[1].secretsFacedown).toBe(atQuestion.players[1].secretsFacedown + 1)
        expect(campaign.defenseRoll).toEqual(rerolled)
        expect(campaign.attackRoll).toEqual(expectedAttack)
        expect(danaBoard(state)).toBe(8 - skullsOf(state))
        // The skulls' kills take their usual path: they count for the defending side (Cursed Cauldron).
        expect(campaign.enemyWarbandsKilled?.defender ?? 0).toBe(skullsOf(state))
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
    })

    it('Ann, an Ally who rules Jinx, rolls nothing and is not offered it', () => {
        const state = declare(table({ revision: atRevision, jinx: ANN })).updatedState
        const campaign = ongoingCampaign(state)
        expect(campaign.allyPlayerIds).toEqual([ANN])
        expect(asked(state)).toEqual([])
        expect(campaign.attackRoll).toHaveLength(campaign.attackPool)
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
    })

    it('Dana’s Jinx: asked after the attack roll, as before, with the skulls waiting on the answer', () => {
        for (let seed = 1; seed < 30; seed++) {
            const state = declare(table({ revision: atRevision, jinx: DANA, seed })).updatedState
            const campaign = ongoingCampaign(state)
            expect(asked(state)).toEqual([`${DANA}:attack`])
            expect(campaign.attackRoll).toHaveLength(campaign.attackPool)
            expect(campaign.pendingAttackRoll).toBeUndefined()
            if (skullsOf(state) === 0) continue
            expect(campaign.pendingSkullKills?.skulls).toBe(skullsOf(state))
            expect(danaBoard(state)).toBe(8)
            const kept = answer(state, DANA, false).updatedState
            expect(danaBoard(kept)).toBe(8 - skullsOf(kept))
            expect(ongoingCampaign(kept).pendingSkullKills).toBeUndefined()
            return
        }
        throw new Error('no seed rolled a skull')
    })

    it('no one rules Jinx: no question, both rolls at once', () => {
        const state = declare(table({ revision: atRevision })).updatedState
        const campaign = ongoingCampaign(state)
        expect(state.pendingQuestions).toBeUndefined()
        expect(campaign.defenseRoll).toHaveLength(campaign.defensePool)
        expect(campaign.attackRoll).toHaveLength(campaign.attackPool)
        expect(state.machineState).toBe(MachineState.CampaignSacrifice)
    })

    it('a targeted Mountain changes the pools before the defense roll; the reroll rerolls the dice rolled', () => {
        const scene = { revision: atRevision, jinx: BEA, siteCards: { c1: MOUNTAIN } }
        const without = declare(table({ ...scene, siteCards: {} })).updatedState
        const atQuestion = declare(table(scene)).updatedState
        const { defensePool, attackPool } = ongoingCampaign(atQuestion)
        expect(attackPool).toBe(ongoingCampaign(without).attackPool - 1)
        expect(ongoingCampaign(atQuestion).defenseRoll).toHaveLength(defensePool)
        const stream = streamOf(atQuestion)
        const rerolled = rollDefenseDice(stream, defensePool)
        const expectedAttack = rollAttackDice(stream, attackPool)
        const campaign = ongoingCampaign(answer(atQuestion, BEA, true).updatedState)
        expect(campaign.defenseRoll).toEqual(rerolled)
        expect(campaign.attackRoll).toEqual(expectedAttack)
    })

    it(`before revision 14 Bea is asked after both rolls, the attack rolled from the stream right after the defense`, () => {
        const fresh = table({ revision: before, jinx: BEA })
        const state = declare(fresh).updatedState
        const campaign = ongoingCampaign(state)
        const stream = streamOf(fresh)
        const defenseRoll = rollDefenseDice(stream, campaign.defensePool)
        expect(campaign.defenseRoll).toEqual(defenseRoll)
        expect(campaign.attackRoll).toEqual(rollAttackDice(stream, campaign.attackPool))
        expect(asked(state)).toEqual([`${BEA}:defense`])
        expect(campaign.pendingSkullKills?.skulls).toBe(skullsOf(state))
        expect(campaign.pendingAttackRoll).toBeUndefined()
    })
})
