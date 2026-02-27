import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    type AtomicDeliveryCandidate,
    ChooseOperatingCompany,
    CompanyType,
    DeliverGood,
    Expand,
    GrowCity,
    listSafeAtomicDeliveryCandidatesForPlayer,
    MachineState,
    PlaceCity,
    PlaceTurnOrderBid,
    Pass,
    PassReason,
    Research,
    ResearchArea,
    StartCompany,
    HydratedChooseOperatingCompany,
    type HydratedIndonesiaGameState,
    type IndonesiaGameState
} from '@tabletop/indonesia'

export class IndonesiaGameSession extends GameSession<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {
    selectedResearchPlayerIdOverride: string | undefined = $state()
    hoveredOperatingCompanyIdOverride: string | undefined = $state()
    selectedDeliveryCultivatedAreaIdOverride: string | undefined = $state()
    selectedDeliveryCityIdOverride: string | undefined = $state()
    hoveredDeliveryRouteKeyOverride: string | undefined = $state()

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

    operableOwnedCompanyIds: string[] = $derived.by(() => {
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return []
        }
        if (this.gameState.machineState !== MachineState.Operations) {
            return []
        }
        if (!this.validActionTypes.includes(ActionType.ChooseOperatingCompany)) {
            return []
        }

        return this.gameState.companies
            .filter(
                (company) =>
                    company.owner === myPlayerId &&
                    HydratedChooseOperatingCompany.canChooseSpecificCompany(
                        this.gameState,
                        myPlayerId,
                        company.id
                    )
            )
            .map((company) => company.id)
    })

    deliverySelectionEnabled = $derived.by(
        () =>
            this.isMyTurn &&
            this.gameState.machineState === MachineState.ProductionOperations &&
            this.validActionTypes.includes(ActionType.DeliverGood)
    )

    midAction = $derived.by(
        () =>
            !!this.selectedDeliveryCultivatedAreaIdOverride ||
            !!this.selectedDeliveryCityIdOverride ||
            !!this.selectedResearchPlayerIdOverride
    )

    safeDeliveryCandidates: AtomicDeliveryCandidate[] = $derived.by(() => {
        if (!this.deliverySelectionEnabled) {
            return []
        }

        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return []
        }

        return listSafeAtomicDeliveryCandidatesForPlayer(this.gameState, myPlayerId)
    })

    deliveryAvailableCultivatedAreaIds: string[] = $derived.by(() => {
        const areaIdSet = new Set<string>()
        for (const candidate of this.safeDeliveryCandidates) {
            areaIdSet.add(candidate.cultivatedAreaId)
        }

        return [...areaIdSet].sort((a, b) => a.localeCompare(b))
    })

    selectedDeliveryCultivatedAreaId: string | null = $derived.by(() => {
        const selectedAreaId = this.selectedDeliveryCultivatedAreaIdOverride
        if (!selectedAreaId) {
            return null
        }

        return this.deliveryAvailableCultivatedAreaIds.includes(selectedAreaId)
            ? selectedAreaId
            : null
    })

    deliveryAvailableCityIds: string[] = $derived.by(() => {
        const selectedAreaId = this.selectedDeliveryCultivatedAreaId
        if (!selectedAreaId) {
            return []
        }

        const cityIdSet = new Set<string>()
        for (const candidate of this.safeDeliveryCandidates) {
            if (candidate.cultivatedAreaId !== selectedAreaId) {
                continue
            }
            cityIdSet.add(candidate.cityId)
        }

        return [...cityIdSet].sort((a, b) => a.localeCompare(b))
    })

    selectedDeliveryCityId: string | null = $derived.by(() => {
        const selectedCityId = this.selectedDeliveryCityIdOverride
        if (!selectedCityId) {
            return null
        }

        return this.deliveryAvailableCityIds.includes(selectedCityId) ? selectedCityId : null
    })

    deliveryShippingChoices: { routeKey: string; candidate: AtomicDeliveryCandidate }[] = $derived.by(() => {
        const selectedAreaId = this.selectedDeliveryCultivatedAreaId
        const selectedCityId = this.selectedDeliveryCityId
        if (!selectedAreaId || !selectedCityId) {
            return []
        }

        return this.safeDeliveryCandidates
            .filter(
                (candidate) =>
                    candidate.cultivatedAreaId === selectedAreaId && candidate.cityId === selectedCityId
            )
            .map((candidate) => ({
                routeKey: `${candidate.shippingCompanyId}|${candidate.seaAreaIds.join('>')}`,
                candidate
            }))
            .sort((choiceA, choiceB) => choiceA.routeKey.localeCompare(choiceB.routeKey))
    })

    hoveredDeliveryShippingChoice: { routeKey: string; candidate: AtomicDeliveryCandidate } | null =
        $derived.by(() => {
            const hoveredRouteKey = this.hoveredDeliveryRouteKeyOverride
            if (!hoveredRouteKey) {
                return null
            }

            return (
                this.deliveryShippingChoices.find((choice) => choice.routeKey === hoveredRouteKey) ?? null
            )
        })

    deliverySelectionStage: 'cultivated' | 'city' | 'shipping' | 'none' = $derived.by(() => {
        if (!this.deliverySelectionEnabled) {
            return 'none'
        }

        if (!this.selectedDeliveryCultivatedAreaId) {
            return 'cultivated'
        }

        if (!this.selectedDeliveryCityId) {
            return 'city'
        }

        return 'shipping'
    })

    productionOperationStage: 'none' | 'delivery' | 'mandatory-expansion' | 'optional-expansion' =
        $derived.by(() => {
            if (this.gameState.machineState !== MachineState.ProductionOperations) {
                return 'none'
            }

            const deliveryTarget = this.gameState.operatingCompanyDeliveryPlan?.totalDelivered
            if (deliveryTarget === undefined) {
                return 'none'
            }

            const shippedGoodsCount = this.gameState.operatingCompanyShippedGoodsCount ?? 0
            if (shippedGoodsCount < deliveryTarget) {
                return 'delivery'
            }

            const producedGoodsCount = this.gameState.operatingCompanyProducedGoodsCount
            if (producedGoodsCount === undefined) {
                return 'none'
            }

            return deliveryTarget >= producedGoodsCount ? 'mandatory-expansion' : 'optional-expansion'
        })

    deliveryAvailableCityAreaIds: string[] = $derived.by(() => {
        const cityAreaIds: string[] = []
        for (const cityId of this.deliveryAvailableCityIds) {
            const city = this.gameState.board.cities.find((entry) => entry.id === cityId)
            if (!city) {
                continue
            }
            cityAreaIds.push(city.area)
        }
        return cityAreaIds
    })

    deliveryShippingChoiceSeaAreaIds: string[] = $derived.by(() => {
        const seaAreaIdSet = new Set<string>()
        for (const choice of this.deliveryShippingChoices) {
            for (const seaAreaId of choice.candidate.seaAreaIds) {
                seaAreaIdSet.add(seaAreaId)
            }
        }

        return [...seaAreaIdSet].sort((a, b) => a.localeCompare(b))
    })

    hoveredDeliveryRouteSeaAreaIds: string[] = $derived.by(() => {
        const hoveredChoice = this.hoveredDeliveryShippingChoice
        if (!hoveredChoice) {
            return []
        }

        return hoveredChoice.candidate.seaAreaIds
    })

    resetAction(): void {
        this.selectedResearchPlayerIdOverride = undefined
        this.hoveredOperatingCompanyIdOverride = undefined
        this.selectedDeliveryCultivatedAreaIdOverride = undefined
        this.selectedDeliveryCityIdOverride = undefined
        this.hoveredDeliveryRouteKeyOverride = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    back(): void {
        if (this.selectedDeliveryCityIdOverride) {
            this.selectedDeliveryCityIdOverride = undefined
            this.hoveredDeliveryRouteKeyOverride = undefined
            return
        }

        if (this.selectedDeliveryCultivatedAreaIdOverride) {
            this.selectedDeliveryCultivatedAreaIdOverride = undefined
            this.selectedDeliveryCityIdOverride = undefined
            this.hoveredDeliveryRouteKeyOverride = undefined
            return
        }

        if (this.selectedResearchPlayerIdOverride) {
            this.selectedResearchPlayerIdOverride = undefined
        }
    }

    override async undo(): Promise<void> {
        if (this.midAction) {
            this.back()
            return
        }

        await super.undo()
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
        if (
            !HydratedChooseOperatingCompany.canChooseSpecificCompany(
                this.gameState,
                this.myPlayer.id,
                company.id
            )
        ) {
            return
        }
        if (company.type !== CompanyType.Shipping) {
            this.hoveredOperatingCompanyIdOverride = undefined
            return
        }

        this.hoveredOperatingCompanyIdOverride = companyId
    }

    selectDeliveryCultivatedArea(areaId: string): void {
        if (!this.deliverySelectionEnabled) {
            return
        }
        if (!this.deliveryAvailableCultivatedAreaIds.includes(areaId)) {
            return
        }

        this.selectedDeliveryCultivatedAreaIdOverride = areaId
        this.selectedDeliveryCityIdOverride = undefined
        this.hoveredDeliveryRouteKeyOverride = undefined
    }

    selectDeliveryCity(cityId: string): void {
        if (!this.deliverySelectionEnabled) {
            return
        }
        if (!this.selectedDeliveryCultivatedAreaId) {
            return
        }
        if (!this.deliveryAvailableCityIds.includes(cityId)) {
            return
        }

        this.selectedDeliveryCityIdOverride = cityId
        this.hoveredDeliveryRouteKeyOverride = undefined
    }

    setHoveredDeliveryRoute(routeKey: string | undefined): void {
        if (!routeKey) {
            this.hoveredDeliveryRouteKeyOverride = undefined
            return
        }
        if (this.deliverySelectionStage !== 'shipping') {
            return
        }
        if (!this.deliveryShippingChoices.some((choice) => choice.routeKey === routeKey)) {
            return
        }

        this.hoveredDeliveryRouteKeyOverride = routeKey
    }

    async deliverGoodForRoute(routeKey: string): Promise<void> {
        if (!this.deliverySelectionEnabled) {
            return
        }

        const choice = this.deliveryShippingChoices.find((entry) => entry.routeKey === routeKey)
        if (!choice) {
            return
        }

        await this.deliverGood(
            choice.candidate.cultivatedAreaId,
            choice.candidate.shippingCompanyId,
            choice.candidate.seaAreaIds,
            choice.candidate.cityId
        )
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

    async growCity(cityId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.GrowCity)) {
            return
        }

        const action = this.createPlayerAction(GrowCity, {
            type: ActionType.GrowCity,
            cityId
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

    async deliverGood(
        cultivatedAreaId: string,
        shippingCompanyId: string,
        seaAreaIds: string[],
        cityId: string
    ): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.DeliverGood)) {
            return
        }

        const action = this.createPlayerAction(DeliverGood, {
            type: ActionType.DeliverGood,
            cultivatedAreaId,
            shippingCompanyId,
            seaAreaIds,
            cityId
        })
        await this.applyAction(action)
    }

    async chooseOperatingCompany(companyId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.ChooseOperatingCompany)) {
            return
        }
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return
        }
        if (
            !HydratedChooseOperatingCompany.canChooseSpecificCompany(
                this.gameState,
                myPlayerId,
                companyId
            )
        ) {
            return
        }

        const action = this.createPlayerAction(ChooseOperatingCompany, {
            type: ActionType.ChooseOperatingCompany,
            companyId
        })
        await this.applyAction(action)
    }

    async pass(reason: PassReason): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.Pass)) {
            return
        }

        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return
        }
        if (!this.gameState.activePlayerIds.includes(myPlayerId)) {
            return
        }

        const action = this.createPlayerAction(Pass, {
            type: ActionType.Pass,
            reason
        })
        await this.applyAction(action)
    }

    async expand(areaId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.Expand)) {
            return
        }

        const action = this.createPlayerAction(Expand, {
            type: ActionType.Expand,
            areaId
        })
        await this.applyAction(action)
    }

    async finishOptionalProductionExpansion(): Promise<void> {
        await this.pass(PassReason.FinishOptionalProductionExpansion)
    }
}
