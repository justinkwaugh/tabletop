import { describe, expect, it } from 'vitest'
import { Color, Prng, type GameAction } from '@tabletop/common'
import { Campaign, type CampaignDefender } from './campaign.js'
import { CampaignDefend } from './campaignDefend.js'
import { CampaignSacrifice, isCampaignSacrifice } from './campaignSacrifice.js'
import { AnswerQuestion } from './answerQuestion.js'
import {
    CampaignTargetKind,
    type CampaignTarget,
    type RolledAttackFace,
    type RolledDefenseFace,
    type WarbandGroup
} from '../model/campaign.js'
import { type OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime, OathVisibility } from '../definition/runtime.js'
import { OathRevision } from '../util/revision.js'
import { rollAttackDice, rollDefenseDice } from '../data/dice.js'
import { CRADLE, HINTERLAND, PROVINCES, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { OathTestEngine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { ongoingCampaign } from '../testing/required.js'
import '../powers/index.js'

const JINX = 'denizen.arcane.jinx'
const HEARTS_AND_MINDS = 'denizen.hearth.hearts-and-minds'
const PEACE_ENVOY = 'denizen.order.peace-envoy'

const DANA = 'dana' // an Exile, the attacker
const BEA = 'bea' // an Exile who rules c1, the defender
const ANN = 'ann' // the Chancellor, away

const AT = OathRevision.EngineFixes21
const BEFORE = OathRevision.EngineFixes20

const SWORD: RolledAttackFace = { swords: 1, hollowSwords: 0, skulls: 0 }
const HOLLOW: RolledAttackFace = { swords: 0, hollowSwords: 1, skulls: 0 }
const SKULL: RolledAttackFace = { swords: 2, hollowSwords: 0, skulls: 1 }
const SHIELD: RolledDefenseFace = { shields: 1, doubling: false }
const TWO_SHIELDS: RolledDefenseFace = { shields: 2, doubling: false }
const DOUBLING: RolledDefenseFace = { shields: 0, doubling: true }

interface Scene {
    revision?: number
    /** Who holds Jinx faceup as an adviser. */
    jinx?: string[]
    /** The denizens at c1, which Bea rules. */
    c1?: string[]
    /** Where Bea's pawn stands; at c1 their board defends too. */
    beaSite?: string
    beaAtC1?: number
    beaBoard?: number
    danaBoard?: number
    beaIsOathkeeper?: boolean
    seed?: number
}

/**
 * Dana (an Exile, 5 warbands on their board) at c1 attacks Bea (an Exile with 2 warbands at c1 and 3
 * on their board, pawn at c1), targeting c1 and Bea's pawn and favor: 3 defense dice. Seed 1 rolls 1
 * shield, so 6 defense; the 4 attack dice roll 4 swords and a skull. With Jinx, Bea's reroll makes
 * 7 defense, then the attack rolls 2 swords and no skull.
 */
function table(scene: Scene = {}): OathProjectedState {
    const advisers = (playerId: string) => ((scene.jinx ?? []).includes(playerId) ? [{ cardId: JINX, faceUp: true }] : [])
    const danaBoard = scene.danaBoard ?? 5
    const beaBoard = scene.beaBoard ?? 3
    const beaAtC1 = scene.beaAtC1 ?? 2
    const s = testState(
        [
            testPlayer({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 7, favor: 4, secrets: 2, advisers: advisers(DANA), warbandsOnBoard: { [DANA]: danaBoard }, warbandsInPersonalBank: { [DANA]: 14 - danaBoard } }),
            testPlayer({ playerId: BEA, color: Color.Yellow, status: PlayerStatus.Exile, siteId: scene.beaSite ?? 'c1', supply: 6, favor: 4, secrets: 2, advisers: advisers(BEA), warbandsOnBoard: { [BEA]: beaBoard }, warbandsInPersonalBank: { [BEA]: 14 - beaBoard - beaAtC1 } }),
            testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1' })
        ],
        {
            oathRevision: scene.revision ?? AT,
            chancellorPlayerId: ANN,
            oathkeeperPlayerId: scene.beaIsOathkeeper ? BEA : undefined,
            denizensBySite: { c1: scene.c1 ?? [], c2: [], p1: [], h1: [] },
            warbandsBySite: beaAtC1 > 0 ? { c1: { [BEA]: beaAtC1 } } : {},
            siteCards: Object.fromEntries([...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => [slotId, slotId])),
            prng: { seed: scene.seed ?? 1, invocations: 0 }
        }
    )
    s.turnManager.series = [{ type: 'turn', playerId: DANA, start: 0 }]
    s.activePlayerIds = [DANA]
    return s.dehydrate()
}

const engine = new OathTestEngine(OathRuntime)
const game = testGame([DANA, BEA, ANN])

const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const atBea = { kind: 'player', playerId: BEA } as const

function declare(
    state: OathProjectedState,
    fields: { attackDice?: number; targets?: CampaignTarget[]; defender?: CampaignDefender } = {}
) {
    return engine.runNext(buildAction(Campaign, { playerId: DANA, defender: fields.defender ?? atBea, targets: fields.targets ?? [siteTarget('c1'), pawnAndFavor], attackDice: fields.attackDice ?? 4, plans: [] }), state, game)
}

function defend(state: OathProjectedState, plans: string[]) {
    return engine.runNext(buildAction(CampaignDefend, { playerId: BEA, plans: plans.map((cardId) => battlePlanUse(cardId)) }), state, game)
}

function answer(state: OathProjectedState, playerId: string, reroll: boolean) {
    return engine.runNext(buildAction(AnswerQuestion, { playerId, answer: { kind: PowerQuestionKind.RerollDice, reroll } }), state, game)
}

function sacrifice(state: OathProjectedState, count: number, defeatKills?: WarbandGroup[]) {
    expect(state.machineState).toBe(MachineState.CampaignSacrifice)
    return engine.runNext(buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: count, ...(defeatKills ? { defeatKills } : {}) }), state, game)
}

/** The closing step's record. */
function closing(processed: readonly GameAction[]) {
    const sacrifices = processed.filter(isCampaignSacrifice)
    expect(sacrifices).toHaveLength(1)
    return sacrifices[0]
}

const rollOf = (processed: readonly GameAction[]) => closing(processed).metadata?.roll

const onDanaBoard = (count: number): WarbandGroup[] => [{ at: { kind: 'board', playerId: DANA }, owner: DANA, count }]

/** R-5.5 — no rule reads the order the dice fell in. */
const multiset = (faces: readonly object[]) => faces.map((face) => JSON.stringify(face)).sort().join('|')

/** Defense then attack, the order a Campaign with no reroll to ask draws them in. */
function seedFor(defense: readonly RolledDefenseFace[], attack: readonly RolledAttackFace[]): number {
    for (let seed = 1; seed <= 2_000_000; seed++) {
        const prng = new Prng({ seed, invocations: 0 })
        if (multiset(rollDefenseDice(prng, defense.length)) !== multiset(defense)) continue
        if (multiset(rollAttackDice(prng, attack.length)) !== multiset(attack)) continue
        return seed
    }
    throw Error('no seed reproduces that roll')
}

describe('R-5.5 — the closing step records the dice as rolled and how the defense was made up', () => {
    it('revision 24 records no roll; otherwise the record is the one revision 25 makes', () => {
        const play = (revision: number) => {
            const rolled = declare(table({ revision })).updatedState
            return closing(sacrifice(rolled, 3).processedActions).metadata
        }
        const before = play(BEFORE)
        const at = play(AT)
        expect(at?.roll).toBeDefined()
        expect(before).not.toHaveProperty('roll')
        const { roll: _roll, ...rest } = at ?? {}
        expect(JSON.stringify(before)).toBe(JSON.stringify(rest))
    })

    it('a Campaign won: the faces as rolled, the counts, and the defending force by place', () => {
        const rolled = declare(table()).updatedState
        const campaign = ongoingCampaign(rolled)
        const won = sacrifice(rolled, 3)
        expect(closing(won.processedActions).metadata?.attackerVictorious).toBe(true)
        expect(rollOf(won.processedActions)).toEqual({
            attackFaces: campaign.attackRoll,
            defenseFaces: campaign.defenseRoll,
            swords: 4,
            skulls: 1,
            shields: 1,
            doubled: false,
            defendingForce: [
                { at: { kind: 'site', siteId: 'c1' }, owner: BEA, count: 2 },
                { at: { kind: 'board', playerId: BEA }, owner: BEA, count: 3 }
            ],
            defendingBandits: 0,
            defense: 6
        })
        expect(campaign.attackRoll).toHaveLength(4)
        expect(campaign.defenseRoll).toHaveLength(3)
    })

    it('a Campaign lost: the roll is recorded on the step that closes it', () => {
        const rolled = declare(table()).updatedState
        const lost = sacrifice(rolled, 0, onDanaBoard(2))
        expect(closing(lost.processedActions).metadata?.attackerVictorious).toBe(false)
        expect(lost.updatedState.campaign).toBeUndefined()
        expect(rollOf(lost.processedActions)).toMatchObject({ swords: 4, skulls: 1, shields: 1, defense: 6 })
    })

    it('Bea rerolls the defense with Jinx: the faces recorded are the reroll, not the first roll', () => {
        const atQuestion = declare(table({ jinx: [BEA] })).updatedState
        const first = ongoingCampaign(atQuestion).defenseRoll
        const rerolled = answer(atQuestion, BEA, true).updatedState
        const final = ongoingCampaign(rerolled)
        expect(multiset(final.defenseRoll)).not.toBe(multiset(first))
        const lost = sacrifice(rerolled, 0, onDanaBoard(2))
        expect(rollOf(lost.processedActions)).toMatchObject({
            attackFaces: final.attackRoll,
            defenseFaces: final.defenseRoll,
            swords: 2,
            skulls: 0,
            shields: 2,
            defense: 7
        })
    })

    it('Dana rerolls the attack with their own Jinx: the attack faces and skulls recorded are the reroll’s', () => {
        const atQuestion = declare(table({ jinx: [DANA] })).updatedState
        const first = ongoingCampaign(atQuestion).attackRoll
        const rerolled = answer(atQuestion, DANA, true).updatedState
        const final = ongoingCampaign(rerolled)
        expect(multiset(final.attackRoll)).not.toBe(multiset(first))
        // The reroll's sword and three hollow swords: 2 swords and no skull, so the first roll's skull killed nothing.
        const lost = sacrifice(rerolled, 0, onDanaBoard(2))
        expect(rollOf(lost.processedActions)).toMatchObject({ attackFaces: final.attackRoll, defenseFaces: final.defenseRoll, swords: 2, skulls: 0, defense: 6 })
    })

    it('hollow swords pair and a doubling doubles the shields only: 6 swords and 2 skulls against 1 shield doubled to 2, + 3 warbands', () => {
        const defense = [SHIELD, DOUBLING]
        const attack = [HOLLOW, HOLLOW, HOLLOW, SWORD, SKULL, SKULL]
        const scene = { beaSite: 'h2', beaAtC1: 3, beaBoard: 0, danaBoard: 6, beaIsOathkeeper: true, seed: seedFor(defense, attack) }
        const rolled = declare(table(scene), { targets: [siteTarget('c1')], attackDice: 6 }).updatedState
        const won = sacrifice(rolled, 0)
        expect(closing(won.processedActions).metadata?.attackerVictorious).toBe(true)
        const roll = rollOf(won.processedActions)
        expect(multiset(roll?.attackFaces ?? [])).toBe(multiset(attack))
        expect(multiset(roll?.defenseFaces ?? [])).toBe(multiset(defense))
        expect(roll).toMatchObject({
            swords: 6,
            skulls: 2,
            shields: 2,
            doubled: true,
            defendingForce: [{ at: { kind: 'site', siteId: 'c1' }, owner: BEA, count: 3 }],
            defendingBandits: 0,
            defense: 5
        })
    })

    it('no doubling rolled: the shields count as rolled, 3 shields + 3 warbands, a tie the defender wins', () => {
        const defense = [TWO_SHIELDS, SHIELD]
        const attack = [SWORD, SWORD, SWORD, SWORD, SWORD, SWORD]
        const scene = { beaSite: 'h2', beaAtC1: 3, beaBoard: 0, danaBoard: 6, beaIsOathkeeper: true, seed: seedFor(defense, attack) }
        const rolled = declare(table(scene), { targets: [siteTarget('c1')], attackDice: 6 }).updatedState
        const roll = rollOf(sacrifice(rolled, 0, onDanaBoard(3)).processedActions)
        expect(roll).toMatchObject({ swords: 6, skulls: 0, shields: 3, doubled: false, defense: 6 })
    })

    it('the bandits defending: no warbands, the bandits counted apart', () => {
        const defense = [SHIELD]
        const attack = [SWORD, SWORD, SWORD, SWORD]
        const scene = { beaSite: 'h2', beaAtC1: 0, beaBoard: 0, seed: seedFor(defense, attack) }
        const rolled = declare(table(scene), { targets: [siteTarget('c1')], defender: { kind: 'bandits' } }).updatedState
        const bandits = ongoingCampaign(rolled).defendingBandits
        expect(bandits).toBeGreaterThan(0)
        const roll = rollOf(sacrifice(rolled, 0).processedActions)
        expect(roll).toMatchObject({ swords: 4, shields: 1, doubled: false, defendingForce: [], defendingBandits: bandits, defense: 1 + bandits })
    })

    it('a Campaign a plan decides rolls nothing, so the closing step records no roll', () => {
        // Control: the same Campaign rolled records its roll.
        expect(rollOf(sacrifice(declare(table()).updatedState, 3).processedActions)).toBeDefined()
        // Bea's Hearts and Minds makes them victorious, so Dana loses half their force; Peace Envoy kills none.
        for (const [plan, kills] of [[HEARTS_AND_MINDS, onDanaBoard(2)], [PEACE_ENVOY, undefined]] as const) {
            const declared = declare(table({ c1: [plan] }))
            const decided = defend(declared.updatedState, [plan]).updatedState
            expect(ongoingCampaign(decided).decidedVictor).toBeDefined()
            const closed = closing(sacrifice(decided, 0, kills).processedActions)
            expect(closed.metadata).toBeDefined()
            expect(closed.metadata).not.toHaveProperty('roll')
        }
    })
})

describe('R-X.3 — the recorded roll reveals nothing the table had not seen', () => {
    it('every perspective is served the same record, and every value was already public before the step', () => {
        const rolled = declare(table()).updatedState
        const shown = served(rolled).campaign
        const record = closing(sacrifice(rolled, 3).processedActions)
        const roll = record.metadata?.roll
        expect(roll).toBeDefined()
        for (const perspective of [{ kind: 'player', playerId: DANA }, { kind: 'player', playerId: BEA }, { kind: 'player', playerId: ANN }, { kind: 'spectator' }] as const) {
            expect(OathVisibility.actions.project(record, perspective)).toMatchObject({ metadata: { roll } })
        }
        expect(roll).toMatchObject({
            attackFaces: shown?.attackRoll,
            defenseFaces: shown?.defenseRoll,
            swords: shown?.swords,
            defendingForce: shown?.defendingForce,
            defendingBandits: shown?.defendingBandits,
            defense: shown?.defense
        })
    })

    it('the attacker’s own served view closes the Campaign to the same record', () => {
        const rolled = declare(table()).updatedState
        const fromHost = rollOf(sacrifice(rolled, 3).processedActions)
        const fromView = rollOf(sacrifice(served(rolled, { kind: 'player', playerId: DANA }), 3).processedActions)
        expect(fromHost).toBeDefined()
        expect(fromView).toEqual(fromHost)
    })
})
