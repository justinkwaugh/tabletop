import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    MachineState,
    PlaceCity,
    PlaceTurnOrderBid,
    Research,
    StartCompany,
    type HydratedIndonesiaGameState,
    type IndonesiaGameState
} from '@tabletop/indonesia'

export class IndonesiaGameSession extends GameSession<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {
    isNewEra = $derived(this.gameState.machineState === MachineState.NewEra)

    async placeTurnOrderBid(amount: number): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.PlaceTurnOrderBid)) {
            return
        }

        const action = this.createPlayerAction(PlaceTurnOrderBid, {
            type: ActionType.PlaceTurnOrderBid,
            amount
        })
        await this.applyAction(action)
    }

    async placeCity(areaId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.PlaceCity)) {
            return
        }

        const action = this.createPlayerAction(PlaceCity, {
            type: ActionType.PlaceCity,
            areaId
        })
        await this.applyAction(action)
    }

    async startCompany(deedId: string, areaId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.StartCompany)) {
            return
        }

        const action = this.createPlayerAction(StartCompany, {
            type: ActionType.StartCompany,
            deedId,
            areaId
        })
        await this.applyAction(action)
    }

    async research(): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.Research)) {
            return
        }

        const action = this.createPlayerAction(Research, {
            type: ActionType.Research
        })
        await this.applyAction(action)
    }
}
