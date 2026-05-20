import type { BuildingType } from '@tabletop/urbino'

export type PlacementAnimRequest = {
    buildingType: BuildingType
    playerColor: string
    fromRect: DOMRect
    toRect: DOMRect
}

const buildingRefs = new Map<BuildingType, HTMLElement>()

export function registerBuildingButton(type: BuildingType, el: HTMLElement | null) {
    if (el) buildingRefs.set(type, el)
    else buildingRefs.delete(type)
}

export function getBuildingButtonRect(type: BuildingType): DOMRect | null {
    return buildingRefs.get(type)?.getBoundingClientRect() ?? null
}

let animCallback: ((req: PlacementAnimRequest) => void) | null = null

export const placementAnim = {
    register(cb: (req: PlacementAnimRequest) => void) {
        animCallback = cb
    },
    unregister() {
        animCallback = null
    },
    trigger(req: PlacementAnimRequest) {
        animCallback?.(req)
    },
}
