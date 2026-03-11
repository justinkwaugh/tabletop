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
    previewIntent:
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

export type ActiveBoardSpotlightVisualState<TMarker> = BoardSpotlightState<TMarker> & {
    previewSource: 'none' | 'company' | 'available-deed' | 'city-reference-card'
    shouldRenderMask: boolean
    hasCityReferenceCardSpotlight: boolean
    hasVisibleCompanySpotlight: boolean
}

export function deriveBoardSpotlightState<TMarker>(
    input: BoardSpotlightDerivationInput<TMarker>
): ActiveBoardSpotlightVisualState<TMarker> {
    const previewSource: 'none' | 'company' | 'available-deed' | 'city-reference-card' =
        input.previewIntent.source === 'city-reference-card' &&
        input.cityReferenceCardOverlayAreaIds.length > 0
            ? 'city-reference-card'
            : input.previewIntent.source === 'available-deed' &&
                input.availableDeedOverlayAreaIds.length > 0
              ? 'available-deed'
              : input.previewIntent.source === 'company'
                ? 'company'
                : 'none'

    if (
        previewSource === 'city-reference-card' &&
        input.cityReferenceCardOverlayAreaIds.length > 0
    ) {
        return {
            previewSource,
            source: 'city-reference-card',
            exemptAreaIds: input.cityReferenceCardOverlayAreaIds,
            seaOverlayAreaIds: [],
            outlinedLandAreaIds: input.cityReferenceCardOverlayAreaIds,
            deedCardMaskRect: null,
            cityReferenceCardMaskRect: input.cityReferenceCardMaskRect,
            highlightedProductionZoneMarkers: [],
            shouldRenderMask: true,
            hasCityReferenceCardSpotlight: true,
            hasVisibleCompanySpotlight: false
        }
    }

    if (previewSource === 'company') {
        return {
            previewSource,
            source: 'general',
            exemptAreaIds: input.companySpotlightAreaIds,
            seaOverlayAreaIds: [],
            outlinedLandAreaIds: input.productionCompanyAreaIds,
            deedCardMaskRect: null,
            cityReferenceCardMaskRect: null,
            highlightedProductionZoneMarkers: input.productionZoneMarkers,
            shouldRenderMask: true,
            hasCityReferenceCardSpotlight: false,
            hasVisibleCompanySpotlight: true
        }
    }

    if (
        previewSource === 'available-deed' &&
        input.availableDeedOverlayAreaIds.length > 0
    ) {
        return {
            previewSource,
            source: 'general',
            exemptAreaIds: input.availableDeedOverlayAreaIds,
            seaOverlayAreaIds: input.availableShippingDeedOverlayAreaIds,
            outlinedLandAreaIds: input.availableDeedOutlinedAreaIds,
            deedCardMaskRect: input.availableDeedCardMaskRect,
            cityReferenceCardMaskRect: null,
            highlightedProductionZoneMarkers: [],
            shouldRenderMask: true,
            hasCityReferenceCardSpotlight: false,
            hasVisibleCompanySpotlight: false
        }
    }

    return {
        previewSource,
        source: 'none',
        exemptAreaIds: [],
        seaOverlayAreaIds: [],
        outlinedLandAreaIds: [],
        deedCardMaskRect: null,
        cityReferenceCardMaskRect: null,
        highlightedProductionZoneMarkers: [],
        shouldRenderMask: false,
        hasCityReferenceCardSpotlight: false,
        hasVisibleCompanySpotlight: false
    }
}
