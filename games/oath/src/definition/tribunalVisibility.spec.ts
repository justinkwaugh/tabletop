import { describe, expect, it } from 'vitest'
import { GameStatus, Visibility, assert, getPrng, type GameAction } from '@tabletop/common'
import { buildAction } from '../testing/actions.js'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { required } from '../testing/required.js'
import { rulerTable } from '../testing/tables.js'
import { OathRuntime, OathVisibility } from './runtime.js'
import { HydratedOathGameState, OathGameStateValidator, type OathGameState, type OathProjectedState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { PowerQuestionKind, type ExchangeTerms } from '../model/question.js'
import { TRIBUNAL_ID } from '../data/cardPowers.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { AnswerQuestion } from '../actions/answerQuestion.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { openDealFrom, reasonExchangeInvalid } from '../util/exchange.js'
import { OathRevision } from '../util/revision.js'
import '../powers/index.js'

const spectator = { kind: 'spectator' } as const

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

// R-7.6.3-H1 — a Tribunal offer's promises are its two players' until the deal is accepted; then they are public.
describe('R-7.6.3-H1 — the Tribunal’s promises on each seat’s view', () => {
    const PROPOSER = 'ruler'
    const ASKED = 'other'
    const THIRD = 'away'
    const PROMISE = 'I will not campaign against you next round.'
    const REPLY = 'Nor I against you.'
    const proposer = { kind: 'player', playerId: PROPOSER } as const
    const asked = { kind: 'player', playerId: ASKED } as const
    const third = { kind: 'player', playerId: THIRD } as const
    const PARTIES: Visibility.Perspective[] = [proposer, asked]
    const OTHERS: Visibility.Perspective[] = [third, spectator]
    const WITH_FAVOR: ExchangeTerms = { fromProposer: { favor: 1 }, promises: { fromProposer: PROMISE, fromCounterparty: REPLY } }
    const PROMISES_ONLY: ExchangeTerms = { promises: { fromProposer: PROMISE } }
    const game = testGame([PROPOSER, ASKED, THIRD], { status: GameStatus.Started, protectedInformation: true })

    function offer(terms: ExchangeTerms = WITH_FAVOR) {
        const sites = { c1: TRIBUNAL_ID, c2: 'site.river', p1: 'site.plains', h1: 'site.wastes' }
        let state = canonical(
            rulerTable([], [], { [THIRD]: { status: PlayerStatus.Chancellor } }, { oathRevision: OathRevision.EngineFixes24, siteCards: sites, chancellorPlayerId: THIRD }).dehydrate()
        )
        const start = state
        const actions: GameAction[] = []
        const run = (action: GameAction) => {
            const result = engine.executeCanonicalAction({ action: { ...action, id: `t-${state.actionCount}`, index: state.actionCount }, state, game })
            actions.push(...result.processedActions)
            state = canonical(result.updatedState)
            return result.processedActions[0]
        }
        const proposal = run(
            buildAction(UseActionPower, {
                playerId: PROPOSER,
                cardId: TRIBUNAL_ID,
                powerIndex: 0,
                choices: [{ kind: PowerChoiceKind.Exchange, withPlayerId: ASKED, terms }]
            })
        )
        return { start, proposal, actions, run, state: () => state }
    }

    const answer = (accept: boolean) => buildAction(AnswerQuestion, { playerId: ASKED, answer: { kind: PowerQuestionKind.Exchange, accept } })
    const project = (state: OathGameState, perspective: Visibility.Perspective): OathProjectedState => OathVisibility.state.project(state, perspective)

    function offerOn(state: OathProjectedState, where: 'pendingQuestions' | 'heldTurn') {
        const question = required(state[where]?.queue[0], `an offer waits under ${where}`)
        assert(question.kind === PowerQuestionKind.Exchange, 'the offer is an exchange question')
        return question
    }

    it.each(['pendingQuestions', 'heldTurn'] as const)('a pending offer under %s shows its promises to its two players only', (where) => {
        let state = offer().state()
        if (where === 'heldTurn') state = canonical({ ...state, heldTurn: state.pendingQuestions, pendingQuestions: undefined })
        for (const perspective of [...PARTIES, ...OTHERS]) {
            expect(() => OathRuntime.hydrator.hydrateState(project(state, perspective))).not.toThrow()
        }
        for (const perspective of PARTIES) {
            expect(offerOn(project(state, perspective), where).terms.promises).toEqual({ fromProposer: PROMISE, fromCounterparty: REPLY })
        }
        for (const perspective of OTHERS) {
            const view = project(state, perspective)
            const question = offerOn(view, where)
            expect(question.terms.promises).toEqual({})
            expect(question).toMatchObject({ proposerPlayerId: PROPOSER, askedPlayerId: ASKED, terms: { fromProposer: { favor: 1 } } })
            expect(JSON.stringify(view)).not.toContain(PROMISE)
            expect(JSON.stringify(view)).not.toContain(REPLY)
        }
    })

    it('the proposal’s record shows the promises to its two players only, and a refusal quotes none', () => {
        const walk = offer()
        for (const perspective of PARTIES) {
            expect(JSON.stringify(OathVisibility.actions.project(walk.proposal, perspective))).toContain(PROMISE)
        }
        for (const perspective of OTHERS) {
            const record = JSON.stringify(OathVisibility.actions.project(walk.proposal, perspective))
            expect(record).not.toContain(PROMISE)
            expect(record).not.toContain(REPLY)
            expect(record).toContain('"promises":{}')
            expect(record).toContain(`"withPlayerId":"${ASKED}"`)
        }
        const refused = walk.run(answer(false))
        for (const perspective of [...PARTIES, ...OTHERS]) {
            expect(JSON.stringify(OathVisibility.actions.project(refused, perspective))).not.toContain(PROMISE)
        }
    })

    it('an accepted deal is public in state and on the accepting answer’s record', () => {
        const walk = offer()
        const accepted = walk.run(answer(true))
        for (const perspective of [...PARTIES, ...OTHERS]) {
            const deals = project(walk.state(), perspective).openDeals
            expect(deals).toEqual([expect.objectContaining({ proposerPlayerId: PROPOSER, counterpartyPlayerId: ASKED, proposerPromise: PROMISE, counterpartyPromise: REPLY })])
            expect(OathVisibility.actions.project(accepted, perspective)).toHaveProperty('metadata.openedDeal.proposerPromise', PROMISE)
        }
    })

    it.each([true, false])('accepted %s: every seat replays the History to its own view, and only an accepted deal makes the promises public', (accept) => {
        const walk = offer()
        const reply = walk.run(answer(accept))
        expect(reply.revealsInfo).toBe(accept)
        const end = walk.state()
        expect(end.openDeals?.length ?? 0).toBe(accept ? 1 : 0)
        for (const perspective of [...PARTIES, ...OTHERS]) {
            const history = Visibility.projectActionHistory({
                game,
                currentState: end,
                startIndex: walk.start.actionCount,
                actions: walk.actions,
                visibility: OathVisibility,
                perspective,
                replay: { game, runtime: OathRuntime }
            })
            let view = project(walk.start, perspective)
            for (const action of history.actions) view = engine.applyProcessedAction({ game, state: view, action })
            expect(view).toEqual(project(end, perspective))
            for (const action of history.actions.toReversed()) view = engine.undoProcessedAction({ state: view, action })
            expect(view).toEqual(project(walk.start, perspective))
            expect(JSON.stringify(history.actions).includes(PROMISE)).toBe(accept || PARTIES.includes(perspective))
        }
    })

    it('the asked player’s own view checks the offer without reading the promises, and the accept defers to the host', () => {
        const state = offer().state()
        const view = OathVisibility.state.guardForExecution(new HydratedOathGameState(state), asked, { config: game.config })
        const question = offerOn(view, 'pendingQuestions')
        expect(reasonExchangeInvalid(view, PROPOSER, ASKED, question.terms)).toBeUndefined()
        let thrown: unknown
        try {
            openDealFrom(view, PROPOSER, ASKED, question.terms)
        } catch (error) {
            thrown = error
        }
        assert(Visibility.isUnavailableProjectedValueError(thrown), 'the promise is withheld from guarded execution')
        expect(thrown.path).toEqual(expect.arrayContaining(['pendingQuestions', 'terms', 'promises']))
        expect(() => engine.executeAction({ action: { ...answer(true), id: 'g-1', index: state.actionCount }, state, game, perspective: asked })).toThrow(
            Visibility.UnavailableProjectedValueError
        )
    })

    it('a third seat exploring accepts a promises-only offer whose words it never saw, opening the deal without them', () => {
        const source = offer(PROMISES_ONLY).state()
        const exploration = required(OathRuntime.exploration, 'Oath declares exploration')
        assert(exploration.createFromProjectedState !== undefined, 'Oath populates projected state')
        const branch = canonical(exploration.createFromProjectedState({ game, state: project(source, third), actions: [], perspective: third, random: getPrng(1) }))
        const result = engine.executeCanonicalAction({ action: { ...answer(true), id: 'x-1', index: branch.actionCount }, state: branch, game })
        const deals = canonical(result.updatedState).openDeals ?? []
        expect(deals).toHaveLength(1)
        expect(deals[0]).toMatchObject({ proposerPlayerId: PROPOSER, counterpartyPlayerId: ASKED })
        expect(deals[0]).not.toHaveProperty('proposerPromise')
    })
})
