import { describe, expect, it } from 'vitest'
import { machineContext, buildAction } from '../testing/actions.js'
import { assertExists, ActionSource, Color, type GameAction } from '@tabletop/common'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignSacrifice, isCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { HydratedSearch, Search, SearchSource } from '../actions/search.js'
import { isForgoFreeAction } from '../actions/forgoFreeAction.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { engine } from '../testing/engine.js'
import { CampaignPlansStateHandler, CampaignSacrificeStateHandler, CampaignVictoryStateHandler } from '../stateHandlers/campaigning.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { Region, Suit } from '../model/oathEnums.js'
import { PowerQuestionKind, type QuestionAnswer } from '../model/question.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { powersWithTiming, PowerTiming } from '../data/cardPowers.js'
import { persistentsInPlay } from '../util/persistent.js'
import { campaignRecords, testPlayer, testState, withChancellor } from '../testing/fixture.js'
import { hasEffect } from './registry.js'
import '../powers/index.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { testGame } from '../testing/game.js'
import { adviser } from '../testing/tables.js'
import { OathRevision } from '../util/revision.js'

/** R-7.1.4-H2 — its "you may" holds the interrupted turn until its Campaign is over. */
const SNEAK_ATTACK = 'denizen.discord.sneak-attack'
const SECOND_WIND = 'denizen.discord.second-wind'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const STORM_CALLER = 'denizen.nomad.storm-caller'
const HERALD = 'denizen.hearth.herald'
const JINX = 'denizen.arcane.jinx'

const X = 'x'
const Y = 'y'
const H = 'h'

const POWER = powersWithTiming(SNEAK_ATTACK, PowerTiming.Persistent)[0]
const PAWN: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const pass: QuestionAnswer = { kind: PowerQuestionKind.SneakAttack, campaign: false }

function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    return testState(
        withChancellor([
            testPlayer({ playerId: X, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [X]: 6 }, ...over[X] }),
            testPlayer({ playerId: Y, color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 0, warbandsOnBoard: { [Y]: 4 }, advisers: [adviser(SNEAK_ATTACK)], ...over[Y] }),
            testPlayer({ playerId: H, color: Color.Yellow, siteId: 'p1', favor: 0, supply: 6, warbandsOnBoard: { [H]: 2 }, warbandsInPersonalBank: { [H]: 12 }, ...over[H] })
        ]),
        { warbandsBySite: {}, ...state }
    )
}
type Board = ReturnType<typeof board>

const game = testGame([X, Y, H])

/** Every step goes through `GameEngine`, so the machine state and the clock are the engine's. */
class Table {
    state: OathProjectedState
    processed: GameAction[] = []
    private seq = 0

    constructor(s: Board, turn = X, seats = [X, Y, H]) {
        this.state = s.dehydrate()
        this.state.turnManager = { series: [{ type: 'turn', playerId: turn, start: 0 }], turnOrder: seats, turnCounts: { [X]: 1, [Y]: 1, [H]: 1 } }
        this.state.activePlayerIds = [turn]
    }

    run(fields: { type: ActionType; playerId: string } & Record<string, unknown>) {
        const action: GameAction = { id: `sa-${(this.seq += 1)}`, gameId: 'game-1', source: ActionSource.User, index: this.state.actionCount, ...fields }
        const result = engine.run(action, this.state, game)
        this.state = result.updatedState
        this.processed = result.processedActions
        return this
    }

    campaign(playerId: string, defender: string | undefined, targets: CampaignTarget[], attackDice: number, plans: string[] = [], flipSecret?: boolean) {
        return this.run({ type: ActionType.Campaign, playerId, defender: defender ? { kind: 'player', playerId: defender } : { kind: 'bandits' }, targets, attackDice, plans: plans.map(battlePlanUse), flipSecret })
    }

    defend(playerId: string, plans: string[] = []) {
        return this.run({ type: ActionType.CampaignDefend, playerId, plans: plans.map(battlePlanUse) })
    }

    sacrifice(playerId: string) {
        const defeatKills = HydratedCampaignSacrifice.attackerDefeatKills(new HydratedOathGameState(this.state), 0)
        return this.run({ type: ActionType.CampaignSacrifice, playerId, sacrifice: 0, defeatKills })
    }

    victory(playerId: string, fields: Record<string, unknown> = {}) {
        return this.run({ type: ActionType.CampaignResolveVictory, playerId, placements: [], burnFavor: false, ...fields })
    }

    answer(playerId: string, answer: QuestionAnswer) {
        return this.run({ type: ActionType.AnswerQuestion, playerId, answer })
    }

    /** No attack dice make a certain defeat (R-5.5.5.b), so the walk needs no seed. */
    /** `flipSecret` — The Hidden Place under the defender's pawn asks for one (R-11.13). */
    xLosesToY(flipSecret?: boolean) {
        this.campaign(X, Y, [PAWN], 0, [], flipSecret)
        if (this.state.machineState === MachineState.CampaignPlans) this.defend(Y)
        return this.sacrifice(X)
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

    get turnPlayer() {
        return this.state.turnManager.series.at(-1)?.playerId
    }
}

describe('Sneak Attack — registered', () => {
    it('its persistent power has an effect, and is in play for the adviser’s holder alone', () => {
        expect(hasEffect(POWER)).toBe(true)
        const inPlay = persistentsInPlay(board()).filter((p) => p.ctx.cardId === SNEAK_ATTACK)
        expect(inPlay.map((p) => p.ctx.ownerIds)).toEqual([[Y]])
    })
})

describe('Sneak Attack — "After another player\'s campaign, you may campaign"', () => {
    it('after another player’s campaign: the holder is asked as it ends, and is on the clock in the other player’s turn', () => {
        const t = new Table(board()).xLosesToY()
        expect(t.state.campaign).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.PowerQuestion)
        expect(t.question).toEqual({ kind: PowerQuestionKind.SneakAttack, cardId: SNEAK_ATTACK, askedPlayerId: Y, defenderPlayerId: X })
        expect(t.state.activePlayerIds).toEqual([Y])
        expect(t.turnPlayer).toBe(X)
        expect(t.offered(Y)).toEqual([ActionType.AnswerQuestion, ActionType.Campaign])
        expect(t.offered(X)).toEqual([])
    })

    it('after a victory too: the question follows R-5.5.7’s step, against the bandits’ attacker as against a player’s', () => {
        const s = board()
        new HydratedCampaign(buildAction(Campaign, { playerId: X, defender: { kind: 'bandits' }, targets: [siteTarget('c1')], attackDice: 3 })).apply(s)
        Object.assign(s.campaign ?? {}, { swords: 9, defense: 0 })
        new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: X, sacrifice: 0, defeatKills: [] })).apply(s)
        expect(s.pendingQuestions).toBeUndefined()
        const won = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: X, placements: [{ siteId: 'c1', owner: X, count: 1 }], burnFavor: false }))
        won.apply(s)
        expect(s.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y, defenderPlayerId: X }])
        expect(won.metadata?.triggered).toEqual([`Sneak Attack: ${Y} may campaign against ${X} for no Supply`])
    })

    it('another player’s: the holder’s own Campaign asks nobody', () => {
        const t = new Table(board(), Y)
        t.state.players[1].supply = 6
        t.campaign(Y, X, [PAWN], 0).sacrifice(Y)
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.pendingQuestions).toBeUndefined()
        const [ended] = t.processed
        expect(isCampaignSacrifice(ended) && ended.metadata?.attackerVictorious === false).toBe(true)
        expect(isCampaignSacrifice(ended) ? ended.metadata?.planNotes : ['not the sacrifice']).toBeUndefined()
    })

    it('you may: passing campaigns against nobody, and the other player’s Act Phase resumes', () => {
        const t = new Table(board()).xLosesToY().answer(Y, pass)
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.campaign).toBeUndefined()
        expect(t.offered(X)).toContain(ActionType.EndActPhase)
    })

    it('a faceup adviser’s power: facedown, it asks nobody (R-5.1.4.II)', () => {
        const t = new Table(board({ [Y]: { advisers: [adviser(SNEAK_ATTACK, false)] } })).xLosesToY()
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.pendingQuestions).toBeUndefined()
    })
})

describe('Sneak Attack — "spending no Supply"', () => {
    it('spending no Supply: a holder with none may campaign, spends none, and the turn player’s ledger is untouched', () => {
        const t = new Table(board()).xLosesToY()
        const before = { ...t.player(X) }
        t.campaign(Y, X, [PAWN], 0)
        expect(t.state.campaign?.attackerPlayerId).toBe(Y)
        expect(t.player(Y)).toMatchObject({ supply: 0, supplySpentThisTurn: 0 })
        expect(t.player(X)).toMatchObject({ supply: before.supply, supplySpentThisTurn: before.supplySpentThisTurn })
    })

    it('only the Sneak Attack is free: the same player’s ordinary Campaign still costs R-5.5.1’s two', () => {
        const s = board()
        expect(HydratedCampaign.supplyCostFor(s, Y)).toBe(2)
        expect(HydratedCampaign.canDoCampaign(s, Y)).toBe(false)
    })
})

describe('Sneak Attack — "if you declare them as the defender"', () => {
    it('if you declare them as the defender: they are the only legal defender, and any other is refused', () => {
        const t = new Table(board({ [H]: { siteId: 'c1' } })).xLosesToY()
        const s = new HydratedOathGameState(t.state)
        expect(HydratedCampaign.legalDefenders(s, Y)).toEqual([{ kind: 'player', playerId: X }])
        const declare = (defender: { kind: 'player'; playerId: string } | { kind: 'bandits' }, targets: CampaignTarget[]) => HydratedCampaign.reasonCannotCampaign(s, Y, { defender, targets, attackDice: 0 })
        expect(declare({ kind: 'player', playerId: H }, [PAWN])).toBe(`a Sneak Attack must declare ${X} as the defender`)
        expect(declare({ kind: 'bandits' }, [siteTarget('c1')])).toBe(`a Sneak Attack must declare ${X} as the defender`)
        expect(declare({ kind: 'player', playerId: X }, [PAWN])).toBeUndefined()
        expect(() => t.campaign(Y, H, [PAWN], 0)).toThrow(/must declare x as the defender/)
    })

    it('R-5.5.1 still applies: with the attacker neither ruling the holder’s site nor standing on it, nobody is asked', () => {
        const t = new Table(board({ [Y]: { siteId: 'c2' }, [H]: { siteId: 'c1' } }))
        t.campaign(X, H, [PAWN], 0).sacrifice(X)
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.pendingQuestions).toBeUndefined()
        // R-5.5.1 — ruling the holder's site is the other limb.
        const ruled = new Table(board({ [Y]: { siteId: 'c2' }, [H]: { siteId: 'c1' } }, { warbandsBySite: { c2: { [X]: 1 } } }))
        ruled.campaign(X, H, [PAWN], 0).sacrifice(X)
        expect(ruled.question).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y })
        // R-5.5.2 — the defender rules the holder's site, so it must be targeted.
        expect(() => ruled.campaign(Y, X, [], 0)).toThrow(/must declare at least one target at your site/)
        ruled.campaign(Y, X, [siteTarget('c2')], 0)
        expect(ruled.state.campaign?.targets).toEqual([siteTarget('c2')])
    })

    it('R-5.5.2: with no legal declaration of targets against the defender, nobody is asked (The Hidden Place, no secret to flip)', () => {
        const hidden = (secrets: number) => new Table(board({ [Y]: { secrets } }, { warbandsBySite: { c1: { [X]: 1 } }, siteCards: { ...Object.fromEntries(['c2', 'p1', 'p2', 'p3', 'h1', 'h2', 'h3'].map((id) => [id, id])), c1: 'site.the-hidden-place' } })).xLosesToY(true)
        const noSecret = hidden(0)
        expect(noSecret.state.machineState).toBe(MachineState.ActPhase)
        expect(noSecret.state.pendingQuestions).toBeUndefined()
        expect(hidden(1).question).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y, defenderPlayerId: X })
    })

    it('only the asked player, only while asked: nobody else may campaign from the question, and no other question opens a Campaign', () => {
        const t = new Table(board()).xLosesToY()
        expect(() => t.campaign(X, Y, [PAWN], 0)).toThrow(/not an active player/)
        expect(() => t.answer(X, pass)).toThrow(/not an active player/)
        const s = new HydratedOathGameState(t.state)
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, X, pass)).toBe("the question is y's to answer")
        expect(HydratedAnswerQuestion.reasonCannotAnswer(s, Y, { kind: PowerQuestionKind.JoinSite, join: true })).toMatch(/the question is sneakAttack/)
        const herald = new Table(board({ [Y]: { advisers: [adviser(HERALD)], supply: 6 } })).xLosesToY()
        expect(herald.question).toMatchObject({ kind: PowerQuestionKind.PickFavorBank, askedPlayerId: Y })
        expect(herald.offered(Y)).toEqual([ActionType.AnswerQuestion])
        expect(() => herald.campaign(Y, X, [PAWN], 0)).toThrow(/is not valid in state PowerQuestion/)
    })
})

describe('Sneak Attack — the whole interrupted turn, through the engine', () => {
    it('the whole interrupted turn: plans, the defender’s plans, the roll’s place, the sacrifice, the spoils, and then the turn player’s Act Phase where it was', () => {
        const t = new Table(board({ [X]: { advisers: [adviser(STORM_CALLER)] }, [Y]: { advisers: [adviser(SNEAK_ATTACK), adviser(PEACE_ENVOY)] } }))
        t.campaign(X, Y, [PAWN], 0)
        // R-5.5.3 — the defender is on the clock for their plans, in the attacker's turn.
        expect(t.state.machineState).toBe(MachineState.CampaignPlans)
        expect(t.state.activePlayerIds).toEqual([Y])
        t.defend(Y)
        expect(t.state.activePlayerIds).toEqual([X])
        t.sacrifice(X)
        const xAfterOwnCampaign = { ...t.player(X) }
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y })

        // Peace Envoy decides the battle without a roll, so the walk needs no seed.
        t.campaign(Y, X, [PAWN], 2, [PEACE_ENVOY])
        expect(t.state.heldTurn).toEqual({ queue: [], askingPlayerId: X, resumeMachineState: MachineState.ActPhase })
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.state.campaign).toMatchObject({ attackerPlayerId: Y, defenderPlayerId: X, decidedVictor: 'attacker' })
        // R-7.1.2.a — it is not the holder's turn, so the plan's favor goes to its bank at once.
        expect(t.state.cardTokens[PEACE_ENVOY]).toBeUndefined()
        expect(t.state.favorBank[Suit.Order]).toBe(4)

        expect(t.state.machineState).toBe(MachineState.CampaignPlans)
        expect(t.state.activePlayerIds).toEqual([X])
        expect(t.offered(X)).toEqual([ActionType.CampaignDefend])
        expect(t.offered(Y)).toEqual([])
        t.defend(X, [STORM_CALLER])

        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.activePlayerIds).toEqual([Y])
        expect(t.offered(X)).toEqual([])
        t.sacrifice(Y)
        expect(t.state.campaign?.attackerVictorious).toBe(true)
        expect(t.state.machineState).toBe(MachineState.CampaignVictory)
        expect(t.state.activePlayerIds).toEqual([Y])
        expect(t.turnPlayer).toBe(X)

        const favorBefore = t.player(X).favor
        t.victory(Y, { banishToSiteId: 'p2', burnFavor: true })
        expect(t.state.campaign).toBeUndefined()
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.player(X).siteId).toBe('p2')
        expect(t.player(X).favor).toBe(favorBefore - Math.floor(favorBefore / 2))
        // R-5.5.8 — the defender's "At end, discard" plan goes with the Campaign, from the region its holder was banished to.
        expect(t.player(X).advisers).toEqual([])
        expect(t.state.discardPileCounts[Region.Hinterland]).toBe(1)

        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        expect(t.turnPlayer).toBe(X)
        expect(t.player(X)).toMatchObject({ supply: xAfterOwnCampaign.supply, supplySpentThisTurn: xAfterOwnCampaign.supplySpentThisTurn })
        expect(t.player(Y)).toMatchObject({ supply: 0, supplySpentThisTurn: 0 })
        expect(t.offered(Y)).toEqual([])
        expect(t.offered(X)).toContain(ActionType.Travel)
        t.run({ type: ActionType.EndActPhase, playerId: X })
        expect(t.state.machineState).toBe(MachineState.RestPhase)
    })

    it('a roll out of turn can still ask (Jinx): the question holds the Sneak Attack’s own Campaign, which then goes on', () => {
        const t = new Table(board({ [Y]: { advisers: [adviser(SNEAK_ATTACK), adviser(JINX)] }, [H]: { siteId: 'c1' } }))
        // x attacks h, so the first roll is none of Jinx's holder's.
        t.campaign(X, H, [PAWN], 0).sacrifice(X)
        t.campaign(Y, X, [PAWN], 2)
        expect(t.state.machineState).toBe(MachineState.PowerQuestion)
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.RerollDice, askedPlayerId: Y, roll: { kind: 'campaign', side: 'attack' } })
        expect(t.state.pendingQuestions?.resumeMachineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.heldTurn?.resumeMachineState).toBe(MachineState.ActPhase)
        t.answer(Y, { kind: PowerQuestionKind.RerollDice, reroll: false })
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        expect(t.state.activePlayerIds).toEqual([Y])
        expect(t.state.campaign?.pendingSkullKills).toBeUndefined()
    })

    it('a defeated Sneak Attack ends at the sacrifice (R-5.5.6), and the turn resumes from there; there is one card, so its own end asks nobody', () => {
        const t = new Table(board()).xLosesToY()
        t.campaign(Y, X, [PAWN], 0)
        expect(t.state.machineState).toBe(MachineState.CampaignSacrifice)
        t.sacrifice(Y)
        expect(t.state.campaign).toBeUndefined()
        expect(t.state.heldTurn).toBeUndefined()
        expect(t.state.pendingQuestions).toBeUndefined()
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        // R-5.5.6 — half of the defeated force of four.
        expect(t.player(Y).warbandsOnBoard[Y]).toBe(2)
    })
})

describe('Sneak Attack — R-10.2-H1, the order of simultaneous triggers', () => {
    it('R-10.2-H1: clockwise from the acting player — a Herald seated before the holder gains first; seated after, it waits for the Sneak Attack and then gains for both Campaigns', () => {
        const withHerald = () => board({ [H]: { advisers: [adviser(HERALD)] } })
        const heraldFirst = new Table(withHerald(), X, [X, H, Y]).xLosesToY()
        expect(heraldFirst.state.pendingQuestions?.queue.map((q) => [q.kind, q.askedPlayerId])).toEqual([
            [PowerQuestionKind.PickFavorBank, H],
            [PowerQuestionKind.SneakAttack, Y]
        ])

        const holderFirst = new Table(withHerald(), X, [X, Y, H]).xLosesToY()
        expect(holderFirst.state.pendingQuestions?.queue.map((q) => [q.kind, q.askedPlayerId])).toEqual([
            [PowerQuestionKind.SneakAttack, Y],
            [PowerQuestionKind.PickFavorBank, H]
        ])
        holderFirst.campaign(Y, X, [PAWN], 0)
        expect(holderFirst.state.heldTurn?.queue).toMatchObject([{ kind: PowerQuestionKind.PickFavorBank, askedPlayerId: H }])
        holderFirst.sacrifice(Y)
        expect(holderFirst.state.machineState).toBe(MachineState.PowerQuestion)
        expect(holderFirst.state.pendingQuestions?.queue.map((q) => [q.kind, q.askedPlayerId])).toEqual([
            [PowerQuestionKind.PickFavorBank, H],
            [PowerQuestionKind.PickFavorBank, H]
        ])
        holderFirst.answer(H, { kind: PowerQuestionKind.PickFavorBank, suit: Suit.Hearth })
        holderFirst.answer(H, { kind: PowerQuestionKind.PickFavorBank, suit: Suit.Hearth })
        expect(holderFirst.player(H).favor).toBe(2)
        expect(holderFirst.state.machineState).toBe(MachineState.ActPhase)
        expect(holderFirst.state.activePlayerIds).toEqual([X])
    })

    /** Searches seeds for x beating the bandits at c1, so x then rules the holder's site. */
    function xWinsWithSecondWind(): Table {
        for (let seed = 1; seed < 500; seed++) {
            const t = new Table(board({ [X]: { advisers: [adviser(SECOND_WIND)], supply: 3 } }, { prng: { seed, invocations: 0 } }))
            t.campaign(X, undefined, [siteTarget('c1')], 6, [SECOND_WIND])
            const rolled = t.state.campaign
            if (!rolled || rolled.swords <= rolled.defense) continue
            t.sacrifice(X)
            return t.victory(X, { placements: [{ siteId: 'c1', owner: X, count: 1 }] })
        }
        throw Error('no seed found where the attack wins outright')
    }

    it('Sneak Attack resolves before Second Wind (its Q&A): the holder is asked at once, and the free Travel and Campaign wait for it', () => {
        const t = xWinsWithSecondWind()
        expect(t.state.machineState).toBe(MachineState.PowerQuestion)
        expect(t.state.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y, defenderPlayerId: X }])

        t.answer(Y, pass)
        expect(t.state.machineState).toBe(MachineState.ActPhase)
        expect(t.state.activePlayerIds).toEqual([X])
        const supply = t.player(X).supply
        t.run({ type: ActionType.Travel, playerId: X, siteId: 'c2' })
        expect(t.player(X)).toMatchObject({ siteId: 'c2', supply })
        t.campaign(X, undefined, [siteTarget('c2')], 0)
        expect(t.player(X).supply).toBe(supply)
        t.sacrifice(X)
        expect(t.question).toMatchObject({ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y, defenderPlayerId: X })
    })

    it('R-10.2 — once the Sneak Attack is passed, only the free Travel or Campaign, giving it up, or ending the phase is offered', () => {
        const t = xWinsWithSecondWind()
        t.answer(Y, pass)
        expect(t.offered(X)).toEqual([ActionType.Travel, ActionType.Campaign, ActionType.ForgoFreeAction, ActionType.EndActPhase])
        const search = new HydratedSearch(buildAction(Search, { playerId: X, drawFrom: SearchSource.WorldDeck }))
        expect(new ActPhaseStateHandler().isValidAction(search, machineContext(new HydratedOathGameState(t.state)))).toBe(false)

        t.run({ type: ActionType.ForgoFreeAction, playerId: X })
        expect(t.processed.find(isForgoFreeAction)?.metadata).toEqual({ forgone: ActionType.Travel })
        expect(t.offered(X)).toEqual([ActionType.Campaign, ActionType.ForgoFreeAction, ActionType.EndActPhase])

        t.run({ type: ActionType.ForgoFreeAction, playerId: X })
        expect(t.processed.find(isForgoFreeAction)?.metadata).toEqual({ forgone: ActionType.Campaign })
        expect(t.offered(X)).toContain(ActionType.Recover)
        expect(t.offered(X)).not.toContain(ActionType.ForgoFreeAction)
    })
})

describe('Sneak Attack — powers that speak of the attacker’s own turn', () => {
    function wonOutOfTurn(campaign: Record<string, unknown> = {}) {
        const s = board()
        s.heldTurn = { queue: [], askingPlayerId: X, resumeMachineState: MachineState.ActPhase }
        s.campaign = { attackerPlayerId: Y, defenderPlayerId: X, nonImperialPlayerIds: [], allyPlayerIds: [], targets: [PAWN], attackPool: 0, defensePool: 0, attackRoll: [], defenseRoll: [], defense: 0, swords: 3, defendingForce: [], defendingBandits: 0, ...campaignRecords(), attackerVictorious: true, ...campaign }
        return s
    }
    const resolve = (s: Board) => {
        const action = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: Y, placements: [], burnFavor: false }))
        action.apply(s)
        return action
    }

    it('who is acting is the Campaign’s to say: a detour that hands the clock back to the turn player (R-2.11.b, a question) is put right as each step is re-entered', () => {
        for (const handler of [new CampaignSacrificeStateHandler(), new CampaignVictoryStateHandler()]) {
            const s = wonOutOfTurn()
            s.activePlayerIds = [X]
            handler.enter(machineContext(s))
            expect(s.activePlayerIds).toEqual([Y])
        }
        const plans = wonOutOfTurn({ attackerVictorious: undefined, pendingDefenderPlans: { queue: [X] } })
        plans.activePlayerIds = [Y]
        new CampaignPlansStateHandler().enter(machineContext(plans))
        expect(plans.activePlayerIds).toEqual([X])
    })

    it('"end your Act Phase" (Martial Culture) ends nothing out of turn: the turn resumes where it was held', () => {
        const action = resolve(wonOutOfTurn({ endsActPhaseAfter: true }))
        expect(action.metadata).toMatchObject({ resumeMachineState: MachineState.ActPhase })
        expect(action.metadata?.endsActPhase).toBeUndefined()
        const own = wonOutOfTurn({ endsActPhaseAfter: true, attackerPlayerId: X, defenderPlayerId: Y })
        own.heldTurn = undefined
        const inTurn = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: X, placements: [], burnFavor: false }))
        inTurn.apply(own)
        expect(inTurn.metadata?.endsActPhase).toBe(true)
        expect(inTurn.metadata?.resumeMachineState).toBeUndefined()
    })

    it('the holder is asked at once, whether the attacker\'s Act Phase ends with the Campaign or a free action is still to come', () => {
        const s = wonOutOfTurn({ endsActPhaseAfter: true, attackerPlayerId: X, defenderPlayerId: Y })
        s.heldTurn = undefined
        Object.assign(s.getPlayerState(X), { freeTravelAtAction: s.actionCount, freeCampaignAtAction: s.actionCount })
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: X, placements: [], burnFavor: false })).apply(s)
        expect(s.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y }])
        const goesOn = wonOutOfTurn({ attackerPlayerId: X, defenderPlayerId: Y })
        goesOn.heldTurn = undefined
        Object.assign(goesOn.getPlayerState(X), { freeTravelAtAction: goesOn.actionCount, freeCampaignAtAction: goesOn.actionCount })
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: X, placements: [], burnFavor: false })).apply(goesOn)
        expect(goesOn.pendingQuestions?.queue).toMatchObject([{ kind: PowerQuestionKind.SneakAttack, askedPlayerId: Y }])
    })

    it('before revision 7 (R-X.4), a free action granted out of turn is forfeit: its player has no Act Phase to use it in', () => {
        const s = wonOutOfTurn()
        s.oathRevision = OathRevision.UiBatch1
        Object.assign(s.getPlayerState(Y), { freeTravelAtAction: s.actionCount + 1, freeCampaignAtAction: s.actionCount + 1 })
        resolve(s)
        expect(s.getPlayerState(Y).freeTravelAtAction).toBeUndefined()
        expect(s.getPlayerState(Y).freeCampaignAtAction).toBeUndefined()
    })
    it('from revision 7 it is kept: its player is asked "Travel now?" at once, and the turn stays held until the chain is over', () => {
        const s = wonOutOfTurn()
        s.oathRevision = OathRevision.EngineFixes3
        const next = s.actionCount + 1
        Object.assign(s.getPlayerState(Y), { freeTravelAtAction: next, freeCampaignAtAction: next })
        const action = resolve(s)
        expect(action.metadata?.resumeMachineState).toBe(MachineState.ActPhase)
        expect(s.heldTurn).toEqual({ queue: [], askingPlayerId: X, resumeMachineState: MachineState.ActPhase })
        expect(s.pendingQuestions?.queue).toEqual([{ kind: PowerQuestionKind.FreeActionOutOfTurn, cardId: SECOND_WIND, askedPlayerId: Y, action: ActionType.Travel }])
        expect(s.getPlayerState(Y)).toMatchObject({ freeTravelAtAction: next, freeCampaignAtAction: next })
    })
})
