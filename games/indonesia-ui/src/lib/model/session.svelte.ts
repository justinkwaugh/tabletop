import {
    GameSession,
    type AnimationContext,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    type AtomicDeliveryCandidate,
    ChooseOperatingCompany,
    CompanyType,
    DeliverGood,
    Era,
    Expand,
    GrowCity,
    HydratedProposeMerger,
    ProposeMerger,
    PlaceMergerBid,
    PassMergerBid,
    RemoveSiapSajiArea,
    HydratedRemoveSiapSajiArea,
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
    type IndonesiaGameState,
    IndonesiaNeighborDirection,
    IndonesiaAreaType,
    isIndonesiaNodeId
} from '@tabletop/indonesia'
import { visibleBoardCityReferenceCardEras } from '$lib/definitions/cityReferenceCardGeometry.js'
import {
    hasManualDeliverySelection,
    getDeliverySelectionValue,
    popHighestManualDeliverySelection,
    setDeliveryCitySelection,
    setDeliveryCultivatedSelection,
    type DeliverySelectionValueByStage
} from './deliverySelection.js'

type PlannedDeliveryRouteHover = {
    zoneId: string
    cityId: string
    shippingCompanyId: string
    seaAreaIds: string[]
    cultivatedAreaId?: string
}

type HoveredRoutePreviewState = {
    routeKey: string
    zoneId: string
    cityId: string
    cityAreaId: string | null
    shippingCompanyId: string
    seaAreaIds: string[]
    sourceAreaIds: string[]
    cultivatedAreaId: string | null
}

type ActiveRoutePreviewVisualState = HoveredRoutePreviewState & {
    seaAreaIdSet: ReadonlySet<string>
    sourceAreaIdSet: ReadonlySet<string>
    exemptAreaIds: string[]
    exemptAreaIdSet: ReadonlySet<string>
    dimmedLandAreaIds: string[]
    dimmedLandAreaIdSet: ReadonlySet<string>
}

type ActiveShipVisualState =
    | {
          source: 'none'
      }
    | {
          source: 'company-spotlight'
          emphasizedCompanyIds: string[]
          emphasizedCompanyIdSet: ReadonlySet<string>
      }
    | {
          source: 'route-preview'
          shippingCompanyId: string
          seaAreaIds: string[]
          seaAreaIdSet: ReadonlySet<string>
      }

type BoardPreviewIntent =
    | {
          source: 'none'
      }
    | {
          source: 'company'
          companyIds: readonly string[]
      }
    | {
          source: 'available-deed'
          deedId: string
      }
    | {
          source: 'city-reference-card'
          cardId: string
      }

type StartedCompanyAnimationEntry = {
    action: GameAction
}

export class IndonesiaGameSession extends GameSession<
    IndonesiaGameState,
    HydratedIndonesiaGameState
> {
    visibleActionOverride: GameAction | undefined = $state()
    startedCompanyAnimationEntry: StartedCompanyAnimationEntry | undefined = $state()

    selectedResearchPlayerIdOverride: string | undefined = $state()
    hoveredOperatingCompanyIdOverride: string | undefined = $state()
    hoveredCompanySpotlightCompanyIdsOverride: string[] | undefined = $state()
    hoveredAvailableDeedIdOverride: string | undefined = $state()
    selectedStartCompanyDeedIdOverride: string | undefined = $state()
    hoveredPlayerCityReferenceCardIdOverride: string | undefined = $state()
    productionZoneRenderStyleOverride: 'player' | 'goods' | undefined = $state()
    deliverySelectionOverrides: StagedSelectionState<DeliverySelectionValueByStage> = $state({})
    hoveredDeliveryCityAreaIdOverride: string | undefined = $state()
    hoveredDeliveryRouteKeyOverride: string | undefined = $state()
    hoveredPlannedDeliveryRouteOverride: PlannedDeliveryRouteHover | undefined = $state()
    suppressBoardEffectsForHistory = $derived(this.isViewingHistory)
    visibleAction = $derived.by(() => this.visibleActionOverride ?? this.currentAction)
    visibleStartedCompanyAnimationEntries = $derived.by(() => {
        const entry = this.startedCompanyAnimationEntry
        return entry ? [entry] : []
    })

    isNewEra = $derived(this.gameState.machineState === MachineState.NewEra)
    researchSelectionEnabled = $derived.by(
        () =>
            this.isMyTurn &&
            this.gameState.machineState === MachineState.ResearchAndDevelopment
    )

    startCompanySelectionEnabled = $derived.by(
        () =>
            !this.suppressBoardEffectsForHistory &&
            !!this.myPlayer?.id &&
            this.isMyTurn &&
            this.gameState.machineState === MachineState.Acquisitions &&
            this.gameState.availableDeeds.length > 0
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

    hoveredCompanySpotlightCompanyIds: string[] = $derived.by(() => {
        const candidateCompanyIds = this.hoveredCompanySpotlightCompanyIdsOverride
        if (!candidateCompanyIds || candidateCompanyIds.length === 0) {
            return []
        }

        return this.uniqueValidCompanyIds(candidateCompanyIds)
    })

    private uniqueValidCompanyIds(companyIds: readonly string[]): string[] {
        const validCompanyIds: string[] = []
        for (const companyId of companyIds) {
            if (!this.gameState.companies.some((company) => company.id === companyId)) {
                continue
            }
            if (validCompanyIds.includes(companyId)) {
                continue
            }
            validCompanyIds.push(companyId)
        }
        return validCompanyIds
    }

    private uniqueValidShippingCompanyIds(companyIds: readonly string[]): string[] {
        return this.uniqueValidCompanyIds(companyIds).filter((companyId) => {
            const company = this.gameState.companies.find((entry) => entry.id === companyId)
            return company?.type === CompanyType.Shipping
        })
    }

    private uniqueValidProductionCompanyIds(companyIds: readonly string[]): string[] {
        return this.uniqueValidCompanyIds(companyIds).filter((companyId) => {
            const company = this.gameState.companies.find((entry) => entry.id === companyId)
            return company?.type === CompanyType.Production
        })
    }

    activeCompanyPiecePreviewCompanyIds: string[] = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory) {
            return []
        }

        if (this.hoveredCompanySpotlightCompanyIds.length > 0) {
            return this.hoveredCompanySpotlightCompanyIds
        }

        const hoveredCompanyId = this.hoveredOperatingCompanyId
        if (hoveredCompanyId) {
            return [hoveredCompanyId]
        }

        return []
    })

    deliveryCultivatedBoardPreviewCompanyIds: string[] = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory || this.activeRoutePreview !== null) {
            return []
        }

        if (
            this.deliverySelectionStage === 'cultivated' &&
            this.gameState.operatingCompanyId &&
            this.gameState.companies.some(
                (company) => company.id === this.gameState.operatingCompanyId
            )
        ) {
            return [this.gameState.operatingCompanyId]
        }

        return []
    })

    activeBoardSpotlightCompanyIds: string[] = $derived.by(() => {
        if (this.cityReferenceCardPreviewWins || this.activeRoutePreview !== null) {
            return []
        }

        if (this.activeCompanyPiecePreviewCompanyIds.length > 0) {
            return this.activeCompanyPiecePreviewCompanyIds
        }

        return this.deliveryCultivatedBoardPreviewCompanyIds
    })

    activeBoardSpotlightProductionCompanyIds: string[] = $derived.by(() => {
        return this.uniqueValidProductionCompanyIds(this.activeBoardSpotlightCompanyIds)
    })

    activeBoardSpotlightShippingCompanyIds: string[] = $derived.by(() => {
        return this.uniqueValidShippingCompanyIds(this.activeBoardSpotlightCompanyIds)
    })

    activeBoardPreviewIntent: BoardPreviewIntent = $derived.by(() => {
        const hoveredCityCard = this.hoveredPlayerCityReferenceCard
        if (hoveredCityCard) {
            return {
                source: 'city-reference-card',
                cardId: hoveredCityCard.id
            }
        }

        const deedPreviewId = this.activeDeedPreviewId
        if (deedPreviewId) {
            return {
                source: 'available-deed',
                deedId: deedPreviewId
            }
        }

        if (this.activeBoardSpotlightCompanyIds.length > 0) {
            return {
                source: 'company',
                companyIds: this.activeBoardSpotlightCompanyIds
            }
        }

        return {
            source: 'none'
        }
    })

    activeShippingPiecePreviewCompanyIds: string[] = $derived.by(() => {
        return this.uniqueValidShippingCompanyIds(this.activeCompanyPiecePreviewCompanyIds)
    })

    activeShipVisualState: ActiveShipVisualState = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory || this.cityReferenceCardPreviewWins) {
            return {
                source: 'none'
            }
        }

        const activeRoutePreview = this.activeRoutePreviewVisualState
        if (activeRoutePreview) {
            return {
                source: 'route-preview',
                shippingCompanyId: activeRoutePreview.shippingCompanyId,
                seaAreaIds: [...activeRoutePreview.seaAreaIds],
                seaAreaIdSet: new Set(activeRoutePreview.seaAreaIds)
            }
        }

        const emphasizedCompanyIds =
            this.activeShippingPiecePreviewCompanyIds.length > 0
                ? this.activeShippingPiecePreviewCompanyIds
                : this.gameState.machineState === MachineState.ShippingOperations &&
                    this.validActionTypes.includes(ActionType.Expand) &&
                    this.gameState.operatingCompanyId
                  ? this.uniqueValidShippingCompanyIds([this.gameState.operatingCompanyId])
                  : []

        if (emphasizedCompanyIds.length === 0) {
            return {
                source: 'none'
            }
        }

        return {
            source: 'company-spotlight',
            emphasizedCompanyIds,
            emphasizedCompanyIdSet: new Set(emphasizedCompanyIds)
        }
    })

    selectedStartCompanyDeedId: string | null = $derived.by(() => {
        if (!this.startCompanySelectionEnabled) {
            return null
        }

        const deedId = this.selectedStartCompanyDeedIdOverride
        if (!deedId) {
            return null
        }

        const deed = this.gameState.availableDeeds.find((entry) => entry.id === deedId)
        return deed?.id ?? null
    })

    hoveredAvailableDeedId: string | null = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory) {
            return null
        }

        const hoveredDeedId = this.hoveredAvailableDeedIdOverride
        if (!hoveredDeedId) {
            return null
        }

        const deed = this.gameState.availableDeeds.find((entry) => entry.id === hoveredDeedId)
        if (!deed) {
            return null
        }

        return deed.id
    })

    activeDeedPreviewId: string | null = $derived.by(() => {
        return this.hoveredAvailableDeedId ?? this.selectedStartCompanyDeedId
    })

    hoveredPlayerCityReferenceCard = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory) {
            return null
        }

        const hoveredCardId = this.hoveredPlayerCityReferenceCardIdOverride
        const playerState = this.myPlayerState
        if (!hoveredCardId || !playerState) {
            return null
        }

        for (const era of visibleBoardCityReferenceCardEras(
            this.gameState.era,
            this.gameState.machineState
        )) {
            const card = playerState.cityCards[era][0]
            if (!card || card.id !== hoveredCardId) {
                continue
            }

            return {
                id: card.id,
                era,
                regions: [...card.regions]
            }
        }

        return null
    })

    cityReferenceCardPreviewWins: boolean = $derived.by(
        () => this.hoveredPlayerCityReferenceCard !== null
    )

    productionZoneRenderStyle: 'player' | 'goods' = $derived.by(() => {
        return this.productionZoneRenderStyleOverride ?? 'goods'
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
            !this.suppressBoardEffectsForHistory &&
            this.isMyTurn &&
            this.gameState.machineState === MachineState.ProductionOperations &&
            this.validActionTypes.includes(ActionType.DeliverGood)
    )

    midAction = $derived.by(() => {
        return (
            hasManualDeliverySelection(this.deliverySelectionOverrides) ||
            !!this.selectedStartCompanyDeedId ||
            !!this.selectedResearchPlayerIdOverride
        )
    })

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
        const selectedAreaId = getDeliverySelectionValue(
            this.deliverySelectionOverrides,
            'cultivated'
        )
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
        const selectedCityId = getDeliverySelectionValue(this.deliverySelectionOverrides, 'city')
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

    hoveredDeliveryCityAreaId: string | null = $derived.by(() => {
        const areaId = this.hoveredDeliveryCityAreaIdOverride
        if (!areaId) {
            return null
        }
        if (this.deliverySelectionStage !== 'city') {
            return null
        }
        return this.deliveryAvailableCityAreaIds.includes(areaId) ? areaId : null
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

    hoveredPlannedDeliveryRoute: PlannedDeliveryRouteHover | null = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory) {
            return null
        }

        const hoveredRoute = this.hoveredPlannedDeliveryRouteOverride
        if (!hoveredRoute || this.gameState.machineState !== MachineState.ProductionOperations) {
            return null
        }

        if (hoveredRoute.cultivatedAreaId) {
            return {
                zoneId: hoveredRoute.zoneId,
                cityId: hoveredRoute.cityId,
                shippingCompanyId: hoveredRoute.shippingCompanyId,
                seaAreaIds: [...hoveredRoute.seaAreaIds],
                cultivatedAreaId: hoveredRoute.cultivatedAreaId
            }
        }

        const matchingCandidate = this.safeDeliveryCandidates.find(
            (candidate) =>
                candidate.zoneId === hoveredRoute.zoneId &&
                candidate.cityId === hoveredRoute.cityId &&
                candidate.shippingCompanyId === hoveredRoute.shippingCompanyId &&
                candidate.seaAreaIds.length === hoveredRoute.seaAreaIds.length &&
                candidate.seaAreaIds.every(
                    (seaAreaId, index) => seaAreaId === hoveredRoute.seaAreaIds[index]
                )
        )

        if (!matchingCandidate) {
            return null
        }

        return {
            zoneId: hoveredRoute.zoneId,
            cityId: hoveredRoute.cityId,
            shippingCompanyId: hoveredRoute.shippingCompanyId,
            seaAreaIds: [...hoveredRoute.seaAreaIds],
            cultivatedAreaId: matchingCandidate.cultivatedAreaId
        }
    })

    hoveredRoutePreview: HoveredRoutePreviewState | null = $derived.by(() => {
        if (this.suppressBoardEffectsForHistory) {
            return null
        }

        const cityAreaByCityId = new Map(
            this.gameState.board.cities.map((city) => [city.id, city.area] as const)
        )

        const operatingCompanyId = this.gameState.operatingCompanyId
        const cultivatedAreaIdsByZoneId = new Map<string, string[]>()
        const cultivatedZoneAreaIdsByCultivatedAreaId = new Map<string, string[]>()
        if (operatingCompanyId) {
            const cultivatedAreaIdSet = new Set<string>()
            for (const area of Object.values(this.gameState.board.areas)) {
                if (!('companyId' in area)) {
                    continue
                }
                if (area.companyId !== operatingCompanyId) {
                    continue
                }
                cultivatedAreaIdSet.add(area.id)
            }

            const unvisited = [...cultivatedAreaIdSet].sort((left, right) =>
                left.localeCompare(right)
            )
            const zoneAreaIdGroups: string[][] = []
            while (unvisited.length > 0) {
                const seedAreaId = unvisited.shift()
                if (!seedAreaId) {
                    continue
                }

                const remaining = new Set(unvisited)
                remaining.delete(seedAreaId)

                const queue: string[] = [seedAreaId]
                const zoneAreaIds: string[] = []
                while (queue.length > 0) {
                    const areaId = queue.shift()
                    if (!areaId) {
                        continue
                    }
                    zoneAreaIds.push(areaId)
                    if (!isIndonesiaNodeId(areaId)) {
                        continue
                    }

                    const node = this.gameState.board.graph.nodeById(areaId)
                    if (!node) {
                        continue
                    }

                    for (const neighborNode of this.gameState.board.graph.neighborsOf(
                        node,
                        IndonesiaNeighborDirection.Land
                    )) {
                        if (!remaining.has(neighborNode.id)) {
                            continue
                        }
                        remaining.delete(neighborNode.id)
                        queue.push(neighborNode.id)
                    }
                }

                unvisited.splice(
                    0,
                    unvisited.length,
                    ...[...remaining].sort((left, right) => left.localeCompare(right))
                )
                zoneAreaIdGroups.push(zoneAreaIds.sort((left, right) => left.localeCompare(right)))
            }

            const sortedZoneAreaGroups = [...zoneAreaIdGroups].sort((left, right) =>
                (left[0] ?? '').localeCompare(right[0] ?? '')
            )
            sortedZoneAreaGroups.forEach((areaIds, index) => {
                cultivatedAreaIdsByZoneId.set(`${operatingCompanyId}:zone:${index + 1}`, areaIds)
                for (const areaId of areaIds) {
                    cultivatedZoneAreaIdsByCultivatedAreaId.set(areaId, areaIds)
                }
            })
        }

        const plannedRoute = this.hoveredPlannedDeliveryRoute
        if (plannedRoute) {
            const sourceAreaIds =
                (plannedRoute.cultivatedAreaId
                    ? cultivatedZoneAreaIdsByCultivatedAreaId.get(plannedRoute.cultivatedAreaId)
                    : undefined) ??
                cultivatedAreaIdsByZoneId.get(plannedRoute.zoneId) ??
                (plannedRoute.cultivatedAreaId !== undefined
                    ? [plannedRoute.cultivatedAreaId]
                    : [])

            return {
                routeKey: `planned:${plannedRoute.shippingCompanyId}|${plannedRoute.cityId}|${plannedRoute.zoneId}|${plannedRoute.seaAreaIds.join('>')}`,
                zoneId: plannedRoute.zoneId,
                cityId: plannedRoute.cityId,
                cityAreaId: cityAreaByCityId.get(plannedRoute.cityId) ?? null,
                shippingCompanyId: plannedRoute.shippingCompanyId,
                seaAreaIds: [...plannedRoute.seaAreaIds],
                sourceAreaIds,
                cultivatedAreaId: plannedRoute.cultivatedAreaId ?? null
            }
        }

        const hoveredChoice = this.hoveredDeliveryShippingChoice
        if (hoveredChoice) {
            const sourceAreaIds =
                cultivatedZoneAreaIdsByCultivatedAreaId.get(
                    hoveredChoice.candidate.cultivatedAreaId
                ) ??
                cultivatedAreaIdsByZoneId.get(hoveredChoice.candidate.zoneId) ??
                [hoveredChoice.candidate.cultivatedAreaId]

            return {
                routeKey: hoveredChoice.routeKey,
                zoneId: hoveredChoice.candidate.zoneId,
                cityId: hoveredChoice.candidate.cityId,
                cityAreaId: cityAreaByCityId.get(hoveredChoice.candidate.cityId) ?? null,
                shippingCompanyId: hoveredChoice.candidate.shippingCompanyId,
                seaAreaIds: [...hoveredChoice.candidate.seaAreaIds],
                sourceAreaIds,
                cultivatedAreaId: hoveredChoice.candidate.cultivatedAreaId
            }
        }

        return null
    })

    activeRoutePreview: HoveredRoutePreviewState | null = $derived.by(() => {
        if (this.cityReferenceCardPreviewWins) {
            return null
        }

        return this.hoveredRoutePreview
    })

    activeRoutePreviewVisualState: ActiveRoutePreviewVisualState | null = $derived.by(() => {
        const activeRoutePreview = this.activeRoutePreview
        if (!activeRoutePreview) {
            return null
        }

        const exemptAreaIdSet = new Set<string>(activeRoutePreview.sourceAreaIds)
        if (activeRoutePreview.cityAreaId) {
            exemptAreaIdSet.add(activeRoutePreview.cityAreaId)
        }

        const dimmedLandAreaIds: string[] = []
        for (const area of this.gameState.board) {
            if (area.type !== IndonesiaAreaType.Land) {
                continue
            }
            if (exemptAreaIdSet.has(area.id)) {
                continue
            }
            dimmedLandAreaIds.push(area.id)
        }

        const exemptAreaIds = [...exemptAreaIdSet].sort((left, right) => left.localeCompare(right))

        return {
            ...activeRoutePreview,
            seaAreaIdSet: new Set(activeRoutePreview.seaAreaIds),
            sourceAreaIdSet: new Set(activeRoutePreview.sourceAreaIds),
            exemptAreaIds,
            exemptAreaIdSet,
            dimmedLandAreaIds,
            dimmedLandAreaIdSet: new Set(dimmedLandAreaIds)
        }
    })

    resetAction(): void {
        this.selectedResearchPlayerIdOverride = undefined
        this.hoveredOperatingCompanyIdOverride = undefined
        this.hoveredCompanySpotlightCompanyIdsOverride = undefined
        this.hoveredAvailableDeedIdOverride = undefined
        this.selectedStartCompanyDeedIdOverride = undefined
        this.deliverySelectionOverrides = {}
        this.hoveredDeliveryCityAreaIdOverride = undefined
        this.hoveredDeliveryRouteKeyOverride = undefined
        this.hoveredPlannedDeliveryRouteOverride = undefined
    }

    override beforeNewState(): void {
        this.resetAction()
    }

    back(): void {
        const { nextState, poppedStage } = popHighestManualDeliverySelection(
            this.deliverySelectionOverrides
        )
        if (poppedStage) {
            this.deliverySelectionOverrides = nextState
            this.hoveredDeliveryCityAreaIdOverride = undefined
            this.hoveredDeliveryRouteKeyOverride = undefined
            return
        }

        if (this.selectedStartCompanyDeedIdOverride) {
            this.selectedStartCompanyDeedIdOverride = undefined
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

        const company = this.gameState.companies.find((entry) => entry.id === companyId)
        if (!company) {
            return
        }

        this.hoveredOperatingCompanyIdOverride = company.id
    }

    setHoveredCompanySpotlightCompanies(companyIds: string[] | undefined): void {
        if (!companyIds || companyIds.length === 0) {
            this.hoveredCompanySpotlightCompanyIdsOverride = undefined
            return
        }

        const validCompanyIds = this.uniqueValidCompanyIds(companyIds)

        this.hoveredCompanySpotlightCompanyIdsOverride =
            validCompanyIds.length > 0 ? validCompanyIds : undefined
    }

    hoverAvailableDeed(deedId: string): void {
        const deed = this.gameState.availableDeeds.find((entry) => entry.id === deedId)
        if (!deed) {
            return
        }

        this.hoveredAvailableDeedIdOverride = deed.id
    }

    clearHoveredAvailableDeed(): void {
        this.hoveredAvailableDeedIdOverride = undefined
    }

    stageStartCompanyDeed(deedId: string): void {
        if (!this.startCompanySelectionEnabled) {
            return
        }

        const deed = this.gameState.availableDeeds.find((entry) => entry.id === deedId)
        if (!deed) {
            return
        }

        this.hoveredAvailableDeedIdOverride = undefined
        this.selectedStartCompanyDeedIdOverride = deed.id
    }

    clearStagedStartCompanyDeed(): void {
        this.selectedStartCompanyDeedIdOverride = undefined
    }

    setHoveredPlayerCityReferenceCard(cardId: string | undefined): void {
        if (!cardId) {
            this.hoveredPlayerCityReferenceCardIdOverride = undefined
            return
        }

        const playerState = this.myPlayerState
        if (!playerState) {
            return
        }

        for (const era of visibleBoardCityReferenceCardEras(
            this.gameState.era,
            this.gameState.machineState
        )) {
            const card = playerState.cityCards[era][0]
            if (card?.id === cardId) {
                this.hoveredPlayerCityReferenceCardIdOverride = card.id
                return
            }
        }
    }

    setProductionZoneRenderStyle(style: 'player' | 'goods'): void {
        this.productionZoneRenderStyleOverride = style
    }

    toggleProductionZoneRenderStyle(): void {
        this.productionZoneRenderStyleOverride =
            this.productionZoneRenderStyle === 'player' ? 'goods' : 'player'
    }

    selectDeliveryCultivatedArea(
        areaId: string,
        options?: {
            source?: StagedSelectionSource
        }
    ): void {
        if (!this.deliverySelectionEnabled) {
            return
        }
        if (!this.deliveryAvailableCultivatedAreaIds.includes(areaId)) {
            return
        }

        this.deliverySelectionOverrides = setDeliveryCultivatedSelection(
            this.deliverySelectionOverrides,
            areaId,
            options?.source ?? 'manual'
        )
        this.hoveredDeliveryCityAreaIdOverride = undefined
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

        this.deliverySelectionOverrides = setDeliveryCitySelection(
            this.deliverySelectionOverrides,
            cityId
        )
        this.hoveredDeliveryCityAreaIdOverride = undefined
        this.hoveredDeliveryRouteKeyOverride = undefined
    }

    setHoveredDeliveryCityArea(areaId: string | undefined): void {
        if (!areaId) {
            this.hoveredDeliveryCityAreaIdOverride = undefined
            return
        }
        if (this.deliverySelectionStage !== 'city') {
            return
        }
        if (!this.deliveryAvailableCityAreaIds.includes(areaId)) {
            return
        }
        this.hoveredDeliveryCityAreaIdOverride = areaId
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

    setHoveredPlannedDeliveryRoute(
        route:
            | {
                  zoneId: string
                  cityId: string
                  shippingCompanyId: string
                  seaAreaIds: readonly string[]
                  cultivatedAreaId?: string
              }
            | undefined
    ): void {
        if (!route) {
            this.hoveredPlannedDeliveryRouteOverride = undefined
            return
        }

        this.hoveredPlannedDeliveryRouteOverride = {
            zoneId: route.zoneId,
            cityId: route.cityId,
            shippingCompanyId: route.shippingCompanyId,
            seaAreaIds: [...route.seaAreaIds],
            ...(route.cultivatedAreaId ? { cultivatedAreaId: route.cultivatedAreaId } : {})
        }
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

    async deliverGoodForPlannedRoute(route: {
        zoneId: string
        cityId: string
        shippingCompanyId: string
        seaAreaIds: readonly string[]
    }): Promise<void> {
        if (!this.deliverySelectionEnabled) {
            return
        }

        const candidate = this.safeDeliveryCandidates.find(
            (entry) =>
                entry.zoneId === route.zoneId &&
                entry.cityId === route.cityId &&
                entry.shippingCompanyId === route.shippingCompanyId &&
                entry.seaAreaIds.length === route.seaAreaIds.length &&
                entry.seaAreaIds.every((seaAreaId, index) => seaAreaId === route.seaAreaIds[index])
        )
        if (!candidate) {
            return
        }

        await this.deliverGood(
            candidate.cultivatedAreaId,
            candidate.shippingCompanyId,
            candidate.seaAreaIds,
            candidate.cityId
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

    async proposeMerger(companyAId: string, companyBId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.ProposeMerger)) {
            return
        }

        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return
        }

        const option = HydratedProposeMerger.findOption(this.gameState, myPlayerId, companyAId, companyBId)
        if (!option) {
            return
        }
        if ((this.myPlayerState?.cash ?? 0) < option.nominalValue) {
            return
        }

        const action = this.createPlayerAction(ProposeMerger, {
            type: ActionType.ProposeMerger,
            companyAId,
            companyBId
        })
        await this.applyAction(action)
    }

    async placeMergerBid(amount: number): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.PlaceMergerBid)) {
            return
        }
        if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
            return
        }

        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId || this.gameState.mergerCurrentBidderId !== myPlayerId) {
            return
        }

        const minimumBid = this.minimumMergerBid()
        if (minimumBid === null || amount < minimumBid) {
            return
        }
        const proposal = this.gameState.activeMergerProposal
        if (!proposal) {
            return
        }
        if ((amount - proposal.nominalValue) % proposal.bidIncrement !== 0) {
            return
        }
        if ((this.myPlayerState?.cash ?? 0) < amount) {
            return
        }

        const action = this.createPlayerAction(PlaceMergerBid, {
            type: ActionType.PlaceMergerBid,
            amount
        })
        await this.applyAction(action)
    }

    async passMergerBid(): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.PassMergerBid)) {
            return
        }
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId || this.gameState.mergerCurrentBidderId !== myPlayerId) {
            return
        }

        const action = this.createPlayerAction(PassMergerBid, {
            type: ActionType.PassMergerBid
        })
        await this.applyAction(action)
    }

    async removeSiapSajiArea(areaId: string): Promise<void> {
        if (!this.validActionTypes.includes(ActionType.RemoveSiapSajiArea)) {
            return
        }
        if (!this.siapSajiRemovalAreaIds.includes(areaId)) {
            return
        }

        const action = this.createPlayerAction(RemoveSiapSajiArea, {
            type: ActionType.RemoveSiapSajiArea,
            areaId
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

    async finishProductionOperationWithoutExpansion(): Promise<void> {
        await this.pass(PassReason.SkipProductionExpansion)
    }

    async finishOptionalShippingExpansion(): Promise<void> {
        await this.pass(PassReason.FinishOptionalShippingExpansion)
    }

    async finishShippingOperationWithoutExpansion(): Promise<void> {
        await this.pass(PassReason.SkipShippingExpansion)
    }

    siapSajiRemovalAreaIds: string[] = $derived.by(() => {
        const myPlayerId = this.myPlayer?.id
        if (!myPlayerId) {
            return []
        }
        return HydratedRemoveSiapSajiArea.validAreaIds(this.gameState, myPlayerId)
    })

    async onGameStateChange({
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) {
        const actionId = action?.id
        this.visibleActionOverride = action
        animationContext.afterAnimations(() => {
            if (actionId && this.visibleActionOverride?.id === actionId) {
                this.visibleActionOverride = undefined
            }
        })
    }

    rememberStartedCompanyAnimation(action: GameAction): void {
        this.startedCompanyAnimationEntry = { action }
    }

    clearStartedCompanyAnimation(actionId: string): void {
        if (this.startedCompanyAnimationEntry?.action.id === actionId) {
            this.startedCompanyAnimationEntry = undefined
        }
    }

    private minimumMergerBid(): number | null {
        const proposal = this.gameState.activeMergerProposal
        if (!proposal) {
            return null
        }

        const currentHighBid = this.gameState.activeMergerAuction?.highBid ?? 0
        let minimumBid = Math.max(currentHighBid + 1, proposal.nominalValue)
        const offset = (minimumBid - proposal.nominalValue) % proposal.bidIncrement
        if (offset !== 0) {
            minimumBid += proposal.bidIncrement - offset
        }

        return minimumBid
    }
}
