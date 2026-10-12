import { assertExists } from '../../../util/assertions.js'
import type { Branch } from '../branch.js'
import type { GameAction } from '../gameAction.js'
import { createSpanGame, spanAction, type SpanGameState } from './spanGame.js'

export type SpanGame = ReturnType<typeof createSpanGame>

export interface PrivatePlay {
    readonly branch: Branch
    readonly actions: GameAction[]
    readonly view: SpanGameState
}

export function playLocally(
    { engine, game }: SpanGame,
    state: SpanGameState,
    actions: readonly GameAction[]
) {
    const processedActions: GameAction[] = []
    let current = state
    const advance = () => {
        const advanced = engine.advanceSpan({ game, state: current })
        if (advanced === undefined) return
        processedActions.push(...advanced.processedActions)
        current = advanced.updatedState
    }
    advance()
    for (const action of actions) {
        const result = engine.executeCanonicalAction({ game, state: current, action })
        processedActions.push(...result.processedActions)
        current = result.updatedState
        advance()
    }
    return { state: current, processedActions }
}

export function playPrivately(
    { engine, game }: SpanGame,
    state: SpanGameState,
    playerId: string,
    actions: readonly GameAction[]
): PrivatePlay {
    let execution = engine.createBranch({ game, state, playerId })
    const recorded = [...execution.processedActions]
    for (const action of actions) {
        execution = engine.executeBranchAction({ game, state, branch: execution.branch, action })
        recorded.push(...execution.processedActions)
    }
    return { branch: execution.branch, actions: recorded, view: execution.view }
}

export function mergePrivatePlay(spanGame: SpanGame, state: SpanGameState, play: PrivatePlay) {
    return spanGame.engine.mergeBranch({
        game: spanGame.game,
        state,
        branch: play.branch,
        actions: play.actions
    })
}

export function beginSpan(spanGame: SpanGame): SpanGameState {
    return spanGame.engine.executeCanonicalAction({
        game: spanGame.game,
        state: spanGame.state,
        action: spanAction('begin', 'begin', 'p1')
    }).updatedState
}

export function restAfterEveryBranch(spanGame: SpanGame): SpanGameState {
    const lastBranch = playLocally(spanGame, beginSpan(spanGame), [
        spanAction('f3', 'finish', 'p3'),
        spanAction('f2', 'finish', 'p2')
    ]).state
    return spanGame.engine.executeCanonicalAction({
        game: spanGame.game,
        state: lastBranch,
        action: spanAction('f1', 'finish', 'p1')
    }).updatedState
}

export function playerOf(state: SpanGameState, playerId: string) {
    const player = state.players.find((candidate) => candidate.playerId === playerId)
    assertExists(player, `No player ${playerId}`)
    return player
}

export function summary(actions: readonly GameAction[]): string[] {
    return actions.map((action) => `${action.type}:${action.playerId ?? ''}`)
}
