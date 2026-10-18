import type { HydratedAction } from '@tabletop/common'
import { HydratedAttemptAnomaly, isAttemptAnomaly } from '../actions/attemptAnomaly.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { HydratedMine, isMine } from '../actions/mine.js'
import { HydratedResearch, isResearch } from '../actions/research.js'
import { HydratedTerraformWithShip, isTerraformWithShip } from '../actions/terraformWithShip.js'
import { shipTerraformSlots } from '../model/terraforming.js'
import { ActionType } from '../definition/actions.js'
import { attemptableSystemIds } from '../model/anomalies.js'
import { canExploreAnyShip } from '../model/exploration.js'
import { canOperateAnyShip } from '../model/operations.js'
import { OperationKind } from '../model/pieces.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

type ExploringAction =
    | HydratedExplore
    | HydratedAttemptAnomaly
    | HydratedMine
    | HydratedResearch
    | HydratedTerraformWithShip

export class ExploringStateHandler extends PlayStateHandler<ExploringAction> {
    protected readonly phase = TurnPhase.Exploration

    protected isPhaseAction(action: HydratedAction): action is ExploringAction {
        return (
            isExplore(action) ||
            isAttemptAnomaly(action) ||
            isMine(action) ||
            isResearch(action) ||
            isTerraformWithShip(action)
        )
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        const available: [ActionType, boolean][] = [
            [ActionType.Explore, canExploreAnyShip(state, playerId)],
            [ActionType.AttemptAnomaly, attemptableSystemIds(state, playerId).length > 0],
            [ActionType.Mine, canOperateAnyShip(state, playerId, OperationKind.Mining)],
            [ActionType.Research, canOperateAnyShip(state, playerId, OperationKind.Research)],
            [
                ActionType.TerraformWithShip,
                state.shipsOf(playerId).some((ship) => shipTerraformSlots(state, ship).length > 0)
            ]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }
}
