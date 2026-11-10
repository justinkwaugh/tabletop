import { assert, type Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isLayAway } from '../actions/layAway.js'
import { Suit } from '../components/cards.js'
import { Contract } from '../components/contracts.js'
import {
    KoenigrufenGameStateValidator,
    type KoenigrufenProjectedState
} from '../model/gameState.js'
import {
    declareByMeinSpiel,
    legalLayAway,
    startTestGame,
    type TestSession
} from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { KoenigrufenRuntime } from './runtime.js'

function perspectives(state: KoenigrufenProjectedState): Visibility.Perspective[] {
    return [
        { kind: 'spectator' },
        ...state.turnManager.turnOrder.map((playerId) => ({ kind: 'player', playerId }) as const)
    ]
}

function project(session: TestSession, perspective: Visibility.Perspective) {
    const state = session.state
    assert(KoenigrufenGameStateValidator.Check(state), 'The test game is canonical')
    return KoenigrufenRuntime.visibility.state.project(state, perspective, {
        config: session.game.config
    })
}

function isOwn(perspective: Visibility.Perspective, playerId: string) {
    return perspective.kind === 'player' && perspective.playerId === playerId
}

describe('what each Perspective sees', () => {
    it('shows each player only their own hand, and nobody the talon', () => {
        const session = startTestGame()
        for (const perspective of perspectives(session.state)) {
            const view = project(session, perspective)
            for (const player of view.players) {
                expect(player.hand !== undefined).toBe(isOwn(perspective, player.playerId))
                expect(player.handCount).toBe(12)
            }
            expect(view.talon).toBeUndefined()
            expect(() => KoenigrufenRuntime.hydrator.hydrateState(view)).not.toThrow()
        }
    })

    it('shows everyone the exposed talon halves', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Rufer)
        session.act(declarer, ActionType.CallKing, { king: Suit.Hearts })
        for (const perspective of perspectives(session.state)) {
            expect(project(session, perspective).talonHalves).toEqual(session.state.talonHalves)
        }
    })

    it('shows laid-away cards only to declarer, apart from trumps laid face up', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Rufer)
        session.act(declarer, ActionType.CallKing, { king: Suit.Hearts })
        session.act(declarer, ActionType.ChooseTalonHalf, { half: 0 })
        const cardIds = legalLayAway(session.hand(declarer), 3)
        const [action] = session.act(declarer, ActionType.LayAway, { cardIds })
        assert(isLayAway(action), 'The declarer laid away')
        for (const perspective of perspectives(session.state)) {
            const own = isOwn(perspective, declarer)
            const view = project(session, perspective)
            const declarerView = view.players.find((player) => player.playerId === declarer)
            expect(declarerView?.discards !== undefined).toBe(own)
            expect(declarerView?.discardCount).toBe(3)
            const seen = KoenigrufenRuntime.visibility.actions.project(action, perspective, {
                config: session.game.config
            })
            expect('cardIds' in seen && seen.cardIds !== undefined).toBe(own)
            expect(seen).toMatchObject({ metadata: { shown: action.metadata?.shown } })
        }
    })

    it('keeps a Solorufer’s talon hidden through play', () => {
        const session = startTestGame()
        const declarer = session.activePlayerId()
        session.act(declarer, ActionType.Bid, { contract: Contract.Solorufer })
        for (let passes = 0; passes < 3; passes++) {
            session.act(session.activePlayerId(), ActionType.Pass)
        }
        session.act(declarer, ActionType.CallKing, { king: Suit.Spades })
        for (const perspective of perspectives(session.state)) {
            const view = project(session, perspective)
            expect(view.talon).toBeUndefined()
            expect(view.talonHalves).toBeUndefined()
        }
    })
})
