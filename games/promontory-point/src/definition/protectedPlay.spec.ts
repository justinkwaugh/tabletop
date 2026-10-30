import { Visibility, assertExists, type Game } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { EndTurn } from '../actions/endTurn.js'
import { ScrapTrack, isScrapTrack } from '../actions/scrapTrack.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { piecesConserved } from '../model/invariants.js'
import { withEmptyBag } from '../testing/fixtures.js'
import { WALKS, walk, type Step } from '../testing/seededWalk.js'
import { canonical, engine, startGame } from '../testing/startGame.js'
import { withNoRoomFor, withPlacingEnded, withTurnPieces } from '../testing/turnPieces.js'
import { action, revealedTurn, turnPlayer } from '../testing/turns.js'
import { ActionType } from './actions.js'
import { PromontoryPointRuntime } from './runtime.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'
const KP = 'railroad.kp'

function seat(playerId: string) {
    return { kind: 'player', playerId } as const
}

function project(state: PromontoryPointGameState, game: Game, perspective: Visibility.Perspective) {
    return PromontoryPointRuntime.visibility.state.project(state, perspective, {
        config: game.config
    })
}

// R-5, R-X.2: an action that reads the bag needs the host's canonical state.
function readsTheBag(step: Step): boolean {
    const [submitted] = step.processedActions
    return (
        submitted.type === ActionType.EndTurn ||
        (isScrapTrack(submitted) && submitted.metadata?.bagEmpty === false)
    )
}

function submitter(step: Step): string {
    const { playerId } = step.submitted
    assertExists(playerId, 'A seat submits each user action')
    return playerId
}

function lastState(step: Step): PromontoryPointGameState {
    const state = step.states.at(-1)
    assertExists(state, 'An action leaves a state')
    return state
}

describe('Promontory Point protected play', () => {
    describe.each(WALKS)('$name', (setting) => {
        const walked = walk(setting)
        const { game, steps } = walked

        it('R-5: the game is played under protection', () => {
            expect(game.protectedInformation).toBe(true)
            expect(Visibility.getGameVisibility(game, PromontoryPointRuntime)).toBe(
                PromontoryPointRuntime.visibility
            )
        })

        it('R-5, R-X.2: guarded execution defers EndTurn and a drawing ScrapTrack to the host and runs every other action optimistically', () => {
            const deferred = new Set<string>()
            const optimistic = new Set<string>()
            for (const step of steps) {
                const perspective = seat(submitter(step))
                const view = project(step.before, game, perspective)
                const execute = () =>
                    engine.executeAction({
                        game,
                        state: view,
                        action: structuredClone(step.submitted),
                        perspective
                    })
                if (readsTheBag(step)) {
                    expect(execute).toThrow(Visibility.UnavailableProjectedValueError)
                    deferred.add(step.submitted.type)
                    continue
                }
                const predicted = execute()
                expect(predicted.updatedState).toEqual(project(lastState(step), game, perspective))
                expect(predicted.processedActions.map(({ type, id }) => [type, id])).toEqual(
                    step.processedActions.map(({ type, id }) => [type, id])
                )
                optimistic.add(step.submitted.type)
            }
            expect([...deferred].sort()).toEqual([ActionType.EndTurn, ActionType.ScrapTrack].sort())
            expect([...optimistic].sort()).toEqual(
                [
                    ActionType.BuyShare,
                    ActionType.PayRepairs,
                    ActionType.PlaceTrack,
                    ActionType.SellShare
                ].sort()
            )
        })

        it("R-5: each seat's projection offers it the same actions as canonical state", () => {
            const playerIds = walked.initial.turnManager.turnOrder
            for (const { before } of steps) {
                for (const playerId of playerIds) {
                    const perspective = seat(playerId)
                    expect(
                        engine.getValidActionTypesForPlayer(
                            game,
                            project(before, game, perspective),
                            playerId,
                            { perspective }
                        )
                    ).toEqual(engine.getValidActionTypesForPlayer(game, before, playerId))
                }
            }
        })

        it('R-1.1: every railroad keeps its 24 pieces across bag, hands, kept pieces, turn pieces, board and scrapped after every action', () => {
            const states = [walked.initial, ...steps.flatMap((step) => step.states)]
            for (const state of states) {
                expect(piecesConserved(state)).toBe(true)
            }
        })
    })

    it('R-3.3-H1: a ScrapTrack with the bag empty draws nothing and runs optimistically', () => {
        const { game, state } = startGame()
        const turn = withEmptyBag(
            withNoRoomFor(withTurnPieces(revealedTurn(game, state), [KP, CP, UP]), KP, UP)
        )
        const scrap = action(ScrapTrack, turn, { playerId: turnPlayer(turn), railroadId: KP })
        const perspective = seat(turnPlayer(turn))
        const canonicalResult = engine.executeCanonicalAction({
            game,
            state: turn,
            action: structuredClone(scrap)
        })

        const predicted = engine.executeAction({
            game,
            state: project(turn, game, perspective),
            action: structuredClone(scrap),
            perspective
        })

        expect(predicted.processedActions[0]).toHaveProperty('metadata', { bagEmpty: true })
        expect(predicted.updatedState).toEqual(
            project(canonical(canonicalResult.updatedState), game, perspective)
        )
    })

    it('R-X.2, R-6.1-H2: an EndTurn on an empty bag reads nothing hidden, yet its record is a barrier, so the client waits for the host', () => {
        const { game, state } = startGame()
        const ending = withEmptyBag(withPlacingEnded(revealedTurn(game, state)))
        const perspective = seat(turnPlayer(ending))
        const endTurn = action(EndTurn, ending, { playerId: turnPlayer(ending) })
        const canonicalResult = engine.executeCanonicalAction({
            game,
            state: ending,
            action: structuredClone(endTurn)
        })

        const predicted = engine.executeAction({
            game,
            state: project(ending, game, perspective),
            action: structuredClone(endTurn),
            perspective
        })

        expect(predicted.processedActions[0]).toMatchObject({
            revealsInfo: true,
            metadata: { drawn: [], drawnCount: 0 }
        })
        expect(predicted.updatedState).toEqual(
            project(canonical(canonicalResult.updatedState), game, perspective)
        )
    })
})
