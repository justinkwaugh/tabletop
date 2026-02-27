import {
    assert,
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'
import { HydratedPlaceCity, isPlaceCity } from '../actions/placeCity.js'
import {
    HydratedPlaceCompanyDeeds,
    isPlaceCompanyDeeds,
    PlaceCompanyDeeds
} from '../actions/placeCompanyDeeds.js'
import {
    HydratedRemoveCompanyDeed,
    isRemoveCompanyDeed
} from '../actions/removeCompanyDeed.js'
import { HydratedIndonesiaGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { Era } from '../definition/eras.js'

type NewEraAction =
    | HydratedPlaceCompanyDeeds
    | HydratedPlaceCity
    | HydratedPass
    | HydratedRemoveCompanyDeed

export class NewEraStateHandler implements MachineStateHandler<
    NewEraAction,
    HydratedIndonesiaGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): action is NewEraAction {
        // Leave this comment if you want the template to generate code for valid actions
        return (
            isPlaceCompanyDeeds(action) ||
            isPlaceCity(action) ||
            isPass(action) ||
            isRemoveCompanyDeed(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedIndonesiaGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions: ActionType[] = []

        if (HydratedPlaceCity.canPlaceCity(gameState, playerId)) {
            validActions.push(ActionType.PlaceCity)
        } else {
            validActions.push(ActionType.Pass)
        }

        return validActions
    }

    enter(context: MachineContext<HydratedIndonesiaGameState>) {
        const gameState = context.gameState
        const phaseManager = gameState.phaseManager

        if (phaseManager.currentPhase?.name !== PhaseName.NewEra) {
            phaseManager.startPhase(PhaseName.NewEra, gameState.actionCount)
            gameState.placingCities = [...gameState.turnManager.turnOrder]
            const firstPlacingPlayerId = gameState.placingCities[0]
            assertExists(
                firstPlacingPlayerId,
                'No first placing player found while entering New Era'
            )
            if (
                gameState.era !== Era.A &&
                HydratedPlaceCompanyDeeds.canPlaceCompanyDeeds(gameState) &&
                !this.hasPendingPlaceCompanyDeeds(context)
            ) {
                context.addSystemAction(PlaceCompanyDeeds)
            }

            if (gameState.numPlayers === 2) {
                // In a 2 player game, each player places 2 cities in the new era, so we need to double the array
                gameState.placingCities.push(...gameState.placingCities)
            }
        }

        const nextPlayerId = gameState.placingCities.at(0)
        assertExists(nextPlayerId, 'No next player found for New Era phase')
        gameState.turnManager.startTurn(nextPlayerId, gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]

        const playerState = gameState.getPlayerState(nextPlayerId)
        const placementsPerPlayer = gameState.numPlayers === 2 ? 2 : 1
        const remainingPlacementsForPlayer = gameState.placingCities.filter(
            (playerId) => playerId === nextPlayerId
        ).length
        const completedPlacementsForPlayer = placementsPerPlayer - remainingPlacementsForPlayer
        assert(
            completedPlacementsForPlayer >= 0,
            `Completed placement count for player ${nextPlayerId} should be non-negative`
        )

        const currentCardForPlacement =
            playerState.cityCards[gameState.era][completedPlacementsForPlayer]
        assertExists(
            currentCardForPlacement,
            `Player ${nextPlayerId} has no city card for era ${gameState.era} at placement ${completedPlacementsForPlayer}`
        )
        gameState.currentCityCard = currentCardForPlacement

        if (
            !HydratedPlaceCity.canPlaceCity(gameState, nextPlayerId) &&
            !this.hasPendingCannotPlaceCityPass(context, nextPlayerId)
        ) {
            context.addSystemAction(Pass, {
                playerId: nextPlayerId,
                reason: PassReason.CannotPlaceCity
            })
        }
    }

    onAction(
        action: NewEraAction,
        context: MachineContext<HydratedIndonesiaGameState>
    ): MachineState {
        switch (true) {
            case isPlaceCompanyDeeds(action): {
                return MachineState.NewEra // Now we need to place cities
            }
            case isPlaceCity(action): {
                return this.handlePlayerActionAndReturnNextState(action, context.gameState)
            }
            case isPass(action): {
                return this.handlePlayerActionAndReturnNextState(action, context.gameState)
            }
            case isRemoveCompanyDeed(action): {
                return MachineState.NewEra
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    handlePlayerActionAndReturnNextState = (
        action: NewEraAction,
        state: HydratedIndonesiaGameState
    ): MachineState => {
        state.placingCities.shift()
        state.turnManager.endTurn(state.actionCount)

        if (state.placingCities.length === 0) {
            state.phaseManager.endPhase(state.actionCount)
            return MachineState.BiddingForTurnOrder
        } else {
            return MachineState.NewEra
        }
    }

    private hasPendingCannotPlaceCityPass(
        context: MachineContext<HydratedIndonesiaGameState>,
        playerId: string
    ): boolean {
        return context.getPendingActions().some(
            (pendingAction) =>
                isPass(pendingAction) &&
                pendingAction.playerId === playerId &&
                pendingAction.reason === PassReason.CannotPlaceCity
        )
    }

    private hasPendingPlaceCompanyDeeds(context: MachineContext<HydratedIndonesiaGameState>): boolean {
        return context.getPendingActions().some((pendingAction) => isPlaceCompanyDeeds(pendingAction))
    }
}
