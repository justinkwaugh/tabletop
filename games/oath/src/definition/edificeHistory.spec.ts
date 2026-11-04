import { describe, expect, it } from 'vitest'
import { Visibility, assert, type GameAction } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { testGame } from '../testing/game.js'
import { DANA, GREAT_SPIRE, RHYS, edificeTable, fillDispossessed } from '../testing/edifices.js'
import { OathRuntime, OathVisibility } from './runtime.js'
import {
    HydratedOathGameState,
    OathGameStateValidator,
    type OathGameState,
    type OathProjectedState
} from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { Search, SearchSource } from '../actions/search.js'
import { SearchSwap } from '../actions/searchSwap.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { UseActionPower } from '../actions/useActionPower.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import '../powers/index.js'

// R-9.4 — what each seat is sent, action by action, rebuilds the state it is shown, around the Spires.
const game = { ...testGame([DANA, RHYS]), protectedInformation: true as const }
const HARP = 'relic.truthful-harp'
const DECK = [
    'denizen.nomad.tents',
    'denizen.beast.rangers',
    'denizen.nomad.elders',
    'denizen.order.wrestlers',
    'denizen.arcane.augury'
]
const DISPOSSESSED = ['denizen.discord.naysayers', 'denizen.hearth.ballot-box']

function canonical(state: unknown): OathGameState {
    assert(OathGameStateValidator.Check(state), 'Expected complete canonical state')
    return state
}

function project(state: OathGameState, perspective: Visibility.Perspective): OathProjectedState {
    return OathVisibility.state.project(state, perspective)
}

const PERSPECTIVES: Visibility.Perspective[] = [
    { kind: 'player', playerId: DANA },
    { kind: 'player', playerId: RHYS },
    { kind: 'spectator' }
]

/** Runs `steps` from `start` and checks every seat's history replays and undoes to its own views. */
function replaysOnEveryView(start: OathGameState, steps: ((s: OathGameState) => GameAction)[]) {
    const actions: GameAction[] = []
    let state = start
    for (const step of steps) {
        const action = step(state)
        const result = engine.executeCanonicalAction({
            action: { ...action, id: `e-${state.actionCount}`, index: state.actionCount },
            state,
            game
        })
        actions.push(...result.processedActions)
        state = canonical(result.updatedState)
    }
    for (const perspective of PERSPECTIVES) {
        const history = Visibility.projectActionHistory({
            game,
            currentState: state,
            startIndex: start.actionCount,
            actions,
            visibility: OathVisibility,
            perspective,
            replay: { game, runtime: OathRuntime }
        })
        let view = project(start, perspective)
        for (const action of history.actions)
            view = engine.applyProcessedAction({ game, state: view, action })
        expect(view).toEqual(project(state, perspective))
        for (const action of history.actions.toReversed())
            view = engine.undoProcessedAction({ state: view, action })
        expect(view).toEqual(project(start, perspective))
    }
    return { state, actions }
}

function spireStart(ruined: boolean, harp = false): OathGameState {
    const s = edificeTable(
        harp ? { [DANA]: { relicIds: [HARP] } } : {},
        {},
        { plains: GREAT_SPIRE, ruined }
    )
    s.requireVault().worldDeck = [...DECK]
    fillDispossessed(s, DISPOSSESSED)
    s.requireVault().discardPiles[Region.Cradle] = ['vision.faith', ...DECK.slice(0, 3)]
    s.discardPileCounts[Region.Cradle] = 4
    return canonical(s.dehydrate())
}

function handOf(state: OathGameState): string[] {
    return new HydratedOathGameState(state).getPlayerState(DANA).knownHand()
}

describe('projected history around Great Spire’s swap and Fallen Spire', () => {
    for (const harp of [false, true]) {
        it(`a Search swapping one drawn card${harp ? ', with Truthful Harp,' : ''} replays to each seat’s view and undoes back`, () => {
            const { actions, state } = replaysOnEveryView(spireStart(false, harp), [
                () =>
                    buildAction(Search, {
                        playerId: DANA,
                        drawFrom: SearchSource.WorldDeck,
                        revealsInfo: true,
                        modifiers: [
                            { cardId: GREAT_SPIRE, powerIndex: 0 },
                            ...(harp ? [{ cardId: HARP, powerIndex: 0 }] : [])
                        ]
                    }),
                () =>
                    buildAction(SearchSwap, {
                        playerId: DANA,
                        revealsInfo: true,
                        swappedCardIds: ['denizen.beast.rangers']
                    }),
                (s) => {
                    const hand = handOf(s)
                    return buildAction(SearchResolve, {
                        playerId: DANA,
                        keptCardId: hand[1],
                        discardOrder: hand.filter((_, i) => i !== 1),
                        play: SearchPlay.Discard
                    })
                }
            ])
            expect(actions.map((a) => a.type)).toEqual(
                expect.arrayContaining(['search', 'searchSwap', 'searchResolve'])
            )
            // Nobody but the searcher learns a card that came in, unless it is the kept card shown.
            const swapAction = actions.find((a) => a.type === 'searchSwap')
            assert(swapAction !== undefined, 'the swap ran')
            for (const perspective of PERSPECTIVES.slice(1)) {
                const seen = JSON.stringify(OathVisibility.actions.project(swapAction, perspective))
                for (const cardId of DISPOSSESSED) expect(seen).not.toContain(cardId)
            }
            expect(state.machineState).not.toBe('Searching')
        })
    }

    it('Fallen Spire replays to each seat’s view and undoes back, naming no card', () => {
        const { actions } = replaysOnEveryView(spireStart(true), [
            () =>
                buildAction(UseActionPower, {
                    playerId: DANA,
                    cardId: GREAT_SPIRE,
                    powerIndex: 1,
                    choices: [{ kind: PowerChoiceKind.Count, n: 2 }]
                })
        ])
        for (const perspective of PERSPECTIVES) {
            const seen = JSON.stringify(
                actions.map((a) => OathVisibility.actions.project(a, perspective))
            )
            for (const cardId of [...DISPOSSESSED, ...DECK.slice(0, 3)])
                expect(seen).not.toContain(cardId)
        }
    })
})
