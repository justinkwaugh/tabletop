import { getContext, setContext } from 'svelte'
import type { ProductionZoneMarkers } from '$lib/model/productionZoneMarkers.svelte.js'

const PRODUCTION_ZONE_MARKERS_CONTEXT = Symbol('indonesia-production-zone-markers')

export function setProductionZoneMarkersContext(
    markers: ProductionZoneMarkers
): ProductionZoneMarkers {
    setContext(PRODUCTION_ZONE_MARKERS_CONTEXT, markers)
    return markers
}

export function getProductionZoneMarkersContext(): ProductionZoneMarkers {
    const markers = getContext<ProductionZoneMarkers>(PRODUCTION_ZONE_MARKERS_CONTEXT)
    if (!markers) {
        throw new Error('ProductionZoneMarkers context not found')
    }
    return markers
}
