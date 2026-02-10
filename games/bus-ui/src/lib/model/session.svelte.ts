import { GameSession } from '@tabletop/frontend-components'
import {
    type HydratedBusGameState,
    type BusGameState,
    type BuildingSiteId,
    MachineState
} from '@tabletop/bus'

export class BusGameSession extends GameSession<BusGameState, HydratedBusGameState> {
    chosenSite: string | undefined = $state()

    isInitialBuildingPlacement = $derived(
        this.gameState.machineState === MachineState.InitialBuildingPlacement
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
}
