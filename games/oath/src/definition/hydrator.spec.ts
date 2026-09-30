import { describe, expect, it } from 'vitest'
import { assert, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { testGame } from '../testing/game.js'
import { OathRuntime } from './runtime.js'
import { OathGameStateValidator, HydratedOathGameState, type OathGameState, type OathProjectedState } from '../model/gameState.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { Search, SearchSource } from '../actions/search.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'

const MASTER_SEED = '0123456789abcdef0123456789abcdef'
const PLAYERS = ['p1', 'p2', 'p3']
const perspectives = [...PLAYERS.map((playerId) => ({ kind: 'player', playerId }) as const), { kind: 'spectator' } as const]

function canonical(state: OathProjectedState): OathGameState {
    assert(OathGameStateValidator.Check(state), 'the engine holds canonical state')
    return state
}

function walk(): OathGameState[] {
    const game = testGame(PLAYERS)
    let current = engine.startGame(game, { masterSeed: MASTER_SEED }).initialState
    const states = [canonical(current)]
    const play = (action: GameAction) => {
        current = engine.runNext(action, current, game).updatedState
        states.push(canonical(current))
    }
    for (const playerId of current.turnManager.turnOrder) {
        const hydrated = new HydratedOathGameState(current)
        const hand = hydrated.getPlayerState(playerId).knownHand()
        play(buildAction(SetupChoice, { playerId, siteId: playerId === current.chancellorPlayerId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1], adviserCardId: hand[0], discardOrder: hand.slice(1) }))
    }
    const chancellor = current.chancellorPlayerId
    play(buildAction(Search, { playerId: chancellor, drawFrom: SearchSource.WorldDeck, revealsInfo: true }))
    const [kept, ...rest] = new HydratedOathGameState(current).getPlayerState(chancellor).knownHand()
    play(buildAction(SearchResolve, { playerId: chancellor, keptCardId: kept, discardOrder: rest, play: SearchPlay.Adviser, faceUp: false }))
    return states
}

describe('Oath hydration', () => {
    it('round-trips canonical state from setup through a facedown Search play', () => {
        const states = walk()
        expect(states.length).toBe(PLAYERS.length + 3)
        for (const state of states) {
            expect(OathRuntime.hydrator.hydrateState(state).dehydrate()).toEqual(state)
        }
    })

    it('round-trips every player and spectator projection of the same states', () => {
        for (const state of walk()) {
            for (const perspective of perspectives) {
                const view = OathRuntime.visibility.state.project(state, perspective)
                expect(view).not.toHaveProperty('vault')
                expect(OathRuntime.hydrator.hydrateState(view).dehydrate()).toEqual(view)
            }
        }
    })
})
