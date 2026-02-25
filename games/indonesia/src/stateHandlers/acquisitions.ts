import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedStartCompany, isStartCompany } from '../actions/startCompany.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type AcquisitionsAction = HydratedStartCompany

export class AcquisitionsStateHandler implements MachineStateHandler<
    AcquisitionsAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is AcquisitionsAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isStartCompany(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        if (HydratedStartCompany.canStartCompany(gameState, playerId)) {
            validActions.push(ActionType.StartCompany)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager
        const canStartCompany = (playerId: string) =>
            HydratedStartCompany.canStartCompany(gameState, playerId)

        const playersWhoCanStart = turnManager.turnOrder.filter((playerId) =>
            canStartCompany(playerId)
        )
        assert(
            playersWhoCanStart.length > 0,
            'At least one player should be able to start a company when entering the Acquisitions state'
        )

        let nextPlayerId: string | undefined
        if (phaseManager.currentPhase?.name !== PhaseName.Acquisitions) {
            phaseManager.startPhase(PhaseName.Acquisitions, gameState.actionCount)
            nextPlayerId = playersWhoCanStart[0]
            turnManager.startTurn(nextPlayerId, gameState.actionCount)
        } else {
            nextPlayerId = turnManager.nextPlayer(turnManager.lastPlayer(), canStartCompany)
            turnManager.startTurn(nextPlayerId, gameState.actionCount)
        }

        assertExists(
            nextPlayerId,
            'There should always be a next player when entering the Acquisitions state'
        )
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(
        action: AcquisitionsAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        const state = context.gameState

        switch (true) {
            case isStartCompany(action): {
                state.turnManager.endTurn(state.actionCount)

                const anyPlayerCanStartCompany = state.turnManager.turnOrder.some((playerId) =>
                    HydratedStartCompany.canStartCompany(state, playerId)
                )
                if (!anyPlayerCanStartCompany) {
                    state.phaseManager.endPhase(state.actionCount)
                    state.activePlayerIds = []
                    return MachineState.ResearchAndDevelopment
                }

                return MachineState.Acquisitions
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
