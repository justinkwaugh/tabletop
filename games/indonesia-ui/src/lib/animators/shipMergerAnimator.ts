import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { CompanyType, isMergeCompanies, type HydratedIndonesiaGameState } from '@tabletop/indonesia'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import { mergedShipMarkerEntriesForAction } from '$lib/utils/mergedShipMarkerEntries.js'

const SHIP_EXIT_DURATION = 0.14
const SHIP_POP_DURATION = 0.18
const SHIP_SETTLE_DURATION = 0.12
const INITIAL_MARKER_SCALE = 0.2
const MARKER_OVERSHOOT_SCALE = 1.14

export class ShipMergerAnimator {
    private shipMarkerElements = new Map<string, HTMLElement | SVGElement>()
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

    constructor(private gameSession: IndonesiaGameSession) {
        this.onGameStateChangeHandler = this.onGameStateChange.bind(this)
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

    setShipMarkerElement(animationKey: string, element: HTMLElement | SVGElement): void {
        this.shipMarkerElements.set(animationKey, element)
    }

    clearShipMarkerElement(animationKey: string, element: HTMLElement | SVGElement): void {
        if (this.shipMarkerElements.get(animationKey) !== element) {
            return
        }
        this.shipMarkerElements.delete(animationKey)
    }

    private async onGameStateChange({
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
        if (!from || !action) {
            return
        }
        if (!isMergeCompanies(action) || action.metadata?.proposal.companyType !== CompanyType.Shipping) {
            return
        }

        const shipEntries = mergedShipMarkerEntriesForAction({
            from,
            to,
            action,
            ownerColorForPlayerId: (playerId) => this.gameSession.colors.getPlayerUiColor(playerId),
            ownerPlayerColorForPlayerId: (playerId) =>
                this.gameSession.colors.getPlayerColor(playerId)
        })
        if (shipEntries.length === 0) {
            return
        }

        this.gameSession.rememberShippingMergeAnimation(action.id, to.actionCount, shipEntries)
        animationContext.ensureDuration(0.75)

        await tick()

        const exitEntries = shipEntries.filter((entry) => entry.animationRole === 'exit')
        const popEntries = shipEntries.filter((entry) => entry.animationRole === 'pop')

        for (const entry of exitEntries) {
            const shipElement = this.shipMarkerElements.get(entry.animationKey)
            if (!shipElement) {
                continue
            }

            gsap.set(shipElement, {
                x: entry.x,
                y: entry.y,
                opacity: 1,
                scale: 1,
                transformOrigin: 'center center'
            })

            animationContext.actionTimeline.to(
                shipElement,
                {
                    scale: 0.22,
                    opacity: 0,
                    duration: SHIP_EXIT_DURATION,
                    ease: 'power2.in'
                },
                0
            )
        }

        for (const entry of popEntries) {
            const shipElement = this.shipMarkerElements.get(entry.animationKey)
            if (!shipElement) {
                continue
            }

            gsap.set(shipElement, {
                x: entry.x,
                y: entry.y,
                opacity: 0,
                scale: INITIAL_MARKER_SCALE,
                transformOrigin: 'center center'
            })

            animationContext.actionTimeline.to(
                shipElement,
                {
                    scale: MARKER_OVERSHOOT_SCALE,
                    opacity: 1,
                    duration: SHIP_POP_DURATION,
                    ease: 'back.out(2.2)'
                },
                SHIP_EXIT_DURATION
            )

            animationContext.actionTimeline.to(
                shipElement,
                {
                    scale: 1,
                    duration: SHIP_SETTLE_DURATION,
                    ease: 'power2.out'
                },
                SHIP_EXIT_DURATION + SHIP_POP_DURATION
            )
        }
    }
}

export function attachShipMergerAnimator(
    animator: ShipMergerAnimator
): (element: HTMLElement | SVGElement) => () => void {
    return (_element: HTMLElement | SVGElement) => {
        untrack(() => {
            animator.register()
        })

        return () => {
            animator.unregister()
        }
    }
}

export function animateMergedShipMarker(
    node: HTMLElement | SVGElement,
    params: {
        animator: ShipMergerAnimator
        animationKey: string
        x: number
        y: number
        role: 'exit' | 'pop'
    }
): {
    update: (next: {
        animator: ShipMergerAnimator
        animationKey: string
        x: number
        y: number
        role: 'exit' | 'pop'
    }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentAnimationKey = params.animationKey
    let currentParams = params
    currentAnimator.setShipMarkerElement(currentAnimationKey, node)

    gsap.set(node, {
        x: currentParams.x,
        y: currentParams.y
    })

    if (currentParams.role === 'pop') {
        gsap.set(node, {
            opacity: 0,
            scale: INITIAL_MARKER_SCALE,
            transformOrigin: 'center center'
        })
    } else {
        gsap.set(node, {
            opacity: 1,
            scale: 1,
            transformOrigin: 'center center'
        })
    }

    return {
        update(next) {
            if (next.animator === currentAnimator && next.animationKey === currentAnimationKey) {
                return
            }

            currentAnimator.clearShipMarkerElement(currentAnimationKey, node)
            currentAnimator = next.animator
            currentAnimationKey = next.animationKey
            currentParams = next
            currentAnimator.setShipMarkerElement(currentAnimationKey, node)
        },
        destroy() {
            currentAnimator.clearShipMarkerElement(currentAnimationKey, node)
        }
    }
}
