import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import {
    type HydratedIndonesiaGameState,
    type GrowCity,
    isGrowCity,
    isPlaceCity,
    type IndonesiaGameState
} from '@tabletop/indonesia'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { IndonesiaGameSession } from '$lib/model/session.svelte.js'

type BeadTone = 'amber' | 'green' | 'red'

type AnimatedCityMarker = {
    areaId: string
    tone: BeadTone
}

type CityPlacementAnimatorCallbacks = {
    showAnimatedCityMarkers: (markers: AnimatedCityMarker[]) => void
    clearAnimatedCityMarkers: () => void
}

const INITIAL_SCALE = 0.2
const POP_OVERSHOOT_SCALE = 1.16
const FALLBACK_POP_DURATION = 0.1
const FALLBACK_SETTLE_DURATION = 0.08

export class CityPlacementAnimator {
    private cityElements = new Map<string, HTMLElement | SVGElement>()
    private registered = false
    private readonly onGameStateChangeHandler: ({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }) => Promise<void>

    constructor(
        private gameSession: IndonesiaGameSession,
        private callbacks: CityPlacementAnimatorCallbacks
    ) {
        this.onGameStateChangeHandler = this.onGameStateChange.bind(this)
    }

    setCityElement(areaId: string, element: HTMLElement | SVGElement): void {
        this.cityElements.set(areaId, element)
    }

    clearCityElement(areaId: string, element: HTMLElement | SVGElement): void {
        if (this.cityElements.get(areaId) !== element) {
            return
        }

        this.cityElements.delete(areaId)
    }

    register(): void {
        if (this.registered) {
            return
        }

        this.gameSession.addGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = true
    }

    unregister(): void {
        if (!this.registered) {
            return
        }

        this.gameSession.removeGameStateChangeListener(this.onGameStateChangeHandler)
        this.registered = false
    }

    private beadToneForCitySize(size: number): BeadTone {
        if (size === 1) {
            return 'amber'
        }
        if (size === 2) {
            return 'green'
        }
        return 'red'
    }

    async onGameStateChange({
        to,
        from,
        action,
        animationContext
    }: {
        to: HydratedIndonesiaGameState
        from?: HydratedIndonesiaGameState
        action?: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!from) {
            return
        }

        const fromCityByAreaId = new Map(from.board.cities.map((city) => [city.area, city] as const))
        const placementsToAnimate: AnimatedCityMarker[] = to.board.cities
            .filter((city) => !fromCityByAreaId.has(city.area))
            .map((city) => ({
                areaId: city.area,
                tone: this.beadToneForCitySize(city.size)
            }))
        const growthsToAnimate = this.growthCityMarkersToAnimate(action, from, to)
        const cityMarkersToAnimate = [...placementsToAnimate, ...growthsToAnimate]

        const hasCityAction = !!action && (isPlaceCity(action) || isGrowCity(action))
        if (cityMarkersToAnimate.length === 0) {
            return
        }

        if (hasCityAction) {
            animationContext.ensureDuration(0.75)
        }

        const placementPopDuration = hasCityAction ? 0.18 : FALLBACK_POP_DURATION
        const placementSettleDuration = hasCityAction ? 0.14 : FALLBACK_SETTLE_DURATION

        this.callbacks.showAnimatedCityMarkers(cityMarkersToAnimate)
        animationContext.afterAnimations(() => {
            this.callbacks.clearAnimatedCityMarkers()
        })

        await tick()

        for (const marker of cityMarkersToAnimate) {
            const element = this.cityElements.get(marker.areaId)
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

    private growthCityMarkersToAnimate(
        action: GameAction | undefined,
        from: HydratedIndonesiaGameState,
        to: HydratedIndonesiaGameState
    ): Array<{ areaId: string; tone: BeadTone }> {
        if (action && isGrowCity(action)) {
            const growCityAction = action as GrowCity
            if (
                growCityAction.metadata &&
                growCityAction.metadata.newSize !== growCityAction.metadata.oldSize
            ) {
                const grownCity = to.board.cities.find((city) => city.id === growCityAction.cityId)
                if (grownCity) {
                    return [
                        {
                            areaId: grownCity.area,
                            tone: this.beadToneForCitySize(grownCity.size)
                        }
                    ]
                }
            }
        }

        const fromCityByAreaId = new Map(from.board.cities.map((city) => [city.area, city] as const))
        return to.board.cities
            .filter((city) => {
                const priorCity = fromCityByAreaId.get(city.area)
                return priorCity !== undefined && priorCity.size !== city.size
            })
            .map((city) => ({
                areaId: city.area,
                tone: this.beadToneForCitySize(city.size)
            }))
    }
}

export function attachCityPlacementAnimator(
    animator: CityPlacementAnimator
): (element: HTMLElement | SVGElement) => () => void {
    return (element: HTMLElement | SVGElement) => {
        untrack(() => {
            animator.register()
        })

        return () => {
            animator.unregister()
        }
    }
}

export function animatePlacedCity(
    node: HTMLElement | SVGElement,
    params: { animator: CityPlacementAnimator; areaId: string }
): {
    update: (next: { animator: CityPlacementAnimator; areaId: string }) => void
    destroy: () => void
} {
    let currentAreaId = params.areaId
    params.animator.setCityElement(currentAreaId, node)

    return {
        update(next) {
            if (next.areaId === currentAreaId) {
                return
            }

            next.animator.clearCityElement(currentAreaId, node)
            currentAreaId = next.areaId
            next.animator.setCityElement(currentAreaId, node)
        },
        destroy() {
            params.animator.clearCityElement(currentAreaId, node)
        }
    }
}
