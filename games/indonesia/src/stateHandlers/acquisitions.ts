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
import {
    HydratedRemoveCompanyDeed,
    isRemoveCompanyDeed
} from '../actions/removeCompanyDeed.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'

type AcquisitionsAction = HydratedStartCompany | HydratedPass | HydratedRemoveCompanyDeed

export class AcquisitionsStateHandler implements MachineStateHandler<
    AcquisitionsAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is AcquisitionsAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isStartCompany(action) || isPass(action) || isRemoveCompanyDeed(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        if (this.canPlayerTakeAcquisitionsTurn(gameState, playerId)) {
            validActions.push(ActionType.StartCompany)
            validActions.push(ActionType.Pass)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const turnManager = gameState.turnManager
        const phaseManager = gameState.phaseManager
        const canTakeAcquisitionsTurn = (playerId: string) =>
            this.canPlayerTakeAcquisitionsTurn(gameState, playerId)
        const enteringPhase = phaseManager.currentPhase?.name !== PhaseName.Acquisitions

        if (enteringPhase) {
            phaseManager.startPhase(PhaseName.Acquisitions, gameState.actionCount)
            gameState.resetAcquisitionsPasses()
        }

        const playersWhoCanStart = turnManager.turnOrder.filter((playerId) =>
            canTakeAcquisitionsTurn(playerId)
        )
        assert(
            playersWhoCanStart.length > 0,
            'At least one player should be able to start a company when entering the Acquisitions state'
        )

        let nextPlayerId: string | undefined
        if (enteringPhase) {
            nextPlayerId = playersWhoCanStart[0]
            turnManager.startTurn(nextPlayerId, gameState.actionCount)
        } else {
            nextPlayerId = turnManager.nextPlayer(turnManager.lastPlayer(), canTakeAcquisitionsTurn)
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

                if (!this.hasAnyPlayerEligibleForAcquisitions(state)) {
                    state.phaseManager.endPhase(state.actionCount)
                    state.activePlayerIds = []
                    return MachineState.ResearchAndDevelopment
                }

                return MachineState.Acquisitions
            }
            case isPass(action): {
                state.markPlayerPassedAcquisitions(action.playerId)
                state.turnManager.endTurn(state.actionCount)

                if (!this.hasAnyPlayerEligibleForAcquisitions(state)) {
                    state.phaseManager.endPhase(state.actionCount)
                    state.activePlayerIds = []
                    return MachineState.ResearchAndDevelopment
                }

                return MachineState.Acquisitions
            }
            case isRemoveCompanyDeed(action): {
                if (!this.hasAnyPlayerEligibleForAcquisitions(state)) {
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

    private canPlayerTakeAcquisitionsTurn(
        state: HydratedIndonesiaGameState,
        playerId: string
    ): boolean {
        return (
            HydratedStartCompany.canStartCompany(state, playerId) &&
            !state.hasPlayerPassedAcquisitions(playerId)
        )
    }

    private hasAnyPlayerEligibleForAcquisitions(state: HydratedIndonesiaGameState): boolean {
        return state.turnManager.turnOrder.some((playerId) =>
            this.canPlayerTakeAcquisitionsTurn(state, playerId)
        )
    }
}
