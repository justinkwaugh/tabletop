import {
    assertExists,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { City } from '../components/city.js'
import { GrowCity, HydratedGrowCity, isGrowCity } from '../actions/growCity.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import {
    HydratedRemoveCompanyDeed,
    isRemoveCompanyDeed
} from '../actions/removeCompanyDeed.js'
import { resolvePostOperationsState } from './operationsFlow.js'

type CityGrowthAction = HydratedGrowCity | HydratedRemoveCompanyDeed

export class CityGrowthStateHandler
    implements MachineStateHandler<CityGrowthAction, HydratedIndonesiaGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedIndonesiaGameState>
    ): action is CityGrowthAction {
        return isGrowCity(action) || isRemoveCompanyDeed(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState
        const validActions: ActionType[] = []

        if (HydratedGrowCity.canGrowCity(gameState, playerId)) {
            validActions.push(ActionType.GrowCity)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const growthDecisionPlayerId = gameState.cityGrowthDecisionPlayerId()
        assertExists(
            growthDecisionPlayerId,
            'A turn-order leader should exist while entering CityGrowth'
        )

        if (gameState.phaseManager.currentPhase?.name !== PhaseName.CityGrowth) {
            gameState.phaseManager.startPhase(PhaseName.CityGrowth, gameState.actionCount)
        }

        const automaticCityId = this.resolveAutomaticCityGrowthId(gameState)
        if (automaticCityId) {
            // Automatic growth does not open a player turn.
            gameState.activePlayerIds = [growthDecisionPlayerId]
            if (!this.hasPendingGrowCity(context, automaticCityId)) {
                context.addSystemAction(GrowCity, {
                    cityId: automaticCityId
                })
            }
            return
        }

        // Player turn exists only when a choice is required.
        if (!gameState.turnManager.currentTurn()) {
            gameState.turnManager.startTurn(growthDecisionPlayerId, gameState.actionCount)
        }
        gameState.activePlayerIds = [growthDecisionPlayerId]
    }

    onAction(action: CityGrowthAction, context: MachineContext<HydratedIndonesiaGameState>): MachineState {
        const state = context.gameState
        switch (true) {
            case isGrowCity(action): {
                if (HydratedGrowCity.canGrowCity(state, action.playerId)) {
                    return MachineState.CityGrowth
                }

                this.completeCityGrowth(state)
                return resolvePostOperationsState(state, context)
            }
            case isRemoveCompanyDeed(action): {
                return MachineState.CityGrowth
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private completeCityGrowth(state: HydratedIndonesiaGameState): void {
        state.resetCityDemandsForOperationsPhase()
        if (state.turnManager.currentTurn()) {
            state.turnManager.endTurn(state.actionCount)
        }
        state.phaseManager.endPhase(state.actionCount)
        state.activePlayerIds = []
    }

    private resolveAutomaticCityGrowthId(state: HydratedIndonesiaGameState): string | undefined {
        const eligibleCities = state.cityGrowthEligibleCities()
        if (eligibleCities.length === 0) {
            return undefined
        }

        const size2Cities = eligibleCities.filter((city) => city.size === 2)
        if (size2Cities.length > 0) {
            if (size2Cities.length > state.availableCities.size3) {
                return undefined
            }
            return this.firstCityId(size2Cities)
        }

        const size1Cities = eligibleCities.filter((city) => city.size === 1)
        if (size1Cities.length > 0) {
            if (size1Cities.length > state.availableCities.size2) {
                return undefined
            }
            return this.firstCityId(size1Cities)
        }

        return undefined
    }

    private firstCityId(cities: City[]): string | undefined {
        return cities[0]?.id
    }

    private hasPendingGrowCity(
        context: MachineContext<HydratedIndonesiaGameState>,
        cityId: string
    ): boolean {
        return context.getPendingActions().some(
            (pendingAction) => isGrowCity(pendingAction) && pendingAction.cityId === cityId
        )
    }
}
