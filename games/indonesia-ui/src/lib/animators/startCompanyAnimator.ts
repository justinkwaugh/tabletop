import type { GameAction } from '@tabletop/common'
import type { AnimationContext } from '@tabletop/frontend-components'
import { CompanyType, isExpand, isStartCompany, type HydratedIndonesiaGameState } from '@tabletop/indonesia'
import { gsap } from 'gsap'
import { tick, untrack } from 'svelte'
import type { IndonesiaGameSession } from '$lib/model/session.svelte.js'
import {
    expandedShipMarkerEntryForAction,
    startedShipMarkerEntryForAction
} from '$lib/utils/startedCompanyEntries.js'

const DEED_EXIT_DURATION = 0.14
const MARKER_POP_DURATION = 0.18
const MARKER_SETTLE_DURATION = 0.12
const CONNECTOR_FADE_DURATION = 0.12
const CULTIVATED_AREA_POP_DURATION = 0.18
const CULTIVATED_AREA_SETTLE_DURATION = 0.12
const SHIP_RELAYOUT_DURATION = 0.18
const INITIAL_MARKER_SCALE = 0.2
const MARKER_OVERSHOOT_SCALE = 1.14
const INITIAL_CULTIVATED_AREA_SCALE = 0.82
const CULTIVATED_AREA_OVERSHOOT_SCALE = 1.04

export class StartCompanyAnimator {
    private deedElements = new Map<string, HTMLElement | SVGElement>()
    private cultivatedAreaElements = new Map<string, HTMLElement | SVGElement>()
    private productionMarkerElements = new Map<string, HTMLElement | SVGElement>()
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

    setDeedElement(deedId: string, element: HTMLElement | SVGElement): void {
        this.deedElements.set(deedId, element)
    }

    clearDeedElement(deedId: string, element: HTMLElement | SVGElement): void {
        if (this.deedElements.get(deedId) !== element) {
            return
        }
        this.deedElements.delete(deedId)
    }

    setProductionMarkerElement(companyId: string, element: HTMLElement | SVGElement): void {
        this.productionMarkerElements.set(companyId, element)
    }

    clearProductionMarkerElement(companyId: string, element: HTMLElement | SVGElement): void {
        if (this.productionMarkerElements.get(companyId) !== element) {
            return
        }
        this.productionMarkerElements.delete(companyId)
    }

    setCultivatedAreaElement(companyId: string, element: HTMLElement | SVGElement): void {
        this.cultivatedAreaElements.set(companyId, element)
    }

    clearCultivatedAreaElement(companyId: string, element: HTMLElement | SVGElement): void {
        if (this.cultivatedAreaElements.get(companyId) !== element) {
            return
        }
        this.cultivatedAreaElements.delete(companyId)
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

        if (isStartCompany(action) && action.metadata?.company) {
            await this.animateStartCompany({
                from,
                action,
                animationContext
            })
            return
        }

        if (isExpand(action)) {
            await this.animateExpand({
                from,
                action,
                animationContext
            })
        }
    }

    private async animateStartCompany({
        from,
        action,
        animationContext
    }: {
        from: HydratedIndonesiaGameState
        action: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!isStartCompany(action) || !action.metadata?.company) {
            return
        }

        this.gameSession.rememberStartedCompanyAnimation(action)

        await tick()

        const deedElement = this.deedElements.get(action.deedId)
        if (deedElement) {
            gsap.set(deedElement, {
                transformOrigin: 'center center',
                scale: 1,
                opacity: 1
            })

            animationContext.actionTimeline.to(
                deedElement,
                {
                    scale: 0.22,
                    opacity: 0,
                    duration: DEED_EXIT_DURATION,
                    ease: 'power2.in'
                },
                0
            )
        }

        const company = action.metadata.company
        animationContext.afterAnimations(() => {
            this.gameSession.clearStartedCompanyAnimation(action.id)
        })
        const markerElement =
            company.type === CompanyType.Production
                ? this.productionMarkerElements.get(company.id)
                : null

        if (company.type === CompanyType.Shipping) {
            const shipEntries = startedShipMarkerEntryForAction({
                gameState: from,
                action,
                ownerColorForPlayerId: (playerId) => this.gameSession.colors.getPlayerUiColor(playerId),
                ownerPlayerColorForPlayerId: (playerId) =>
                    this.gameSession.colors.getPlayerColor(playerId)
            })
            const moveEntries = shipEntries.filter((entry) => entry.animationRole === 'move')
            const popEntries = shipEntries.filter((entry) => entry.animationRole === 'pop')

            for (const entry of moveEntries) {
                const shipElement = this.shipMarkerElements.get(entry.animationKey)
                if (!shipElement) {
                    continue
                }
                gsap.set(shipElement, {
                    x: entry.fromX,
                    y: entry.fromY,
                    opacity: 1,
                    scale: 1
                })
                animationContext.actionTimeline.to(
                    shipElement,
                    {
                        x: entry.toX,
                        y: entry.toY,
                        duration: SHIP_RELAYOUT_DURATION,
                        ease: 'power2.inOut'
                    },
                    DEED_EXIT_DURATION
                )
            }

            for (const entry of popEntries) {
                const shipElement = this.shipMarkerElements.get(entry.animationKey)
                if (!shipElement) {
                    continue
                }
                gsap.set(shipElement, {
                    x: entry.toX,
                    y: entry.toY,
                    opacity: 0,
                    scale: INITIAL_MARKER_SCALE,
                    transformOrigin: 'center center'
                })
                animationContext.actionTimeline.to(
                    shipElement,
                    {
                        scale: MARKER_OVERSHOOT_SCALE,
                        opacity: 1,
                        duration: MARKER_POP_DURATION,
                        ease: 'back.out(2.2)'
                    },
                    DEED_EXIT_DURATION + SHIP_RELAYOUT_DURATION
                )
                animationContext.actionTimeline.to(
                    shipElement,
                    {
                        scale: 1,
                        duration: MARKER_SETTLE_DURATION,
                        ease: 'power2.out'
                    },
                    DEED_EXIT_DURATION + SHIP_RELAYOUT_DURATION + MARKER_POP_DURATION
                )
            }
            return
        }

        if (!markerElement) {
            return
        }

        if (company.type === CompanyType.Production) {
            const cultivatedAreaElement = this.cultivatedAreaElements.get(company.id)
            const bodyElement = markerElement.querySelector('.company-zone-marker__body')
            const connectorElement = markerElement.querySelector('.company-zone-marker__connector')
            gsap.set(markerElement, { opacity: 1 })

            if (cultivatedAreaElement) {
                gsap.set(cultivatedAreaElement, {
                    transformOrigin: '0px 0px',
                    opacity: 0,
                    scale: INITIAL_CULTIVATED_AREA_SCALE
                })

                animationContext.actionTimeline.to(
                    cultivatedAreaElement,
                    {
                        opacity: 1,
                        scale: CULTIVATED_AREA_OVERSHOOT_SCALE,
                        duration: CULTIVATED_AREA_POP_DURATION,
                        ease: 'power2.out'
                    },
                    DEED_EXIT_DURATION
                )

                animationContext.actionTimeline.to(
                    cultivatedAreaElement,
                    {
                        scale: 1,
                        duration: CULTIVATED_AREA_SETTLE_DURATION,
                        ease: 'power2.out'
                    },
                    DEED_EXIT_DURATION + CULTIVATED_AREA_POP_DURATION
                )
            }

            if (bodyElement) {
                gsap.set(bodyElement, {
                    transformOrigin: 'center center',
                    scale: INITIAL_MARKER_SCALE,
                    opacity: 0
                })

                animationContext.actionTimeline.to(
                    bodyElement,
                    {
                        scale: MARKER_OVERSHOOT_SCALE,
                        opacity: 1,
                        duration: MARKER_POP_DURATION,
                        ease: 'back.out(2.2)'
                    },
                    DEED_EXIT_DURATION
                )

                animationContext.actionTimeline.to(
                    bodyElement,
                    {
                        scale: 1,
                        duration: MARKER_SETTLE_DURATION,
                        ease: 'power2.out'
                    },
                    DEED_EXIT_DURATION + MARKER_POP_DURATION
                )
            }

            if (connectorElement) {
                gsap.set(connectorElement, { opacity: 0 })
                animationContext.actionTimeline.to(
                    connectorElement,
                    {
                        opacity: 1,
                        duration: CONNECTOR_FADE_DURATION,
                        ease: 'power1.out'
                    },
                    DEED_EXIT_DURATION + MARKER_POP_DURATION + MARKER_SETTLE_DURATION * 0.35
                )
            }
            return
        }

        gsap.set(markerElement, {
            transformOrigin: 'center center',
            scale: INITIAL_MARKER_SCALE,
            opacity: 0
        })

        animationContext.actionTimeline.to(
            markerElement,
            {
                scale: MARKER_OVERSHOOT_SCALE,
                opacity: 1,
                duration: MARKER_POP_DURATION,
                ease: 'back.out(2.2)'
            },
            DEED_EXIT_DURATION
        )

        animationContext.actionTimeline.to(
            markerElement,
            {
                scale: 1,
                duration: MARKER_SETTLE_DURATION,
                ease: 'power2.out'
            },
            DEED_EXIT_DURATION + MARKER_POP_DURATION
        )
    }

    private async animateExpand({
        from,
        action,
        animationContext
    }: {
        from: HydratedIndonesiaGameState
        action: GameAction
        animationContext: AnimationContext
    }): Promise<void> {
        if (!isExpand(action)) {
            return
        }

        const operatingCompanyId = from.operatingCompanyId
        if (!operatingCompanyId) {
            return
        }

        const operatingCompany = from.companies.find((company) => company.id === operatingCompanyId)
        if (!operatingCompany) {
            return
        }

        this.gameSession.rememberExpandAnimation(action)

        await tick()

        animationContext.afterAnimations(() => {
            this.gameSession.clearExpandAnimation(action.id)
        })

        if (operatingCompany.type === CompanyType.Production) {
            const cultivatedAreaElement = this.cultivatedAreaElements.get(operatingCompany.id)
            if (!cultivatedAreaElement) {
                return
            }

            gsap.set(cultivatedAreaElement, {
                transformOrigin: '0px 0px',
                opacity: 0,
                scale: INITIAL_CULTIVATED_AREA_SCALE
            })

            animationContext.actionTimeline.to(
                cultivatedAreaElement,
                {
                    opacity: 1,
                    scale: CULTIVATED_AREA_OVERSHOOT_SCALE,
                    duration: CULTIVATED_AREA_POP_DURATION,
                    ease: 'power2.out'
                },
                0
            )

            animationContext.actionTimeline.to(
                cultivatedAreaElement,
                {
                    scale: 1,
                    duration: CULTIVATED_AREA_SETTLE_DURATION,
                    ease: 'power2.out'
                },
                CULTIVATED_AREA_POP_DURATION
            )
            return
        }

        if (operatingCompany.type !== CompanyType.Shipping) {
            return
        }

        const shipEntries = expandedShipMarkerEntryForAction({
            gameState: from,
            action,
            ownerColorForPlayerId: (playerId) => this.gameSession.colors.getPlayerUiColor(playerId),
            ownerPlayerColorForPlayerId: (playerId) => this.gameSession.colors.getPlayerColor(playerId)
        })
        const moveEntries = shipEntries.filter((entry) => entry.animationRole === 'move')
        const popEntries = shipEntries.filter((entry) => entry.animationRole === 'pop')

        for (const entry of moveEntries) {
            const shipElement = this.shipMarkerElements.get(entry.animationKey)
            if (!shipElement) {
                continue
            }

            gsap.set(shipElement, {
                x: entry.fromX,
                y: entry.fromY,
                opacity: 1,
                scale: 1
            })

            animationContext.actionTimeline.to(
                shipElement,
                {
                    x: entry.toX,
                    y: entry.toY,
                    duration: SHIP_RELAYOUT_DURATION,
                    ease: 'power2.inOut'
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
                x: entry.toX,
                y: entry.toY,
                opacity: 0,
                scale: INITIAL_MARKER_SCALE,
                transformOrigin: 'center center'
            })

            animationContext.actionTimeline.to(
                shipElement,
                {
                    scale: MARKER_OVERSHOOT_SCALE,
                    opacity: 1,
                    duration: MARKER_POP_DURATION,
                    ease: 'back.out(2.2)'
                },
                SHIP_RELAYOUT_DURATION
            )

            animationContext.actionTimeline.to(
                shipElement,
                {
                    scale: 1,
                    duration: MARKER_SETTLE_DURATION,
                    ease: 'power2.out'
                },
                SHIP_RELAYOUT_DURATION + MARKER_POP_DURATION
            )
        }
    }
}

export function attachStartCompanyAnimator(
    animator: StartCompanyAnimator
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

export function animateStartedCompanyDeed(
    node: HTMLElement | SVGElement,
    params: { animator: StartCompanyAnimator; deedId: string }
): {
    update: (next: { animator: StartCompanyAnimator; deedId: string }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentDeedId = params.deedId
    currentAnimator.setDeedElement(currentDeedId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.deedId === currentDeedId) {
                return
            }

            currentAnimator.clearDeedElement(currentDeedId, node)
            currentAnimator = next.animator
            currentDeedId = next.deedId
            currentAnimator.setDeedElement(currentDeedId, node)
        },
        destroy() {
            currentAnimator.clearDeedElement(currentDeedId, node)
        }
    }
}

export function animateStartedProductionMarker(
    node: HTMLElement | SVGElement,
    params: { animator: StartCompanyAnimator; companyId: string }
): {
    update: (next: { animator: StartCompanyAnimator; companyId: string }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentCompanyId = params.companyId
    currentAnimator.setProductionMarkerElement(currentCompanyId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.companyId === currentCompanyId) {
                return
            }

            currentAnimator.clearProductionMarkerElement(currentCompanyId, node)
            currentAnimator = next.animator
            currentCompanyId = next.companyId
            currentAnimator.setProductionMarkerElement(currentCompanyId, node)
        },
        destroy() {
            currentAnimator.clearProductionMarkerElement(currentCompanyId, node)
        }
    }
}

export function animateStartedCultivatedArea(
    node: HTMLElement | SVGElement,
    params: { animator: StartCompanyAnimator; companyId: string }
): {
    update: (next: { animator: StartCompanyAnimator; companyId: string }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentCompanyId = params.companyId
    currentAnimator.setCultivatedAreaElement(currentCompanyId, node)

    return {
        update(next) {
            if (next.animator === currentAnimator && next.companyId === currentCompanyId) {
                return
            }

            currentAnimator.clearCultivatedAreaElement(currentCompanyId, node)
            currentAnimator = next.animator
            currentCompanyId = next.companyId
            currentAnimator.setCultivatedAreaElement(currentCompanyId, node)
        },
        destroy() {
            currentAnimator.clearCultivatedAreaElement(currentCompanyId, node)
        }
    }
}

export function animateStartedShipMarker(
    node: HTMLElement | SVGElement,
    params: {
        animator: StartCompanyAnimator
        animationKey: string
        fromX: number
        fromY: number
        toX: number
        toY: number
        role: 'move' | 'pop'
    }
): {
    update: (next: {
        animator: StartCompanyAnimator
        animationKey: string
        fromX: number
        fromY: number
        toX: number
        toY: number
        role: 'move' | 'pop'
    }) => void
    destroy: () => void
} {
    let currentAnimator = params.animator
    let currentAnimationKey = params.animationKey
    let currentParams = params
    currentAnimator.setShipMarkerElement(currentAnimationKey, node)

    gsap.set(node, {
        x: currentParams.fromX,
        y: currentParams.fromY
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
            scale: 1
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
