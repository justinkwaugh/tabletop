import type { HydratedAction } from '@tabletop/common'
import { HydratedAttemptAnomaly, isAttemptAnomaly } from '../actions/attemptAnomaly.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { ActionType } from '../definition/actions.js'
import { attemptableSystemIds } from '../model/anomalies.js'
import { canExploreAnyShip } from '../model/exploration.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

type ExploringAction = HydratedExplore | HydratedAttemptAnomaly

export class ExploringStateHandler extends PlayStateHandler<ExploringAction> {
    protected readonly phase = TurnPhase.Exploration

    protected isPhaseAction(action: HydratedAction): action is ExploringAction {
        return isExplore(action) || isAttemptAnomaly(action)
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        const available: [ActionType, boolean][] = [
            [ActionType.Explore, canExploreAnyShip(state, playerId)],
            [ActionType.AttemptAnomaly, attemptableSystemIds(state, playerId).length > 0]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }
}
