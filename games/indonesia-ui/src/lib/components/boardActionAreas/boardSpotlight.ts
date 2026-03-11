export type SpotlightMaskRect = {
    x: number
    y: number
    width: number
    height: number
    rx: number
    ry: number
}

export type BoardSpotlightState<TMarker> = {
    source: 'none' | 'general' | 'city-reference-card'
    exemptAreaIds: readonly string[]
    seaOverlayAreaIds: readonly string[]
    outlinedLandAreaIds: readonly string[]
    deedCardMaskRect: SpotlightMaskRect | null
    cityReferenceCardMaskRect: SpotlightMaskRect | null
    highlightedProductionZoneMarkers: readonly TMarker[]
}

export type BoardSpotlightDerivationInput<TMarker> = {
    previewSource: 'none' | 'company' | 'available-deed' | 'city-reference-card'
    cityReferenceCardOverlayAreaIds: readonly string[]
    cityReferenceCardMaskRect: SpotlightMaskRect | null
    companySpotlightAreaIds: readonly string[]
    productionCompanyAreaIds: readonly string[]
    productionZoneMarkers: readonly TMarker[]
    availableDeedOverlayAreaIds: readonly string[]
    availableShippingDeedOverlayAreaIds: readonly string[]
    availableDeedOutlinedAreaIds: readonly string[]
    availableDeedCardMaskRect: SpotlightMaskRect | null
}

export function deriveBoardSpotlightState<TMarker>(
    input: BoardSpotlightDerivationInput<TMarker>
): BoardSpotlightState<TMarker> {
    if (
        input.previewSource === 'city-reference-card' &&
        input.cityReferenceCardOverlayAreaIds.length > 0
    ) {
        return {
            source: 'city-reference-card',
            exemptAreaIds: input.cityReferenceCardOverlayAreaIds,
            seaOverlayAreaIds: [],
            outlinedLandAreaIds: input.cityReferenceCardOverlayAreaIds,
            deedCardMaskRect: null,
            cityReferenceCardMaskRect: input.cityReferenceCardMaskRect,
            highlightedProductionZoneMarkers: []
        }
    }

    if (input.previewSource === 'company') {
        return {
            source: 'general',
            exemptAreaIds: input.companySpotlightAreaIds,
            seaOverlayAreaIds: [],
            outlinedLandAreaIds: input.productionCompanyAreaIds,
            deedCardMaskRect: null,
            cityReferenceCardMaskRect: null,
            highlightedProductionZoneMarkers: input.productionZoneMarkers
        }
    }

    if (
        input.previewSource === 'available-deed' &&
        input.availableDeedOverlayAreaIds.length > 0
    ) {
        return {
            source: 'general',
            exemptAreaIds: input.availableDeedOverlayAreaIds,
            seaOverlayAreaIds: input.availableShippingDeedOverlayAreaIds,
            outlinedLandAreaIds: input.availableDeedOutlinedAreaIds,
            deedCardMaskRect: input.availableDeedCardMaskRect,
            cityReferenceCardMaskRect: null,
            highlightedProductionZoneMarkers: []
        }
    }

    return {
        source: 'none',
        exemptAreaIds: [],
        seaOverlayAreaIds: [],
        outlinedLandAreaIds: [],
        deedCardMaskRect: null,
        cityReferenceCardMaskRect: null,
        highlightedProductionZoneMarkers: []
    }
}
