import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    ChooseOperatingCompany,
    CompanyType,
    DeliverGood,
    Expand,
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
    hoveredOperatingCompanyIdOverride: string | undefined = $state()

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

    hoveredOperatingCompanyId: string | null = $derived.by(() => {
        const hoveredCompanyId = this.hoveredOperatingCompanyIdOverride
        if (!hoveredCompanyId) {
            return null
        }

        const company = this.gameState.companies.find((entry) => entry.id === hoveredCompanyId)
        if (!company) {
            return null
        }

        return company.id
    })

    resetAction(): void {
        this.selectedResearchPlayerIdOverride = undefined
        this.hoveredOperatingCompanyIdOverride = undefined
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

    setHoveredOperatingCompany(companyId: string | undefined): void {
        if (!companyId) {
            this.hoveredOperatingCompanyIdOverride = undefined
            return
        }

        if (!this.isMyTurn || this.gameState.machineState !== MachineState.Operations) {
            return
        }

        if (!this.validActionTypes.includes(ActionType.ChooseOperatingCompany)) {
            return
        }

        const company = this.gameState.companies.find((entry) => entry.id === companyId)
        if (!company) {
            return
        }
        if (company.owner !== this.myPlayer?.id) {
            return
        }
        if (company.type !== CompanyType.Shipping) {
            this.hoveredOperatingCompanyIdOverride = undefined
            return
        }

        this.hoveredOperatingCompanyIdOverride = companyId
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

    async chooseOperatingCompany(companyId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.ChooseOperatingCompany)) {
            return
        }

        const action = this.createPlayerAction(ChooseOperatingCompany, {
            type: ActionType.ChooseOperatingCompany,
            companyId
        })
        await this.applyAction(action)
    }

    async expand(): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.Expand)) {
            return
        }

        const action = this.createPlayerAction(Expand, {
            type: ActionType.Expand
        })
        await this.applyAction(action)
    }
}
