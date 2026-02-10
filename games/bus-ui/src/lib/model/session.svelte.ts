import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    BuildingType,
    PlaceBuilding,
    type HydratedBusGameState,
    type BusGameState,
    type BuildingSiteId,
    MachineState
} from '@tabletop/bus'

export class BusGameSession extends GameSession<BusGameState, HydratedBusGameState> {
    chosenSite: BuildingSiteId | undefined = $state()

    isInitialBuildingPlacement = $derived(
        this.gameState.machineState === MachineState.InitialBuildingPlacement
    )
    isInitialBusLinePlacement = $derived(
        this.gameState.machineState === MachineState.InitialBusLinePlacement
    )

    back() {
        if (this.isInitialBuildingPlacement) {
            if (this.chosenSite) {
                this.chosenSite = undefined
            }
        }
    }

    resetAction() {
        this.chosenSite = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    async placeBuilding(siteId: BuildingSiteId, buildingType: BuildingType) {
        if (!this.validActionTypes.includes(ActionType.PlaceBuilding)) {
            return
        }

        const action = this.createPlayerAction(PlaceBuilding, {
            siteId,
            buildingType
        })

        await this.applyAction(action)
    }
}
