<script lang="ts">
    import { onMount } from 'svelte'
    import { animateStartedProductionMarker } from '$lib/animators/startCompanyAnimator.js'
    import CompanyZoneMarker from '$lib/components/CompanyZoneMarker.svelte'
    import { PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY } from '$lib/definitions/productionZoneMarkerOffsets.js'
    import type { ProductionZoneMarkerEntry } from '$lib/model/productionZoneMarkers.svelte.js'
    import { getProductionZoneMarkersContext } from '$lib/model/productionZoneMarkersContext.svelte.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { getStartCompanyAnimatorContext } from '$lib/model/startCompanyAnimatorContext.svelte.js'
    import { startedProductionZoneMarkerEntryForAction } from '$lib/utils/startedCompanyEntries.js'
    import type { Point } from '@tabletop/common'
    import { MachineState } from '@tabletop/indonesia'

    const PRODUCTION_ZONE_MARKER_OFFSETS_EVENT = 'indonesia-production-zone-marker-offsets-change'
    const HOVER_COMPANY_ZONE_TAG_MASK_OPACITY = 0.26
    const SELECTION_ZONE_TAG_MASK_OPACITY = 0.42
    const OPERATED_ZONE_TAG_MASK_OPACITY = 0.34

    const gameSession = getGameSession()
    const startCompanyAnimator = getStartCompanyAnimatorContext()
    const productionZoneMarkerModel = getProductionZoneMarkersContext()

    function parseProductionZoneMarkerOffsets(value: unknown): Record<string, Point> {
        if (!value || typeof value !== 'object') {
            return {}
        }

        const offsets: Record<string, Point> = {}
        for (const [deedId, candidate] of Object.entries(value)) {
            if (
                candidate &&
                typeof candidate === 'object' &&
                'x' in candidate &&
                'y' in candidate &&
                typeof candidate.x === 'number' &&
                typeof candidate.y === 'number'
            ) {
                offsets[deedId] = { x: candidate.x, y: candidate.y }
            }
        }
        return offsets
    }

    function loadDeveloperProductionZoneMarkerOffsets(): void {
        try {
            const stored = window.localStorage.getItem(PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY)
            productionZoneMarkerModel.developerOffsets = stored
                ? parseProductionZoneMarkerOffsets(JSON.parse(stored))
                : {}
        } catch {
            productionZoneMarkerModel.developerOffsets = {}
        }
    }

    onMount(() => {
        if (!gameSession.isDeveloperHarness) {
            return
        }

        loadDeveloperProductionZoneMarkerOffsets()

        const handleStorageChanged = (event: StorageEvent): void => {
            if (event.key === PRODUCTION_ZONE_MARKER_OFFSETS_STORAGE_KEY) {
                loadDeveloperProductionZoneMarkerOffsets()
            }
        }

        window.addEventListener(
            PRODUCTION_ZONE_MARKER_OFFSETS_EVENT,
            loadDeveloperProductionZoneMarkerOffsets
        )
        window.addEventListener('storage', handleStorageChanged)

        return () => {
            window.removeEventListener(
                PRODUCTION_ZONE_MARKER_OFFSETS_EVENT,
                loadDeveloperProductionZoneMarkerOffsets
            )
            window.removeEventListener('storage', handleStorageChanged)
        }
    })

    const productionZoneMarkers: ProductionZoneMarkerEntry[] = $derived(
        productionZoneMarkerModel.entries
    )

    const spotlightedProductionCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return new Set<string>()
        }

        const productionCompanyIds = new Set<string>()

        for (const companyId of gameSession.activeBoardSpotlightProductionCompanyIds) {
            productionCompanyIds.add(companyId)
        }

        return productionCompanyIds
    })

    const baseProductionZoneMarkers: ProductionZoneMarkerEntry[] = $derived.by(() => {
        if (spotlightedProductionCompanyIdSet.size === 0) {
            return productionZoneMarkers
        }
        return productionZoneMarkers.filter(
            (marker) => !spotlightedProductionCompanyIdSet.has(marker.companyId)
        )
    })

    const highlightedProductionZoneMarkers: ProductionZoneMarkerEntry[] = $derived.by(() => {
        if (spotlightedProductionCompanyIdSet.size === 0) {
            return []
        }
        return productionZoneMarkers.filter((marker) =>
            spotlightedProductionCompanyIdSet.has(marker.companyId)
        )
    })

    const startedProductionZoneMarkers = $derived.by(() => {
        return gameSession.visibleStartedCompanyAnimationEntries
            .map((entry) =>
                startedProductionZoneMarkerEntryForAction({
                    gameState: gameSession.gameState,
                    action: entry.action,
                    ownerColor: gameSession.colors.getPlayerUiColor(entry.action.playerId)
                })
            )
            .filter((marker): marker is NonNullable<typeof marker> => marker !== null)
    })

    const maskNonSelectableZoneTagsDuringDeliverySelection: boolean = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        return (
            gameSession.deliverySelectionEnabled &&
            gameSession.deliverySelectionStage === 'cultivated'
        )
    })

    const selectableDeliveryZoneMarkerKeySet: ReadonlySet<string> = $derived.by(() => {
        if (!maskNonSelectableZoneTagsDuringDeliverySelection) {
            return new Set<string>()
        }

        const operatingCompanyId = gameSession.gameState.operatingCompanyId
        if (!operatingCompanyId) {
            return new Set<string>()
        }

        const remainingCultivatedAreaIdSet = new Set(gameSession.deliveryAvailableCultivatedAreaIds)
        if (remainingCultivatedAreaIdSet.size === 0) {
            return new Set<string>()
        }

        return new Set(
            productionZoneMarkers
                .filter(
                    (marker) =>
                        marker.companyId === operatingCompanyId &&
                        marker.zoneAreaIds.some((areaId) =>
                            remainingCultivatedAreaIdSet.has(areaId)
                        )
                )
                .map((marker) => marker.key)
        )
    })

    const maskNonSpotlightZoneTagsDuringCompanyHover: boolean = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        return spotlightedProductionCompanyIdSet.size > 0
    })

    const maskAllZoneTagsDuringNonProductionCompanyHover: boolean = $derived.by(() => {
        if (gameSession.cityReferenceCardPreviewWins) {
            return false
        }
        const hasAnyCompanySpotlight = gameSession.activeBoardSpotlightCompanyIds.length > 0
        return hasAnyCompanySpotlight && spotlightedProductionCompanyIdSet.size === 0
    })

    const hoveredRoutePreviewSourceAreaIdSet: ReadonlySet<string> = $derived.by(() => {
        return gameSession.activeRoutePreviewVisualState?.sourceAreaIdSet ?? new Set<string>()
    })

    const hasHoveredRoutePreview: boolean = $derived.by(() => {
        return gameSession.activeRoutePreviewVisualState !== null
    })

    const operatedCompanyIdSet: ReadonlySet<string> = $derived.by(() => {
        const state = gameSession.gameState.machineState
        const inOperationsPhase =
            state === MachineState.Operations ||
            state === MachineState.ShippingOperations ||
            state === MachineState.ProductionOperations
        return inOperationsPhase
            ? new Set(gameSession.gameState.operatedCompanyIds)
            : new Set<string>()
    })

    function isMarkerUnavailable(marker: ProductionZoneMarkerEntry): boolean {
        return operatedCompanyIdSet.has(marker.companyId)
    }

    function isMarkerMaskedByRoutePreview(marker: ProductionZoneMarkerEntry): boolean {
        if (!hasHoveredRoutePreview) {
            return false
        }
        return !marker.zoneAreaIds.some((areaId) => hoveredRoutePreviewSourceAreaIdSet.has(areaId))
    }

    function isMarkerMasked(marker: ProductionZoneMarkerEntry): boolean {
        if (isMarkerUnavailable(marker)) {
            return true
        }
        if (isMarkerMaskedByRoutePreview(marker)) {
            return true
        }
        if (
            maskNonSelectableZoneTagsDuringDeliverySelection &&
            !selectableDeliveryZoneMarkerKeySet.has(marker.key)
        ) {
            return true
        }
        if (
            maskNonSpotlightZoneTagsDuringCompanyHover &&
            !spotlightedProductionCompanyIdSet.has(marker.companyId)
        ) {
            return true
        }
        if (maskAllZoneTagsDuringNonProductionCompanyHover) {
            return true
        }
        return false
    }

    function isMarkerMaskedByCompanyHover(marker: ProductionZoneMarkerEntry): boolean {
        if (
            maskNonSpotlightZoneTagsDuringCompanyHover &&
            !spotlightedProductionCompanyIdSet.has(marker.companyId)
        ) {
            return true
        }
        if (maskAllZoneTagsDuringNonProductionCompanyHover) {
            return true
        }
        return false
    }

    function maskedOpacityForMarker(marker: ProductionZoneMarkerEntry): number {
        if (!isMarkerMasked(marker)) {
            return 0
        }
        if (isMarkerUnavailable(marker)) {
            return OPERATED_ZONE_TAG_MASK_OPACITY
        }
        if (isMarkerMaskedByRoutePreview(marker)) {
            return HOVER_COMPANY_ZONE_TAG_MASK_OPACITY
        }
        if (
            maskNonSelectableZoneTagsDuringDeliverySelection &&
            !selectableDeliveryZoneMarkerKeySet.has(marker.key)
        ) {
            return SELECTION_ZONE_TAG_MASK_OPACITY
        }
        if (isMarkerMaskedByCompanyHover(marker)) {
            return HOVER_COMPANY_ZONE_TAG_MASK_OPACITY
        }
        return SELECTION_ZONE_TAG_MASK_OPACITY
    }

    function toggleProductionZoneRenderStyle(): void {
        gameSession.toggleProductionZoneRenderStyle()
    }
</script>

<g class="pointer-events-none select-none" aria-label="Production zone markers layer">
    {#each baseProductionZoneMarkers as marker (marker.key)}
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
            highlighted={false}
            masked={isMarkerMasked(marker)}
            maskedOpacity={maskedOpacityForMarker(marker)}
            onClick={toggleProductionZoneRenderStyle}
        />
    {/each}

    {#if highlightedProductionZoneMarkers.length > 0}
        {#each highlightedProductionZoneMarkers as marker (marker.key)}
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
                masked={isMarkerMasked(marker)}
                maskedOpacity={maskedOpacityForMarker(marker)}
                onClick={toggleProductionZoneRenderStyle}
            />
        {/each}
    {/if}

    {#each startedProductionZoneMarkers as marker (marker.key)}
        <g
            opacity="0"
            use:animateStartedProductionMarker={{
                animator: startCompanyAnimator,
                companyId: marker.companyId
            }}
        >
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
                highlighted={false}
                masked={false}
                maskedOpacity={0}
                onClick={toggleProductionZoneRenderStyle}
            />
        </g>
    {/each}
</g>
