import { ActionSource } from '../engine/gameAction.js'
import { GameEngine } from '../engine/gameEngine.js'
import * as Visibility from './index.js'
import {
    ActionType,
    createPrivateDealScenario,
    PlayerIds
} from './privateDealScenario.testSupport.js'
import { describe, expect, it } from 'vitest'

const expectedCardsByPlayer = {
    'player-1': ['player-1-card-a', 'player-1-card-b'],
    'player-2': ['player-2-card-a', 'player-2-card-b'],
    'player-3': ['player-3-card-a', 'player-3-card-b'],
    'player-4': ['player-4-card-a', 'player-4-card-b']
}

const perspectives: Visibility.Perspective[] = [
    ...PlayerIds.map((playerId) => ({ kind: 'player' as const, playerId })),
    { kind: 'spectator' }
]

function visibleCardsFor(
    perspective: Visibility.Perspective,
    playerId: (typeof PlayerIds)[number]
): string[] {
    return perspective.kind === 'player' && perspective.playerId === playerId
        ? expectedCardsByPlayer[playerId]
        : []
}

describe('I3 / S2: a public Action triggers a private multi-Player deal', () => {
    it('projects and round-trips one system deal to four private hands for every perspective', () => {
        const scenario = createPrivateDealScenario()
        const engine = new GameEngine(scenario.runtime)
        const canonicalResult = engine.executeAction({
            action: scenario.startRound,
            state: scenario.before,
            game: scenario.game
        })

        expect(
            canonicalResult.processedActions.map(({ type, source, index }) => ({
                type,
                source,
                index
            }))
        ).toEqual([
            { type: ActionType.StartRound, source: ActionSource.User, index: 0 },
            { type: ActionType.DealCards, source: ActionSource.System, index: 1 }
        ])

        for (const perspective of perspectives) {
            const visibleBefore = scenario.runtime.visibility.state.project(
                scenario.before,
                perspective
            )
            const visibleResult = Visibility.projectActionResult({
                result: canonicalResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const expectedOwnedCards = PlayerIds.map((playerId) => ({
                playerId,
                cards: visibleCardsFor(perspective, playerId),
                cardCount: 2
            }))

            expect(visibleResult.updatedState).toMatchObject({
                phase: 'playing',
                deck: { items: [], remaining: 1 },
                hands: expectedOwnedCards,
                actionCount: 2
            })
            expect(visibleResult.processedActions).toHaveLength(2)
            expect(visibleResult.processedActions[1]).toMatchObject({
                type: ActionType.DealCards,
                source: ActionSource.System,
                index: 1,
                deals: expectedOwnedCards
            })
            expect(visibleResult.processedActions.map(({ id, index }) => ({ id, index }))).toEqual(
                canonicalResult.processedActions.map(({ id, index }) => ({ id, index }))
            )
            expect(
                visibleResult.processedActions.every(
                    (action) => action.forwardPatch !== undefined && action.undoPatch !== undefined
                )
            ).toBe(true)

            let advancedState = visibleBefore
            for (const action of visibleResult.processedActions) {
                advancedState = engine.applyProcessedAction({
                    action,
                    state: advancedState,
                    game: scenario.game
                })
            }
            expect(advancedState).toEqual(visibleResult.updatedState)

            let restoredState = advancedState
            for (const action of visibleResult.processedActions.toReversed()) {
                restoredState = engine.undoProcessedAction({ action, state: restoredState })
            }
            expect(restoredState).toEqual(visibleBefore)

            expect(
                Visibility.projectActionHistory({
                    currentState: canonicalResult.updatedState,
                    actions: canonicalResult.processedActions,
                    visibility: scenario.runtime.visibility,
                    perspective,
                    replay: { game: scenario.game, runtime: scenario.runtime }
                })
            ).toEqual({
                startIndex: 0,
                currentState: visibleResult.updatedState,
                actions: visibleResult.processedActions
            })

            const serializedProjection = JSON.stringify(visibleResult)
            for (const [playerId, cards] of Object.entries(expectedCardsByPlayer)) {
                if (perspective.kind === 'player' && perspective.playerId === playerId) {
                    continue
                }
                for (const card of cards) {
                    expect(serializedProjection).not.toContain(card)
                }
            }
            expect(serializedProjection).not.toContain('undealt-stock-card')
            expect(serializedProjection).not.toContain('host-only-deal-note')
        }
    })
})
