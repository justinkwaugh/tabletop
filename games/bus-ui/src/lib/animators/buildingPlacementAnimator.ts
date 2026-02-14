import type { AnimationContext } from '@tabletop/frontend-components'
import type { GameAction } from '@tabletop/common'
import { gsap } from 'gsap'
import {
    type Building,
    isPlaceBuilding,
    isSiteId,
    type BuildingSiteId,
    type BuildingType,
    type BusGameState,
    type HydratedBusGameState
} from '@tabletop/bus'
import { tick } from 'svelte'
import { StateAnimator } from './stateAnimator.js'
import type { BusGameSession } from '$lib/model/session.svelte.js'

type BuildingPlacementAnimatorCallbacks = {
    onPlacementStart: (args: { siteId: BuildingSiteId; buildingType: BuildingType }) => void
}

const INITIAL_SCALE = 0.2
const POP_OVERSHOOT_SCALE = 1.16
const FALLBACK_POP_DURATION = 0.1
const FALLBACK_SETTLE_DURATION = 0.08
const FALLBACK_REMOVAL_POP_DURATION = 0.08
const FALLBACK_REMOVAL_SHRINK_DURATION = 0.12

export class BuildingPlacementAnimator extends StateAnimator<
    BusGameState,
    HydratedBusGameState,
    BusGameSession
> {
    private buildingElements = new Map<BuildingSiteId, HTMLElement | SVGElement>()

    constructor(
        gameSession: BusGameSession,
        private callbacks: BuildingPlacementAnimatorCallbacks
    ) {
        super(gameSession)
    }

    setBuildingElement(siteId: BuildingSiteId, element?: HTMLElement | SVGElement): void {
        if (!element) {
            this.buildingElements.delete(siteId)
            return
        }
        this.buildingElements.set(siteId, element)
    }

    private placedBuildingsBySite(state: HydratedBusGameState): Map<BuildingSiteId, Building> {
        return new Map(
            Object.values(state.board.buildings)
                .filter((building) => isSiteId(building.site))
                .map((building) => [building.site as BuildingSiteId, building] as const)
        )
    }

    override async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedBusGameState
        from?: HydratedBusGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) {
            return
        }

        const fromBySite = this.placedBuildingsBySite(from)
        const toBySite = this.placedBuildingsBySite(to)

        const hasPlaceBuildingAction = !!action && isPlaceBuilding(action) && isSiteId(action.siteId)
        const placementPopDuration = hasPlaceBuildingAction ? 0.18 : FALLBACK_POP_DURATION
        const placementSettleDuration = hasPlaceBuildingAction ? 0.14 : FALLBACK_SETTLE_DURATION
        const removalPopDuration = hasPlaceBuildingAction ? 0.12 : FALLBACK_REMOVAL_POP_DURATION
        const removalShrinkDuration = hasPlaceBuildingAction
            ? 0.2
            : FALLBACK_REMOVAL_SHRINK_DURATION

        for (const [siteId] of fromBySite) {
            if (toBySite.has(siteId)) {
                continue
            }

            const element = this.buildingElements.get(siteId)
            if (!element) {
                continue
            }

            gsap.set(element, {
                transformOrigin: 'center center',
                scale: 1,
                opacity: 1
            })
            animationContext.actionTimeline.to(
                element,
                {
                    scale: 1.1,
                    duration: removalPopDuration,
                    ease: 'power1.out'
                },
                0
            )

            animationContext.actionTimeline.to(
                element,
                {
                    scale: 0.2,
                    opacity: 0,
                    duration: removalShrinkDuration,
                    ease: 'power2.in'
                },
                removalPopDuration
            )
        }

        const placementsToAnimate: { siteId: BuildingSiteId; buildingType: BuildingType }[] = []
        for (const [siteId, building] of toBySite) {
            if (fromBySite.has(siteId)) {
                continue
            }
            placementsToAnimate.push({
                siteId,
                buildingType: building.type
            })
            this.callbacks.onPlacementStart({
                siteId,
                buildingType: building.type
            })
        }

        if (placementsToAnimate.length === 0) {
            return
        }

        // Wait for transient building nodes to mount before targeting them.
        await tick()

        for (const placement of placementsToAnimate) {
            const element = this.buildingElements.get(placement.siteId)
            if (!element) {
                continue
            }

            gsap.set(element, {
                transformOrigin: 'center center',
                scale: INITIAL_SCALE,
                opacity: 1
            })

            animationContext.actionTimeline.to(
                element,
                {
                    scale: POP_OVERSHOOT_SCALE,
                    duration: placementPopDuration,
                    ease: 'back.out(2.2)'
                },
                0
            )

            animationContext.actionTimeline.to(
                element,
                {
                    scale: 1,
                    duration: placementSettleDuration,
                    ease: 'power2.out'
                },
                placementPopDuration
            )
        }
    }
}

export function animatePlacedBuilding(
    node: HTMLElement | SVGElement,
    params: { animator: BuildingPlacementAnimator; siteId: BuildingSiteId }
): {
    update: (next: { animator: BuildingPlacementAnimator; siteId: BuildingSiteId }) => void
    destroy: () => void
} {
    let currentSiteId = params.siteId
    params.animator.setBuildingElement(currentSiteId, node)

    return {
        update(next) {
            if (next.siteId === currentSiteId) {
                return
            }

            next.animator.setBuildingElement(currentSiteId, undefined)
            currentSiteId = next.siteId
            next.animator.setBuildingElement(currentSiteId, node)
        },
        destroy() {
            params.animator.setBuildingElement(currentSiteId, undefined)
        }
    }
}
