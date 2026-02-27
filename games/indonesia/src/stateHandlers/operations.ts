import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedChooseOperatingCompany,
    isChooseOperatingCompany
} from '../actions/chooseOperatingCompany.js'
import {
    HydratedRemoveCompanyDeed,
    isRemoveCompanyDeed
} from '../actions/removeCompanyDeed.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { CompanyType } from '../definition/companyType.js'

type OperationsAction = HydratedChooseOperatingCompany | HydratedRemoveCompanyDeed

export class OperationsStateHandler implements MachineStateHandler<
    OperationsAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is OperationsAction {
        return isChooseOperatingCompany(action) || isRemoveCompanyDeed(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (HydratedChooseOperatingCompany.canChooseOperatingCompany(gameState, playerId)) {
            validActions.push(ActionType.ChooseOperatingCompany)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager

        const enteringPhase = phaseManager.currentPhase?.name !== PhaseName.Operations
        if (enteringPhase) {
            phaseManager.startPhase(PhaseName.Operations, gameState.actionCount)
            gameState.resetOperationsTracking()
            gameState.resetCityDemandsForOperationsPhase()
        }

        const playersWhoCanOperate = turnManager.turnOrder.filter((playerId) =>
            gameState.canPlayerOperateAnyCompany(playerId)
        )
        if (playersWhoCanOperate.length === 0) {
            gameState.activePlayerIds = []
            return
        }

        let nextPlayerId: string | undefined
        if (enteringPhase) {
            nextPlayerId = playersWhoCanOperate[0]
        } else {
            nextPlayerId = turnManager.nextPlayer(turnManager.lastPlayer(), (playerId) =>
                gameState.canPlayerOperateAnyCompany(playerId)
            )
        }
        assertExists(nextPlayerId, 'There should always be a next player when entering Operations')
        turnManager.startTurn(nextPlayerId, gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: OperationsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState

        switch (true) {
            case isChooseOperatingCompany(action): {
                const operatingCompany = state.companies.find(
                    (company) => company.id === action.companyId
                )
                assertExists(
                    operatingCompany,
                    'Operating company should exist while handling ChooseOperatingCompany'
                )

                if (operatingCompany.type === CompanyType.Shipping) {
                    return MachineState.ShippingOperations
                }

                return MachineState.ProductionOperations
            }
            case isRemoveCompanyDeed(action): {
                return MachineState.Operations
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
