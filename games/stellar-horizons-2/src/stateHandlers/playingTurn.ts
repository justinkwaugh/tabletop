import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedBuildShip, isBuildShip } from '../actions/buildShip.js'
import { HydratedCloneSettlement, isCloneSettlement } from '../actions/cloneSettlement.js'
import { HydratedDevelopTech, isDevelopTech } from '../actions/developTech.js'
import { HydratedEndStep, isEndStep } from '../actions/endStep.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { HydratedMoveShip, isMoveShip } from '../actions/moveShip.js'
import { HydratedRepairShip, isRepairShip } from '../actions/repairShip.js'
import { HydratedScrapShip, isScrapShip } from '../actions/scrapShip.js'
import { HydratedTransferCargo, isTransferCargo } from '../actions/transferCargo.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { activeTurnPlayers } from '../model/turnCycle.js'
import { stateAfterTurnActions } from './transitions.js'

type PlayingTurnAction =
    | HydratedBuildShip
    | HydratedRepairShip
    | HydratedScrapShip
    | HydratedCloneSettlement
    | HydratedTransferCargo
    | HydratedMoveShip
    | HydratedExplore
    | HydratedDevelopTech
    | HydratedEndStep

export class PlayingTurnStateHandler implements MachineStateHandler<
    PlayingTurnAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is PlayingTurnAction {
        return (
            isBuildShip(action) ||
            isRepairShip(action) ||
            isScrapShip(action) ||
            isCloneSettlement(action) ||
            isTransferCargo(action) ||
            isMoveShip(action) ||
            isExplore(action) ||
            isDevelopTech(action) ||
            isEndStep(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        const available: [ActionType, boolean][] = [
            [ActionType.BuildShip, HydratedBuildShip.canBuildShip(state, playerId)],
            [ActionType.RepairShip, HydratedRepairShip.canRepairShip(state, playerId)],
            [
                ActionType.CloneSettlement,
                HydratedCloneSettlement.canCloneSettlement(state, playerId)
            ],
            [ActionType.TransferCargo, HydratedTransferCargo.canTransferCargo(state, playerId)],
            [ActionType.MoveShip, HydratedMoveShip.canMoveShip(state, playerId)],
            [ActionType.Explore, HydratedExplore.canExplore(state, playerId)],
            [ActionType.DevelopTech, HydratedDevelopTech.canDevelopTech(state, playerId)],
            [ActionType.ScrapShip, HydratedScrapShip.canScrapShip(state, playerId)],
            [ActionType.EndStep, HydratedEndStep.canEndStep(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        state.activePlayerIds = activeTurnPlayers(state)
    }

    onAction(
        _action: PlayingTurnAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return activeTurnPlayers(state).length > 0
            ? MachineState.PlayingTurn
            : stateAfterTurnActions(state)
    }
}
