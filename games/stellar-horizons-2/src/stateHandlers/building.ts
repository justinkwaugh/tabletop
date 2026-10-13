import type { HydratedAction } from '@tabletop/common'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedCloneSettlement, isCloneSettlement } from '../actions/cloneSettlement.js'
import { HydratedRepairShip, isRepairShip } from '../actions/repairShip.js'
import { ActionType } from '../definition/actions.js'
import { canBuildAnyShip, canRepairAnyShip, cloningBases } from '../model/building.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { PlayStateHandler } from './playing.js'

type BuildingAction = HydratedBuildShip | HydratedRepairShip | HydratedCloneSettlement

export class BuildingStateHandler extends PlayStateHandler<BuildingAction> {
    protected readonly phase = TurnPhase.Build

    protected isPhaseAction(action: HydratedAction): action is BuildingAction {
        return isBuildShip(action) || isRepairShip(action) || isCloneSettlement(action)
    }

    protected phaseActions(playerId: string, state: HydratedStellarHorizonsGameState) {
        const available: [ActionType, boolean][] = [
            [ActionType.BuildShip, canBuildAnyShip(state, playerId)],
            [ActionType.RepairShip, canRepairAnyShip(state, playerId)],
            [ActionType.CloneSettlement, cloningBases(state, playerId).length > 0]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }
}
