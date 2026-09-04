import { ActionSource } from '../engine/gameAction.js'
import { GameEngine } from '../engine/gameEngine.js'
import * as Visibility from './index.js'
import {
    ActionType,
    createPrivateDealScenario,
    createPrivateObservationScenario,
    PlayerIds
} from './hiddenCardScenarios.testSupport.js'
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

describe('I8 / K1: observed Card knowledge survives a later move', () => {
    it('reprojects the observed Card in its new private zone only for entitled Players', () => {
        const scenario = createPrivateObservationScenario()
        const engine = new GameEngine(scenario.runtime)
        const peekResult = engine.executeAction({
            action: scenario.peekTopCard,
            state: scenario.before,
            game: scenario.game
        })
        const drawResult = engine.executeAction({
            action: scenario.drawTopCard,
            state: peekResult.updatedState,
            game: scenario.game
        })
        const canonicalActions = [...peekResult.processedActions, ...drawResult.processedActions]

        expect(
            canonicalActions.map(({ type, source, index }) => ({ type, source, index }))
        ).toEqual([
            { type: ActionType.PeekTopCard, source: ActionSource.User, index: 0 },
            { type: ActionType.DrawTopCard, source: ActionSource.User, index: 1 }
        ])

        for (const perspective of perspectives) {
            const visibleBefore = scenario.runtime.visibility.state.project(
                scenario.before,
                perspective
            )
            const visiblePeek = Visibility.projectActionResult({
                result: peekResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const visibleDraw = Visibility.projectActionResult({
                result: drawResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const seesObservedCardAfterPeek =
                perspective.kind === 'player' && perspective.playerId === PlayerIds[0]
            const seesObservedCardAfterDraw =
                perspective.kind === 'player' &&
                (perspective.playerId === PlayerIds[0] || perspective.playerId === PlayerIds[1])
            const emptyHands = PlayerIds.map((playerId) => ({
                playerId,
                cards: [],
                cardCount: 0
            }))
            const handsAfterDraw = PlayerIds.map((playerId) => ({
                playerId,
                cards:
                    playerId === PlayerIds[1] && seesObservedCardAfterDraw ? ['observed-card'] : [],
                cardCount: playerId === PlayerIds[1] ? 1 : 0
            }))

            expect(visiblePeek.updatedState).toMatchObject({
                deck: {
                    items: seesObservedCardAfterPeek ? ['observed-card'] : [],
                    remaining: 2
                },
                hands: emptyHands,
                knowledge: [],
                actionCount: 1
            })
            expect(visibleDraw.updatedState).toMatchObject({
                deck: { items: [], remaining: 1 },
                hands: handsAfterDraw,
                knowledge: [],
                actionCount: 2
            })

            const visiblePeekAction = visiblePeek.processedActions[0]
            const visibleDrawAction = visibleDraw.processedActions[0]
            if (visiblePeekAction === undefined || visibleDrawAction === undefined) {
                throw Error('Expected both observed-card Actions')
            }
            if (seesObservedCardAfterPeek) {
                expect(visiblePeekAction).toMatchObject({ observedCard: 'observed-card' })
            } else {
                expect(visiblePeekAction).not.toHaveProperty('observedCard')
            }
            if (perspective.kind === 'player' && perspective.playerId === PlayerIds[1]) {
                expect(visibleDrawAction).toMatchObject({ drawnCard: 'observed-card' })
            } else {
                expect(visibleDrawAction).not.toHaveProperty('drawnCard')
            }
            if (!seesObservedCardAfterPeek) {
                expect(JSON.stringify(visiblePeek)).not.toContain('observed-card')
            }
            if (!seesObservedCardAfterDraw) {
                expect(JSON.stringify(visibleDraw)).not.toContain('observed-card')
            }

            const visibleActions = [visiblePeekAction, visibleDrawAction]
            expect(visibleActions.map(({ id, index }) => ({ id, index }))).toEqual(
                canonicalActions.map(({ id, index }) => ({ id, index }))
            )
            expect(
                visibleActions.every(
                    (action) => action.forwardPatch !== undefined && action.undoPatch !== undefined
                )
            ).toBe(true)

            let visibleState = visibleBefore
            visibleState = engine.applyProcessedAction({
                action: visiblePeekAction,
                state: visibleState,
                game: scenario.game
            })
            expect(visibleState).toEqual(visiblePeek.updatedState)
            visibleState = engine.applyProcessedAction({
                action: visibleDrawAction,
                state: visibleState,
                game: scenario.game
            })
            expect(visibleState).toEqual(visibleDraw.updatedState)

            visibleState = engine.undoProcessedAction({
                action: visibleDrawAction,
                state: visibleState
            })
            expect(visibleState).toEqual(visiblePeek.updatedState)
            visibleState = engine.undoProcessedAction({
                action: visiblePeekAction,
                state: visibleState
            })
            expect(visibleState).toEqual(visibleBefore)

            for (const action of visibleActions) {
                visibleState = engine.applyProcessedAction({
                    action,
                    state: visibleState,
                    game: scenario.game
                })
            }
            expect(visibleState).toEqual(visibleDraw.updatedState)

            expect(
                Visibility.projectActionHistory({
                    currentState: drawResult.updatedState,
                    actions: canonicalActions,
                    visibility: scenario.runtime.visibility,
                    perspective,
                    replay: { game: scenario.game, runtime: scenario.runtime }
                })
            ).toEqual({
                startIndex: 0,
                currentState: visibleDraw.updatedState,
                actions: visibleActions
            })

            expect(JSON.stringify([visiblePeek, visibleDraw])).not.toContain('unknown-stock-card')
        }
    })
})
