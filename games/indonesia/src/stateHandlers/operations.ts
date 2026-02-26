import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import {
    HydratedChooseOperatingCompany,
    isChooseOperatingCompany
} from '../actions/chooseOperatingCompany.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { CompanyType } from '../definition/companyType.js'

type OperationsAction = HydratedChooseOperatingCompany

function canOperateCompany(state: HydratedIndonesiaGameState, playerId: string): boolean {
    return state.companies.some((company) => company.owner === playerId)
}

function hasCompletedOperationsTurn(state: HydratedIndonesiaGameState, playerId: string): boolean {
    if (!canOperateCompany(state, playerId)) {
        return true
    }
    const currentPhase = state.phaseManager.currentPhase
    if (!currentPhase || currentPhase.name !== PhaseName.Operations) {
        return false
    }
    return state.turnManager.hadTurnSinceAction(playerId, currentPhase.start)
}

export class OperationsStateHandler implements MachineStateHandler<
    OperationsAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is OperationsAction {
        return isChooseOperatingCompany(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (!hasCompletedOperationsTurn(gameState, playerId)) {
            if (HydratedChooseOperatingCompany.canChooseOperatingCompany(gameState, playerId)) {
                validActions.push(ActionType.ChooseOperatingCompany)
            }
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager

        let nextPlayerId: string | undefined
        let lastPlayerId: string | undefined
        if (phaseManager.currentPhase?.name !== PhaseName.Operations) {
            phaseManager.startPhase(PhaseName.Operations, gameState.actionCount)
            gameState.operatingCompanyId = undefined
        } else {
            lastPlayerId = turnManager.lastPlayer()
        }
        nextPlayerId = turnManager.nextPlayer(lastPlayerId, (playerId) =>
            canOperateCompany(gameState, playerId)
        )
        turnManager.startTurn(nextPlayerId, gameState.actionCount)
        assertExists(nextPlayerId, 'There should always be a next player when entering Operations')
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

                return MachineState.ProductionOperaions
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
