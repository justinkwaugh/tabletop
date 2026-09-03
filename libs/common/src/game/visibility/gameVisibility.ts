import jsonpatch from 'fast-json-patch'
import type { GameAction } from '../engine/gameAction.js'
import type {
    ActionCascadeResult,
    ActionResult,
    CanonicalActionCascade,
    CanonicalActionTransition
} from '../engine/gameEngine.js'
import type { GameState } from '../model/gameState.js'
import { assert, assertExists } from '../../util/assertions.js'
import type { ActionProjector } from './actionProjector.js'
import type { Perspective, ValueProjector } from './valueProjector.js'

export interface GameVisibility<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly state: ValueProjector<State, ProjectedState>
    readonly actions: ActionProjector
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
}

export interface ActionResultProjectionOptions<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly result: ActionCascadeResult<State>
    readonly visibility?: GameVisibility<State, ProjectedState>
    readonly perspective: Perspective
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
    let before = options.visibility.state.project(actionCascade.before, options.perspective)
    const actions = actionCascade.transitions.map((transition) => {
        const after = options.visibility.state.project(transition.after, options.perspective)
        const action = options.visibility.actions.project(transition.action, options.perspective)
        action.forwardPatch = jsonpatch.compare(before, after)
        action.undoPatch = jsonpatch.compare(after, before)
        before = after
        return action
    })

    return { actions }
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

    let before = structuredClone(options.currentState)
    const reversedTransitions: CanonicalActionTransition<State>[] = []

    for (const { action } of orderedActions.toReversed()) {
        reversedTransitions.push({ action, after: before })

        const undoPatch = action.undoPatch
        assertExists(undoPatch, `Canonical Action ${action.id} has no undo patch`)
        before = jsonpatch.applyPatch(structuredClone(before), undoPatch).newDocument
    }

    const visibleActionCascade = projectActionCascade(
        {
            before,
            transitions: reversedTransitions.toReversed()
        },
        {
            visibility: options.visibility,
            perspective: options.perspective
        }
    )

    return {
        startIndex,
        currentState: options.visibility.state.project(options.currentState, options.perspective),
        actions: visibleActionCascade.actions
    }
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
        perspective
    })

    return {
        processedActions: [...visibleActionCascade.actions],
        updatedState: visibility.state.project(result.updatedState, perspective),
        indexOffset: result.indexOffset
    }
}
