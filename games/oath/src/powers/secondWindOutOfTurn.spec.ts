import { describe, expect, it } from 'vitest'
import { assertExists, ActionSource, Color, type GameAction } from '@tabletop/common'
import { HydratedCampaignSacrifice } from '../actions/campaignSacrifice.js'
import { isCampaign } from '../actions/campaign.js'
import { isTravel } from '../actions/travel.js'
import { isAnswerQuestion } from '../actions/answerQuestion.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Suit } from '../model/oathEnums.js'
import { CRADLE, HINTERLAND, PROVINCES, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { battlePlanUse } from '../testing/choices.js'
import { testGame } from '../testing/game.js'
import { adviser } from '../testing/tables.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * Second Wind: "After you're victorious, you may travel and then may campaign, spending no Supply for either."
 * Sneak Attack: "After another player's campaign, you may campaign, spending no Supply, if you declare them as
 * the defender." Its Q&A: "When exactly do I campaign? Immediately after the triggering player ends their
 * campaign." and "Can I use this power if the attacker used Second Wind? Yes. Resolve Sneak Attack first, then
 * Second Wind."
 */
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const SECOND_WIND = 'denizen.discord.second-wind'
const HERALD = 'denizen.hearth.herald'
const SHROUDED_WOOD = 'site.shrouded-wood'

const atRevision = OathRevision.EngineFixes3
const before = OathRevision.UiBatch1

const X = 'x'
const Y = 'y'
const H = 'h'

const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const passSneakAttack: QuestionAnswer = { kind: PowerQuestionKind.SneakAttack, campaign: false }
const herald: QuestionAnswer = { kind: PowerQuestionKind.PickFavorBank, suit: Suit.Hearth }
const skip: QuestionAnswer = { kind: PowerQuestionKind.FreeActionOutOfTurn, take: false }

interface Scene {
    revision: number
    seed: number
    x?: Record<string, unknown>
    y?: Record<string, unknown>
    h?: Record<string, unknown>
    state?: Record<string, unknown>
}

function board({ revision, seed, x = {}, y = {}, h = {}, state = {} }: Scene) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: X, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [X]: 6 }, ...x }),
            testPlayer({ playerId: Y, color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 0, warbandsOnBoard: { [Y]: 4 }, advisers: [adviser(SNEAK_ATTACK), adviser(SECOND_WIND)], ...y }),
            testPlayer({ playerId: H, color: Color.Yellow, siteId: 'p1', favor: 0, supply: 6, warbandsOnBoard: { [H]: 2 }, warbandsInPersonalBank: { [H]: 12 }, ...h })
        ]),
        { warbandsBySite: {}, prng: { seed, invocations: 0 }, ...state }
    )
    s.oathRevision = revision
    return s
}

const game = testGame([X, Y, H])

/** Every step goes through `GameEngine`, so the machine state and the clock are the engine's. */
class Table {
    state: OathProjectedState
    processed: GameAction[] = []
    private seq = 0

    constructor(s: HydratedOathGameState, seats = [X, Y, H]) {
        this.state = s.dehydrate()
        this.state.turnManager = { series: [{ type: 'turn', playerId: X, start: 0 }], turnOrder: seats, turnCounts: { [X]: 1, [Y]: 1, [H]: 1 } }
        this.state.activePlayerIds = [X]
    }

    run(fields: { type: ActionType; playerId: string } & Record<string, unknown>) {
        const action: GameAction = { id: `sw-${(this.seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        const result = engine.run(action, this.state, game)
        this.state = result.updatedState
        this.processed = result.processedActions
        return this
    }

    campaign(playerId: string, defender: string | undefined, targets: CampaignTarget[], attackDice: number, plans: string[] = []) {
        return this.run({ type: ActionType.Campaign, playerId, defender: defender ? { kind: 'player', playerId: defender } : { kind: 'bandits' }, targets, attackDice, plans: plans.map(battlePlanUse) })
    }

    /** The defending side's plans, when the machine asks for them. */
    defendIfAsked(playerId: string) {
        if (this.state.machineState === MachineState.CampaignPlans) this.run({ type: ActionType.CampaignDefend, playerId, plans: [] })
        return this
    }

    sacrifice(playerId: string) {
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(this.state), 0)
        return this.run({ type: ActionType.CampaignSacrifice, playerId, sacrifice: 0, defeatKills })
    }

    victory(playerId: string, fields: Record<string, unknown> = {}) {
        return this.run({ type: ActionType.CampaignResolveVictory, playerId, placements: [], burnFavor: false, ...fields })
    }

    travel(playerId: string, siteId?: string) {
        return this.run({ type: ActionType.Travel, playerId, siteId })
    }

    answer(playerId: string, answer: QuestionAnswer) {
        return this.run({ type: ActionType.AnswerQuestion, playerId, answer })
    }

    /** No attack dice make a certain defeat (R-5.5.5.b), so these walks need no seed. */
    losesWithNoDice(attacker: string, defender: string | undefined, targets: CampaignTarget[]) {
        this.campaign(attacker, defender, targets, 0)
        this.defendIfAsked(defender ?? attacker)
        return this.sacrifice(attacker)
    }

    player(playerId: string) {
        const found = this.state.players.find((p) => p.playerId === playerId)
        assertExists(found, `no player ${playerId}`)
        return found
    }

    offered(playerId: string) {
        return engine.getValidActionTypesForPlayer(game, this.state, playerId)
    }

    get question() {
        return this.state.pendingQuestions?.queue[0]
    }

    get queue() {
        return (this.state.pendingQuestions?.queue ?? []).map((q) => [q.kind, q.askedPlayerId])
    }
}

/**
 * x campaigns against y and loses; y's Sneak Attack, with Second Wind, wins against x. Searches seeds for y's
 * four attack dice beating x's defence outright.
 */
function yWinsOutOfTurn(scene: Omit<Scene, 'seed'>, victory: Record<string, unknown> = {}, seats?: string[]): Table {
    for (let seed = 1; seed < 500; seed++) {
        const t = new Table(board({ ...scene, seed }), seats)
        t.losesWithNoDice(X, Y, [PAWN])
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y })
        t.campaign(Y, X, [PAWN], 4, [SECOND_WIND]).defendIfAsked(X)
        const rolled = t.state.campaign
        if (!rolled || rolled.swords <= rolled.defense || t.state.machineState !== MachineState.CampaignSacrifice) continue
        t.sacrifice(Y)
        if (t.state.campaign?.attackerVictorious !== true) continue
        return t.victory(Y, victory)
    }
    throw Error('no seed found where the Sneak Attack wins outright')
}

describe('Second Wind out of turn (revision 7) — "you may travel and then may campaign"', () => {
    it('the holder is asked "Travel now?" before the paused turn resumes; the turn stays held, and only the holder may act', () => {
        const t = yWinsOutOfTurn({ revision: atRevision })
        expect(t.state.machineState).toBe(MachineState.PowerQuestion)
        expect(t.question).toEqual({ kind: PowerQuestionKind.FreeActionOutOfTurn, cardId: SECOND_WIND, askedPlayerId: Y, action: ActionType.Travel })
        expect(t.state.heldTurn).toMatchObject({ askingPlayerId: X, resumeMachineState: MachineState.ActPhase })
        expect(t.state.pendingQuestions?.resumeMachineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([Y])
        expect(t.offered(Y)).toEqual([ActionType.AnswerQuestion, ActionType.Travel])
        expect(t.offered(X)).toEqual([])
        expect(() => t.campaign(Y, X, [PAWN], 0)).toThrow(/not valid in state PowerQuestion/)
    })

    it('the Travel spends no Supply; then "Campaign now?"; the free Campaign is ordinary, from the new site, and spends no Supply; then the paused turn resumes', () => {
        const t = yWinsOutOfTurn({ revision: atRevision }, { banishToSiteId: 'p2' })
        expect(t.player(X).siteId).toBe('p2')
        expect(t.player(Y).supply).toBe(0)

        // Cradle to Provinces costs 2 (R-5.6.1); this one costs nothing.
        t.travel(Y, 'p2')
        expect(t.player(Y)).toMatchObject({ siteId: 'p2', supply: 0 })
        const travelled = t.processed.find(isTravel)
        expect(travelled?.metadata).toMatchObject({ supplySpent: 0, freeActionOf: SECOND_WIND })
        expect(t.state.machineState).toBe(MachineState.PowerQuestion)
        expect(t.question).toEqual({ kind: PowerQuestionKind.FreeActionOutOfTurn, cardId: SECOND_WIND, askedPlayerId: Y, action: ActionType.Campaign })
        expect(t.state.heldTurn).toMatchObject({ askingPlayerId: X, resumeMachineState: MachineState.ActPhase })
        expect(t.offered(Y)).toEqual([ActionType.AnswerQuestion, ActionType.Campaign])
        expect(t.offered(X)).toEqual([])

        // Any legal defender: h, who stands at neither site, is not one; x, whose pawn is here, is.
        expect(() => t.campaign(Y, H, [PAWN], 0)).toThrow(/Cannot campaign/)
        t.campaign(Y, X, [PAWN], 0)
        expect(t.processed.find(isCampaign)?.metadata).toMatchObject({ supplySpent: 0, freeActionOf: SECOND_WIND })
        expect(t.state.campaign?.attackerPlayerId).toBe(Y)
        expect(t.state.heldTurn).toMatchObject({ askingPlayerId: X, resumeMachineState: MachineState.ActPhase })
        t.defendIfAsked(X).sacrifice(Y)

        expect(t.state.campaign).toBeUndefined()
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        expect(t.player(Y).supply).toBe(0)
        expect(t.player(Y).freeTravelAtAction).toBeUndefined()
        expect(t.player(Y).freeCampaignAtAction).toBeUndefined()
        expect(t.offered(Y)).toEqual([])
        expect(t.offered(X)).toContain(ActionType.EndActPhase)
    })

    it('both are optional: skipping the Travel leaves the Campaign, and skipping that resumes the paused turn', () => {
        const t = yWinsOutOfTurn({ revision: atRevision })
        t.answer(Y, skip)
        const skippedTravel = t.processed.find(isAnswerQuestion)
        expect(skippedTravel?.metadata).toMatchObject({ kind: PowerQuestionKind.FreeActionOutOfTurn, cardId: SECOND_WIND, summary: 'skipped the free Travel' })
        expect(t.question).toEqual({ kind: PowerQuestionKind.FreeActionOutOfTurn, cardId: SECOND_WIND, askedPlayerId: Y, action: ActionType.Campaign })
        expect(t.state.heldTurn).toBeDefined()
        expect(t.player(Y).siteId).toBe('c1')

        t.answer(Y, skip)
        expect(t.processed.find(isAnswerQuestion)?.metadata).toMatchObject({ summary: 'skipped the free Campaign', last: true })
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        expect(t.player(Y).freeTravelAtAction).toBeUndefined()
        expect(t.player(Y).freeCampaignAtAction).toBeUndefined()
        expect(t.offered(X)).toContain(ActionType.EndActPhase)
    })

    it('only the asked holder answers, and the skip is the only answer', () => {
        const t = yWinsOutOfTurn({ revision: atRevision })
        expect(() => t.answer(X, skip)).toThrow(/not an active player/)
        expect(() => t.travel(X, 'c2')).toThrow(/not an active player/)
        expect(() => t.answer(Y, passSneakAttack)).toThrow(/the question is freeActionOutOfTurn/)
    })

    it('the free Travel is a real Travel: leaving a Shrouded Wood an enemy rules, the ruler picks the site, for no Supply, and then the Campaign is asked', () => {
        const sites = { ...Object.fromEntries([...CRADLE, ...PROVINCES, ...HINTERLAND].map((id) => [id, id])), c1: SHROUDED_WOOD }
        const t = yWinsOutOfTurn({ revision: atRevision, state: { siteCards: sites, warbandsBySite: { c1: { [H]: 1 } } } })
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.FreeActionOutOfTurn, action: ActionType.Travel })
        expect(() => t.travel(Y, 'c2')).toThrow(/the Shrouded Wood's ruler chooses where you go/)
        t.travel(Y)
        expect(t.queue).toEqual([
            [PowerQuestionKind.ShroudedWoodDestination, H],
            [PowerQuestionKind.FreeActionOutOfTurn, Y]
        ])
        expect(t.question).toMatchObject({ travel: { free: true } })
        expect(t.state.activePlayerIds).toEqual([H])
        expect(t.state.heldTurn).toBeDefined()
        t.answer(H, { kind: PowerQuestionKind.ShroudedWoodDestination, siteId: 'h1' })
        expect(t.player(Y)).toMatchObject({ siteId: 'h1', supply: 0 })
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.FreeActionOutOfTurn, askedPlayerId: Y, action: ActionType.Campaign })
        expect(t.state.activePlayerIds).toEqual([Y])
        t.answer(Y, skip)
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.heldTurn).toBeUndefined()
    })

    it('Sneak Attack first, then Second Wind; the chain ends before the paused turn resumes, and the turn’s own questions wait for it (R-10.2-H1)', () => {
        const t = yWinsOutOfTurn({ revision: atRevision, h: { advisers: [adviser(HERALD)] } }, {}, [X, Y, H])
        // h's Herald for y's Campaign, then y's free Travel; h's Herald for x's Campaign waits with the turn.
        expect(t.queue).toEqual([
            [PowerQuestionKind.PickFavorBank, H],
            [PowerQuestionKind.FreeActionOutOfTurn, Y]
        ])
        expect(t.state.heldTurn?.queue.map((q) => [q.kind, q.askedPlayerId])).toEqual([[PowerQuestionKind.PickFavorBank, H]])
        t.answer(H, herald)
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.FreeActionOutOfTurn, askedPlayerId: Y, action: ActionType.Travel })
        t.answer(Y, skip)
        t.campaign(Y, X, [PAWN], 0).defendIfAsked(X).sacrifice(Y)
        // The free Campaign's own Herald, then the paused turn's.
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.queue).toEqual([
            [PowerQuestionKind.PickFavorBank, H],
            [PowerQuestionKind.PickFavorBank, H]
        ])
        t.answer(H, herald)
        t.answer(H, herald)
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
    })

    it('the free Campaign can itself draw a Sneak Attack: held turns never stack, the one held turn waits for both', () => {
        // There is one Sneak Attack, and no step out of turn moves an adviser; it is handed to h here to show the machine.
        const t = yWinsOutOfTurn({ revision: atRevision, h: { siteId: 'c1', supply: 0 } })
        const yState = t.player(Y)
        const card = yState.advisers.find((a) => 'cardId' in a && a.cardId === SNEAK_ATTACK)
        assertExists(card, 'y holds Sneak Attack')
        yState.advisers = yState.advisers.filter((a) => a !== card)
        t.player(H).advisers = [card]

        t.answer(Y, skip)
        t.campaign(Y, X, [PAWN], 0).defendIfAsked(X).sacrifice(Y)
        expect(t.question).toEqual({ kind: PowerQuestionKind.SneakAttack, cardId: SNEAK_ATTACK, askedPlayerId: H, defenderPlayerId: Y })
        expect(t.state.heldTurn).toBeUndefined()
        t.campaign(H, Y, [PAWN], 0)
        expect(t.state.heldTurn).toMatchObject({ askingPlayerId: X, resumeMachineState: MachineState.ActPhase, queue: [] })
        t.defendIfAsked(Y).sacrifice(H)
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
    })
})

describe('Second Wind out of turn before revision 7 (R-X.4)', () => {
    it('a free action granted out of turn is forfeit: its player has no Act Phase to use it in, and the paused turn resumes', () => {
        const t = yWinsOutOfTurn({ revision: before })
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        expect(t.player(Y).freeTravelAtAction).toBeUndefined()
        expect(t.player(Y).freeCampaignAtAction).toBeUndefined()
        expect(t.offered(Y)).toEqual([])
    })
})
