<script lang="ts">
    import Area from '$lib/components/Area.svelte'
    import CompanyZoneMarker from '$lib/components/CompanyZoneMarker.svelte'
    import { companyDeedStyleForType } from '$lib/components/CompanyDeed.svelte'
    import { boardAreaPathById } from '$lib/definitions/boardGeometry.js'
    import {
        BOARD_DEED_CARD_CORNER_RX,
        BOARD_DEED_CARD_CORNER_RY,
        BOARD_DEED_CARD_HEIGHT,
        BOARD_DEED_CARD_WIDTH
    } from '$lib/definitions/companyDeedGeometry.js'
    import { DEED_CARD_POSITIONS } from '$lib/definitions/deedCardPositions.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { deedPositionLookupKeys } from '$lib/utils/deeds.js'
    import {
        ActionType,
        CompanyType,
        HydratedExpand,
        HydratedGrowCity,
        HydratedPlaceCity,
        HydratedStartCompany,
        IndonesiaAreaType,
        IndonesiaNeighborDirection,
        MachineState
    } from '@tabletop/indonesia'

    const gameSession = getGameSession()
    const BOARD_WIDTH = 2646
    const BOARD_HEIGHT = 1280
    const PRODUCTION_HOVER_SPOTLIGHT_MASK_ID = 'production-company-hover-spotlight-mask'
    const DELIVERY_ZONE_OUTLINE_MASK_ID = 'delivery-zone-outline-mask'
    const DELIVERY_ZONE_INNER_OUTLINE_MASK_ID = 'delivery-zone-inner-outline-mask'
    const DELIVERY_ZONE_HOVER_OUTLINE_MASK_ID = 'delivery-zone-hover-outline-mask'
    const SHIPPING_HIGHLIGHT_STYLE = companyDeedStyleForType('ship')

    type AreaInteractionAction =
        | 'place-city'
        | 'grow-city'
        | 'start-company'
        | 'expand'
        | 'remove-siap-saji-area'
        | 'select-delivery-cultivated'
        | 'select-delivery-city'
    type ActiveAreaInteraction = {
        action: AreaInteractionAction
        validAreaIds: readonly string[]
        outlineColor: string
        maskedAreaType: IndonesiaAreaType
        maskInvalidAreas: boolean
    }

    type StartCompanyDeedEntry = {
        deedId: string
        type: CompanyType
        x: number
        y: number
    }

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

    type DeliverySelectableZone = {
        key: string
        companyId: string
        allAreaIds: readonly string[]
        remainingAreaIds: readonly string[]
    }

    type DeliverySelectableZoneMarker = {
        key: string
        zoneKey: string
        x: number
        y: number
    }

    function areaHasShips(area: Record<string, unknown>): area is Record<string, unknown> & {
        ships: string[]
    } {
        return Array.isArray(area.ships)
    }

    let hoveredAreaId: string | null = $state(null)
    let hoveredDeliveryZoneKey: string | null = $state(null)
    let hoveredStartCompanyDeedId: string | null = $state(null)
    let selectedStartCompanyDeedId: string | null = $state(null)
    let applyingAreaAction = $state(false)

    const myPlayerId: string | null = $derived(gameSession.myPlayer?.id ?? null)

    const startCompanySelectionEnabled: boolean = $derived.by(() => {
        return (
            !!myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Acquisitions &&
            gameSession.gameState.availableDeeds.length > 0
        )
    })

    const canApplyStartCompanyAction: boolean = $derived.by(() => {
        return (
            !!myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Acquisitions
        )
    })

    const startCompanyDeeds: StartCompanyDeedEntry[] = $derived.by(() => {
        if (!startCompanySelectionEnabled) {
            return []
        }

        const deeds: StartCompanyDeedEntry[] = []
        const availableDeeds = gameSession.gameState.availableDeeds
        for (const deed of availableDeeds) {
            const position = deedPositionLookupKeys(deed)
                .map((key) => DEED_CARD_POSITIONS[key])
                .find((point) => point !== undefined)
            if (!position) {
                continue
            }

            deeds.push({
                deedId: deed.id,
                type: deed.type,
                x: position.x,
                y: position.y
            })
        }

        return deeds
    })

    const startCompanyDeedById: Map<string, StartCompanyDeedEntry> = $derived.by(() => {
        return new Map(startCompanyDeeds.map((deed) => [deed.deedId, deed]))
    })

    const selectedStartCompanyDeed: StartCompanyDeedEntry | null = $derived.by(() => {
        if (!selectedStartCompanyDeedId) {
            return null
        }
        return startCompanyDeedById.get(selectedStartCompanyDeedId) ?? null
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
        if (
            !myPlayerId ||
            !deliverySelectionEnabled ||
            gameSession.deliverySelectionStage !== 'cultivated'
        ) {
            return []
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return []
        }

        const operatingCompany = gameSession.gameState.companies.find(
            (company) => company.id === operatingCompanyId
        )
        if (!operatingCompany || operatingCompany.type !== CompanyType.Production) {
            return []
        }

        const companyAreaIds = Object.values(gameSession.gameState.board.areas)
            .filter((area) => 'companyId' in area && area.companyId === operatingCompanyId)
            .map((area) => area.id)
            .filter((areaId) => !!boardAreaPathById(areaId))
            .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

        if (companyAreaIds.length === 0) {
            return []
        }

        const companyAreaIdSet = new Set(companyAreaIds)
        const remainingDeliverableAreaIdSet = new Set(gameSession.deliveryAvailableCultivatedAreaIds)
        const unvisited = [...companyAreaIds]
        const zones: DeliverySelectableZone[] = []

        while (unvisited.length > 0) {
            const seedAreaId = unvisited.shift()
            if (!seedAreaId) {
                continue
            }

            const queue: string[] = [seedAreaId]
            const zoneAreaIds: string[] = []
            companyAreaIdSet.delete(seedAreaId)

            while (queue.length > 0) {
                const currentAreaId = queue.shift()
                if (!currentAreaId) {
                    continue
                }

                zoneAreaIds.push(currentAreaId)
                const currentNode = gameSession.gameState.board.graph.nodeById(currentAreaId)
                if (!currentNode) {
                    continue
                }

                for (const neighborNode of gameSession.gameState.board.graph.neighborsOf(
                    currentNode,
                    IndonesiaNeighborDirection.Land
                )) {
                    if (!companyAreaIdSet.has(neighborNode.id)) {
                        continue
                    }

                    companyAreaIdSet.delete(neighborNode.id)
                    queue.push(neighborNode.id)
                    const remainingIndex = unvisited.indexOf(neighborNode.id)
                    if (remainingIndex >= 0) {
                        unvisited.splice(remainingIndex, 1)
                    }
                }
            }

            zoneAreaIds.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
            const remainingAreaIds = zoneAreaIds.filter((areaId) =>
                remainingDeliverableAreaIdSet.has(areaId)
            )
            if (remainingAreaIds.length === 0) {
                continue
            }

            zones.push({
                key: zoneAreaIds[0] ?? `zone-${zones.length}`,
                companyId: operatingCompanyId,
                allAreaIds: zoneAreaIds,
                remainingAreaIds
            })
        }

        return zones.sort((left, right) =>
            left.key.localeCompare(right.key, undefined, { numeric: true })
        )
    })

    const deliverySelectableAreaIds: readonly string[] = $derived.by(() => {
        if (deliverySelectableZones.length === 0) {
            return []
        }

        const areaIds = new Set<string>()
        for (const zone of deliverySelectableZones) {
            for (const areaId of zone.allAreaIds) {
                areaIds.add(areaId)
            }
        }

        return [...areaIds].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    })

    const deliveryZoneByAreaId: Map<string, DeliverySelectableZone> = $derived.by(() => {
        const byAreaId = new Map<string, DeliverySelectableZone>()
        for (const zone of deliverySelectableZones) {
            for (const areaId of zone.allAreaIds) {
                byAreaId.set(areaId, zone)
            }
        }
        return byAreaId
    })

    const deliveryZoneByKey: Map<string, DeliverySelectableZone> = $derived.by(() => {
        return new Map(deliverySelectableZones.map((zone) => [zone.key, zone]))
    })

    $effect(() => {
        if (!startCompanySelectionEnabled) {
            selectedStartCompanyDeedId = null
            hoveredStartCompanyDeedId = null
            gameSession.setHoveredAvailableDeed(undefined)
            hoveredAreaId = null
            return
        }

        if (selectedStartCompanyDeedId && !startCompanyDeedById.has(selectedStartCompanyDeedId)) {
            selectedStartCompanyDeedId = null
            hoveredAreaId = null
        }

        if (hoveredStartCompanyDeedId && !startCompanyDeedById.has(hoveredStartCompanyDeedId)) {
            hoveredStartCompanyDeedId = null
        }
    })

    $effect(() => {
        if (activeAreaInteraction?.action !== 'select-delivery-cultivated') {
            hoveredDeliveryZoneKey = null
        }
    })

    const activeAreaInteraction: ActiveAreaInteraction | null = $derived.by(() => {
        if (
            myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.Mergers &&
            gameSession.validActionTypes.includes(ActionType.RemoveSiapSajiArea)
        ) {
            const validAreaIds = gameSession.siapSajiRemovalAreaIds
            if (validAreaIds.length === 0) {
                return null
            }

            return {
                action: 'remove-siap-saji-area',
                validAreaIds,
                outlineColor: '#fef3c7',
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        if (
            myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.gameState.machineState === MachineState.CityGrowth &&
            gameSession.validActionTypes.includes(ActionType.GrowCity)
        ) {
            const validAreaIds = Array.from(
                HydratedGrowCity.validCityAreaIds(gameSession.gameState, myPlayerId)
            )
            if (validAreaIds.length === 0) {
                return null
            }

            return {
                action: 'grow-city',
                validAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        if (
            myPlayerId &&
            gameSession.isMyTurn &&
            gameSession.isNewEra &&
            gameSession.validActionTypes.includes(ActionType.PlaceCity)
        ) {
            const validAreaIds = Array.from(
                HydratedPlaceCity.validAreaIds(gameSession.gameState, myPlayerId)
            )
            if (validAreaIds.length === 0) {
                return null
            }

            return {
                action: 'place-city',
                validAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        if (myPlayerId && shippingExpandValidAreaIds.length > 0) {
            return {
                action: 'expand',
                validAreaIds: shippingExpandValidAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType: IndonesiaAreaType.Sea,
                maskInvalidAreas: false
            }
        }

        if (myPlayerId && productionExpandValidAreaIds.length > 0) {
            return {
                action: 'expand',
                validAreaIds: productionExpandValidAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType: IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        if (myPlayerId && deliverySelectionEnabled) {
            if (gameSession.deliverySelectionStage === 'cultivated') {
                const validAreaIds = deliverySelectableAreaIds
                if (validAreaIds.length === 0) {
                    return null
                }

                return {
                    action: 'select-delivery-cultivated',
                    validAreaIds,
                    outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                    maskedAreaType: IndonesiaAreaType.Land,
                    maskInvalidAreas: true
                }
            }

            if (gameSession.deliverySelectionStage === 'city') {
                const validAreaIds = gameSession.deliveryAvailableCityAreaIds.filter((areaId) =>
                    boardAreaPathById(areaId)
                )
                if (validAreaIds.length === 0) {
                    return null
                }

                return {
                    action: 'select-delivery-city',
                    validAreaIds,
                    outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                    maskedAreaType: IndonesiaAreaType.Land,
                    maskInvalidAreas: true
                }
            }
        }

        if (myPlayerId && selectedStartCompanyDeed) {
            if (startCompanyValidAreaIds.length === 0) {
                return null
            }
            return {
                action: 'start-company',
                validAreaIds: startCompanyValidAreaIds,
                outlineColor: gameSession.colors.getPlayerUiColor(myPlayerId),
                maskedAreaType:
                    selectedStartCompanyDeed.type === CompanyType.Shipping
                        ? IndonesiaAreaType.Sea
                        : IndonesiaAreaType.Land,
                maskInvalidAreas: true
            }
        }

        return null
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

    const hoveredSpotlightCompanyIds: readonly string[] = $derived.by(() => {
        if (gameSession.hoveredCompanySpotlightCompanyIds.length > 0) {
            return gameSession.hoveredCompanySpotlightCompanyIds
        }
        const hoveredCompanyId = gameSession.hoveredOperatingCompanyId
        if (!hoveredCompanyId) {
            return []
        }
        return [hoveredCompanyId]
    })

    const hoveredProductionCompanyAreaIds: readonly string[] = $derived.by(() => {
        if (hoveredSpotlightCompanyIds.length === 0) {
            return []
        }
        const hoveredProductionCompanyIdSet = new Set(
            hoveredSpotlightCompanyIds.filter((companyId) => {
                const company = gameSession.gameState.companies.find((entry) => entry.id === companyId)
                return !!company && company.type === CompanyType.Production
            })
        )
        if (hoveredProductionCompanyIdSet.size <= 0) {
            return []
        }

        const highlightedAreaIds: string[] = []
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!('companyId' in area) || !hoveredProductionCompanyIdSet.has(area.companyId)) {
                continue
            }
            if (!boardAreaPathById(area.id)) {
                continue
            }
            highlightedAreaIds.push(area.id)
        }

        return highlightedAreaIds.sort((left, right) => left.localeCompare(right))
    })

    const hoveredShippingCompanyAreaIds: readonly string[] = $derived.by(() => {
        if (hoveredSpotlightCompanyIds.length === 0) {
            return []
        }
        const hoveredShippingCompanyIdSet = new Set(
            hoveredSpotlightCompanyIds.filter((companyId) => {
                const company = gameSession.gameState.companies.find((entry) => entry.id === companyId)
                return !!company && company.type === CompanyType.Shipping
            })
        )
        if (hoveredShippingCompanyIdSet.size <= 0) {
            return []
        }

        const highlightedSeaAreaIds: string[] = []
        for (const area of Object.values(gameSession.gameState.board.areas)) {
            if (!areaHasShips(area) || !area.ships.some((companyId) => hoveredShippingCompanyIdSet.has(companyId))) {
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
        return [...new Set([...hoveredProductionCompanyAreaIds, ...hoveredShippingCompanyAreaIds])]
    })

    const hoveredProductionCompanyIds: readonly string[] = $derived.by(() => {
        return hoveredSpotlightCompanyIds.filter((companyId) => {
            const hoveredCompany = gameSession.gameState.companies.find(
                (company) => company.id === companyId
            )
            return !!hoveredCompany && hoveredCompany.type === CompanyType.Production
        })
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
        if (
            activeAreaInteraction?.action !== 'select-delivery-cultivated' ||
            deliverySelectableZones.length === 0 ||
            typeof window === 'undefined'
        ) {
            return []
        }

        const selectableZoneKeySet = new Set(deliverySelectableZones.map((zone) => zone.key))
        const markerEntries = (
            window as Window & {
                __indonesiaProductionZoneMarkerEntries?: HoveredProductionZoneMarker[]
            }
        ).__indonesiaProductionZoneMarkerEntries
        if (!Array.isArray(markerEntries) || markerEntries.length === 0) {
            return []
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return []
        }

        return markerEntries
            .filter((marker) => marker.companyId === operatingCompanyId)
            .map((marker) => {
                const zoneAreaIds = [...marker.zoneAreaIds].sort((left, right) =>
                    left.localeCompare(right, undefined, { numeric: true })
                )
                const zoneKey = zoneAreaIds[0]
                if (!zoneKey || !selectableZoneKeySet.has(zoneKey)) {
                    return null
                }
                return {
                    key: marker.key,
                    zoneKey,
                    x: marker.x,
                    y: marker.y
                } satisfies DeliverySelectableZoneMarker
            })
            .filter((entry): entry is DeliverySelectableZoneMarker => entry !== null)
    })

    function selectDeliveryCultivatedZone(zone: DeliverySelectableZone): void {
        const selectedAreaId = [...zone.remainingAreaIds]
            .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))[0]
        if (!selectedAreaId) {
            return
        }

        gameSession.selectDeliveryCultivatedArea(selectedAreaId)
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
            selectedStartCompanyDeedId = null
        } finally {
            applyingAreaAction = false
        }
    }

    function selectStartCompanyDeed(deedId: string): void {
        if (!startCompanySelectionEnabled || applyingAreaAction) {
            return
        }
        selectedStartCompanyDeedId = deedId
        hoveredAreaId = null
    }
</script>

{#if activeAreaInteraction || startCompanySelectionEnabled || hoveredCompanySpotlightAreaIds.length > 0}
    <g class="select-none" aria-label="Board action areas layer">
        {#if hoveredCompanySpotlightAreaIds.length > 0}
            <defs>
                <mask id={PRODUCTION_HOVER_SPOTLIGHT_MASK_ID} maskUnits="userSpaceOnUse">
                    <rect x="0" y="0" width={BOARD_WIDTH} height={BOARD_HEIGHT} fill="#ffffff"></rect>
                    {#each hoveredCompanySpotlightAreaIds as areaId (areaId)}
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
                mask={`url(#${PRODUCTION_HOVER_SPOTLIGHT_MASK_ID})`}
                pointer-events="none"
            />

            {#each hoveredProductionCompanyAreaIds as areaId (areaId)}
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

            {#each hoveredProductionZoneMarkers as marker (marker.key)}
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

        {#if activeAreaInteraction}
            {#if activeAreaInteraction.action === 'expand' &&
                activeAreaInteraction.maskedAreaType === IndonesiaAreaType.Sea}
                {#each interactiveValidAreaIds as areaId (areaId)}
                    <Area
                        areaId={areaId}
                        fill={SHIPPING_HIGHLIGHT_STYLE.overlayFill}
                        stroke={SHIPPING_HIGHLIGHT_STYLE.overlayStroke}
                        fillOpacity="1"
                        fillRule="evenodd"
                        strokeWidth="1.9"
                        strokeLineJoin="round"
                        strokeLineCap="round"
                        opacity={SHIPPING_HIGHLIGHT_STYLE.overlayOpacity}
                        pointer-events="none"
                    />
                {/each}
            {/if}

            {#each maskedAreaIds as areaId (areaId)}
                <Area
                    areaId={areaId}
                    fill="#000000"
                    stroke="none"
                    fillOpacity="0.5"
                    pointer-events="none"
                />
            {/each}

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
                        if (activeAreaInteraction.action === 'select-delivery-cultivated') {
                            const zone = deliveryZoneByAreaId.get(areaId)
                            hoveredDeliveryZoneKey = zone?.key ?? null
                        }
                    }}
                    onmouseleave={() => {
                        if (hoveredAreaId === areaId) {
                            hoveredAreaId = null
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

            {#if activeAreaInteraction.action === 'select-delivery-cultivated'}
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

                {#each deliverySelectableZones as zone (zone.key)}
                    {@const isHoveredZone = hoveredDeliveryZoneKey === zone.key}
                    {@const outerMask = deliveryZoneOutlineMaskId(zone.key)}
                    {@const innerMask = deliveryZoneInnerOutlineMaskId(zone.key)}
                    {@const hoverMask = deliveryZoneHoverOutlineMaskId(zone.key)}

                    <rect
                        x="0"
                        y="0"
                        width={BOARD_WIDTH}
                        height={BOARD_HEIGHT}
                        fill="#fff8d7"
                        fillOpacity="0.9"
                        mask={`url(#${outerMask})`}
                        pointer-events="none"
                    />
                    <rect
                        x="0"
                        y="0"
                        width={BOARD_WIDTH}
                        height={BOARD_HEIGHT}
                        fill="#1f2937"
                        fillOpacity="0.88"
                        mask={`url(#${innerMask})`}
                        pointer-events="none"
                    />
                    {#if isHoveredZone}
                        <rect
                            x="0"
                            y="0"
                            width={BOARD_WIDTH}
                            height={BOARD_HEIGHT}
                            fill="#fff8d7"
                            fillOpacity="0.32"
                            mask={`url(#${hoverMask})`}
                            pointer-events="none"
                        />
                    {/if}
                {/each}
            {:else}
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
            {#each startCompanyDeeds as deed (deed.deedId)}
                {@const isSelected = selectedStartCompanyDeedId === deed.deedId}
                {@const isHovered = hoveredStartCompanyDeedId === deed.deedId}
                <rect
                    x={deed.x - BOARD_DEED_CARD_WIDTH / 2}
                    y={deed.y - BOARD_DEED_CARD_HEIGHT / 2}
                    width={BOARD_DEED_CARD_WIDTH}
                    height={BOARD_DEED_CARD_HEIGHT}
                    rx={BOARD_DEED_CARD_CORNER_RX}
                    ry={BOARD_DEED_CARD_CORNER_RY}
                    fill={isSelected ? '#ffffff' : '#000000'}
                    fill-opacity={isSelected ? 0.14 : isHovered ? 0.08 : 0.001}
                    stroke={isSelected || isHovered ? startCompanyDeedOutlineColor : 'none'}
                    stroke-width={isSelected ? 3 : 2}
                    pointer-events={applyingAreaAction ? 'none' : 'all'}
                    cursor={applyingAreaAction ? 'default' : 'pointer'}
                    onmouseenter={() => {
                        hoveredStartCompanyDeedId = deed.deedId
                        gameSession.setHoveredAvailableDeed(deed.deedId)
                    }}
                    onmouseleave={() => {
                        if (hoveredStartCompanyDeedId === deed.deedId) {
                            hoveredStartCompanyDeedId = null
                        }
                        if (gameSession.hoveredAvailableDeedId === deed.deedId) {
                            gameSession.setHoveredAvailableDeed(undefined)
                        }
                    }}
                    onpointerdown={() => {
                        selectStartCompanyDeed(deed.deedId)
                    }}
                />
            {/each}
        {/if}
    </g>
{/if}
