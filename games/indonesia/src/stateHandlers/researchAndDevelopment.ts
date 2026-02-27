import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedResearch, isResearch } from '../actions/research.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type ResearchAndDevelopmentAction = HydratedResearch

function hasCompletedResearchTurn(state: HydratedIndonesiaGameState, playerId: string): boolean {
    const currentPhase = state.phaseManager.currentPhase
    if (!currentPhase || currentPhase.name !== PhaseName.ResearchAndDevelopment) {
        return false
    }
    return state.turnManager.hadTurnSinceAction(playerId, currentPhase.start)
}

export class ResearchAndDevelopmentStateHandler implements MachineStateHandler<
    ResearchAndDevelopmentAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is ResearchAndDevelopmentAction {
        return isResearch(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (
            !hasCompletedResearchTurn(gameState, playerId) &&
            HydratedResearch.canResearch(gameState, playerId)
        ) {
            validActions.push(ActionType.Research)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager

        let nextPlayerId: string | undefined
        if (phaseManager.currentPhase?.name !== PhaseName.ResearchAndDevelopment) {
            phaseManager.startPhase(PhaseName.ResearchAndDevelopment, gameState.actionCount)
            nextPlayerId = turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            const currentPhase = phaseManager.currentPhase
            assertExists(
                currentPhase,
                'Current phase should exist in Research and Development enter'
            )
            const playersStillToResearch = turnManager.turnOrder.filter(
                (playerId) => !turnManager.hadTurnSinceAction(playerId, currentPhase.start)
            )
            if (playersStillToResearch.length === 0) {
                gameState.activePlayerIds = []
                return
            }

            nextPlayerId = turnManager.nextPlayer(turnManager.lastPlayer(), (playerId) =>
                playersStillToResearch.includes(playerId)
            )
            turnManager.startTurn(nextPlayerId, gameState.actionCount)
        }

        assertExists(
            nextPlayerId,
            'There should always be a next player when entering Research and Development'
        )
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: ResearchAndDevelopmentAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState

        switch (true) {
            case isResearch(action): {
                state.turnManager.endTurn(state.actionCount)

                const currentPhase = state.phaseManager.currentPhase
                assertExists(
                    currentPhase,
                    'Current phase should exist while handling Research action'
                )
                const allPlayersResearched = state.turnManager.turnOrder.every((playerId) =>
                    state.turnManager.hadTurnSinceAction(playerId, currentPhase.start)
                )
                if (allPlayersResearched) {
                    state.phaseManager.endPhase(state.actionCount)
                    const anyPlayerCanOperateCompany = state.turnManager.turnOrder.some((playerId) =>
                        state.canPlayerOperateAnyCompany(playerId)
                    )
                    if (!anyPlayerCanOperateCompany) {
                        if (state.canAnyCityGrow()) {
                            return MachineState.CityGrowth
                        }
                        return MachineState.NewEra
                    }
                    return MachineState.Operations
                }

                return MachineState.ResearchAndDevelopment
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
