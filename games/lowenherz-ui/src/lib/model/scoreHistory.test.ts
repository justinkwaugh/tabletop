import {
    GameEngine,
    PlayerStatus,
    Visibility,
    assertExists,
    type GameAction
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import {
    Definition,
    LowenherzRuntime,
    MachineState,
    isAdvanceResolution,
    type LowenherzProjectedState
} from '@tabletop/lowenherz'
import { nextAction } from '@tabletop/lowenherz/testing'
import { powerPointHistory } from './scoreHistory.js'

const engine = new GameEngine(LowenherzRuntime)
const GAME_TIMEOUT_MS = 30_000

function powerPoints(state: LowenherzProjectedState): Record<string, number> {
    return Object.fromEntries(
        state.players.map(({ playerId, powerPoints }) => [playerId, powerPoints])
    )
}

function playToEnd(config: { privateMoney?: boolean } = {}) {
    const game = LowenherzRuntime.initializer.initializeGame(
        {
            id: 'lowenherz-score-history',
            typeId: Definition.info.id,
            ownerId: 'p0',
            config,
            players: Array.from({ length: 4 }, (_, index) => ({
                id: `p${index}`,
                name: `Player ${index}`,
                isHuman: true,
                status: PlayerStatus.Joined
            }))
        },
        Definition
    )
    const { startedGame, initialState } = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef'
    })
    let state: LowenherzProjectedState = initialState
    const actions: GameAction[] = []
    const pointsAtRoundEnds: Record<string, number>[] = []
    while (state.machineState !== MachineState.EndOfGame) {
        const result = engine.executeCanonicalAction({
            game: startedGame,
            state,
            action: nextAction(state, startedGame.id)
        })
        for (const { action, after } of result.actionCascade.transitions) {
            if (isAdvanceResolution(action) && action.metadata?.roundAdvanced) {
                pointsAtRoundEnds.push(powerPoints(after))
            }
        }
        state = result.updatedState
        actions.push(...result.processedActions)
    }
    return { game: startedGame, state, actions, pointsAtRoundEnds }
}

function projectedHistory({ game, state, actions }: ReturnType<typeof playToEnd>) {
    const visibility = LowenherzRuntime.visibility
    assertExists(visibility, 'Lowenherz registers visibility')
    return Visibility.projectActionHistory({
        currentState: state,
        actions,
        visibility,
        perspective: { kind: 'spectator' },
        replay: { game, runtime: LowenherzRuntime }
    })
}

describe('powerPointHistory', () => {
    it(
        'gives every round end and then the final score',
        () => {
            const played = playToEnd()
            const checkpoints = [...played.pointsAtRoundEnds, powerPoints(played.state)]

            expect(played.pointsAtRoundEnds.length).toBeGreaterThan(1)
            expect(powerPointHistory(played.state, played.actions)).toEqual(
                played.state.players.map(({ playerId }) => ({
                    playerId,
                    scores: checkpoints.map((points) => points[playerId])
                }))
            )
        },
        GAME_TIMEOUT_MS
    )

    it(
        'rebuilds the same history from a spectator view, even with private money',
        () => {
            const played = playToEnd({ privateMoney: true })
            const canonical = powerPointHistory(played.state, played.actions)
            const projected = projectedHistory(played)

            expect(canonical).toBeDefined()
            expect(powerPointHistory(projected.currentState, projected.actions)).toEqual(canonical)
        },
        GAME_TIMEOUT_MS
    )

    it(
        'has no history when the earliest rounds were redacted',
        () => {
            const played = playToEnd()
            const secondRoundEnd = played.actions.findIndex(
                (action, index) =>
                    isAdvanceResolution(action) &&
                    action.metadata?.roundAdvanced === true &&
                    played.actions
                        .slice(0, index)
                        .some(
                            (earlier) =>
                                isAdvanceResolution(earlier) && earlier.metadata?.roundAdvanced
                        )
            )
            const actions = played.actions.map((action, index) =>
                index <= secondRoundEnd
                    ? {
                          id: action.id,
                          gameId: action.gameId,
                          source: action.source,
                          type: Visibility.RedactedActionType
                      }
                    : action
            )

            expect(secondRoundEnd).toBeGreaterThan(0)
            expect(powerPointHistory(played.state, actions)).toBeUndefined()
        },
        GAME_TIMEOUT_MS
    )

    it(
        'has no history when reversal data runs out before a round end',
        () => {
            const played = playToEnd()
            const firstRoundEnd = played.actions.findIndex(
                (action) => isAdvanceResolution(action) && action.metadata?.roundAdvanced === true
            )
            const actions = played.actions.map((action, index) =>
                index === firstRoundEnd + 1 ? { ...action, undoPatch: undefined } : action
            )

            expect(powerPointHistory(played.state, actions)).toBeUndefined()
        },
        GAME_TIMEOUT_MS
    )
})
