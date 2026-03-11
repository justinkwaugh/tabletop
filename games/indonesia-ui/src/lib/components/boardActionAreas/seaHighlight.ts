import { IndonesiaAreaType } from '@tabletop/indonesia'

export type ShippingDeedSeaOverlayState = {
    visibleShippingDeedIds: readonly string[]
    activeShippingPreviewDeedId: string | null
}

export type SeaHighlightState = {
    source: 'none' | 'board-preview' | 'shipping-expansion'
    areaIds: readonly string[]
}

export function deriveShippingDeedSeaOverlayState(input: {
    shippingDeedIds: readonly string[]
    activeDeedPreviewId: string | null
    showAllDeedOverlays: boolean
    suppressBoardEffectsForHistory: boolean
    cityReferenceCardPreviewWins: boolean
}): ShippingDeedSeaOverlayState {
    if (input.suppressBoardEffectsForHistory || input.cityReferenceCardPreviewWins) {
        return {
            visibleShippingDeedIds: [],
            activeShippingPreviewDeedId: null
        }
    }

    const activeShippingPreviewDeedId =
        input.activeDeedPreviewId && input.shippingDeedIds.includes(input.activeDeedPreviewId)
            ? input.activeDeedPreviewId
            : null

    if (input.showAllDeedOverlays) {
        return {
            visibleShippingDeedIds: input.shippingDeedIds,
            activeShippingPreviewDeedId
        }
    }

    return {
        visibleShippingDeedIds: activeShippingPreviewDeedId ? [activeShippingPreviewDeedId] : [],
        activeShippingPreviewDeedId
    }
}

export function deriveSeaHighlightState(input: {
    boardPreviewSeaAreaIds: readonly string[]
    activeAreaInteractionAction: string | null
    activeAreaInteractionMaskedAreaType: IndonesiaAreaType | null
    interactiveValidAreaIds: readonly string[]
    hasHoveredRoutePreview: boolean
    hasVisibleCompanySpotlightPreview: boolean
    hasHoveredCityReferenceCardSpotlight: boolean
}): SeaHighlightState {
    if (input.boardPreviewSeaAreaIds.length > 0) {
        return {
            source: 'board-preview',
            areaIds: input.boardPreviewSeaAreaIds
        }
    }

    if (
        input.activeAreaInteractionAction === 'expand' &&
        input.activeAreaInteractionMaskedAreaType === IndonesiaAreaType.Sea &&
        input.interactiveValidAreaIds.length > 0 &&
        !input.hasHoveredRoutePreview &&
        !input.hasVisibleCompanySpotlightPreview &&
        !input.hasHoveredCityReferenceCardSpotlight
    ) {
        return {
            source: 'shipping-expansion',
            areaIds: input.interactiveValidAreaIds
        }
    }

    return {
        source: 'none',
        areaIds: []
    }
}
