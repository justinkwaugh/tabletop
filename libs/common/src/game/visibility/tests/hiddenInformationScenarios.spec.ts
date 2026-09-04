import { ActionSource, GameAction } from '../../engine/gameAction.js'
import { GameEngine } from '../../engine/gameEngine.js'
import * as Visibility from '../index.js'
import {
    ActionType,
    createForgetKnowledgeScenario,
    createLegalChoiceScenario,
    createOpaqueDealScenario,
    createPrivateDealScenario,
    createPrivateObservationScenario,
    createPrivateTransferScenario,
    createProgressiveTeamRevealScenario,
    createSelectiveRevealScenario,
    PlayerIds
} from './hiddenCardScenarios.js'
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

describe('A4 / S4: a System Action type is hidden from every ordinary perspective', () => {
    it('replaces the complete Action with a sentinel and patches its mixed cascade', () => {
        const scenario = createOpaqueDealScenario()
        const engine = new GameEngine(scenario.runtime)
        const canonicalResult = engine.executeAction({
            action: scenario.startRound,
            state: scenario.before,
            game: scenario.game
        })

        expect(canonicalResult.processedActions.map(({ type }) => type)).toEqual([
            ActionType.StartRound,
            ActionType.DealCards
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

            expect(visibleResult.processedActions).toHaveLength(2)
            expect(visibleResult.processedActions[0]).toMatchObject({
                id: canonicalResult.processedActions[0]?.id,
                index: 0,
                type: ActionType.StartRound,
                forwardPatch: expect.any(Array),
                undoPatch: expect.any(Array)
            })
            expect(visibleResult.processedActions[1]).toMatchObject({
                id: canonicalResult.processedActions[1]?.id,
                index: 1,
                type: 'tabletop.redacted-action',
                forwardPatch: expect.any(Array),
                undoPatch: expect.any(Array)
            })
            expect(visibleResult.processedActions[1]).not.toHaveProperty('deals')
            expect(visibleResult.processedActions[1]).not.toHaveProperty('hostNote')
            expect(JSON.stringify(visibleResult.processedActions)).not.toContain(
                ActionType.DealCards
            )
            expect(JSON.stringify(visibleResult.processedActions)).not.toContain(
                'host-only-deal-note'
            )
            expect(visibleResult.processedActions.map(({ id, index }) => ({ id, index }))).toEqual(
                canonicalResult.processedActions.map(({ id, index }) => ({ id, index }))
            )

            let visibleState = visibleBefore
            for (const action of visibleResult.processedActions) {
                visibleState = engine.applyProcessedAction({
                    action,
                    state: visibleState,
                    game: scenario.game
                })
            }
            expect(visibleState).toEqual(visibleResult.updatedState)

            for (const action of visibleResult.processedActions.toReversed()) {
                visibleState = engine.undoProcessedAction({ action, state: visibleState })
            }
            expect(visibleState).toEqual(visibleBefore)

            for (const action of visibleResult.processedActions) {
                visibleState = engine.applyProcessedAction({
                    action,
                    state: visibleState,
                    game: scenario.game
                })
            }
            expect(visibleState).toEqual(visibleResult.updatedState)

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
        }
    })

    it('aborts projected optimistic execution before running the hidden System Action', () => {
        const scenario = createOpaqueDealScenario()
        const engine = new GameEngine(scenario.runtime)

        expect(() =>
            engine.executeAction({
                action: scenario.startRound,
                state: scenario.before,
                game: scenario.game,
                perspective: { kind: 'player', playerId: PlayerIds[0] }
            })
        ).toThrow(
            `Projected execution cannot expose protected Action type "${ActionType.DealCards}"`
        )
    })

    it('rejects a redacted Action record that has no forward patch', () => {
        const scenario = createOpaqueDealScenario()
        const engine = new GameEngine(scenario.runtime)
        const canonicalResult = engine.executeAction({
            action: scenario.startRound,
            state: scenario.before,
            game: scenario.game
        })
        const perspective = { kind: 'spectator' as const }
        const visibleResult = Visibility.projectActionResult({
            result: canonicalResult,
            visibility: scenario.runtime.visibility,
            perspective,
            replay: { game: scenario.game, runtime: scenario.runtime }
        })
        const redactedAction = structuredClone(visibleResult.processedActions[1])
        if (redactedAction === undefined) {
            throw Error('Expected a redacted System Action')
        }
        delete redactedAction.forwardPatch
        const visibleBefore = scenario.runtime.visibility.state.project(
            scenario.before,
            perspective
        )
        const visibleUserAction = visibleResult.processedActions[0]
        if (visibleUserAction === undefined) {
            throw Error('Expected a visible User Action')
        }
        const stateBeforeRedactedAction = engine.applyProcessedAction({
            action: visibleUserAction,
            state: visibleBefore,
            game: scenario.game
        })

        expect(() =>
            engine.applyProcessedAction({
                action: redactedAction,
                state: stateBeforeRedactedAction,
                game: scenario.game
            })
        ).toThrow('Redacted Action record requires a forward patch')
    })

    it('reserves the sentinel from game Action registries', () => {
        expect(() =>
            Visibility.createActionProjector({
                [Visibility.RedactedActionType]: GameAction
            })
        ).toThrow(
            `Game Action registry cannot use reserved type "${Visibility.RedactedActionType}"`
        )
    })

    it('rejects the sentinel as an Action submitted for rules execution', () => {
        const scenario = createOpaqueDealScenario()
        const engine = new GameEngine(scenario.runtime)
        const submittedAction = {
            ...scenario.startRound,
            type: Visibility.RedactedActionType
        }

        expect(() =>
            engine.executeAction({
                action: submittedAction,
                state: scenario.before,
                game: scenario.game
            })
        ).toThrow('Redacted Action records cannot be executed by game rules')
    })
})

describe('I4 / I10: a secret progressively reveals from its owner to a team and then publicly', () => {
    it('materializes each audience transition and reverses it for every perspective', () => {
        const scenario = createProgressiveTeamRevealScenario()
        const engine = new GameEngine(scenario.runtime)
        const teamResult = engine.executeAction({
            action: scenario.shareWithTeam,
            state: scenario.before,
            game: scenario.game
        })
        const publicResult = engine.executeAction({
            action: scenario.revealPublicly,
            state: teamResult.updatedState,
            game: scenario.game
        })
        const canonicalActions = [...teamResult.processedActions, ...publicResult.processedActions]

        expect(canonicalActions.map(({ type, index }) => ({ type, index }))).toEqual([
            { type: ActionType.AdvanceSecretAudience, index: 0 },
            { type: ActionType.AdvanceSecretAudience, index: 1 }
        ])
        expect(teamResult.updatedState).toHaveProperty('teamSecret.revealLevel', 'team')
        expect(publicResult.updatedState).toHaveProperty('teamSecret.revealLevel', 'public')

        for (const perspective of perspectives) {
            const visibleBefore = scenario.runtime.visibility.state.project(
                scenario.before,
                perspective
            )
            const visibleTeamResult = Visibility.projectActionResult({
                result: teamResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const visiblePublicResult = Visibility.projectActionResult({
                result: publicResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const isOwner = perspective.kind === 'player' && perspective.playerId === PlayerIds[0]
            const isTeammate =
                perspective.kind === 'player' && perspective.playerId === PlayerIds[1]

            expect(visibleBefore).toHaveProperty('teamSecret.revealLevel', 'owner')
            expect(visibleTeamResult.updatedState).toHaveProperty('teamSecret.revealLevel', 'team')
            expect(visiblePublicResult.updatedState).toHaveProperty(
                'teamSecret.revealLevel',
                'public'
            )
            if (isOwner) {
                expect(visibleBefore).toHaveProperty('teamSecret.value', 'shared-plan')
            } else {
                expect(visibleBefore).not.toHaveProperty('teamSecret.value')
                expect(JSON.stringify(visibleBefore)).not.toContain('shared-plan')
            }
            if (isOwner || isTeammate) {
                expect(visibleTeamResult.updatedState).toHaveProperty(
                    'teamSecret.value',
                    'shared-plan'
                )
            } else {
                expect(visibleTeamResult.updatedState).not.toHaveProperty('teamSecret.value')
                expect(JSON.stringify(visibleTeamResult)).not.toContain('shared-plan')
            }
            expect(visiblePublicResult.updatedState).toHaveProperty(
                'teamSecret.value',
                'shared-plan'
            )

            const visibleActions = [
                ...visibleTeamResult.processedActions,
                ...visiblePublicResult.processedActions
            ]
            expect(visibleActions.map(({ id, index }) => ({ id, index }))).toEqual(
                canonicalActions.map(({ id, index }) => ({ id, index }))
            )
            expect(visibleActions.every((action) => action.undoPatch !== undefined)).toBe(true)
            if (isTeammate) {
                expect(visibleActions[0]?.forwardPatch).toBeDefined()
            }
            if (!isOwner && !isTeammate) {
                expect(visibleActions[1]?.forwardPatch).toBeDefined()
            }

            let visibleState = visibleBefore
            visibleState = engine.applyProcessedAction({
                action: visibleActions[0],
                state: visibleState,
                game: scenario.game
            })
            expect(visibleState).toEqual(visibleTeamResult.updatedState)
            visibleState = engine.applyProcessedAction({
                action: visibleActions[1],
                state: visibleState,
                game: scenario.game
            })
            expect(visibleState).toEqual(visiblePublicResult.updatedState)

            visibleState = engine.undoProcessedAction({
                action: visibleActions[1],
                state: visibleState
            })
            expect(visibleState).toEqual(visibleTeamResult.updatedState)
            visibleState = engine.undoProcessedAction({
                action: visibleActions[0],
                state: visibleState
            })
            expect(visibleState).toEqual(visibleBefore)

            expect(
                Visibility.projectActionHistory({
                    currentState: publicResult.updatedState,
                    actions: canonicalActions,
                    visibility: scenario.runtime.visibility,
                    perspective,
                    replay: { game: scenario.game, runtime: scenario.runtime }
                })
            ).toEqual({
                startIndex: 0,
                currentState: visiblePublicResult.updatedState,
                actions: visibleActions
            })
        }
    })
})

describe('I11 / I12: selected information reveals while the remainder stays permanently hidden', () => {
    it('reveals one Card and does not disclose the remaining hand or deck when the Game finishes', () => {
        const scenario = createSelectiveRevealScenario()
        const engine = new GameEngine(scenario.runtime)
        const revealResult = engine.executeAction({
            action: scenario.revealCard,
            state: scenario.before,
            game: scenario.game
        })
        const completeResult = engine.executeAction({
            action: scenario.completeGame,
            state: revealResult.updatedState,
            game: scenario.game
        })
        const canonicalActions = [
            ...revealResult.processedActions,
            ...completeResult.processedActions
        ]

        expect(canonicalActions.map(({ type, index }) => ({ type, index }))).toEqual([
            { type: ActionType.RevealCard, index: 0 },
            { type: ActionType.CompleteGame, index: 1 }
        ])
        expect(completeResult.updatedState).toMatchObject({
            phase: 'complete',
            result: 'Win',
            winningPlayerIds: [PlayerIds[0]]
        })

        for (const perspective of perspectives) {
            const visibleBefore = scenario.runtime.visibility.state.project(
                scenario.before,
                perspective
            )
            const visibleRevealResult = Visibility.projectActionResult({
                result: revealResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const visibleCompleteResult = Visibility.projectActionResult({
                result: completeResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const isOwner = perspective.kind === 'player' && perspective.playerId === PlayerIds[0]
            const expectedBeforeCards = isOwner ? ['revealed-card', 'permanently-hidden-card'] : []
            const expectedAfterCards = isOwner
                ? ['revealed-card', 'permanently-hidden-card']
                : ['revealed-card']

            expect(visibleBefore).toMatchObject({
                phase: 'playing',
                revealedCardIds: [],
                deck: { items: [], remaining: 1 },
                hands: expect.arrayContaining([
                    { playerId: PlayerIds[0], cards: expectedBeforeCards, cardCount: 2 }
                ])
            })
            expect(visibleRevealResult.updatedState).toMatchObject({
                phase: 'playing',
                revealedCardIds: ['revealed-card'],
                hands: expect.arrayContaining([
                    { playerId: PlayerIds[0], cards: expectedAfterCards, cardCount: 2 }
                ])
            })
            expect(visibleCompleteResult.updatedState).toMatchObject({
                phase: 'complete',
                result: 'Win',
                winningPlayerIds: [PlayerIds[0]],
                revealedCardIds: ['revealed-card'],
                deck: { items: [], remaining: 1 },
                hands: expect.arrayContaining([
                    { playerId: PlayerIds[0], cards: expectedAfterCards, cardCount: 2 }
                ])
            })

            const visibleActions = [
                ...visibleRevealResult.processedActions,
                ...visibleCompleteResult.processedActions
            ]
            expect(visibleActions.map(({ id, index }) => ({ id, index }))).toEqual(
                canonicalActions.map(({ id, index }) => ({ id, index }))
            )
            expect(visibleActions[0]).toMatchObject({
                type: ActionType.RevealCard,
                cardId: 'revealed-card',
                revealsInfo: true
            })
            expect(visibleActions.every((action) => action.undoPatch !== undefined)).toBe(true)
            if (!isOwner) {
                expect(visibleActions[0]?.forwardPatch).toBeDefined()
            }

            let visibleState = visibleBefore
            for (const action of visibleActions) {
                visibleState = engine.applyProcessedAction({
                    action,
                    state: visibleState,
                    game: scenario.game
                })
            }
            expect(visibleState).toEqual(visibleCompleteResult.updatedState)
            for (const action of visibleActions.toReversed()) {
                visibleState = engine.undoProcessedAction({ action, state: visibleState })
            }
            expect(visibleState).toEqual(visibleBefore)

            expect(
                Visibility.projectActionHistory({
                    currentState: completeResult.updatedState,
                    actions: canonicalActions,
                    visibility: scenario.runtime.visibility,
                    perspective,
                    replay: { game: scenario.game, runtime: scenario.runtime }
                })
            ).toEqual({
                startIndex: 0,
                currentState: visibleCompleteResult.updatedState,
                actions: visibleActions
            })

            const serializedCompletion = JSON.stringify(visibleCompleteResult)
            expect(serializedCompletion).not.toContain('unused-deck-card')
            if (!isOwner) {
                expect(JSON.stringify(visibleBefore)).not.toContain('revealed-card')
                expect(serializedCompletion).not.toContain('permanently-hidden-card')
            }
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

describe('K2 / S9: a rule explicitly removes Card knowledge', () => {
    it('hides the Card from the formerly informed Player using one perspective-specific cascade mode', () => {
        const scenario = createForgetKnowledgeScenario()
        const engine = new GameEngine(scenario.runtime)
        const canonicalResult = engine.executeAction({
            action: scenario.endRound,
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
            { type: ActionType.EndRound, source: ActionSource.User, index: 0 },
            { type: ActionType.ForgetKnownCards, source: ActionSource.System, index: 1 }
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
            const previouslyKnewCard =
                perspective.kind === 'player' && perspective.playerId === PlayerIds[0]
            const ownsCard = perspective.kind === 'player' && perspective.playerId === PlayerIds[1]
            const expectedBeforeCards = previouslyKnewCard || ownsCard ? ['observed-card'] : []
            const expectedAfterCards = ownsCard ? ['observed-card'] : []

            expect(visibleBefore).toMatchObject({
                hands: expect.arrayContaining([
                    { playerId: PlayerIds[1], cards: expectedBeforeCards, cardCount: 1 }
                ]),
                knowledge: []
            })
            expect(visibleResult.updatedState).toMatchObject({
                hands: expect.arrayContaining([
                    { playerId: PlayerIds[1], cards: expectedAfterCards, cardCount: 1 }
                ]),
                knowledge: [],
                actionCount: 2
            })
            expect(visibleResult.processedActions.map(({ id, index }) => ({ id, index }))).toEqual(
                canonicalResult.processedActions.map(({ id, index }) => ({ id, index }))
            )
            expect(
                visibleResult.processedActions.every((action) => action.undoPatch !== undefined)
            ).toBe(true)
            expect(
                visibleResult.processedActions.map((action) => action.forwardPatch !== undefined)
            ).toEqual(previouslyKnewCard ? [true, true] : [false, false])

            let visibleState = visibleBefore
            for (const action of visibleResult.processedActions) {
                visibleState = engine.applyProcessedAction({
                    action,
                    state: visibleState,
                    game: scenario.game
                })
            }
            expect(visibleState).toEqual(visibleResult.updatedState)

            for (const action of visibleResult.processedActions.toReversed()) {
                visibleState = engine.undoProcessedAction({ action, state: visibleState })
            }
            expect(visibleState).toEqual(visibleBefore)

            for (const action of visibleResult.processedActions) {
                visibleState = engine.applyProcessedAction({
                    action,
                    state: visibleState,
                    game: scenario.game
                })
            }
            expect(visibleState).toEqual(visibleResult.updatedState)

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

            if (!previouslyKnewCard && !ownsCard) {
                expect(JSON.stringify(visibleResult)).not.toContain('observed-card')
            }
            expect(JSON.stringify(visibleResult)).not.toContain('unknown-stock-card')
        }
    })
})

describe("I7 / A5: an Action changes another Player's private state", () => {
    it('projects the private transfer independently for both participants and every observer', () => {
        const scenario = createPrivateTransferScenario()
        const engine = new GameEngine(scenario.runtime)
        const canonicalResult = engine.executeAction({
            action: scenario.stealTopCard,
            state: scenario.before,
            game: scenario.game
        })

        expect(canonicalResult.processedActions).toHaveLength(1)
        expect(canonicalResult.processedActions[0]).toMatchObject({
            type: ActionType.StealTopCard,
            source: ActionSource.User,
            index: 0,
            stolenCard: 'transferred-card'
        })

        const cardsBefore: Readonly<Record<string, readonly string[]>> = {
            'player-1': ['actor-card'],
            'player-2': ['transferred-card', 'target-card'],
            'player-3': ['observer-card'],
            'player-4': ['fourth-player-card']
        }
        const cardsAfter: Readonly<Record<string, readonly string[]>> = {
            'player-1': ['actor-card', 'transferred-card'],
            'player-2': ['target-card'],
            'player-3': ['observer-card'],
            'player-4': ['fourth-player-card']
        }

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
            const expectedBeforeHands = PlayerIds.map((playerId) => ({
                playerId,
                cards:
                    perspective.kind === 'player' && perspective.playerId === playerId
                        ? cardsBefore[playerId]
                        : [],
                cardCount: cardsBefore[playerId].length
            }))
            const expectedAfterHands = PlayerIds.map((playerId) => ({
                playerId,
                cards:
                    perspective.kind === 'player' && perspective.playerId === playerId
                        ? cardsAfter[playerId]
                        : perspective.kind === 'player' &&
                            perspective.playerId === PlayerIds[1] &&
                            playerId === PlayerIds[0]
                          ? ['transferred-card']
                          : [],
                cardCount: cardsAfter[playerId].length
            }))

            expect(visibleBefore).toMatchObject({
                hands: expectedBeforeHands,
                actionCount: 0
            })
            expect(visibleResult.updatedState).toMatchObject({
                hands: expectedAfterHands,
                actionCount: 1
            })

            const visibleAction = visibleResult.processedActions[0]
            if (visibleAction === undefined) {
                throw Error('Expected the private-transfer Action')
            }
            const isParticipant =
                perspective.kind === 'player' &&
                (perspective.playerId === PlayerIds[0] || perspective.playerId === PlayerIds[1])
            if (isParticipant) {
                expect(visibleAction).toMatchObject({ stolenCard: 'transferred-card' })
            } else {
                expect(visibleAction).not.toHaveProperty('stolenCard')
            }
            expect(visibleAction).toMatchObject({
                id: canonicalResult.processedActions[0]?.id,
                index: canonicalResult.processedActions[0]?.index,
                forwardPatch: expect.any(Array),
                undoPatch: expect.any(Array)
            })

            const advancedState = engine.applyProcessedAction({
                action: visibleAction,
                state: visibleBefore,
                game: scenario.game
            })
            expect(advancedState).toEqual(visibleResult.updatedState)
            expect(
                engine.undoProcessedAction({ action: visibleAction, state: advancedState })
            ).toEqual(visibleBefore)

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

            const allowedCards = new Set(
                perspective.kind === 'player'
                    ? [
                          ...cardsAfter[perspective.playerId],
                          ...(isParticipant ? ['transferred-card'] : [])
                      ]
                    : []
            )
            const serializedProjection = JSON.stringify(visibleResult)
            for (const card of [
                'actor-card',
                'transferred-card',
                'target-card',
                'observer-card',
                'fourth-player-card',
                'stock-card'
            ]) {
                if (!allowedCards.has(card)) {
                    expect(serializedProjection).not.toContain(card)
                }
            }
        }
    })
})

describe('A6: Processed Action metadata contains secrets', () => {
    it('projects nested history and animation metadata for each perspective', () => {
        const scenario = createPrivateTransferScenario()
        const engine = new GameEngine(scenario.runtime)
        const canonicalResult = engine.executeAction({
            action: scenario.stealTopCard,
            state: scenario.before,
            game: scenario.game
        })

        expect(canonicalResult.processedActions[0]).toMatchObject({
            metadata: {
                publicDescription: 'One card changed hands',
                historyDescription: 'Player 1 stole transferred-card from Player 2',
                animation: {
                    kind: 'private-card-transfer',
                    cardId: 'transferred-card',
                    fromPlayerId: PlayerIds[1],
                    toPlayerId: PlayerIds[0]
                }
            }
        })

        for (const perspective of perspectives) {
            const visibleResult = Visibility.projectActionResult({
                result: canonicalResult,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            const visibleAction = visibleResult.processedActions[0]
            if (visibleAction === undefined) {
                throw Error('Expected the private-transfer Action')
            }
            expect(visibleAction).toMatchObject({
                metadata: {
                    publicDescription: 'One card changed hands',
                    animation: {
                        kind: 'private-card-transfer',
                        fromPlayerId: PlayerIds[1],
                        toPlayerId: PlayerIds[0]
                    }
                }
            })

            const isParticipant =
                perspective.kind === 'player' &&
                (perspective.playerId === PlayerIds[0] || perspective.playerId === PlayerIds[1])
            if (isParticipant) {
                expect(visibleAction).toHaveProperty(
                    'metadata.historyDescription',
                    'Player 1 stole transferred-card from Player 2'
                )
                expect(visibleAction).toHaveProperty(
                    'metadata.animation.cardId',
                    'transferred-card'
                )
            } else {
                expect(visibleAction).not.toHaveProperty('metadata.historyDescription')
                expect(visibleAction).not.toHaveProperty('metadata.animation.cardId')
                expect(JSON.stringify(visibleAction)).not.toContain('transferred-card')
            }

            const visibleHistory = Visibility.projectActionHistory({
                currentState: canonicalResult.updatedState,
                actions: canonicalResult.processedActions,
                visibility: scenario.runtime.visibility,
                perspective,
                replay: { game: scenario.game, runtime: scenario.runtime }
            })
            expect(visibleHistory.actions[0]).toEqual(visibleAction)
        }
    })
})

describe('A7 / A8 / U6: visible undo patches never expose canonical undo', () => {
    it('derives secret-sensitive undo per perspective even when another visible undo matches canonically', () => {
        const privateScenario = createPrivateTransferScenario()
        const privateEngine = new GameEngine(privateScenario.runtime)
        const privateResult = privateEngine.executeAction({
            action: privateScenario.stealTopCard,
            state: privateScenario.before,
            game: privateScenario.game
        })
        const canonicalPrivateAction = privateResult.processedActions[0]
        const canonicalPrivateUndo = canonicalPrivateAction?.undoPatch
        if (canonicalPrivateAction === undefined || canonicalPrivateUndo === undefined) {
            throw Error('Expected the canonical private-transfer undo patch')
        }
        expect(JSON.stringify(canonicalPrivateUndo)).toContain('transferred-card')
        expect(JSON.stringify(canonicalPrivateUndo)).toContain('target-card')

        const permittedUndoCards: Readonly<Record<string, readonly string[]>> = {
            [PlayerIds[0]]: ['actor-card', 'transferred-card'],
            [PlayerIds[1]]: ['target-card', 'transferred-card'],
            [PlayerIds[2]]: ['observer-card'],
            [PlayerIds[3]]: ['fourth-player-card']
        }
        for (const perspective of perspectives) {
            const visibleBefore = privateScenario.runtime.visibility.state.project(
                privateScenario.before,
                perspective
            )
            const visibleResult = Visibility.projectActionResult({
                result: privateResult,
                visibility: privateScenario.runtime.visibility,
                perspective,
                replay: { game: privateScenario.game, runtime: privateScenario.runtime }
            })
            const visibleAction = visibleResult.processedActions[0]
            const visibleUndo = visibleAction?.undoPatch
            if (visibleAction === undefined || visibleUndo === undefined) {
                throw Error('Expected the projected private-transfer undo patch')
            }

            expect(visibleUndo).not.toBe(canonicalPrivateUndo)
            const permittedCards = new Set(
                perspective.kind === 'player' ? permittedUndoCards[perspective.playerId] : []
            )
            const serializedUndo = JSON.stringify(visibleUndo)
            for (const card of [
                'actor-card',
                'transferred-card',
                'target-card',
                'observer-card',
                'fourth-player-card',
                'stock-card'
            ]) {
                if (!permittedCards.has(card)) {
                    expect(serializedUndo).not.toContain(card)
                }
            }
            expect(
                privateEngine.undoProcessedAction({
                    action: visibleAction,
                    state: visibleResult.updatedState
                })
            ).toEqual(visibleBefore)
        }

        const publicScenario = createSelectiveRevealScenario()
        const publicEngine = new GameEngine(publicScenario.runtime)
        const revealResult = publicEngine.executeAction({
            action: publicScenario.revealCard,
            state: publicScenario.before,
            game: publicScenario.game
        })
        const completeResult = publicEngine.executeAction({
            action: publicScenario.completeGame,
            state: revealResult.updatedState,
            game: publicScenario.game
        })
        const canonicalCompleteAction = completeResult.processedActions[0]
        const canonicalCompleteUndo = canonicalCompleteAction?.undoPatch
        if (canonicalCompleteAction === undefined || canonicalCompleteUndo === undefined) {
            throw Error('Expected the canonical completion undo patch')
        }

        for (const perspective of perspectives) {
            const visibleCompleteResult = Visibility.projectActionResult({
                result: completeResult,
                visibility: publicScenario.runtime.visibility,
                perspective,
                replay: { game: publicScenario.game, runtime: publicScenario.runtime }
            })
            const visibleCompleteAction = visibleCompleteResult.processedActions[0]
            const visibleCompleteUndo = visibleCompleteAction?.undoPatch
            if (visibleCompleteAction === undefined || visibleCompleteUndo === undefined) {
                throw Error('Expected the projected completion undo patch')
            }

            expect(visibleCompleteAction).not.toBe(canonicalCompleteAction)
            expect(visibleCompleteUndo).toHaveLength(canonicalCompleteUndo.length)
            expect(visibleCompleteUndo).toEqual(expect.arrayContaining(canonicalCompleteUndo))
            expect(visibleCompleteUndo).not.toBe(canonicalCompleteUndo)
        }
    })
})

describe('A9: legal choices depend on private state', () => {
    it('derives Action availability and concrete choices only for the entitled Player', () => {
        const scenario = createLegalChoiceScenario()
        const engine = new GameEngine(scenario.runtime)
        const expectedChoices = {
            [PlayerIds[0]]: ['player-1-playable-card', 'player-1-second-card'],
            [PlayerIds[1]]: ['player-2-playable-card'],
            [PlayerIds[2]]: [],
            [PlayerIds[3]]: ['player-4-playable-card']
        }

        for (const playerId of PlayerIds) {
            const perspective: Visibility.Perspective = { kind: 'player', playerId }
            const projected = scenario.runtime.visibility.state.project(
                scenario.before,
                perspective
            )
            const hand = projected.hands.find((candidate) => candidate.playerId === playerId)
            if (hand === undefined) {
                throw Error(`Expected a projected hand for Player ${playerId}`)
            }
            const actionTypes = engine.getValidActionTypesForPlayer(
                scenario.game,
                projected,
                playerId,
                { perspective }
            )

            expect({ actionTypes, choices: hand.cards }).toEqual({
                actionTypes: expectedChoices[playerId].length > 0 ? [ActionType.RevealCard] : [],
                choices: expectedChoices[playerId]
            })
            const unauthorizedPlayerId = playerId === PlayerIds[0] ? PlayerIds[1] : PlayerIds[0]
            expect(
                engine.getValidActionTypesForPlayer(
                    scenario.game,
                    projected,
                    unauthorizedPlayerId,
                    { perspective }
                )
            ).toEqual([])
        }

        const spectatorPerspective: Visibility.Perspective = { kind: 'spectator' }
        const spectatorState = scenario.runtime.visibility.state.project(
            scenario.before,
            spectatorPerspective
        )
        expect(spectatorState.hands.flatMap((hand) => hand.cards)).toEqual([])
        expect(
            engine.getValidActionTypesForPlayer(scenario.game, spectatorState, PlayerIds[0], {
                perspective: spectatorPerspective
            })
        ).toEqual([])
    })

    it('refuses to infer Action availability from inaccessible protected state', () => {
        const scenario = createLegalChoiceScenario()
        const engine = new GameEngine(scenario.secretDependentRuntime)

        expect(
            engine.getValidActionTypesForPlayer(scenario.game, scenario.before, PlayerIds[0])
        ).toEqual([ActionType.StealTopCard])

        const perspective: Visibility.Perspective = {
            kind: 'player',
            playerId: PlayerIds[0]
        }
        const projected = scenario.runtime.visibility.state.project(scenario.before, perspective)

        expect(() =>
            engine.getValidActionTypesForPlayer(scenario.game, projected, PlayerIds[0], {
                perspective
            })
        ).toThrow('Projected execution cannot access protected value at /hands/1/cards/0')
    })
})
