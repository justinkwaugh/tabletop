import jsonpatch from 'fast-json-patch'
import type { GameAction } from '../engine/gameAction.js'
import type { CanonicalActionCascade } from '../engine/gameEngine.js'
import type { GameState } from '../model/gameState.js'
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

export interface ActionCascadeProjectionOptions<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly visibility: GameVisibility<State, ProjectedState>
    readonly perspective: Perspective
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
