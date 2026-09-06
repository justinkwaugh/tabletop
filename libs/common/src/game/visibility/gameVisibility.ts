import jsonpatch from 'fast-json-patch'
import * as Value from 'typebox/value'
import { ActionSource, type GameAction } from '../engine/gameAction.js'
import type {
    ActionCascadeResult,
    ActionResult,
    CanonicalActionCascade,
    CanonicalActionTransition
} from '../engine/gameEngine.js'
import { GameEngine } from '../engine/gameEngine.js'
import type { GameRuntime } from '../definition/gameDefinition.js'
import type { Game } from '../model/game.js'
import type { GameState } from '../model/gameState.js'
import { assert, assertExists } from '../../util/assertions.js'
import { isRedactedAction, redactActionRecord, type ActionProjector } from './actionProjector.js'
import type { Perspective, ValueProjector } from './valueProjector.js'

export interface GameVisibility<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly state: ValueProjector<State, ProjectedState>
    readonly actions: ActionProjector
}

export function getGameVisibility<State extends GameState>(
    game: Pick<Game, 'protectedInformation'>,
    runtime: Pick<GameRuntime<State>, 'visibility'>
): GameVisibility<State> | undefined {
    if (game.protectedInformation !== true) return undefined
    assertExists(runtime.visibility, 'Protected Game requires a registered visibility definition')
    return runtime.visibility
}

export interface VisibleActionCascade {
    readonly actions: readonly GameAction[]
}

export interface VisibleActionHistory<ProjectedState extends GameState = GameState> {
    readonly startIndex: number
    readonly currentState: ProjectedState
    readonly actions: readonly GameAction[]
}

export interface ActionCascadeProjectionOptions<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly visibility: GameVisibility<State, ProjectedState>
    readonly perspective: Perspective
    readonly replay?: ActionReplayContext
}

export interface ActionReplayContext {
    readonly game: Game
    readonly runtime: GameRuntime
}

export interface ActionResultProjectionOptions<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly result: ActionCascadeResult<State>
    readonly visibility?: GameVisibility<State, ProjectedState>
    readonly perspective: Perspective
    readonly replay?: ActionReplayContext
}

export interface ActionHistoryProjectionOptions<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> extends ActionCascadeProjectionOptions<State, ProjectedState> {
    readonly startIndex?: number
    readonly currentState: State
    readonly actions: readonly GameAction[]
}

export function projectActionCascade<State extends GameState, ProjectedState extends GameState>(
    actionCascade: CanonicalActionCascade<State>,
    options: ActionCascadeProjectionOptions<State, ProjectedState>
): VisibleActionCascade {
    const before = options.visibility.state.project(actionCascade.before, options.perspective)
    const transitions: CanonicalActionTransition<ProjectedState>[] = []
    let previous = before
    for (const transition of actionCascade.transitions) {
        const after = options.visibility.state.project(transition.after, options.perspective)
        const action = options.visibility.actions.project(transition.action, options.perspective)
        action.forwardPatch = jsonpatch.compare(previous, after)
        action.undoPatch = jsonpatch.compare(after, previous)
        transitions.push({ action, after })
        previous = after
    }

    const projectedCascade = { before, transitions }
    const containsRedactedAction = transitions.some(({ action }) => isRedactedAction(action))
    if (
        !containsRedactedAction &&
        options.replay !== undefined &&
        canReplayCascade(projectedCascade, options.replay)
    ) {
        return { actions: transitions.map(({ action }) => withoutForwardPatch(action)) }
    }

    return { actions: transitions.map(({ action }) => action) }
}

export function projectActionHistory<State extends GameState, ProjectedState extends GameState>(
    options: ActionHistoryProjectionOptions<State, ProjectedState>
): VisibleActionHistory<ProjectedState> {
    const startIndex = options.startIndex ?? 0
    assert(
        Number.isInteger(startIndex) && startIndex >= 0,
        `Canonical Action History start index must be a non-negative integer, received ${startIndex}`
    )
    assert(
        options.currentState.actionCount === startIndex + options.actions.length,
        `Canonical Action History segment starts at ${startIndex} with ${options.actions.length} Actions but current state has Action count ${options.currentState.actionCount}`
    )

    const indexedActions = options.actions.map((action) => {
        const index = action.index
        assertExists(index, `Canonical Action ${action.id} has no index`)
        return { action, index }
    })
    const orderedActions = indexedActions.toSorted((left, right) => left.index - right.index)
    let expectedIndex = startIndex
    for (const indexedAction of orderedActions) {
        assert(
            indexedAction.index === expectedIndex,
            `Canonical Action ${indexedAction.action.id} has index ${indexedAction.index}, expected ${expectedIndex}`
        )
        expectedIndex += 1
    }

    const currentState = options.visibility.state.project(options.currentState, options.perspective)
    let before = structuredClone(options.currentState)
    const projectedCascades: (readonly GameAction[])[] = []
    let end = orderedActions.length

    while (end > 0) {
        let start = end - 1
        while (start > 0 && orderedActions[start].action.source !== ActionSource.User) start -= 1
        const reversedTransitions: CanonicalActionTransition<State>[] = []
        try {
            for (let index = end - 1; index >= start; index--) {
                const action = orderedActions[index].action
                reversedTransitions.push({ action, after: before })
                assertExists(action.undoPatch, `Canonical Action ${action.id} has no undo patch`)
                before = jsonpatch.applyPatch(structuredClone(before), action.undoPatch).newDocument
                assert(
                    before.actionCount === startIndex + index,
                    'Historical Action count mismatch'
                )
            }
            projectedCascades.push(
                projectActionCascade(
                    { before, transitions: reversedTransitions.toReversed() },
                    options
                ).actions
            )
        } catch {
            projectedCascades.push(
                orderedActions.slice(0, end).map(({ action }) => redactActionRecord(action))
            )
            break
        }
        end = start
    }

    return { startIndex, currentState, actions: projectedCascades.toReversed().flat() }
}

export function projectActionResult<State extends GameState>(
    options: ActionResultProjectionOptions<State, State> & { readonly visibility?: undefined }
): ActionResult<State>
export function projectActionResult<State extends GameState, ProjectedState extends GameState>(
    options: ActionResultProjectionOptions<State, ProjectedState> & {
        readonly visibility: GameVisibility<State, ProjectedState>
    }
): ActionResult<ProjectedState>
export function projectActionResult<State extends GameState, ProjectedState extends GameState>(
    options: ActionResultProjectionOptions<State, ProjectedState>
): ActionResult<State | ProjectedState>
export function projectActionResult<State extends GameState, ProjectedState extends GameState>(
    options: ActionResultProjectionOptions<State, ProjectedState>
): ActionResult<State | ProjectedState> {
    const { result, visibility, perspective } = options

    if (visibility === undefined) {
        return {
            processedActions: result.processedActions,
            updatedState: result.updatedState,
            indexOffset: result.indexOffset
        }
    }

    const visibleActionCascade = projectActionCascade(result.actionCascade, {
        visibility,
        perspective,
        replay: options.replay
    })

    return {
        processedActions: [...visibleActionCascade.actions],
        updatedState: visibility.state.project(result.updatedState, perspective),
        indexOffset: result.indexOffset
    }
}

function canReplayCascade(
    actionCascade: CanonicalActionCascade<GameState>,
    replay: ActionReplayContext
): boolean {
    const firstTransition = actionCascade.transitions[0]
    if (firstTransition?.action.source !== ActionSource.User) {
        return false
    }

    const engine = new GameEngine(replay.runtime)
    try {
        const executed = engine.executeAction({
            action: firstTransition.action,
            state: actionCascade.before,
            game: replay.game
        })
        if (executed.actionCascade.transitions.length !== actionCascade.transitions.length) {
            return false
        }

        for (const [index, expected] of actionCascade.transitions.entries()) {
            const actual = executed.actionCascade.transitions[index]
            if (
                actual === undefined ||
                !Value.Equal(comparableAction(actual.action), comparableAction(expected.action)) ||
                !Value.Equal(actual.after, expected.after)
            ) {
                return false
            }
        }

        let replayedState = structuredClone(actionCascade.before)
        for (const transition of actionCascade.transitions) {
            replayedState = engine.applyProcessedAction({
                action: withoutForwardPatch(transition.action),
                state: replayedState,
                game: replay.game
            })
            if (!Value.Equal(replayedState, transition.after)) {
                return false
            }
        }
        return true
    } catch {
        return false
    }
}

function comparableAction(action: GameAction): GameAction {
    const comparable = structuredClone(action)
    delete comparable.undoPatch
    delete comparable.forwardPatch
    delete comparable.createdAt
    delete comparable.updatedAt
    return comparable
}

function withoutForwardPatch(action: GameAction): GameAction {
    const replayable = structuredClone(action)
    delete replayable.forwardPatch
    return replayable
}
