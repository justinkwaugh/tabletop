import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    Color,
    assertExists,
    latestPlayerUndoTarget,
    proveCommutation,
    type GameAction
} from '@tabletop/common'
import { Campaign, HydratedCampaign } from './campaign.js'
import { CampaignDefend, HydratedCampaignDefend } from './campaignDefend.js'
import { CampaignAttackPlans, HydratedCampaignAttackPlans } from './campaignAttackPlans.js'
import { AnswerConsent, HydratedAnswerConsent } from './answerConsent.js'
import { HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { LetPeek, LetPeekSubjectKind } from './letPeek.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { OathRuntime } from '../definition/runtime.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { CRADLE, HINTERLAND, PROVINCES, openTurn, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { served } from '../testing/projection.js'
import { ongoingCampaign } from '../testing/required.js'
import { adviser } from '../testing/tables.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

/**
 * R-5.5.5.b-H1 — "You're victorious now" decides the Campaign at Step 3: no dice are rolled, and with
 * no PRNG advance the Campaign stays undoable (R-X.3). A step that rolls, or that leaves a roll to
 * come, still reveals. Games created before revision 17 keep every Campaign step revealing (R-X.4).
 */
const NOW = OathRevision.EngineFixes13
const BEFORE = OathRevision.EngineFixes12

const HEARTS = 'denizen.hearth.hearts-and-minds'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const FIELD_PROMOTION = 'denizen.order.field-promotion'
const BEAR_TRAPS = 'denizen.order.bear-traps'
const STORM_CALLER = 'denizen.nomad.storm-caller'
const JINX = 'denizen.arcane.jinx'
const TUTOR = 'denizen.arcane.tutor'
const TENTS = 'denizen.nomad.tents'
const INN = 'denizen.hearth.wayside-inn'
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const SECOND_WIND = 'denizen.discord.second-wind'
const HIDDEN_PLACE = 'site.the-hidden-place'

const DANA = 'dana'
const RHYS = 'rhys'
const ANN = 'ann'
const BEA = 'bea'

const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

/** Every random stream the state carries, so a step that rolled shows as a change. */
const streams = (s: HydratedOathGameState | OathProjectedState) => JSON.stringify([s.prng, s.protectedPrng])

const player = (playerId: string) => ({ kind: 'player', playerId }) as const

type Fields = { type: ActionType; playerId: string } & Record<string, unknown>

/** The step's outcome, or the error that stopped it, named, so a comparison shows which. */
function outcomeOrError(run: () => Outcome): Outcome | string {
    try {
        return run()
    } catch (error) {
        return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    }
}

/** What a step did: the Campaign it left, and whether each action it processed reveals. */
interface Outcome {
    campaign: OathProjectedState['campaign']
    reveals: (boolean | undefined)[]
}

/** Every step goes through `GameEngine`, so the history Undo reads is the engine's own. */
class Table {
    state: OathProjectedState
    history: GameAction[] = []
    processed: GameAction[] = []
    private seq = 0

    constructor(
        s: HydratedOathGameState,
        turn: string,
        seats: string[],
        private readonly game = testGame(seats)
    ) {
        this.state = s.dehydrate()
        this.state.turnManager = {
            series: [{ type: 'turn', playerId: turn, start: 0 }],
            turnOrder: seats,
            turnCounts: Object.fromEntries(seats.map((seat) => [seat, 1]))
        }
        this.state.activePlayerIds = [turn]
    }

    run(fields: Fields) {
        const action: GameAction = { id: `d-${(this.seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        const result = engine.run(action, this.state, this.game)
        this.state = result.updatedState
        this.processed = result.processedActions
        this.history.push(...result.processedActions)
        return this
    }

    /** What the last step did on the host. */
    get outcome(): Outcome {
        return { campaign: this.state.campaign, reveals: this.processed.map((action) => action.revealsInfo) }
    }

    /**
     * The next step as `seat`'s own client runs it before the server answers: on what that seat is
     * served, from its perspective. The client shows this result when the step reveals nothing, so
     * it must be the host's; a hidden read throws, and the client then waits for the server.
     */
    onSeatsView(seat: string, fields: Fields): Outcome {
        const perspective = player(seat)
        const action: GameAction = { id: `view-${seat}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        const game = { ...this.game, hotseat: false, protectedInformation: true as const }
        const result = engine.executeAction({ action, state: served(this.state, perspective), game, perspective })
        return { campaign: result.updatedState.campaign, reveals: result.processedActions.map((processed) => processed.revealsInfo) }
    }

    campaign(playerId: string, defender: string | undefined, targets: CampaignTarget[], attackDice: number, plans: string[] = [], flipSecret?: boolean) {
        return this.run({ type: ActionType.Campaign, playerId, defender: defender ? { kind: 'player', playerId: defender } : { kind: 'bandits' }, targets, attackDice, plans: plans.map(battlePlanUse), flipSecret })
    }

    defend(playerId: string, plans: string[] = []) {
        return this.run({ type: ActionType.CampaignDefend, playerId, plans: plans.map(battlePlanUse) })
    }

    defendIfAsked(playerId: string) {
        if (this.state.machineState === MachineState.CampaignPlans) this.defend(playerId)
        return this
    }

    sacrifice(playerId: string) {
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(this.state), 0)
        return this.run({ type: ActionType.CampaignSacrifice, playerId, sacrifice: 0, defeatKills })
    }

    victory(playerId: string) {
        return this.run({ type: ActionType.CampaignResolveVictory, playerId, placements: [], burnFavor: false })
    }

    answer(playerId: string, answer: QuestionAnswer) {
        return this.run({ type: ActionType.AnswerQuestion, playerId, answer })
    }

    /** The action Undo offers `playerId` now, if any. */
    undoTarget(playerId: string): GameAction | undefined {
        return latestPlayerUndoTarget(this.history, playerId)
    }

    /** The state that Undo rewinds to: every action from the offered one on, undone by its patch. */
    undone(playerId: string): OathProjectedState {
        const target = this.undoTarget(playerId)
        assertExists(target, `Undo is offered to ${playerId}`)
        let state = this.state
        for (const action of this.history.slice(this.history.indexOf(target)).toReversed())
            state = engine.undoProcessedAction({ state, action })
        return state
    }

    player(playerId: string) {
        const found = this.state.players.find((p) => p.playerId === playerId)
        assertExists(found, `no player ${playerId}`)
        return found
    }
}

// ---- Hearts and Minds: Rhys attacks Dana at c1, where Dana rules Hearts and Minds; Ann is away ----

function heartsBoard(revision: number, rhys: Partial<OathPlayerState> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: RHYS, color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { [RHYS]: 4 }, warbandsInPersonalBank: { [RHYS]: 6 }, advisers: [{ cardId: TENTS, faceUp: false }], ...rhys }),
            testPlayer({ playerId: DANA, color: Color.Blue, siteId: 'c1', favor: 5, secrets: 2, supply: 4, warbandsOnBoard: { [DANA]: 2 }, warbandsInPersonalBank: { [DANA]: 5 }, advisers: [{ cardId: TUTOR, faceUp: false }] }),
            testPlayer({ playerId: ANN, color: Color.Yellow, siteId: 'h1', favor: 3, secrets: 1, supply: 4, advisers: [{ cardId: STORM_CALLER, faceUp: false }] })
        ],
        {
            oathRevision: revision,
            denizensBySite: { c1: [HEARTS] },
            warbandsBySite: { c1: { [DANA]: 2 } },
            siteCards: { c1: 'site.plains' },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, RHYS)
    return s
}

function rhysAttacksDana(s: HydratedOathGameState): HydratedCampaign {
    const declared = new HydratedCampaign(buildAction(Campaign, { playerId: RHYS, defender: { kind: 'player', playerId: DANA }, targets: [siteTarget('c1')], attackDice: 3 }))
    declared.apply(s)
    return declared
}

const danaDefends = (plans: string[]) => () => new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: DANA, plans: plans.map(battlePlanUse) }))

describe('R-5.5.5.b-H1 — Hearts and Minds decides the Campaign with no roll, so its defence stays undoable', () => {
    it('the defence rolls nothing and reveals nothing; the declaration, waiting on it, still reveals', () => {
        const s = heartsBoard(NOW)
        const declared = rhysAttacksDana(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([DANA])
        expect(declared.revealsInfo).toBe(true)
        const before = streams(s)
        const defence = danaDefends([HEARTS])()
        defence.apply(s)
        expect(s.campaign).toMatchObject({ decidedVictor: 'defender', attackRoll: [], defenseRoll: [] })
        expect(streams(s)).toBe(before)
        expect(defence.revealsInfo).toBe(false)
    })

    it('control: a defence that rolls reveals, at either revision', () => {
        for (const revision of [NOW, BEFORE]) {
            const s = heartsBoard(revision)
            rhysAttacksDana(s)
            const before = streams(s)
            const defence = danaDefends([])()
            defence.apply(s)
            expect(ongoingCampaign(s).attackRoll.length, `revision ${revision}`).toBeGreaterThan(0)
            expect(streams(s)).not.toBe(before)
            expect(defence.revealsInfo, `revision ${revision}`).toBe(true)
        }
    })

    it('in a game created before revision 17 the Hearts and Minds defence reveals, as recorded', () => {
        const s = heartsBoard(BEFORE)
        rhysAttacksDana(s)
        const defence = danaDefends([HEARTS])()
        defence.apply(s)
        expect(s.campaign?.decidedVictor).toBe('defender')
        expect(defence.revealsInfo).toBe(true)
    })

    it('Jinx: with no dice rolled there is nothing to reroll, so nothing is asked; after a roll it is asked', () => {
        const s = heartsBoard(NOW, { advisers: [adviser(JINX)] })
        rhysAttacksDana(s)
        const defence = danaDefends([HEARTS])()
        defence.apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        expect(defence.revealsInfo).toBe(false)

        const rolled = heartsBoard(NOW, { advisers: [adviser(JINX)] })
        rhysAttacksDana(rolled)
        const plain = danaDefends([])()
        plain.apply(rolled)
        expect(rolled.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.RerollDice, askedPlayerId: RHYS })
        expect(plain.revealsInfo).toBe(true)
    })

    it("on Dana's own view the defence reaches the host's Campaign and flag; on a seat that cannot see Dana's advisers it waits for the server", () => {
        const t = new Table(heartsBoard(NOW), RHYS, [RHYS, DANA, ANN])
        t.campaign(RHYS, DANA, [siteTarget('c1')], 3)
        expect(JSON.stringify(served(t.state, player(DANA)))).not.toContain(TENTS)
        expect(JSON.stringify(served(t.state, player(ANN)))).not.toContain(TUTOR)
        const defence = { type: ActionType.CampaignDefend, playerId: DANA, plans: [battlePlanUse(HEARTS)] }
        const views = [DANA, ANN].map((seat) => outcomeOrError(() => t.onSeatsView(seat, defence)))
        t.run(defence)
        expect(t.outcome.reveals).toEqual([false])
        // Ann's run reads Dana's facedown adviser: the projected-unavailable error, so it never differs.
        expect(views).toEqual([t.outcome, expect.stringMatching(/^UnavailableProjectedValueError: .*\/players\/1\/adviserIds$/)])
    })

    it('through the engine: Undo is offered after the defence, and rewinds to the plans being asked', () => {
        const t = new Table(heartsBoard(NOW), RHYS, [RHYS, DANA, ANN])
        t.campaign(RHYS, DANA, [siteTarget('c1')], 3)
        expect(t.state.machineState).toBe(MachineState.CampaignPlans)
        const asked = structuredClone(t.state)
        t.defend(DANA, [HEARTS])
        expect(t.state.campaign?.decidedVictor).toBe('defender')
        expect(t.undoTarget(DANA)?.type).toBe(ActionType.CampaignDefend)
        expect(t.undone(DANA)).toEqual(asked)

        const recorded = new Table(heartsBoard(BEFORE), RHYS, [RHYS, DANA, ANN])
        recorded.campaign(RHYS, DANA, [siteTarget('c1')], 3).defend(DANA, [HEARTS])
        expect(recorded.undoTarget(DANA)).toBeUndefined()
    })

    it("the server's out-of-turn commutation admits nothing new: a let-peek, Oath's one sequenced action, itself reveals", () => {
        const game = testGame([RHYS, DANA, ANN])
        const t = new Table(heartsBoard(NOW), RHYS, [RHYS, DANA, ANN], game)
        t.campaign(RHYS, DANA, [siteTarget('c1')], 3)
        const index = t.state.actionCount
        const asked = t.state
        t.defend(DANA, [HEARTS])
        expect(t.processed.some((action) => action.revealsInfo)).toBe(false)
        const late = buildAction(LetPeek, { id: 'late-peek', playerId: ANN, toPlayerId: RHYS, subject: { kind: LetPeekSubjectKind.Adviser, cardId: STORM_CALLER }, index })
        // Ann may show Rhys an adviser while Dana is asked for a defence, and that shows a card.
        expect(engine.executeCanonicalAction({ action: late, state: asked, game }).processedActions.map((action) => action.revealsInfo)).toEqual([true])
        expect(proveCommutation({ engine, apiActions: OathRuntime.apiActions, game, state: t.state, raced: t.processed, late })).toEqual({ kind: 'invalid', reason: 'an involved Action reveals information' })
    })
})

// ---- Peace Envoy: Dana, an Exile, attacks Bea, a Citizen, at c1, which the Empire holds, so Ann, the Chancellor, is Bea's Ally ----

interface EnvoyScene {
    revision: number
    dana?: Partial<OathPlayerState>
    bea?: Partial<OathPlayerState>
    ann?: Partial<OathPlayerState>
    rhys?: Partial<OathPlayerState>
    /** Hearts and Minds at c2, which Bea rules. */
    hearts?: boolean
}

function envoyTable(scene: EnvoyScene): HydratedOathGameState {
    const s = testState(
        [
            testPlayer({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 8, secrets: 3, warbandsOnBoard: { [DANA]: 6 }, warbandsInPersonalBank: { [DANA]: 4 }, advisers: [adviser(PEACE_ENVOY)], ...scene.dana }),
            testPlayer({ playerId: BEA, color: Color.Blue, status: PlayerStatus.Citizen, siteId: 'c1', supply: 6, favor: 8, secrets: 3, warbandsOnBoard: { [BEA]: 2 }, warbandsInPersonalBank: { [BEA]: 4 }, ...scene.bea }),
            testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 }, ...scene.ann }),
            testPlayer({ playerId: RHYS, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'p2', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: {}, warbandsInPersonalBank: {}, ...scene.rhys })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: { c1: [], c2: scene.hearts ? [HEARTS] : [], p1: [], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 }, c2: { [BEA]: 2 }, p1: { [IMPERIAL_WARBANDS]: 1 } },
            prng: { seed: 1, invocations: 0 }
        }
    )
    openTurn(s, DANA)
    return s
}

const danaAttacks = (plans: string[]) => () =>
    new HydratedCampaign(buildAction(Campaign, { playerId: DANA, defender: { kind: 'player', playerId: BEA }, targets: [siteTarget('c1')], attackDice: 3, plans: plans.map(battlePlanUse) }))

const defends = (playerId: string, plans: string[] = []) => () =>
    new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId, plans: plans.map(battlePlanUse) }))

const noPlans = { advisers: [] }
/** Every other seat holds a facedown adviser that is no battle plan, so each view hides some. */
const hiddenAdvisers = { bea: { advisers: [{ cardId: TENTS, faceUp: false }] }, ann: { advisers: [{ cardId: TUTOR, faceUp: false }] }, rhys: { advisers: [{ cardId: INN, faceUp: false }] } }

describe('R-5.5.5.b-H1 — Peace Envoy decides the Campaign at its declaration', () => {
    it('with no defending plan to wait on, the declaration rolls nothing and reveals nothing', () => {
        const s = envoyTable({ revision: NOW, ann: noPlans })
        const before = streams(s)
        const declared = danaAttacks([PEACE_ENVOY])()
        declared.apply(s)
        expect(ongoingCampaign(s)).toMatchObject({ decidedVictor: 'attacker', attackRoll: [], defenseRoll: [] })
        expect(ongoingCampaign(s).pendingDefenderPlans).toBeUndefined()
        expect(streams(s)).toBe(before)
        expect(declared.revealsInfo).toBe(false)
    })

    it('in a game created before revision 17 that declaration reveals, as recorded', () => {
        const s = envoyTable({ revision: BEFORE, ann: noPlans })
        const declared = danaAttacks([PEACE_ENVOY])()
        declared.apply(s)
        expect(ongoingCampaign(s).decidedVictor).toBe('attacker')
        expect(declared.revealsInfo).toBe(true)
    })

    it('with a defender who has a plan, the declaration still reveals; that defence, the last, does not', () => {
        const s = envoyTable({ revision: NOW, ann: { advisers: [adviser(FIELD_PROMOTION)] } })
        const declared = danaAttacks([PEACE_ENVOY])()
        declared.apply(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN])
        expect(declared.revealsInfo).toBe(true)
        const before = streams(s)
        const defence = defends(ANN, [FIELD_PROMOTION])()
        defence.apply(s)
        expect(streams(s)).toBe(before)
        expect(defence.revealsInfo).toBe(false)
    })

    it('a second defender queued after Hearts and Minds: that defence reveals, the last one does not', () => {
        const s = envoyTable({ revision: NOW, hearts: true, dana: noPlans, ann: { advisers: [adviser(FIELD_PROMOTION)] } })
        danaAttacks([])().apply(s)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([BEA, ANN])
        const first = defends(BEA, [HEARTS])()
        first.apply(s)
        expect(ongoingCampaign(s).decidedVictor).toBe('defender')
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([ANN])
        expect(first.revealsInfo).toBe(true)
        const last = defends(ANN)()
        last.apply(s)
        expect(ongoingCampaign(s).attackRoll).toEqual([])
        expect(last.revealsInfo).toBe(false)
    })

    it("on Dana's own view, and on a third seat's, the declaration reaches the host's Campaign and flag", () => {
        const t = new Table(envoyTable({ revision: NOW, ...hiddenAdvisers }), DANA, [DANA, BEA, ANN, RHYS])
        const declaration = { type: ActionType.Campaign, playerId: DANA, defender: { kind: 'player', playerId: BEA }, targets: [siteTarget('c1')], attackDice: 3, plans: [battlePlanUse(PEACE_ENVOY)] }
        const views = [DANA, RHYS].map((seat) => outcomeOrError(() => t.onSeatsView(seat, declaration)))
        t.run(declaration)
        expect(t.outcome.reveals).toEqual([false])
        expect(views).toEqual([t.outcome, t.outcome])
    })

    it('the bandits defending, with their compelled plans: decided, nothing rolled, nothing revealed', () => {
        const s = testState(
            [
                testPlayer({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { [DANA]: 6 }, warbandsInPersonalBank: { [DANA]: 4 }, advisers: [adviser(PEACE_ENVOY)] }),
                testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h3', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 } })
            ],
            {
                oathRevision: NOW,
                denizensBySite: { c1: [BEAR_TRAPS, STORM_CALLER], c2: [], p1: [], p2: [], h1: [] },
                warbandsBySite: { c2: { [IMPERIAL_WARBANDS]: 1 } },
                siteCards: Object.fromEntries([...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => [slotId, slotId])),
                prng: { seed: 1, invocations: 0 }
            }
        )
        openTurn(s, DANA)
        const before = streams(s)
        const declared = new HydratedCampaign(buildAction(Campaign, { playerId: DANA, defender: { kind: 'bandits' }, targets: [siteTarget('c1')], attackDice: 4, plans: [battlePlanUse(PEACE_ENVOY)] }))
        declared.apply(s)
        expect(ongoingCampaign(s).plansUsedBy.bandits).toEqual([BEAR_TRAPS, STORM_CALLER])
        expect(ongoingCampaign(s).decidedVictor).toBe('attacker')
        expect(streams(s)).toBe(before)
        expect(declared.revealsInfo).toBe(false)
    })

    it('through the engine: Undo is offered after the declaration, and gives back the Supply it spent', () => {
        const t = new Table(envoyTable({ revision: NOW, ann: noPlans }), DANA, [DANA, BEA, ANN, RHYS])
        const start = structuredClone(t.state)
        t.campaign(DANA, BEA, [siteTarget('c1')], 3, [PEACE_ENVOY])
        expect(t.player(DANA).supply).toBeLessThan(6)
        expect(t.undoTarget(DANA)?.type).toBe(ActionType.Campaign)
        const undone = t.undone(DANA)
        expect(undone).toEqual(start)
        expect(undone.players.find((p) => p.playerId === DANA)?.supply).toBe(6)
    })
})

// ---- The Citizens asked first: Rhys, a Citizen at c1, is asked to join Bea's defence ----

const answers = (playerId: string, granted: boolean) => () => new HydratedAnswerConsent(buildAction(AnswerConsent, { playerId, granted }))
const attackPlans = (plans: string[]) => () => new HydratedCampaignAttackPlans(buildAction(CampaignAttackPlans, { playerId: DANA, plans: plans.map(battlePlanUse) }))

describe('R-5.5.5.b-H1 — Peace Envoy declared once the Citizens have answered', () => {
    it("the attacker's plans, Peace Envoy, decide the Campaign: they reveal nothing; before revision 17 they do", () => {
        for (const [revision, reveals] of [[NOW, false], [BEFORE, true]] as const) {
            const s = envoyTable({ revision, ann: noPlans, rhys: { siteId: 'c1' } })
            const declared = danaAttacks([])()
            declared.apply(s)
            expect(s.pendingConsent?.askedPlayerId).toBe(RHYS)
            expect(declared.revealsInfo).toBe(true)
            const declined = answers(RHYS, false)()
            declined.apply(s)
            expect(s.pendingCampaign?.awaitingAttackerPlans).toBe(true)
            expect(declined.revealsInfo).toBe(false)
            const before = streams(s)
            const plans = attackPlans([PEACE_ENVOY])()
            plans.apply(s)
            expect(ongoingCampaign(s).decidedVictor).toBe('attacker')
            expect(streams(s)).toBe(before)
            expect(plans.revealsInfo, `revision ${revision}`).toBe(reveals)
        }
    })

    it("on Dana's own view, and on Rhys's, the plans reach the host's Campaign and flag", () => {
        const t = new Table(envoyTable({ revision: NOW, ...hiddenAdvisers, rhys: { siteId: 'c1', advisers: [{ cardId: STORM_CALLER, faceUp: false }] } }), DANA, [DANA, BEA, ANN, RHYS])
        t.campaign(DANA, BEA, [siteTarget('c1')], 3)
        t.run({ type: ActionType.AnswerConsent, playerId: RHYS, granted: false })
        expect(t.state.pendingCampaign?.awaitingAttackerPlans).toBe(true)
        const plans = { type: ActionType.CampaignAttackPlans, playerId: DANA, plans: [battlePlanUse(PEACE_ENVOY)] }
        const views = [DANA, RHYS].map((seat) => outcomeOrError(() => t.onSeatsView(seat, plans)))
        t.run(plans)
        expect(t.outcome.reveals).toEqual([false])
        expect(views).toEqual([t.outcome, t.outcome])
    })

    it('a Citizen answer that musters with no attacking plan rolls, and reveals', () => {
        const s = envoyTable({ revision: NOW, dana: noPlans, ann: noPlans, rhys: { siteId: 'c1' } })
        danaAttacks([])().apply(s)
        const before = streams(s)
        const declined = answers(RHYS, false)()
        declined.apply(s)
        expect(ongoingCampaign(s).attackRoll.length).toBeGreaterThan(0)
        expect(streams(s)).not.toBe(before)
        expect(declined.revealsInfo).toBe(true)
    })

    it("the Citizen joins, the admission musters and waits on Bea's plans, so it reveals; Bea's Hearts and Minds then does not", () => {
        const s = envoyTable({ revision: NOW, hearts: true, dana: noPlans, ann: noPlans, rhys: { siteId: 'c1' } })
        danaAttacks([])().apply(s)
        answers(RHYS, true)().apply(s)
        const admitted = answers(BEA, true)()
        admitted.apply(s)
        expect(ongoingCampaign(s).allyPlayerIds).toContain(RHYS)
        expect(ongoingCampaign(s).pendingDefenderPlans?.queue).toEqual([BEA])
        expect(admitted.revealsInfo).toBe(true)
        const defence = defends(BEA, [HEARTS])()
        defence.apply(s)
        expect(ongoingCampaign(s).decidedVictor).toBe('defender')
        expect(defence.revealsInfo).toBe(false)
    })
})

// ---- Held turns: Sneak Attack and Second Wind, in X's turn ----

const X = 'x'
const Y = 'y'
const H = 'h'

function heldBoard(revision: number, seed: number, y: Partial<OathPlayerState> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        withChancellor([
            testPlayer({ playerId: X, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [X]: 6 } }),
            testPlayer({ playerId: Y, color: Color.Blue, siteId: 'c1', favor: 6, secrets: 2, supply: 0, warbandsOnBoard: { [Y]: 4 }, advisers: [adviser(SNEAK_ATTACK), adviser(PEACE_ENVOY)], ...y }),
            testPlayer({ playerId: H, color: Color.Yellow, siteId: 'p1', favor: 0, supply: 6, warbandsOnBoard: { [H]: 2 }, warbandsInPersonalBank: { [H]: 12 } })
        ]),
        { warbandsBySite: {}, prng: { seed, invocations: 0 }, ...state }
    )
    s.oathRevision = revision
    return s
}

describe('R-5.5.5.b-H1 — a decided Campaign that holds the turn player’s turn', () => {
    it('Sneak Attack with Peace Envoy, flipping a secret at The Hidden Place: Undo is offered, and gives back the question, the turn and the secret', () => {
        const hidden = { siteCards: { ...Object.fromEntries(['c2', 'p1', 'p2', 'p3', 'h1', 'h2', 'h3'].map((id) => [id, id])), c1: HIDDEN_PLACE } }
        for (const revision of [NOW, BEFORE]) {
            const t = new Table(heldBoard(revision, 1, {}, hidden), X, [X, Y, H])
            t.campaign(X, Y, [PAWN], 0, [], true).defendIfAsked(Y).sacrifice(X)
            expect(t.state.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y })
            const asked = structuredClone(t.state)
            t.campaign(Y, X, [PAWN], 2, [PEACE_ENVOY], true)
            expect(t.state.heldTurn).toMatchObject({ askingPlayerId: X })
            expect(t.state.campaign).toMatchObject({ attackerPlayerId: Y, decidedVictor: 'attacker' })
            expect(t.player(Y)).toMatchObject({ secrets: 1, secretsFacedown: 1 })
            if (revision === BEFORE) {
                expect(t.undoTarget(Y)).toBeUndefined()
                continue
            }
            expect(t.undoTarget(Y)?.type).toBe(ActionType.Campaign)
            const undone = t.undone(Y)
            expect(undone).toEqual(asked)
            expect(undone.heldTurn).toBeUndefined()
            expect(undone.players.find((p) => p.playerId === Y)).toMatchObject({ secrets: 2, secretsFacedown: 0 })
        }
    })

    it('Second Wind, its free Campaign with Peace Envoy: Undo is offered, and gives back the "Campaign now?" question', () => {
        const skip: QuestionAnswer = { kind: PowerQuestionKind.FreeActionOutOfTurn, take: false }
        for (let seed = 1; seed < 500; seed++) {
            const t = new Table(heldBoard(NOW, seed, { supply: 0, advisers: [adviser(SNEAK_ATTACK), adviser(SECOND_WIND), adviser(PEACE_ENVOY)] }), X, [X, Y, H])
            t.campaign(X, Y, [PAWN], 0).defendIfAsked(Y).sacrifice(X)
            t.campaign(Y, X, [PAWN], 4, [SECOND_WIND]).defendIfAsked(X)
            const rolled = t.state.campaign
            if (!rolled || rolled.swords <= rolled.defense || t.state.machineState !== MachineState.CampaignSacrifice) continue
            t.sacrifice(Y)
            if (t.state.campaign?.attackerVictorious !== true) continue
            t.victory(Y).answer(Y, skip)
            expect(t.state.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.FreeActionOutOfTurn, askedPlayerId: Y, action: ActionType.Campaign })
            const asked = structuredClone(t.state)
            t.campaign(Y, X, [PAWN], 2, [PEACE_ENVOY])
            expect(t.state.campaign).toMatchObject({ attackerPlayerId: Y, decidedVictor: 'attacker' })
            expect(t.state.heldTurn).toMatchObject({ askingPlayerId: X })
            expect(t.undoTarget(Y)?.type).toBe(ActionType.Campaign)
            expect(t.undone(Y)).toEqual(asked)
            return
        }
        throw Error('no seed found where the Sneak Attack wins outright')
    })
})
