import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    DeliverGood,
    MachineState,
    PlaceCity,
    PlaceTurnOrderBid,
    Research,
    ResearchArea,
    StartCompany,
    type HydratedIndonesiaGameState,
    type IndonesiaGameState
} from '@tabletop/indonesia'

export class IndonesiaGameSession extends GameSession<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {
    selectedResearchPlayerIdOverride: string | undefined = $state()

    isNewEra = $derived(this.gameState.machineState === MachineState.NewEra)
    researchSelectionEnabled = $derived.by(
        () =>
            this.isMyTurn &&
            this.gameState.machineState === MachineState.ResearchAndDevelopment
    )

    currentResearchPlayerId: string | null = $derived.by(
        () => this.myPlayer?.id ?? this.gameState.activePlayerIds[0] ?? null
    )

    selectedResearchPlayerId: string | null = $derived.by(() => {
        const turnOrder = this.gameState.turnManager.turnOrder
        const selectedPlayerIdOverride = this.selectedResearchPlayerIdOverride
        if (selectedPlayerIdOverride && turnOrder.includes(selectedPlayerIdOverride)) {
            return selectedPlayerIdOverride
        }

        const currentPlayerId = this.currentResearchPlayerId
        if (currentPlayerId && turnOrder.includes(currentPlayerId)) {
            return currentPlayerId
        }

        return null
    })

    resetAction(): void {
        this.selectedResearchPlayerIdOverride = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    selectResearchPlayer(playerId: string): void {
        if (!this.researchSelectionEnabled) {
            return
        }
        if (!this.gameState.turnManager.turnOrder.includes(playerId)) {
            return
        }

        this.selectedResearchPlayerIdOverride = playerId
    }

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

    async research(researchArea: ResearchArea): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.Research)) {
            return
        }
        const targetPlayerId = this.selectedResearchPlayerId
        if (!targetPlayerId) {
            return
        }

        this.selectedResearchPlayerIdOverride = undefined

        const action = this.createPlayerAction(Research, {
            type: ActionType.Research,
            targetPlayerId,
            researchArea
        })
        await this.applyAction(action)
    }

    async deliverGood(): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.DeliverGood)) {
            return
        }

        const action = this.createPlayerAction(DeliverGood, {
            type: ActionType.DeliverGood
        })
        await this.applyAction(action)
    }
}
