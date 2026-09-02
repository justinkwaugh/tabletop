import jsonpatch, { type Operation } from 'fast-json-patch'
import type { GameAction } from '../engine/gameAction.js'
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

export interface CanonicalCascadeTransition<State extends GameState = GameState> {
    readonly action: GameAction
    readonly after: State
}

export interface CanonicalActionCascade<State extends GameState = GameState> {
    readonly before: State
    readonly transitions: readonly CanonicalCascadeTransition<State>[]
}

export interface VisibleActionTransition {
    readonly action: GameAction
    readonly forwardPatch: Operation[]
    readonly undoPatch: Operation[]
}

export interface VisibleActionCascade {
    readonly transitions: VisibleActionTransition[]
}

export interface CascadeProjectionOptions<
    State extends GameState = GameState,
    ProjectedState extends GameState = GameState
> {
    readonly visibility: GameVisibility<State, ProjectedState>
    readonly perspective: Perspective
}

export function projectActionCascade<State extends GameState, ProjectedState extends GameState>(
    actionCascade: CanonicalActionCascade<State>,
    options: CascadeProjectionOptions<State, ProjectedState>
): VisibleActionCascade {
    let before = options.visibility.state.project(actionCascade.before, options.perspective)
    const transitions = actionCascade.transitions.map((transition) => {
        const after = options.visibility.state.project(transition.after, options.perspective)
        const visibleTransition: VisibleActionTransition = {
            action: options.visibility.actions.project(transition.action, options.perspective),
            forwardPatch: jsonpatch.compare(before, after),
            undoPatch: jsonpatch.compare(after, before)
        }
        before = after
        return visibleTransition
    })

    return {
        transitions
    }
}
