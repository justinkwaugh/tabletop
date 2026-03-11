<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import CompanyZoneMarker from '$lib/components/CompanyZoneMarker.svelte'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
    import {
        BOARD_CITY_REFERENCE_CARD_HEIGHT,
        BOARD_CITY_REFERENCE_CARD_RADIUS,
        BOARD_CITY_REFERENCE_CARD_WIDTH,
        CITY_REFERENCE_CARD_LEFT_X,
        CITY_REFERENCE_CARD_RIGHT_X,
        CITY_REFERENCE_CARD_TOP_Y
    } from '$lib/definitions/cityReferenceCardGeometry.js'
    import {
        BOARD_DEED_CARD_CORNER_RX,
        BOARD_DEED_CARD_CORNER_RY,
        BOARD_DEED_CARD_HEIGHT,
        BOARD_DEED_CARD_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import {
        deriveActiveAreaInteraction,
        type ActiveAreaInteraction
    } from '$lib/components/boardActionAreas/areaInteraction.js'
    import {
        deriveBoardSpotlightState,
        type ActiveBoardSpotlightVisualState,
        type SpotlightMaskRect
    } from '$lib/components/boardActionAreas/boardSpotlight.js'
    import {
        deriveShippingDeedSeaOverlayState,
        deriveSeaHighlightState,
        type ShippingDeedSeaOverlayState,
        type SeaHighlightState
    } from '$lib/components/boardActionAreas/seaHighlight.js'
    import {
        deliverySelectableAreaIds as deriveDeliverySelectableAreaIds,
        deliveryZoneByAreaId as buildDeliveryZoneByAreaId,
        deliveryZoneByKey as buildDeliveryZoneByKey,
        deriveDeliverySelectableZoneMarkers,
        deriveDeliverySelectableZones,
        type DeliverySelectableZone,
        type DeliverySelectableZoneMarker
    } from '$lib/components/boardActionAreas/deliveryZones.js'
    import {
        deriveStartCompanyDeeds,
        selectedStartCompanyDeed as deriveSelectedStartCompanyDeed,
        startCompanyDeedById as buildStartCompanyDeedById,
        type StartCompanyDeedEntry
    } from '$lib/components/boardActionAreas/startCompany.js'
    import StartCompanyDeedSelectionOverlay from '$lib/components/boardActionAreas/StartCompanyDeedSelectionOverlay.svelte'
    import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { deedPositionLookupKeys } from '$lib/utils/deeds.js'
    import {
        ActionType,
        CompanyType,
        Era,
        HydratedExpand,
        HydratedGrowCity,
        HydratedPlaceCity,
        HydratedStartCompany,
        IndonesiaAreaType,
        MachineState
    } from '@tabletop/indonesia'

    const gameSession = getGameSession()
    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const PRODUCTION_HOVER_SPOTLIGHT_MASK_ID = 'production-company-hover-spotlight-mask'
    const EXPANSION_SELECTION_SPOTLIGHT_MASK_ID = 'expansion-selection-spotlight-mask'
    const CITY_PLACEMENT_SPOTLIGHT_MASK_ID = 'city-placement-spotlight-mask'
    const DELIVERY_ZONE_OUTLINE_MASK_ID = 'delivery-zone-outline-mask'
    const DELIVERY_ZONE_INNER_OUTLINE_MASK_ID = 'delivery-zone-inner-outline-mask'
    const DELIVERY_ZONE_HOVER_OUTLINE_MASK_ID = 'delivery-zone-hover-outline-mask'
    const SEA_HIGHLIGHT_FILL = '#93c5fd'
    const SEA_HIGHLIGHT_FILL_OPACITY = 0.38

    type MarkerGood = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
    type MarkerDirection = 'north' | 'east' | 'south' | 'west'
    type HoveredProductionZoneMarker = {
        key: string
        companyId: string
        zoneAreaIds: readonly string[]
        x: number
        y: number
        targetX: number
        targetY: number
        ownerColor: string
        goodType: MarkerGood
        goodsCount: number
        hatchPatternId: string | null
        direction: MarkerDirection
    }

    function areaHasShips(area: Record<string, unknown>): area is Record<string, unknown> & {
        ships: string[]
    } {
        return Array.isArray(area.ships)
    }

    let hoveredAreaId: string | null = $derived.by(() => {
        gameSession.updatingVisibleState
        gameSession.gameState
        return null
    })
    let hoveredDeliveryZoneKey: string | null = $derived.by(() => {
        gameSession.updatingVisibleState
        if (
            !deliverySelectionEnabled ||
            gameSession.deliverySelectionStage !== 'cultivated'
        ) {
            return null
        }
        return null
    })
    let applyingAreaAction = $state(false)

    const myPlayerId: string | null = $derived(gameSession.myPlayer?.id ?? null)

    const startCompanySelectionEnabled: boolean = $derived(gameSession.startCompanySelectionEnabled)

    const selectedStartCompanyDeedId: string | null = $derived.by(() => {
        return gameSession.selectedStartCompanyDeedId
    })

    const canApplyStartCompanyAction: boolean = $derived.by(() => {
        return (
            !gameSession.suppressBoardEffectsForHistory &&
            !!myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Acquisitions
        )
    })

    const startCompanyDeeds: StartCompanyDeedEntry[] = $derived.by(() => {
        return deriveStartCompanyDeeds({
            enabled: startCompanySelectionEnabled,
            availableDeeds: gameSession.gameState.availableDeeds,
            positionForDeed: (deed) => {
                return (
                    deedPositionLookupKeys(deed)
                        .map((key) => DEED_CARD_POSITIONS[key])
                        .find((point) => point !== undefined) ?? null
                )
            }
        })
    })

    const startCompanyDeedById: Map<string, StartCompanyDeedEntry> = $derived.by(() => {
        return buildStartCompanyDeedById(startCompanyDeeds)
    })

    const selectedStartCompanyDeed: StartCompanyDeedEntry | null = $derived.by(() => {
        return deriveSelectedStartCompanyDeed(startCompanyDeedById, selectedStartCompanyDeedId)
    })

    const startCompanyValidAreaIds: readonly string[] = $derived.by(() => {
        if (!myPlayerId || !selectedStartCompanyDeed) {
            return []
        }

        return Array.from(
            HydratedStartCompany.validAreaIds(
                gameSession.gameState,
                myPlayerId,
                selectedStartCompanyDeed.deedId
            )
        )
    })

    const startCompanyDeedOutlineColor: string = $derived.by(() => {
        if (!myPlayerId) {
            return '#1f2937'
        }
        return gameSession.colors.getPlayerUiColor(myPlayerId)
    })

    const playerOutlineColor: string | null = $derived.by(() => {
        if (!myPlayerId) {
            return null
        }
        return gameSession.colors.getPlayerUiColor(myPlayerId)
    })

    const siapSajiRemovalAreaIds: readonly string[] = $derived.by(() => {
        return gameSession.siapSajiRemovalAreaIds
    })

    const growCityValidAreaIds: readonly string[] = $derived.by(() => {
        if (
            !myPlayerId ||
            !gameSession.isMyTurn ||
            gameSession.gameState.machineState !== MachineState.CityGrowth ||
            !gameSession.validActionTypes.includes(ActionType.GrowCity)
        ) {
            return []
        }

        return Array.from(HydratedGrowCity.validCityAreaIds(gameSession.gameState, myPlayerId))
    })

    const placeCityValidAreaIds: readonly string[] = $derived.by(() => {
        if (
            !myPlayerId ||
            !gameSession.isMyTurn ||
            !gameSession.isNewEra ||
            !gameSession.validActionTypes.includes(ActionType.PlaceCity)
        ) {
            return []
        }

        return Array.from(HydratedPlaceCity.validAreaIds(gameSession.gameState, myPlayerId))
    })

    const shippingExpandValidAreaIds: readonly string[] = $derived.by(() => {
        if (
            !myPlayerId ||
            !gameSession.isMyTurn ||
            gameSession.gameState.machineState !== MachineState.ShippingOperations ||
            !gameSession.validActionTypes.includes(ActionType.Expand)
        ) {
            return []
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return []
        }

        return Array.from(gameSession.gameState.validExpansionAreaIds(operatingCompanyId)).filter((areaId) =>
            HydratedExpand.canExpand(gameSession.gameState, myPlayerId, areaId)
        )
    })

    const productionExpandValidAreaIds: readonly string[] = $derived.by(() => {
        if (
            !myPlayerId ||
            !gameSession.isMyTurn ||
            gameSession.gameState.machineState !== MachineState.ProductionOperations ||
            !gameSession.validActionTypes.includes(ActionType.Expand)
        ) {
            return []
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return []
        }

        return Array.from(gameSession.gameState.validExpansionAreaIds(operatingCompanyId))
    })

    const deliverySelectionEnabled: boolean = $derived.by(() => gameSession.deliverySelectionEnabled)

    const deliverySelectableZones: DeliverySelectableZone[] = $derived.by(() => {
        const operatingCompany = gameSession.gameState.companies.find(
            (company) => company.id === gameSession.gameState.operatingCompanyId
        )

        return deriveDeliverySelectableZones({
            enabled: !!myPlayerId && deliverySelectionEnabled,
            deliverySelectionStage: gameSession.deliverySelectionStage,
            operatingCompanyId: gameSession.gameState.operatingCompanyId ?? null,
            operatingCompanyType: operatingCompany?.type ?? null,
            boardAreas: gameSession.gameState.board.areas,
            boardGraph: gameSession.gameState.board.graph,
            isVisibleAreaId: (areaId) => !!boardAreaPathById(areaId),
            deliveryAvailableCultivatedAreaIds: gameSession.deliveryAvailableCultivatedAreaIds
        })
    })

    const deliverySelectableAreaIds: readonly string[] = $derived.by(() => {
        return deriveDeliverySelectableAreaIds(deliverySelectableZones)
    })

    const deliveryZoneByAreaId: Map<string, DeliverySelectableZone> = $derived.by(() => {
        return buildDeliveryZoneByAreaId(deliverySelectableZones)
    })

    const deliveryZoneByKey: Map<string, DeliverySelectableZone> = $derived.by(() => {
        return buildDeliveryZoneByKey(deliverySelectableZones)
    })

    $effect(() => {
        if (
            !deliverySelectionEnabled ||
            gameSession.deliverySelectionStage !== 'cultivated' ||
            activeAreaInteraction?.action !== 'select-delivery-cultivated'
        ) {
            return
        }

        if (deliverySelectableZones.length !== 1) {
            return
        }

        const onlyZone = deliverySelectableZones[0]
        if (!onlyZone) {
            return
        }

        selectDeliveryCultivatedZone(onlyZone, { source: 'auto' })
    })

    const activeAreaInteraction: ActiveAreaInteraction | null = $derived.by(() => {
        return deriveActiveAreaInteraction({
            myPlayerId,
            isMyTurn: gameSession.isMyTurn,
            suppressBoardEffectsForHistory: gameSession.suppressBoardEffectsForHistory,
            canRemoveSiapSajiArea:
                gameSession.gameState.machineState === MachineState.Mergers &&
                gameSession.validActionTypes.includes(ActionType.RemoveSiapSajiArea),
            siapSajiRemovalAreaIds,
            canGrowCity:
                gameSession.gameState.machineState === MachineState.CityGrowth &&
                gameSession.validActionTypes.includes(ActionType.GrowCity),
            growCityValidAreaIds,
            canPlaceCity:
                gameSession.isNewEra &&
                gameSession.validActionTypes.includes(ActionType.PlaceCity),
            placeCityValidAreaIds,
            shippingExpandValidAreaIds,
            productionExpandValidAreaIds,
            deliverySelectionEnabled,
            deliverySelectionStage: gameSession.deliverySelectionStage,
            deliverySelectableAreaIds,
            deliveryAvailableCityAreaIds: gameSession.deliveryAvailableCityAreaIds.filter((areaId) =>
                boardAreaPathById(areaId)
            ),
            selectedStartCompanyDeedType: selectedStartCompanyDeed?.type ?? null,
            startCompanyValidAreaIds,
            playerOutlineColor
        })
    })

    const interactiveValidAreaIds: readonly string[] = $derived.by(() =>
        (activeAreaInteraction?.validAreaIds ?? []).filter((areaId) => boardAreaPathById(areaId))
    )

    const validAreaIdSet: Set<string> = $derived.by(() => new Set(interactiveValidAreaIds))

    const hoveredDeliveryZone: DeliverySelectableZone | null = $derived.by(() => {
        if (
            activeAreaInteraction?.action !== 'select-delivery-cultivated' ||
            deliverySelectableZones.length === 0
        ) {
            return null
        }

        if (hoveredDeliveryZoneKey) {
            return deliveryZoneByKey.get(hoveredDeliveryZoneKey) ?? null
        }

        if (!hoveredAreaId || !validAreaIdSet.has(hoveredAreaId)) {
            return null
        }

        return deliveryZoneByAreaId.get(hoveredAreaId) ?? null
    })

    const hoveredInteractiveAreaIds: readonly string[] = $derived.by(() => {
        if (!activeAreaInteraction) {
            return []
        }

        if (activeAreaInteraction.action === 'select-delivery-cultivated') {
            return hoveredDeliveryZone?.allAreaIds ?? []
        }

        if (!hoveredAreaId || !validAreaIdSet.has(hoveredAreaId)) {
            return []
        }

        return [hoveredAreaId]
    })

    const maskedAreaIds: string[] = $derived.by(() => {
        if (!activeAreaInteraction || !activeAreaInteraction.maskInvalidAreas) {
            return []
        }

        const maskedIds: string[] = []
        for (const area of gameSession.gameState.board) {
            if (area.type !== activeAreaInteraction.maskedAreaType) {
                continue
            }
            if (!boardAreaPathById(area.id)) {
                continue
            }
            if (validAreaIdSet.has(area.id)) {
                continue
            }
            maskedIds.push(area.id)
        }

        return maskedIds
    })

    const spotlightedProductionCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        return new Set(gameSession.activeBoardSpotlightProductionCompanyIds)
    })

    const spotlightedShippingCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        return new Set(gameSession.activeBoardSpotlightShippingCompanyIds)
    })

    const spotlightedProductionCompanyAreaIds: readonly string[] = $derived.by(() => {
        if (spotlightedProductionCompanyIdSet.size === 0) {
            return []
        }

        const highlightedAreaIds: string[] = []
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area) || !spotlightedProductionCompanyIdSet.has(area.companyId)) {
                continue
            }
            if (!boardAreaPathById(area.id)) {
                continue
            }
            highlightedAreaIds.push(area.id)
        }

        return highlightedAreaIds.sort((left, right) => left.localeCompare(right))
    })

    const spotlightedShippingCompanyAreaIds: readonly string[] = $derived.by(() => {
        if (spotlightedShippingCompanyIdSet.size === 0) {
            return []
        }

        const highlightedSeaAreaIds: string[] = []
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (
                !areaHasShips(area) ||
                !area.ships.some((companyId) => spotlightedShippingCompanyIdSet.has(companyId))
            ) {
                continue
            }
            if (!boardAreaPathById(area.id)) {
                continue
            }
            highlightedSeaAreaIds.push(area.id)
        }

        return highlightedSeaAreaIds.sort((left, right) => left.localeCompare(right))
    })

    const hoveredCompanySpotlightAreaIds: readonly string[] = $derived.by(() => {
        return [
            ...new Set([
                ...spotlightedProductionCompanyAreaIds,
                ...spotlightedShippingCompanyAreaIds
            ])
        ]
    })

    const hasHoveredRoutePreview: boolean = $derived.by(
        () => gameSession.activeRoutePreviewVisualState !== null
    )

    const hoveredRoutePreviewDimmedLandAreaIds: readonly string[] = $derived.by(() => {
        return (
            gameSession.activeRoutePreviewVisualState?.dimmedLandAreaIds.filter((areaId) =>
                !!boardAreaPathById(areaId)
            ) ?? []
        )
    })

    const activeDeedPreviewId: string | null = $derived.by(() => {
        return gameSession.activeDeedPreviewId
    })

    const showAllDeedOverlays: boolean = $derived.by(() => {
        return (
            !gameSession.suppressBoardEffectsForHistory &&
            gameSession.gameState.machineState === MachineState.Acquisitions
        )
    })

    const availableShippingDeedIds: readonly string[] = $derived.by(() => {
        return gameSession.gameState.availableDeeds
            .filter((deed) => deed.type === CompanyType.Shipping)
            .map((deed) => deed.id)
    })

    const shippingDeedSeaOverlayState: ShippingDeedSeaOverlayState = $derived.by(() => {
        return deriveShippingDeedSeaOverlayState({
            shippingDeedIds: availableShippingDeedIds,
            activeDeedPreviewId,
            showAllDeedOverlays,
            suppressBoardEffectsForHistory: gameSession.suppressBoardEffectsForHistory,
            cityReferenceCardPreviewWins: gameSession.cityReferenceCardPreviewWins
        })
    })

    const activeDeedPreviewOverlayAreaIds: readonly string[] = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return []
        }

        const deed = gameSession.gameState.availableDeeds.find((entry) => entry.id === previewDeedId)
        if (!deed) {
            return []
        }

        if (deed.type === CompanyType.Shipping) {
            return gameSession.gameState.board
                .seaAreasForRegion(deed.region)
                .map((seaArea) => seaArea.id)
                .filter((areaId) => !!boardAreaPathById(areaId))
        }

        if (deed.type === CompanyType.Production) {
            return gameSession.gameState.board
                .areasForRegion(deed.region)
                .filter((area) => gameSession.gameState.board.canBeNewlyCultivated(area, deed.good))
                .map((area) => area.id)
                .filter((areaId) => !!boardAreaPathById(areaId))
        }

        return []
    })
    const activeProductionDeedPreviewOutlinedAreaIds: readonly string[] = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return []
        }

        const deed = gameSession.gameState.availableDeeds.find((entry) => entry.id === previewDeedId)
        if (!deed || deed.type !== CompanyType.Production) {
            return []
        }

        return activeDeedPreviewOverlayAreaIds
    })
    const activeShippingDeedPreviewOverlayAreaIds: readonly string[] = $derived.by(() => {
        const activeShippingPreviewDeedId = shippingDeedSeaOverlayState.activeShippingPreviewDeedId
        if (!activeShippingPreviewDeedId) {
            return []
        }

        const deed = gameSession.gameState.availableDeeds.find(
            (entry) => entry.id === activeShippingPreviewDeedId
        )
        if (!deed || deed.type !== CompanyType.Shipping) {
            return []
        }

        return activeDeedPreviewOverlayAreaIds
    })
    const activeDeedPreviewCardMaskRect: SpotlightMaskRect | null = $derived.by(() => {
        const previewDeedId = activeDeedPreviewId
        if (!previewDeedId) {
            return null
        }

        const deed = gameSession.gameState.availableDeeds.find((entry) => entry.id === previewDeedId)
        if (!deed) {
            return null
        }

        const position = deedPositionLookupKeys(deed)
            .map((key) => DEED_CARD_POSITIONS[key])
            .find((point) => point !== undefined)
        if (!position) {
            return null
        }

        return {
            x: position.x - BOARD_DEED_CARD_WIDTH / 2,
            y: position.y - BOARD_DEED_CARD_HEIGHT / 2,
            width: BOARD_DEED_CARD_WIDTH,
            height: BOARD_DEED_CARD_HEIGHT,
            rx: BOARD_DEED_CARD_CORNER_RX,
            ry: BOARD_DEED_CARD_CORNER_RY
        }
    })

    const activeBoardSpotlightVisualState: ActiveBoardSpotlightVisualState<HoveredProductionZoneMarker> =
        $derived.by(() => {
            return deriveBoardSpotlightState<HoveredProductionZoneMarker>({
                previewIntent: gameSession.activeBoardPreviewIntent,
                cityReferenceCardOverlayAreaIds: hoveredCityReferenceCardOverlayAreaIds,
                cityReferenceCardMaskRect: hoveredCityReferenceCardMaskRect,
                companySpotlightAreaIds: hoveredCompanySpotlightAreaIds,
                productionCompanyAreaIds: spotlightedProductionCompanyAreaIds,
                productionZoneMarkers: hoveredProductionZoneMarkers,
                availableDeedOverlayAreaIds: activeDeedPreviewOverlayAreaIds,
                availableShippingDeedOverlayAreaIds: activeShippingDeedPreviewOverlayAreaIds,
                availableDeedOutlinedAreaIds: activeProductionDeedPreviewOutlinedAreaIds,
                availableDeedCardMaskRect: activeDeedPreviewCardMaskRect
            })
        })

    const shouldRenderBoardSpotlightMask: boolean = $derived.by(
        () => activeBoardSpotlightVisualState.shouldRenderMask
    )

    const hasHoveredCityReferenceCardSpotlight: boolean = $derived.by(
        () => activeBoardSpotlightVisualState.hasCityReferenceCardSpotlight
    )

    const hasVisibleCompanySpotlightPreview: boolean = $derived.by(
        () => activeBoardSpotlightVisualState.hasVisibleCompanySpotlight
    )

    const shouldRenderExpansionSelectionSpotlightMask: boolean = $derived.by(() => {
        return (
            activeAreaInteraction?.action === 'expand' &&
            interactiveValidAreaIds.length > 0 &&
            !hasHoveredRoutePreview &&
            !hasVisibleCompanySpotlightPreview &&
            !hasHoveredCityReferenceCardSpotlight
        )
    })

    const shouldRenderCityPlacementSpotlightMask: boolean = $derived.by(() => {
        return (
            activeAreaInteraction?.action === 'place-city' &&
            interactiveValidAreaIds.length > 0 &&
            !hasHoveredRoutePreview &&
            !hasVisibleCompanySpotlightPreview &&
            !hasHoveredCityReferenceCardSpotlight
        )
    })

    const seaHighlightState: SeaHighlightState = $derived.by(() => {
        return deriveSeaHighlightState({
            boardPreviewSeaAreaIds: activeBoardSpotlightVisualState.seaOverlayAreaIds,
            activeAreaInteractionAction: activeAreaInteraction?.action ?? null,
            activeAreaInteractionMaskedAreaType: activeAreaInteraction?.maskedAreaType ?? null,
            interactiveValidAreaIds,
            hasHoveredRoutePreview,
            hasVisibleCompanySpotlightPreview,
            hasHoveredCityReferenceCardSpotlight
        })
    })

    const allowHoveredCityReferenceCardSpotlight: boolean = $derived.by(
        () => !gameSession.suppressBoardEffectsForHistory
    )

    const hoveredCityReferenceCardOverlayAreaIds: readonly string[] = $derived.by(() => {
        if (!allowHoveredCityReferenceCardSpotlight) {
            return []
        }

        const cityCard = gameSession.hoveredPlayerCityReferenceCard
        if (!cityCard) {
            return []
        }

        const areaIds = new Set<string>()
        for (const regionId of cityCard.regions) {
            if (gameSession.gameState.board.hasCityInRegion(regionId)) {
                continue
            }

            for (const area of gameSession.gameState.board.coastalAreasForRegion(regionId)) {
                if (area.type !== 'EmptyLand') {
                    continue
                }
                if (!boardAreaPathById(area.id)) {
                    continue
                }
                areaIds.add(area.id)
            }
        }

        return [...areaIds].sort((left, right) => left.localeCompare(right))
    })

    const hoveredCityReferenceCardMaskRect: SpotlightMaskRect | null = $derived.by(() => {
        if (!allowHoveredCityReferenceCardSpotlight) {
            return null
        }

        const cityCard = gameSession.hoveredPlayerCityReferenceCard
        if (!cityCard) {
            return null
        }

        const cardX =
            gameSession.gameState.era === Era.B
                ? CITY_REFERENCE_CARD_LEFT_X
                : cityCard.era === Era.B
                  ? CITY_REFERENCE_CARD_LEFT_X
                  : CITY_REFERENCE_CARD_RIGHT_X

        return {
            x: cardX,
            y: CITY_REFERENCE_CARD_TOP_Y,
            width: BOARD_CITY_REFERENCE_CARD_WIDTH,
            height: BOARD_CITY_REFERENCE_CARD_HEIGHT,
            rx: BOARD_CITY_REFERENCE_CARD_RADIUS,
            ry: BOARD_CITY_REFERENCE_CARD_RADIUS
        }
    })

    const hoveredProductionCompanyIds: readonly string[] = $derived.by(() => {
        return gameSession.activeBoardSpotlightProductionCompanyIds
    })

    const hoveredProductionZoneMarkers: HoveredProductionZoneMarker[] = $derived.by(() => {
        if (hoveredProductionCompanyIds.length === 0 || typeof window === 'undefined') {
            return []
        }
        const markerEntries = (
            window as Window & {
                __indonesiaProductionZoneMarkerEntries?: HoveredProductionZoneMarker[]
            }
        ).__indonesiaProductionZoneMarkerEntries
        if (!Array.isArray(markerEntries) || markerEntries.length === 0) {
            return []
        }
        const hoveredProductionCompanyIdSet = new Set(hoveredProductionCompanyIds)
        return markerEntries.filter((marker) => hoveredProductionCompanyIdSet.has(marker.companyId))
    })

    const deliverySelectableZoneMarkers: readonly DeliverySelectableZoneMarker[] = $derived.by(() => {
        const markerEntries = (
            window as Window & {
                __indonesiaProductionZoneMarkerEntries?: HoveredProductionZoneMarker[]
            }
        ).__indonesiaProductionZoneMarkerEntries
        return deriveDeliverySelectableZoneMarkers({
            activeAreaInteractionAction: activeAreaInteraction?.action ?? null,
            deliverySelectableZones,
            markerEntries: Array.isArray(markerEntries) ? markerEntries : [],
            operatingCompanyId: gameSession.gameState.operatingCompanyId ?? null
        })
    })

    function selectDeliveryCultivatedZone(
        zone: DeliverySelectableZone,
        options?: {
            source?: 'auto' | 'manual'
        }
    ): void {
        const selectedAreaId = [...zone.remainingAreaIds]
            .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))[0]
        if (!selectedAreaId) {
            return
        }

        gameSession.selectDeliveryCultivatedArea(selectedAreaId, options)
        hoveredAreaId = null
        hoveredDeliveryZoneKey = null
    }

    function handleDeliveryZoneMarkerHover(zoneKey: string): void {
        if (activeAreaInteraction?.action !== 'select-delivery-cultivated') {
            return
        }
        hoveredDeliveryZoneKey = zoneKey
    }

    function handleDeliveryZoneMarkerLeave(zoneKey: string): void {
        if (hoveredDeliveryZoneKey === zoneKey) {
            hoveredDeliveryZoneKey = null
        }
    }

    function handleDeliveryZoneMarkerClick(zoneKey: string): void {
        if (activeAreaInteraction?.action !== 'select-delivery-cultivated' || applyingAreaAction) {
            return
        }
        const zone = deliveryZoneByKey.get(zoneKey)
        if (!zone) {
            return
        }

        selectDeliveryCultivatedZone(zone)
    }

    function deliveryZoneOutlineMaskId(zoneKey: string): string {
        const safeKey = zoneKey.replace(/[^a-zA-Z0-9_-]/g, '-')
        return `${DELIVERY_ZONE_OUTLINE_MASK_ID}-${safeKey}`
    }

    function deliveryZoneInnerOutlineMaskId(zoneKey: string): string {
        const safeKey = zoneKey.replace(/[^a-zA-Z0-9_-]/g, '-')
        return `${DELIVERY_ZONE_INNER_OUTLINE_MASK_ID}-${safeKey}`
    }

    function deliveryZoneHoverOutlineMaskId(zoneKey: string): string {
        const safeKey = zoneKey.replace(/[^a-zA-Z0-9_-]/g, '-')
        return `${DELIVERY_ZONE_HOVER_OUTLINE_MASK_ID}-${safeKey}`
    }

    async function handleAreaClick(areaId: string): Promise<void> {
        if (!activeAreaInteraction || applyingAreaAction || !myPlayerId) {
            return
        }
        if (!validAreaIdSet.has(areaId)) {
            return
        }

        if (activeAreaInteraction.action === 'select-delivery-cultivated') {
            const zone = deliveryZoneByAreaId.get(areaId)
            if (!zone) {
                return
            }

            selectDeliveryCultivatedZone(zone)
            return
        }

        if (activeAreaInteraction.action === 'select-delivery-city') {
            const city = gameSession.gameState.board.cities.find((entry) => entry.area === areaId)
            if (!city) {
                return
            }

            gameSession.selectDeliveryCity(city.id)
            gameSession.setHoveredDeliveryCityArea(undefined)
            hoveredAreaId = null
            return
        }

        applyingAreaAction = true
        try {
            if (activeAreaInteraction.action === 'place-city') {
                await gameSession.placeCity(areaId)
                return
            }

            if (activeAreaInteraction.action === 'grow-city') {
                const city = gameSession.gameState.board.cities.find((entry) => entry.area === areaId)
                if (!city) {
                    return
                }

                await gameSession.growCity(city.id)
                return
            }

            if (activeAreaInteraction.action === 'expand') {
                await gameSession.expand(areaId)
                return
            }

            if (activeAreaInteraction.action === 'remove-siap-saji-area') {
                await gameSession.removeSiapSajiArea(areaId)
                return
            }

            if (!selectedStartCompanyDeedId) {
                return
            }
            if (!canApplyStartCompanyAction) {
                return
            }

            await gameSession.startCompany(selectedStartCompanyDeedId, areaId)
            gameSession.clearStagedStartCompanyDeed()
        } finally {
            applyingAreaAction = false
        }
    }

    function handleStartCompanyDeedStaged(): void {
        hoveredAreaId = null
    }
</script>

{#if activeAreaInteraction ||
    startCompanySelectionEnabled ||
    shouldRenderBoardSpotlightMask ||
    shouldRenderExpansionSelectionSpotlightMask ||
    shouldRenderCityPlacementSpotlightMask ||
    hasHoveredRoutePreview}
    <g class="select-none" aria-label="Board action areas layer">
        {#if shouldRenderBoardSpotlightMask}
            <defs>
                <mask id={PRODUCTION_HOVER_SPOTLIGHT_MASK_ID} maskUnits="userSpaceOnUse">
                    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#ffffff"></rect>
                    {#each activeBoardSpotlightVisualState.exemptAreaIds as areaId (areaId)}
                        <Area areaId={areaId} fill="#000000" stroke="none" fillOpacity="1" pointer-events="none" />
                    {/each}
                    {#if activeBoardSpotlightVisualState.deedCardMaskRect}
                        <rect
                            x={activeBoardSpotlightVisualState.deedCardMaskRect.x}
                            y={activeBoardSpotlightVisualState.deedCardMaskRect.y}
                            width={activeBoardSpotlightVisualState.deedCardMaskRect.width}
                            height={activeBoardSpotlightVisualState.deedCardMaskRect.height}
                            rx={activeBoardSpotlightVisualState.deedCardMaskRect.rx}
                            ry={activeBoardSpotlightVisualState.deedCardMaskRect.ry}
                            fill="#000000"
                            pointer-events="none"
                        />
                    {/if}
                    {#if activeBoardSpotlightVisualState.cityReferenceCardMaskRect}
                        <rect
                            x={activeBoardSpotlightVisualState.cityReferenceCardMaskRect.x}
                            y={activeBoardSpotlightVisualState.cityReferenceCardMaskRect.y}
                            width={activeBoardSpotlightVisualState.cityReferenceCardMaskRect.width}
                            height={activeBoardSpotlightVisualState.cityReferenceCardMaskRect.height}
                            rx={activeBoardSpotlightVisualState.cityReferenceCardMaskRect.rx}
                            ry={activeBoardSpotlightVisualState.cityReferenceCardMaskRect.ry}
                            fill="#000000"
                            pointer-events="none"
                        />
                    {/if}
                </mask>
            </defs>

            <rect
                x="0"
                y="0"
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                fill="#000000"
                fill-opacity="0.34"
                mask={`url(#${PRODUCTION_HOVER_SPOTLIGHT_MASK_ID})`}
                pointer-events="none"
            />

            {#each activeBoardSpotlightVisualState.outlinedLandAreaIds as areaId (areaId)}
                <Area
                    areaId={areaId}
                    fill="none"
                    stroke="#fff8d7"
                    fillOpacity="0"
                    strokeWidth="7.2"
                    strokeLineJoin="round"
                    strokeLineCap="round"
                    opacity="0.9"
                    pointer-events="none"
                />
                <Area
                    areaId={areaId}
                    fill="none"
                    stroke="#1f2937"
                    fillOpacity="0"
                    strokeWidth="2.2"
                    strokeLineJoin="round"
                    strokeLineCap="round"
                    opacity="0.88"
                    pointer-events="none"
                />
            {/each}

            {#each activeBoardSpotlightVisualState.highlightedProductionZoneMarkers as marker (marker.key)}
                <CompanyZoneMarker
                    x={marker.x}
                    y={marker.y}
                    targetX={marker.targetX}
                    targetY={marker.targetY}
                    playerColor={marker.ownerColor}
                    goodType={marker.goodType}
                    goodsCount={marker.goodsCount}
                    hatchPatternId={marker.hatchPatternId}
                    direction={marker.direction}
                    highlighted={true}
                />
            {/each}
        {/if}

        {#if shouldRenderExpansionSelectionSpotlightMask}
            <defs>
                <mask id={EXPANSION_SELECTION_SPOTLIGHT_MASK_ID} maskUnits="userSpaceOnUse">
                    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#ffffff"></rect>
                    {#each interactiveValidAreaIds as areaId (areaId)}
                        <Area areaId={areaId} fill="#000000" stroke="none" fillOpacity="1" pointer-events="none" />
                    {/each}
                </mask>
            </defs>

            <rect
                x="0"
                y="0"
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                fill="#000000"
                fill-opacity="0.34"
                mask={`url(#${EXPANSION_SELECTION_SPOTLIGHT_MASK_ID})`}
                pointer-events="none"
            />
        {/if}

        {#if shouldRenderCityPlacementSpotlightMask}
            <defs>
                <mask id={CITY_PLACEMENT_SPOTLIGHT_MASK_ID} maskUnits="userSpaceOnUse">
                    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#ffffff"></rect>
                    {#each interactiveValidAreaIds as areaId (areaId)}
                        <Area areaId={areaId} fill="#000000" stroke="none" fillOpacity="1" pointer-events="none" />
                    {/each}
                </mask>
            </defs>

            <rect
                x="0"
                y="0"
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                fill="#000000"
                fill-opacity="0.34"
                mask={`url(#${CITY_PLACEMENT_SPOTLIGHT_MASK_ID})`}
                pointer-events="none"
            />
        {/if}

        {#if hasHoveredRoutePreview && !hasHoveredCityReferenceCardSpotlight}
            {#each hoveredRoutePreviewDimmedLandAreaIds as areaId (areaId)}
                <Area
                    areaId={areaId}
                    fill="#000000"
                    stroke="none"
                    fillOpacity="0.42"
                    pointer-events="none"
                />
            {/each}
        {/if}

        {#if activeAreaInteraction}
            {#if !hasHoveredCityReferenceCardSpotlight &&
                activeAreaInteraction.action === 'expand' &&
                !hasHoveredRoutePreview &&
                !hasVisibleCompanySpotlightPreview}
                {#each interactiveValidAreaIds as areaId (areaId)}
                    {#if activeAreaInteraction.maskedAreaType !== IndonesiaAreaType.Sea}
                        <Area
                            areaId={areaId}
                            fill="none"
                            stroke="#fff8d7"
                            fillOpacity="0"
                            strokeWidth="6.2"
                            strokeLineJoin="round"
                            strokeLineCap="round"
                            opacity="0.9"
                            pointer-events="none"
                        />
                        <Area
                            areaId={areaId}
                            fill="none"
                            stroke="#1f2937"
                            fillOpacity="0"
                            strokeWidth="2.1"
                            strokeLineJoin="round"
                            strokeLineCap="round"
                            opacity="0.88"
                            pointer-events="none"
                        />
                    {/if}
                {/each}
            {/if}

            {#if seaHighlightState.source === 'board-preview'}
                {#each seaHighlightState.areaIds as areaId (areaId)}
                    <Area
                        areaId={areaId}
                        fill={SEA_HIGHLIGHT_FILL}
                        stroke="none"
                        fillOpacity={SEA_HIGHLIGHT_FILL_OPACITY}
                        pointer-events="none"
                    />
                {/each}
            {/if}

            {#if !hasHoveredCityReferenceCardSpotlight &&
                activeAreaInteraction.action === 'place-city' &&
                !hasHoveredRoutePreview &&
                !hasVisibleCompanySpotlightPreview &&
                !hasHoveredCityReferenceCardSpotlight}
                {#each interactiveValidAreaIds as areaId (areaId)}
                    <Area
                        areaId={areaId}
                        fill="none"
                        stroke="#fff8d7"
                        fillOpacity="0"
                        strokeWidth="6.2"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.9"
                        pointer-events="none"
                    />
                    <Area
                        areaId={areaId}
                        fill="none"
                        stroke="#1f2937"
                        fillOpacity="0"
                        strokeWidth="2.1"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity="0.88"
                        pointer-events="none"
                    />
                {/each}
            {/if}

            {#if !hasHoveredCityReferenceCardSpotlight &&
                !hasHoveredRoutePreview &&
                !hasVisibleCompanySpotlightPreview &&
                activeAreaInteraction.action !== 'select-delivery-cultivated' &&
                activeAreaInteraction.action !== 'expand' &&
                activeAreaInteraction.action !== 'place-city'}
                {#each maskedAreaIds as areaId (areaId)}
                    <Area
                        areaId={areaId}
                        fill="#000000"
                        stroke="none"
                        fillOpacity="0.5"
                        pointer-events="none"
                    />
                {/each}
            {/if}

            {#each interactiveValidAreaIds as areaId (areaId)}
                <Area
                    areaId={areaId}
                    fill="#ffffff"
                    stroke="none"
                    fillOpacity="0.001"
                    strokeWidth="0"
                    pointer-events={applyingAreaAction ? 'none' : 'all'}
                    cursor={applyingAreaAction ? 'default' : 'pointer'}
                    onmouseenter={() => {
                        hoveredAreaId = areaId
                        if (activeAreaInteraction.action === 'select-delivery-city') {
                            gameSession.setHoveredDeliveryCityArea(areaId)
                        }
                        if (activeAreaInteraction.action === 'select-delivery-cultivated') {
                            const zone = deliveryZoneByAreaId.get(areaId)
                            hoveredDeliveryZoneKey = zone?.key ?? null
                        }
                    }}
                    onmouseleave={() => {
                        if (hoveredAreaId === areaId) {
                            hoveredAreaId = null
                        }
                        if (activeAreaInteraction.action === 'select-delivery-city') {
                            gameSession.setHoveredDeliveryCityArea(undefined)
                        }
                        if (activeAreaInteraction.action === 'select-delivery-cultivated') {
                            hoveredDeliveryZoneKey = null
                        }
                    }}
                    onclick={() => {
                        handleAreaClick(areaId)
                    }}
                />
            {/each}

            {#if false}
                <defs>
                    {#each deliverySelectableZones as zone (zone.key)}
                        <mask id={deliveryZoneOutlineMaskId(zone.key)} maskUnits="userSpaceOnUse">
                            <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#000000"></rect>
                            {#each zone.allAreaIds as areaId (areaId)}
                                <Area
                                    areaId={areaId}
                                    fill="none"
                                    stroke="#ffffff"
                                    fillOpacity="0"
                                    strokeWidth="7.2"
                                    strokeLineJoin="round"
                                    strokeLineCap="round"
                                    pointer-events="none"
                                />
                            {/each}
                            {#each zone.allAreaIds as areaId (areaId)}
                                <Area areaId={areaId} fill="#000000" stroke="none" fillOpacity="1" pointer-events="none" />
                            {/each}
                        </mask>

                        <mask id={deliveryZoneInnerOutlineMaskId(zone.key)} maskUnits="userSpaceOnUse">
                            <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#000000"></rect>
                            {#each zone.allAreaIds as areaId (areaId)}
                                <Area
                                    areaId={areaId}
                                    fill="none"
                                    stroke="#ffffff"
                                    fillOpacity="0"
                                    strokeWidth="2.2"
                                    strokeLineJoin="round"
                                    strokeLineCap="round"
                                    pointer-events="none"
                                />
                            {/each}
                            {#each zone.allAreaIds as areaId (areaId)}
                                <Area areaId={areaId} fill="#000000" stroke="none" fillOpacity="1" pointer-events="none" />
                            {/each}
                        </mask>

                        <mask id={deliveryZoneHoverOutlineMaskId(zone.key)} maskUnits="userSpaceOnUse">
                            <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#000000"></rect>
                            {#each zone.allAreaIds as areaId (areaId)}
                                <Area
                                    areaId={areaId}
                                    fill="none"
                                    stroke="#ffffff"
                                    fillOpacity="0"
                                    strokeWidth="9.2"
                                    strokeLineJoin="round"
                                    strokeLineCap="round"
                                    pointer-events="none"
                                />
                            {/each}
                            {#each zone.allAreaIds as areaId (areaId)}
                                <Area areaId={areaId} fill="#000000" stroke="none" fillOpacity="1" pointer-events="none" />
                            {/each}
                        </mask>
                    {/each}
                </defs>
            {:else}
                {#if !hasHoveredCityReferenceCardSpotlight &&
                    activeAreaInteraction.action !== 'select-delivery-city' &&
                    !hasHoveredRoutePreview}
                    {#each hoveredInteractiveAreaIds as areaId (areaId)}
                        <Area
                            areaId={areaId}
                            fill="none"
                            stroke={activeAreaInteraction.outlineColor}
                            fillOpacity="0"
                            strokeWidth="4"
                            pointer-events="none"
                        />
                    {/each}
                {/if}
            {/if}

            {#if activeAreaInteraction.action === 'select-delivery-cultivated'}
                {#each deliverySelectableZoneMarkers as marker (marker.key)}
                    <circle
                        cx={marker.x}
                        cy={marker.y}
                        r="34"
                        fill="#ffffff"
                        fill-opacity="0.001"
                        pointer-events={applyingAreaAction ? 'none' : 'all'}
                        cursor={applyingAreaAction ? 'default' : 'pointer'}
                        onmouseenter={() => {
                            handleDeliveryZoneMarkerHover(marker.zoneKey)
                        }}
                        onmouseleave={() => {
                            handleDeliveryZoneMarkerLeave(marker.zoneKey)
                        }}
                        onclick={() => {
                            handleDeliveryZoneMarkerClick(marker.zoneKey)
                        }}
                    />
                {/each}
            {/if}
        {/if}

        {#if startCompanySelectionEnabled}
            <StartCompanyDeedSelectionOverlay
                deeds={startCompanyDeeds}
                {selectedStartCompanyDeedId}
                {applyingAreaAction}
                {hasHoveredCityReferenceCardSpotlight}
                onStageSelection={handleStartCompanyDeedStaged}
            />
        {/if}
    </g>
{/if}
