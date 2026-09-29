import { Visibility } from '@tabletop/common'
import {
    HydratedOathGameState,
    OathGameState,
    OathGameStateValidator,
    type OathProjectedState
} from '../model/gameState.js'
import { OathVisibilityPolicies } from '../model/question.js'

const projector = Visibility.createProjector(OathGameState, { policies: OathVisibilityPolicies })

export const spectator: Visibility.Perspective = { kind: 'spectator' }

export function servedJson(
    state: OathProjectedState | HydratedOathGameState,
    perspective: Visibility.Perspective = spectator
): string {
    const data = state instanceof HydratedOathGameState ? state.dehydrate() : state
    if (!OathGameStateValidator.Check(data))
        throw Error('Serving requires complete canonical state')
    return JSON.stringify(projector.project(data, perspective))
}
